import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  worldSimState, worldSimLog, customWorlds, worldFrameworks, worldDisasters, worldWeather,
  territories, territoryLogs, npcGovernments, npcCores,
  worldHistory,
} from "@workspace/db/schema";
import { eq, and, desc, lt, sql, inArray, asc } from "drizzle-orm";
import { applyGovernmentPolicies } from "./npcGovernmentPolicy.js";
import { tickNpcWorld } from "./npcCore.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { broadcastUnity } from "../lib/unityWs.js";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

/* ─── Event types ─── */
const EVENT_POOL = [
  { type: "economic_boom",       name: "Thịnh Vượng Kinh Tế",    dEconomy: +12, dMood: +8,  dStability: +5,  dPop: +30  },
  { type: "economic_recession",  name: "Suy Thoái Kinh Tế",       dEconomy: -10, dMood: -10, dStability: -8,  dPop: -20  },
  { type: "political_crisis",    name: "Khủng Hoảng Chính Trị",   dEconomy: -8,  dMood: -12, dStability: -15, dPop: 0    },
  { type: "rebellion",           name: "Nổi Loạn Dân Chúng",      dEconomy: -15, dMood: -5,  dStability: -20, dPop: -50  },
  { type: "natural_wonder",      name: "Kỳ Quan Thiên Nhiên",     dEconomy: +5,  dMood: +15, dStability: +3,  dPop: +10  },
  { type: "plague",              name: "Dịch Bệnh Hoành Hành",    dEconomy: -12, dMood: -18, dStability: -10, dPop: -80  },
  { type: "harvest_festival",    name: "Lễ Hội Thu Hoạch",        dEconomy: +8,  dMood: +20, dStability: +5,  dPop: +15  },
  { type: "mysterious_arrival",  name: "Khách Lạ Ghé Đến",        dEconomy: +3,  dMood: +5,  dStability: 0,   dPop: +5   },
  { type: "ancient_discovery",   name: "Khám Phá Cổ Đại",         dEconomy: +10, dMood: +12, dStability: +2,  dPop: 0    },
  { type: "trade_boom",          name: "Buôn Bán Phồn Thịnh",     dEconomy: +15, dMood: +10, dStability: +5,  dPop: +20  },
  { type: "inter_world_war",     name: "Xung Đột Liên Thế Giới",  dEconomy: -18, dMood: -15, dStability: -25, dPop: -100 },
  { type: "hero_born",           name: "Anh Hùng Xuất Hiện",      dEconomy: +2,  dMood: +18, dStability: +8,  dPop: 0    },
  { type: "villain_rises",       name: "Ma Đầu Trỗi Dậy",         dEconomy: -5,  dMood: -14, dStability: -12, dPop: -30  },
  { type: "peace_treaty",        name: "Hòa Ước Ký Kết",          dEconomy: +5,  dMood: +15, dStability: +18, dPop: 0    },
  { type: "migration_wave",      name: "Làn Sóng Di Dân",         dEconomy: +3,  dMood: -3,  dStability: -5,  dPop: +150 },
];

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

/* ─── Core tick logic ─── */
export async function tickWorld(worldSlug: string): Promise<{ log: typeof worldSimLog.$inferSelect | null; state: typeof worldSimState.$inferSelect | null }> {
  try {
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return { log: null, state: null };

    const [framework] = await db.select().from(worldFrameworks).where(eq(worldFrameworks.worldSlug, worldSlug));

    let [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));
    if (!state) {
      const [created] = await db.insert(worldSimState).values({
        worldSlug,
        worldName: world.name,
        theme: framework?.theme ?? "",
        population: 1000,
        economyScore: 50,
        avgMood: 60,
        stability: 70,
      }).returning();
      state = created;
    }

    const activeDisasters = await db.select().from(worldDisasters)
      .where(and(eq(worldDisasters.worldSlug, worldSlug), eq(worldDisasters.status, "active")));
    const [activeWeather] = await db.select().from(worldWeather)
      .where(and(eq(worldWeather.worldSlug, worldSlug), eq(worldWeather.isActive, true)));

    /* ─── Compute base deltas ─── */
    let dPop       = Math.round(rand(-5, 15));
    let dEconomy   = rand(-2, 3);
    let dMood      = rand(-3, 3);
    let dStability = rand(-2, 2);
    let eventName  = "Tick Bình Thường";
    let eventType  = "tick";
    let narrative  = "";

    /* Disaster modifier */
    for (const d of activeDisasters) {
      const eff = d.effect as any ?? {};
      if ((eff.expMult ?? 1) < 0.7) { dEconomy -= 8; dMood -= 10; dStability -= 8; dPop -= 30; }
      else if ((eff.expMult ?? 1) < 1.0) { dEconomy -= 3; dMood -= 5; dStability -= 3; }
      else { dEconomy += 5; dMood += 8; dPop += 10; }
    }

    /* Weather modifier */
    if (activeWeather?.effects) {
      const eff = activeWeather.effects as any;
      dEconomy += (eff.goldMult - 1) * 5;
      dMood    += (eff.expMult  - 1) * 6;
    }

    /* Mean reversion — pull toward baseline (50/60/70) */
    dEconomy   += (50 - state.economyScore) * 0.03;
    dMood      += (60 - state.avgMood)      * 0.03;
    dStability += (70 - state.stability)    * 0.03;

    /* ─── Random event roll (28% chance) ─── */
    let rolledEvent = null;
    if (Math.random() < 0.28) {
      rolledEvent = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
      dPop       += rolledEvent.dPop;
      dEconomy   += rolledEvent.dEconomy;
      dMood      += rolledEvent.dMood;
      dStability += rolledEvent.dStability;
      eventName   = rolledEvent.name;
      eventType   = rolledEvent.type;

      const worldTheme = framework?.theme ?? world.name;
      narrative = await geminiText(
        `Thế giới "${world.name}" (chủ đề: ${worldTheme}) vừa trải qua sự kiện "${rolledEvent.name}".
Viết 2-3 câu tiếng Việt mô tả sự kiện này theo lore thế giới đó. Ngắn gọn, sử thi, không giải thích.`
      );
    } else {
      const worldTheme = framework?.theme ?? world.name;
      narrative = await geminiText(
        `Thế giới "${world.name}" (chủ đề: ${worldTheme}) trải qua một giờ bình thường.
Viết 1 câu tiếng Việt mô tả nhịp sống thường ngày của thế giới này. Ngắn, có hồn.`
      );
    }

    /* ─── Apply updates ─── */
    const newPop       = Math.max(0,   state.population + dPop);
    const newEconomy   = clamp(state.economyScore + dEconomy, 0, 100);
    const newMood      = clamp(state.avgMood + dMood, 0, 100);
    const newStability = clamp(state.stability + dStability, 0, 100);
    const newTick      = state.totalTicks + 1;

    const [updatedState] = await db.update(worldSimState)
      .set({ population: newPop, economyScore: newEconomy, avgMood: newMood, stability: newStability, totalTicks: newTick, lastTickAt: new Date(), worldName: world.name, theme: framework?.theme ?? "" })
      .where(eq(worldSimState.worldSlug, worldSlug))
      .returning();

    const summary = `[Tick #${newTick}] ${eventName} | Pop: ${newPop} (${dPop >= 0 ? "+" : ""}${dPop}) | Economy: ${newEconomy.toFixed(1)} | Mood: ${newMood.toFixed(1)} | Stability: ${newStability.toFixed(1)}`;

    const [log] = await db.insert(worldSimLog).values({
      worldSlug,
      tickNumber: newTick,
      eventType,
      eventName,
      summary,
      aiNarrative: narrative,
      deltaPopulation: dPop,
      deltaEconomy: dEconomy,
      deltaMood: dMood,
      deltaStability: dStability,
    }).returning();

    /* ─── Apply government policy effects ─── */
    try { await applyGovernmentPolicies(worldSlug); } catch {}

    /* ─── NPC heartbeat (opt-in via ENABLE_NPC_HEARTBEAT=true) ─── */
    if (process.env.ENABLE_NPC_HEARTBEAT === "true") {
      try { await tickNpcWorld(worldSlug, 20); } catch {}
    }

    /* ─── Territory Collapse: pop<10 + sec<15 → ruins ─── */
    /* ─── Recolonization: ruins + nearby overcrowded → active ─── */
    try {
      const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));

      for (const terr of terrs) {
        /* Collapse: active/abandoned territory → ruins when emptied */
        if (terr.status !== "ruins" && terr.population < 10 && terr.security < 15) {
          await db.update(territories)
            .set({ status: "ruins", updatedAt: new Date() })
            .where(eq(territories.id, terr.id));
          await db.insert(territoryLogs).values({
            territoryId: terr.id,
            event: `${terr.name} sụp đổ thành phế tích — dân số ${terr.population}, an ninh ${terr.security}`,
          });
          await db.insert(worldHistory).values({
            worldSlug,
            tick:        newTick,
            eventType:   "collapse",
            title:       `${terr.name} sụp đổ thành phế tích`,
            description: `Dân số giảm xuống ${terr.population}, an ninh ${terr.security} — lãnh thổ bỏ hoang thành phế tích.`,
            actors:      { territories: [terr.id] },
          });
          try {
            broadcastUnity(worldSlug, {
              type: "territory_collapse", territoryId: terr.id,
              territoryName: terr.name, population: terr.population, security: terr.security,
              timestamp: Date.now(),
            });
          } catch {}
        }

        /* Recolonization: ruins → active when crowded neighbor pushes settlers (15% chance/tick) */
        if (terr.status === "ruins" && Math.random() < 0.15) {
          const overcrowded = terrs.find(t =>
            t.id !== terr.id && t.status === "active" && t.population > 200 &&
            Math.abs(t.x - terr.x) < 60 && Math.abs(t.y - terr.y) < 60
          );
          if (overcrowded) {
            const settlers = Math.min(Math.floor(Math.random() * 6) + 3, Math.floor(overcrowded.population * 0.03));
            if (settlers >= 3) {
              await db.update(territories)
                .set({
                  status:     "active",
                  population: settlers,
                  prosperity: Math.max(15, Math.floor(overcrowded.prosperity * 0.4)),
                  security:   20,
                  updatedAt:  new Date(),
                })
                .where(eq(territories.id, terr.id));
              await db.update(territories)
                .set({ population: overcrowded.population - settlers, updatedAt: new Date() })
                .where(eq(territories.id, overcrowded.id));
              await db.insert(territoryLogs).values({
                territoryId: terr.id,
                event: `${settlers} người định cư từ ${overcrowded.name} đến tái lập ${terr.name}`,
              });
              await db.insert(worldHistory).values({
                worldSlug,
                tick:        newTick,
                eventType:   "recolonization",
                title:       `${terr.name} được tái lập`,
                description: `${settlers} dân định cư từ ${overcrowded.name} đến khai phá phế tích ${terr.name}, thành lập khu định cư mới.`,
                actors:      { territories: [terr.id, overcrowded.id] },
              });
              try {
                broadcastUnity(worldSlug, {
                  type: "recolonization", territoryId: terr.id,
                  territoryName: terr.name, settlers,
                  fromTerritory: overcrowded.name, timestamp: Date.now(),
                });
              } catch {}
            }
          }
        }
      }
    } catch {}

    return { log, state: updatedState };
  } catch (e) {
    console.error(`[Simulation] tick error for ${worldSlug}:`, e);
    return { log: null, state: null };
  }
}

/* ─── Tick ALL active worlds ─── */
export async function tickAllWorlds(): Promise<void> {
  try {
    const worlds = await db.select().from(worldSimState).where(eq(worldSimState.isActive, true));
    if (worlds.length === 0) {
      const allWorlds = await db.select().from(customWorlds).limit(20);
      for (const w of allWorlds) await tickWorld(w.slug);
    } else {
      for (const s of worlds) await tickWorld(s.worldSlug);
    }
    console.log(`[Simulation] ✅ Ticked ${worlds.length} worlds`);
  } catch (e) {
    console.error("[Simulation] tickAll error:", e);
  }
}

/* ═══════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════ */

/* GET /api/simulation/state/:worldSlug */
router.get("/simulation/state/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    let [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));
    if (!state) {
      const { state: s } = await tickWorld(worldSlug);
      state = s!;
    }
    res.json(state);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/logs/:worldSlug */
router.get("/simulation/logs/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const logs = await db.select().from(worldSimLog)
      .where(eq(worldSimLog.worldSlug, worldSlug))
      .orderBy(desc(worldSimLog.happenedAt))
      .limit(limit);
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/feed — global event feed */
router.get("/simulation/feed", isAuthenticated, async (req, res) => {
  try {
    const logs = await db.select().from(worldSimLog)
      .orderBy(desc(worldSimLog.happenedAt))
      .limit(60);
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/all — all world states */
router.get("/simulation/all", isAuthenticated, async (req, res) => {
  try {
    const states = await db.select().from(worldSimState)
      .where(eq(worldSimState.isActive, true))
      .orderBy(desc(worldSimState.lastTickAt));
    res.json(states);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/tick/:worldSlug — manual tick */
router.post("/simulation/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const result = await tickWorld(worldSlug);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/tick/all — tick all (admin / heartbeat) */
router.post("/simulation/tick/all", isAuthenticated, async (_req, res) => {
  try {
    await tickAllWorlds();
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/stress-test/:worldSlug — chạy N ticks liên tục, trả báo cáo ổn định */
router.post("/simulation/stress-test/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const ticks = Math.min(Number(req.body?.ticks ?? 200), 500);

    let [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));
    if (!state) {
      const { state: s } = await tickWorld(worldSlug);
      if (!s) return res.status(404).json({ error: "Không tìm thấy thế giới" });
      state = s;
    }

    const snapshots: { tick: number; population: number; economyScore: number; stability: number; avgMood: number }[] = [];
    const events: string[] = [];
    let anomalies = 0;
    let crashes   = 0;

    const initPop  = state.population;
    const initEcon = state.economyScore;

    for (let i = 0; i < ticks; i++) {
      try {
        const result = await tickWorld(worldSlug);
        if (!result.state) { crashes++; continue; }

        const s = result.state;

        /* ─ Anomaly checks ─ */
        if (s.population < 0)     { anomalies++; events.push(`Tick ${i+1}: population âm (${s.population})`); }
        if (s.economyScore < 0 || s.economyScore > 100) { anomalies++; events.push(`Tick ${i+1}: economyScore ngoài [0,100] (${s.economyScore.toFixed(1)})`); }
        if (s.avgMood < 0 || s.avgMood > 100)           { anomalies++; events.push(`Tick ${i+1}: avgMood ngoài [0,100] (${s.avgMood.toFixed(1)})`); }
        if (s.stability < 0 || s.stability > 100)       { anomalies++; events.push(`Tick ${i+1}: stability ngoài [0,100] (${s.stability.toFixed(1)})`); }
        if (s.population > initPop * 100)                { anomalies++; events.push(`Tick ${i+1}: population RUNAWAY (${s.population})`); }
        if (s.economyScore > 99.5 && i > 50)             { anomalies++; events.push(`Tick ${i+1}: economy kẹt cực đại`); }

        if (i % Math.max(1, Math.floor(ticks / 10)) === 0) {
          snapshots.push({ tick: i + 1, population: s.population, economyScore: parseFloat(s.economyScore.toFixed(2)), stability: parseFloat(s.stability.toFixed(2)), avgMood: parseFloat(s.avgMood.toFixed(2)) });
        }
      } catch (e) {
        crashes++;
        events.push(`Tick ${i+1}: crash — ${(e as Error).message?.slice(0, 80)}`);
      }
    }

    const [finalState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));

    const econValues  = snapshots.map(s => s.economyScore);
    const econMin     = econValues.length ? Math.min(...econValues) : 0;
    const econMax     = econValues.length ? Math.max(...econValues) : 0;
    const econOsc     = econMax - econMin;

    const report = {
      worldSlug,
      ticks,
      anomalies,
      crashes,
      passed: anomalies === 0 && crashes === 0,
      initial: { population: initPop, economyScore: parseFloat(initEcon.toFixed(2)) },
      final: finalState ? {
        population:   finalState.population,
        economyScore: parseFloat(finalState.economyScore.toFixed(2)),
        avgMood:      parseFloat(finalState.avgMood.toFixed(2)),
        stability:    parseFloat(finalState.stability.toFixed(2)),
        totalTicks:   finalState.totalTicks,
      } : null,
      economy: { min: parseFloat(econMin.toFixed(2)), max: parseFloat(econMax.toFixed(2)), oscillation: parseFloat(econOsc.toFixed(2)) },
      snapshots,
      issues: events,
      verdict: anomalies === 0 && crashes === 0 ? "✅ PASS" : `❌ FAIL — ${anomalies} anomaly, ${crashes} crash`,
    };

    return res.json(report);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* GET /api/simulation/history/:worldSlug — lịch sử sự kiện thế giới */
router.get("/simulation/history/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const eventType = req.query.eventType as string | undefined;

    let query = db.select().from(worldHistory)
      .where(eq(worldHistory.worldSlug, worldSlug))
      .$dynamic();

    if (eventType) {
      query = db.select().from(worldHistory)
        .where(and(eq(worldHistory.worldSlug, worldSlug), eq(worldHistory.eventType, eventType)))
        .$dynamic();
    }

    const rows = await query.orderBy(desc(worldHistory.tick)).limit(limit);

    const stats = {
      total:         rows.length,
      wars:          rows.filter(r => r.eventType === "territory_capture" || r.eventType === "battle_failed").length,
      collapses:     rows.filter(r => r.eventType === "collapse").length,
      recolonized:   rows.filter(r => r.eventType === "recolonization").length,
      latestTick:    rows[0]?.tick ?? 0,
    };

    return res.json({ stats, history: rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/history/:worldSlug/timeline — compact timeline for Unity/map */
router.get("/simulation/history/:worldSlug/timeline", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const rows = await db.select({
      tick:      worldHistory.tick,
      eventType: worldHistory.eventType,
      title:     worldHistory.title,
      createdAt: worldHistory.createdAt,
    }).from(worldHistory)
      .where(eq(worldHistory.worldSlug, worldSlug))
      .orderBy(asc(worldHistory.tick))
      .limit(500);
    return res.json(rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/seed-defaults — upsert 3 default worlds into custom_worlds + tick */
router.post("/simulation/seed-defaults", async (_req, res) => {
  try {
    const defaults = [
      { slug: "cultivation", name: "Tu Tiên",  genre: "cultivation", description: "Võ đạo cổ xưa hoà quyện với AI thần thức.", rules: "", lore: "" },
      { slug: "cyberpunk",   name: "Cyberpunk", genre: "cyberpunk",   description: "Siêu đô thị ngập tràn ánh đèn neon và kim loại lạnh.", rules: "", lore: "" },
      { slug: "zombie",      name: "Hoang Phế", genre: "survival",    description: "Sinh tồn kinh dị hậu tận thế.", rules: "", lore: "" },
    ];

    for (const w of defaults) {
      await db.insert(customWorlds).values(w).onConflictDoNothing();
    }

    // Kick off first tick for each world so worldSimState gets created
    const results = await Promise.allSettled(defaults.map((w) => tickWorld(w.slug)));
    const ticked = results.filter((r) => r.status === "fulfilled").length;

    res.json({ seeded: defaults.length, ticked, message: `Đã seed ${defaults.length} thế giới mặc định, tick ${ticked} world` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
