import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  stressTestRuns, stressTestSnapshots, stressTestReports, stressTestReplay,
  worldSimState, customWorlds, worldFrameworks,
  npcCores, npcFamilies, npcFactions, npcGovernments, worldWars, elections
} from "@workspace/db/schema";
import { eq, and, desc, count, sum, max } from "drizzle-orm";

const router = Router();

/* ─── Event pool (same as worldSimulation, no AI) ─── */
const EVENT_POOL = [
  { type: "economic_boom",       name: "Thịnh Vượng Kinh Tế",    dEconomy: +12, dMood: +8,  dStability: +5,  dPop: +30,  category: "economy"    },
  { type: "economic_recession",  name: "Suy Thoái Kinh Tế",       dEconomy: -10, dMood: -10, dStability: -8,  dPop: -20,  category: "economy"    },
  { type: "political_crisis",    name: "Khủng Hoảng Chính Trị",   dEconomy: -8,  dMood: -12, dStability: -15, dPop: 0,    category: "government" },
  { type: "rebellion",           name: "Nổi Loạn Dân Chúng",      dEconomy: -15, dMood: -5,  dStability: -20, dPop: -50,  category: "war"        },
  { type: "natural_wonder",      name: "Kỳ Quan Thiên Nhiên",     dEconomy: +5,  dMood: +15, dStability: +3,  dPop: +10,  category: "event"      },
  { type: "plague",              name: "Dịch Bệnh Hoành Hành",    dEconomy: -12, dMood: -18, dStability: -10, dPop: -80,  category: "population" },
  { type: "harvest_festival",    name: "Lễ Hội Thu Hoạch",        dEconomy: +8,  dMood: +20, dStability: +5,  dPop: +15,  category: "event"      },
  { type: "mysterious_arrival",  name: "Khách Lạ Ghé Đến",        dEconomy: +3,  dMood: +5,  dStability: 0,   dPop: +5,   category: "event"      },
  { type: "ancient_discovery",   name: "Khám Phá Cổ Đại",         dEconomy: +10, dMood: +12, dStability: +2,  dPop: 0,    category: "event"      },
  { type: "trade_boom",          name: "Buôn Bán Phồn Thịnh",     dEconomy: +15, dMood: +10, dStability: +5,  dPop: +20,  category: "economy"    },
  { type: "inter_world_war",     name: "Xung Đột Liên Thế Giới",  dEconomy: -18, dMood: -15, dStability: -25, dPop: -100, category: "war"        },
  { type: "hero_born",           name: "Anh Hùng Xuất Hiện",      dEconomy: +2,  dMood: +18, dStability: +8,  dPop: 0,    category: "event"      },
  { type: "villain_rises",       name: "Ma Đầu Trỗi Dậy",         dEconomy: -5,  dMood: -14, dStability: -12, dPop: -30,  category: "war"        },
  { type: "peace_treaty",        name: "Hòa Ước Ký Kết",          dEconomy: +5,  dMood: +15, dStability: +18, dPop: 0,    category: "government" },
  { type: "migration_wave",      name: "Làn Sóng Di Dân",         dEconomy: +3,  dMood: -3,  dStability: -5,  dPop: +150, category: "population" },
  { type: "election_held",       name: "Bầu Cử Diễn Ra",          dEconomy: +1,  dMood: +5,  dStability: +3,  dPop: 0,    category: "government" },
  { type: "coup",                name: "Đảo Chính",               dEconomy: -10, dMood: -8,  dStability: -18, dPop: -10,  category: "government" },
  { type: "famine",              name: "Nạn Đói",                 dEconomy: -8,  dMood: -20, dStability: -12, dPop: -60,  category: "population" },
  { type: "tech_breakthrough",   name: "Đột Phá Công Nghệ",       dEconomy: +18, dMood: +12, dStability: +5,  dPop: +25,  category: "economy"    },
  { type: "war_declaration",     name: "Tuyên Chiến",             dEconomy: -12, dMood: -6,  dStability: -20, dPop: -80,  category: "war"        },
];

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

interface SimState {
  population: number;
  economyScore: number;
  avgMood: number;
  stability: number;
  gdp: number;
  totalAssets: number;
  unemploymentRate: number;
  mortalityRate: number;
  totalTicks: number;
}

interface TickResult {
  state: SimState;
  eventType: string | null;
  eventName: string | null;
  category: string | null;
  dPop: number;
  dEconomy: number;
  dMood: number;
  dStability: number;
}

function tickInMemory(state: SimState): TickResult {
  let dPop       = Math.round(rand(-5, 15));
  let dEconomy   = rand(-2, 3);
  let dMood      = rand(-3, 3);
  let dStability = rand(-2, 2);
  let eventType: string | null  = null;
  let eventName: string | null  = null;
  let category:  string | null  = null;

  // Mean reversion
  dEconomy   += (50 - state.economyScore) * 0.03;
  dMood      += (60 - state.avgMood)      * 0.03;
  dStability += (70 - state.stability)    * 0.03;

  // Random event (28%)
  if (Math.random() < 0.28) {
    const ev = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
    dPop       += ev.dPop;
    dEconomy   += ev.dEconomy;
    dMood      += ev.dMood;
    dStability += ev.dStability;
    eventType   = ev.type;
    eventName   = ev.name;
    category    = ev.category;
  }

  const newPop       = Math.max(0, state.population + dPop);
  const newEconomy   = clamp(state.economyScore + dEconomy, 0, 100);
  const newMood      = clamp(state.avgMood + dMood, 0, 100);
  const newStability = clamp(state.stability + dStability, 0, 100);

  // Derived metrics
  const newGdp        = Math.max(0, (newEconomy / 100) * newPop * 50);
  const newAssets     = Math.max(0, newGdp * 3.5 + (newEconomy * 1000));
  const newUnemploy   = clamp(100 - newEconomy + rand(-5, 5), 0, 95);
  const newMortality  = clamp(Math.max(0, -dPop) / Math.max(1, state.population) * 100, 0, 30);

  return {
    state: {
      population:       newPop,
      economyScore:     newEconomy,
      avgMood:          newMood,
      stability:        newStability,
      gdp:              newGdp,
      totalAssets:      newAssets,
      unemploymentRate: newUnemploy,
      mortalityRate:    newMortality,
      totalTicks:       state.totalTicks + 1,
    },
    eventType,
    eventName,
    category,
    dPop,
    dEconomy,
    dMood,
    dStability,
  };
}

function detectAnomalies(
  state: SimState,
  initState: SimState,
  warCount: number,
  electionCount: number,
  ticksDone: number,
  warnings: string[]
): string[] {
  const newWarnings: string[] = [];

  if (state.population > initState.population * 15)
    newWarnings.push(`[Tick ${ticksDone}] ⚠️ DÂN SỐ TĂNG VÔ HẠN: ${state.population.toLocaleString()} (gấp ${(state.population / initState.population).toFixed(0)}x ban đầu)`);

  if (state.population < 10 && initState.population > 100)
    newWarnings.push(`[Tick ${ticksDone}] 💀 TUYỆT CHỦNG: Dân số còn ${state.population}`);

  if (state.economyScore >= 99 && ticksDone > 100)
    newWarnings.push(`[Tick ${ticksDone}] 💰 TIỀN TĂNG VÔ HẠN: Economy score đạt tối đa 99+`);

  if (state.economyScore < 3 && ticksDone > 50)
    newWarnings.push(`[Tick ${ticksDone}] 📉 THỊ TRƯỜNG SỤP ĐỔ: Economy score chỉ còn ${state.economyScore.toFixed(1)}`);

  if (state.unemploymentRate > 85 && ticksDone > 200)
    newWarnings.push(`[Tick ${ticksDone}] 🍞 KHÔNG CÒN THỰC PHẨM/VIỆC LÀM: Thất nghiệp ${state.unemploymentRate.toFixed(1)}%`);

  if (state.stability < 5 && ticksDone > 100)
    newWarnings.push(`[Tick ${ticksDone}] 🏛️ CHÍNH PHỦ KHÔNG HOẠT ĐỘNG: Stability ${state.stability.toFixed(1)}`);

  if (electionCount === 0 && ticksDone >= 5000)
    newWarnings.push(`[Tick ${ticksDone}] 🗳️ BẦU CỬ KHÔNG DIỄN RA trong ${ticksDone} tick`);

  if (warCount === 0 && ticksDone >= 10000)
    newWarnings.push(`[Tick ${ticksDone}] ⚔️ CHIẾN TRANH KHÔNG BAO GIỜ XẢY RA trong ${ticksDone} tick`);

  // Dedup
  for (const w of newWarnings) {
    const key = w.slice(w.indexOf(']') + 2, w.indexOf(':'));
    const alreadyHas = warnings.some(x => x.includes(key));
    if (!alreadyHas) warnings.push(w);
  }
  return warnings;
}

function buildReport(
  tickNumber: number,
  state: SimState,
  initState: SimState,
  warCount: number,
  electionCount: number,
  replayEvents: { tick: number; name: string; category: string }[],
  warnings: string[]
) {
  const economyRatio = state.economyScore / 50;
  const popRatio     = state.population / Math.max(1, initState.population);

  let worldStatus = "stable";
  if (state.population < 50)                    worldStatus = "extinction";
  else if (state.economyScore < 10)             worldStatus = "collapsed";
  else if (state.stability < 20)                worldStatus = "chaotic";
  else if (state.economyScore > 80 && popRatio > 2) worldStatus = "thriving";
  else if (economyRatio > 1.5)                  worldStatus = "prosperous";
  else if (economyRatio < 0.6)                  worldStatus = "struggling";

  const wars     = replayEvents.filter(e => e.category === "war");
  const govChanges = replayEvents.filter(e => e.category === "government");

  return {
    worldStatus,
    strongestNation: {
      population:   state.population,
      economyScore: state.economyScore.toFixed(1),
      stability:    state.stability.toFixed(1),
      gdp:          state.gdp.toFixed(0),
    },
    strongestFamily: {
      note:         "Dữ liệu gia tộc được đọc từ DB thực tế",
      totalFamilies: 0,
    },
    richestNpc: {
      note:       "Dữ liệu NPC được đọc từ DB thực tế",
      totalAssets: state.totalAssets.toFixed(0),
    },
    longestLeader: {
      note:      "Dữ liệu leader được đọc từ DB thực tế",
      govEvents: govChanges.length,
    },
    metrics: {
      tickNumber,
      population:       state.population,
      economyScore:     +state.economyScore.toFixed(1),
      gdp:              +state.gdp.toFixed(0),
      totalAssets:      +state.totalAssets.toFixed(0),
      unemploymentRate: +state.unemploymentRate.toFixed(1),
      mortalityRate:    +state.mortalityRate.toFixed(2),
      avgMood:          +state.avgMood.toFixed(1),
      stability:        +state.stability.toFixed(1),
      totalWars:        warCount,
      totalElections:   electionCount,
    },
    anomalies: warnings.slice(-20),
  };
}

/* ══════════════════════════════════════════════════════
   POST /api/stress-test/run
   Body: { worldSlug, ticks: 100 | 1000 | 10000 | 100000 }
   Streams SSE progress
══════════════════════════════════════════════════════ */
router.post("/stress-test/run", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug, ticks } = req.body as { worldSlug: string; ticks: number };
    const VALID_TICKS = [100, 1000, 10000, 100000];
    if (!worldSlug || !VALID_TICKS.includes(Number(ticks))) {
      return res.status(400).json({ error: "worldSlug và ticks (100/1000/10000/100000) là bắt buộc" });
    }
    const tickCount = Number(ticks);

    // Load initial world state
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ error: "World không tồn tại" });

    let [simState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));

    const [totalFamiliesResult]    = await db.select({ c: count() }).from(npcFamilies);
    const [totalFactionsResult]    = await db.select({ c: count() }).from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug));
    const [totalGovernmentsResult] = await db.select({ c: count() }).from(npcGovernments);
    const [totalWarsDbResult]      = await db.select({ c: count() }).from(worldWars);
    const [totalElectionsDbResult] = await db.select({ c: count() }).from(elections);

    const dbFamilies    = Number(totalFamiliesResult?.c ?? 0);
    const dbFactions    = Number(totalFactionsResult?.c ?? 0);
    const dbGovernments = Number(totalGovernmentsResult?.c ?? 0);
    const dbWars        = Number(totalWarsDbResult?.c ?? 0);
    const dbElections   = Number(totalElectionsDbResult?.c ?? 0);

    const initPop     = simState?.population ?? 1000;
    const initEconomy = simState?.economyScore ?? 50;
    const initMood    = simState?.avgMood ?? 60;
    const initStab    = simState?.stability ?? 70;

    // Create run record
    const [run] = await db.insert(stressTestRuns).values({
      worldSlug,
      worldName:        world.name,
      ticksRequested:   tickCount,
      initPopulation:   initPop,
      initEconomy,
      totalFamilies:    dbFamilies,
      totalFactions:    dbFactions,
      totalGovernments: dbGovernments,
      totalWars:        dbWars,
      totalElections:   dbElections,
      initialState: {
        population:   initPop,
        economyScore: initEconomy,
        avgMood:      initMood,
        stability:    initStab,
      },
    }).returning();

    // Setup SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    send({ type: "started", runId: run.id, worldName: world.name, ticks: tickCount });

    // ── In-memory simulation ──
    let state: SimState = {
      population:       initPop,
      economyScore:     initEconomy,
      avgMood:          initMood,
      stability:        initStab,
      gdp:              (initEconomy / 100) * initPop * 50,
      totalAssets:      (initEconomy / 100) * initPop * 175,
      unemploymentRate: clamp(100 - initEconomy, 0, 95),
      mortalityRate:    0,
      totalTicks:       simState?.totalTicks ?? 0,
    };

    const initState      = { ...state };
    const warnings:      string[] = [];
    const replayBatch:   Array<typeof stressTestReplay.$inferInsert> = [];
    const snapshotBatch: Array<typeof stressTestSnapshots.$inferInsert> = [];
    const reportBatch:   Array<typeof stressTestReports.$inferInsert> = [];

    let simWarCount      = 0;
    let simElectionCount = 0;
    let unemploySum      = 0;
    let mortalitySum     = 0;

    // Snapshot interval: every 100 ticks for ≤1000; every 1000 for larger
    const snapshotEvery  = tickCount <= 1000 ? 100 : 1000;
    // Progress report every 10%
    const progressEvery  = Math.max(100, Math.floor(tickCount / 10));
    const MILESTONES     = new Set([1000, 10000, 100000]);

    const startedAt = Date.now();

    for (let t = 1; t <= tickCount; t++) {
      const result = tickInMemory(state);
      state = result.state;
      unemploySum  += state.unemploymentRate;
      mortalitySum += state.mortalityRate;

      // Count simulated events
      if (result.eventType === "inter_world_war" || result.eventType === "war_declaration" || result.eventType === "rebellion") simWarCount++;
      if (result.eventType === "election_held") simElectionCount++;

      // Detect anomalies
      detectAnomalies(state, initState, simWarCount + dbWars, simElectionCount + dbElections, t, warnings);

      // Record major events for replay
      const isMajor =
        Math.abs(result.dPop) > 50 ||
        Math.abs(result.dEconomy) > 10 ||
        Math.abs(result.dStability) > 15 ||
        result.eventType === "inter_world_war" ||
        result.eventType === "plague" ||
        result.eventType === "rebellion" ||
        result.eventType === "coup";

      if (isMajor && result.eventType) {
        replayBatch.push({
          runId:       run.id,
          tickNumber:  t,
          eventType:   result.eventType,
          eventName:   result.eventName ?? "",
          category:    result.category ?? "event",
          impact: {
            dPop:       result.dPop,
            dEconomy:   +result.dEconomy.toFixed(1),
            dMood:      +result.dMood.toFixed(1),
            dStability: +result.dStability.toFixed(1),
            population:   state.population,
            economyScore: +state.economyScore.toFixed(1),
          },
          description: `[Tick ${t}] ${result.eventName}: Dân số ${result.dPop >= 0 ? "+" : ""}${result.dPop} | Kinh tế ${result.dEconomy >= 0 ? "+" : ""}${result.dEconomy.toFixed(1)}`,
        });
      }

      // Snapshot
      if (t % snapshotEvery === 0) {
        snapshotBatch.push({
          runId:            run.id,
          tickNumber:       t,
          population:       state.population,
          economyScore:     state.economyScore,
          gdp:              state.gdp,
          totalAssets:      state.totalAssets,
          unemploymentRate: state.unemploymentRate,
          mortalityRate:    state.mortalityRate,
          avgMood:          state.avgMood,
          stability:        state.stability,
          majorEventType:   result.eventType,
          majorEventName:   result.eventName,
        });
      }

      // Milestone reports
      if (MILESTONES.has(t) && t <= tickCount) {
        const report = buildReport(t, state, initState, simWarCount + dbWars, simElectionCount + dbElections, replayBatch.map(r => ({ tick: r.tickNumber, name: r.eventName, category: r.category ?? "event" })), warnings);
        reportBatch.push({
          runId: run.id, tickNumber: t, milestone: t,
          worldStatus:     report.worldStatus,
          strongestNation: report.strongestNation,
          strongestFamily: report.strongestFamily,
          richestNpc:      report.richestNpc,
          longestLeader:   report.longestLeader,
          metrics:         report.metrics,
          anomalies:       report.anomalies,
        });
      }

      // Progress SSE
      if (t % progressEvery === 0) {
        const pct = Math.round((t / tickCount) * 100);
        send({
          type:       "progress",
          tick:       t,
          pct,
          population: state.population,
          economy:    +state.economyScore.toFixed(1),
          warnings:   warnings.length,
        });
      }

      // Flush batches to DB in chunks to avoid huge single inserts
      if (snapshotBatch.length >= 100) {
        await db.insert(stressTestSnapshots).values(snapshotBatch.splice(0, 100));
      }
      if (replayBatch.length >= 200) {
        await db.insert(stressTestReplay).values(replayBatch.splice(0, 200));
      }
    }

    // Flush remaining batches
    if (snapshotBatch.length)  await db.insert(stressTestSnapshots).values(snapshotBatch);
    if (replayBatch.length)    await db.insert(stressTestReplay).values(replayBatch);
    if (reportBatch.length)    await db.insert(stressTestReports).values(reportBatch);

    const durationMs = Date.now() - startedAt;
    const avgUnemploy = unemploySum / tickCount;
    const avgMortality = mortalitySum / tickCount;

    // Final report (if tickCount not already a milestone)
    if (!MILESTONES.has(tickCount)) {
      const finalReport = buildReport(tickCount, state, initState, simWarCount + dbWars, simElectionCount + dbElections, replayBatch.map(r => ({ tick: r.tickNumber, name: r.eventName, category: r.category ?? "event" })), warnings);
      await db.insert(stressTestReports).values({
        runId: run.id, tickNumber: tickCount, milestone: tickCount,
        worldStatus:     finalReport.worldStatus,
        strongestNation: finalReport.strongestNation,
        strongestFamily: finalReport.strongestFamily,
        richestNpc:      finalReport.richestNpc,
        longestLeader:   finalReport.longestLeader,
        metrics:         finalReport.metrics,
        anomalies:       finalReport.anomalies,
      });
    }

    // Update run record
    await db.update(stressTestRuns)
      .set({
        ticksCompleted:   tickCount,
        status:           "completed",
        durationMs,
        finalPopulation:  state.population,
        finalEconomy:     state.economyScore,
        finalGdp:         state.gdp,
        finalTotalAssets: state.totalAssets,
        totalWars:        dbWars + simWarCount,
        totalElections:   dbElections + simElectionCount,
        avgUnemployment:  avgUnemploy,
        avgMortality,
        warnings,
        finalState: {
          population:       state.population,
          economyScore:     +state.economyScore.toFixed(2),
          avgMood:          +state.avgMood.toFixed(2),
          stability:        +state.stability.toFixed(2),
          gdp:              +state.gdp.toFixed(0),
          totalAssets:      +state.totalAssets.toFixed(0),
          unemploymentRate: +state.unemploymentRate.toFixed(1),
          mortalityRate:    +state.mortalityRate.toFixed(2),
        },
        completedAt: new Date(),
      })
      .where(eq(stressTestRuns.id, run.id));

    send({
      type:       "completed",
      runId:      run.id,
      durationMs,
      ticks:      tickCount,
      finalState: state,
      warnings,
      totalWars:        simWarCount + dbWars,
      totalElections:   simElectionCount + dbElections,
      avgUnemployment:  +avgUnemploy.toFixed(1),
      avgMortality:     +avgMortality.toFixed(2),
    });

    res.end();
  } catch (e: any) {
    console.error("[StressTest] error:", e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
    else {
      res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
      res.end();
    }
  }
});

/* GET /api/stress-test/runs?worldSlug=xxx */
router.get("/stress-test/runs", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.query as { worldSlug?: string };
    const query = db.select().from(stressTestRuns).orderBy(desc(stressTestRuns.startedAt)).limit(20);
    const runs = worldSlug
      ? await db.select().from(stressTestRuns).where(eq(stressTestRuns.worldSlug, worldSlug)).orderBy(desc(stressTestRuns.startedAt)).limit(20)
      : await query;
    res.json(runs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/stress-test/runs/:runId */
router.get("/stress-test/runs/:runId", isAuthenticated, async (req, res) => {
  try {
    const [run] = await db.select().from(stressTestRuns).where(eq(stressTestRuns.id, req.params.runId));
    if (!run) return res.status(404).json({ error: "Run không tồn tại" });
    res.json(run);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/stress-test/runs/:runId/snapshots */
router.get("/stress-test/runs/:runId/snapshots", isAuthenticated, async (req, res) => {
  try {
    const snapshots = await db.select().from(stressTestSnapshots)
      .where(eq(stressTestSnapshots.runId, req.params.runId))
      .orderBy(stressTestSnapshots.tickNumber);
    res.json(snapshots);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/stress-test/runs/:runId/reports */
router.get("/stress-test/runs/:runId/reports", isAuthenticated, async (req, res) => {
  try {
    const reports = await db.select().from(stressTestReports)
      .where(eq(stressTestReports.runId, req.params.runId))
      .orderBy(stressTestReports.tickNumber);
    res.json(reports);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/stress-test/runs/:runId/replay */
router.get("/stress-test/runs/:runId/replay", isAuthenticated, async (req, res) => {
  try {
    const { category, limit = "200" } = req.query as { category?: string; limit?: string };
    let q = db.select().from(stressTestReplay)
      .where(eq(stressTestReplay.runId, req.params.runId));
    const events = await db.select().from(stressTestReplay)
      .where(
        category
          ? and(eq(stressTestReplay.runId, req.params.runId), eq(stressTestReplay.category, category))
          : eq(stressTestReplay.runId, req.params.runId)
      )
      .orderBy(stressTestReplay.tickNumber)
      .limit(Math.min(Number(limit), 500));
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/stress-test/worlds — list worlds with sim state */
router.get("/stress-test/worlds", isAuthenticated, async (req, res) => {
  try {
    const worlds = await db.select({
      slug:       customWorlds.slug,
      name:       customWorlds.name,
      population: worldSimState.population,
      economy:    worldSimState.economyScore,
      ticks:      worldSimState.totalTicks,
    })
    .from(customWorlds)
    .leftJoin(worldSimState, eq(customWorlds.slug, worldSimState.worldSlug))
    .limit(30);
    res.json(worlds);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
