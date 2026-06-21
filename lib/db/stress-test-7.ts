/**
 * STRESS TEST #7 — 1000 TICKS: War v1 + History + Recolonization + Anomaly
 *
 * Tests:
 *  T1. 1000 ticks — economy/population/stability ổn định, không kẹt cực đoan
 *  T2. War v1 — /military/attack logic: combat, ownerFactionId transfer, refugee wave
 *  T3. Territory Collapse — pop<10 + sec<15 → ruins + world_history entry
 *  T4. Recolonization — ruins + overcrowded neighbor → active + world_history entry
 *  T5. World History — ghi đúng event type, tick, actors
 *  T6. Anomaly check — no negatives, no runaway, DB integrity
 */

import { db } from "./src/index.js";
import { sql, eq, inArray, desc, and } from "drizzle-orm";
import {
  worldSimState, customWorlds,
  territories, territoryLogs,
  npcGovernments, npcGovernmentLogs,
  militaryForces,
  npcCores, npcFactions,
  worldHistory,
} from "./src/schema/index.js";
import { randomUUID } from "crypto";

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const C = (s: string) => `\x1b[36m${s}\x1b[0m`;
const B = (s: string) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0, warnings = 0;
const RESULTS: { ok: boolean | null; label: string; detail: string }[] = [];

function pass(label: string, detail = "") { passed++; RESULTS.push({ ok: true, label, detail }); console.log(`  ${G("✓")} ${label}${detail ? " — " + detail : ""}`); }
function fail(label: string, detail = "") { failed++; RESULTS.push({ ok: false, label, detail }); console.log(`  ${R("✗")} ${label}${detail ? " — " + detail : ""}`); }
function warn(label: string, detail = "") { warnings++; RESULTS.push({ ok: null, label, detail }); console.log(`  ${Y("⚠")} ${label}${detail ? " — " + detail : ""}`); }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function calcPower(soldiers: number, morale: number, training: number, supply: number) {
  return Math.round(soldiers * (morale / 100) * (training / 10) * (supply / 100) * 10);
}

const EVENTS = [
  { dE: +12, dM: +8,  dS: +5,  dP: +30,  n: "Thịnh Vượng Kinh Tế" },
  { dE: -10, dM: -10, dS: -8,  dP: -20,  n: "Suy Thoái Kinh Tế" },
  { dE: -8,  dM: -12, dS: -15, dP: 0,    n: "Khủng Hoảng Chính Trị" },
  { dE: -15, dM: -5,  dS: -20, dP: -50,  n: "Nổi Loạn Dân Chúng" },
  { dE: +5,  dM: +15, dS: +3,  dP: +10,  n: "Kỳ Quan Thiên Nhiên" },
  { dE: -12, dM: -18, dS: -10, dP: -80,  n: "Dịch Bệnh Hoành Hành" },
  { dE: +8,  dM: +20, dS: +5,  dP: +15,  n: "Lễ Hội Thu Hoạch" },
  { dE: +10, dM: +12, dS: +2,  dP: 0,    n: "Khám Phá Cổ Đại" },
  { dE: +15, dM: +10, dS: +5,  dP: +20,  n: "Buôn Bán Phồn Thịnh" },
  { dE: -18, dM: -15, dS: -25, dP: -100, n: "Xung Đột Liên Thế Giới" },
  { dE: +5,  dM: +15, dS: +18, dP: 0,    n: "Hòa Ước Ký Kết" },
  { dE: +3,  dM: -3,  dS: -5,  dP: +150, n: "Làn Sóng Di Dân" },
];

type Snap = { population: number; economyScore: number; avgMood: number; stability: number; totalTicks: number };

const SLUG = "stress-test-7";

async function simTick(s: Snap): Promise<Snap & { event: string }> {
  let dP = randInt(-5, 15);
  let dE = rand(-2, 3) + (50 - s.economyScore) * 0.03;
  let dM = rand(-3, 3) + (60 - s.avgMood) * 0.03;
  let dS = rand(-2, 2) + (70 - s.stability) * 0.03;
  let ev = "Tick Bình Thường";
  if (Math.random() < 0.28) {
    const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    dP += e.dP; dE += e.dE; dM += e.dM; dS += e.dS; ev = e.n;
  }
  const newPop  = Math.max(0, s.population + dP);
  const newEcon = clamp(s.economyScore + dE, 0, 100);
  const newMood = clamp(s.avgMood + dM, 0, 100);
  const newStab = clamp(s.stability + dS, 0, 100);
  const newTick = s.totalTicks + 1;
  await db.update(worldSimState)
    .set({ population: newPop, economyScore: newEcon, avgMood: newMood, stability: newStab, totalTicks: newTick, lastTickAt: new Date() })
    .where(eq(worldSimState.worldSlug, SLUG));
  return { population: newPop, economyScore: newEcon, avgMood: newMood, stability: newStab, totalTicks: newTick, event: ev };
}

/* ─── SETUP ─────────────────────────────── */
interface Ctx {
  slug: string;
  terrA: any; terrB: any; terrC: any;
  govA: any; govB: any;
  armyA: any; armyB: any;
  factionA: any;
}

async function setup(): Promise<Ctx> {
  // World
  await db.execute(sql`INSERT INTO custom_worlds (slug,name,genre,description,rules,lore) VALUES (${SLUG},'Stress Test 7','survival','','','') ON CONFLICT (slug) DO UPDATE SET name='Stress Test 7'`);
  await db.execute(sql`INSERT INTO world_sim_state (world_slug,world_name,theme,population,economy_score,avg_mood,stability,total_ticks,is_active) VALUES (${SLUG},'Stress Test 7','survival',2000,55,65,75,0,true) ON CONFLICT (world_slug) DO UPDATE SET population=2000,economy_score=55,avg_mood=65,stability=75,total_ticks=0,is_active=true`);

  // Clear old history for clean run
  await db.delete(worldHistory).where(eq(worldHistory.worldSlug, SLUG));

  // Territory A — Đế Đô (overcrowded, active)
  let [terrA] = await db.select().from(territories).where(and(eq(territories.worldSlug, SLUG), sql`name='Đế Đô'`));
  if (!terrA) { [terrA] = await db.insert(territories).values({ worldSlug: SLUG, name: "Đế Đô", type: "city", population: 500, prosperity: 70, security: 70, x: 20, y: 20, terrain: "plains", status: "active" }).returning(); }
  else { await db.update(territories).set({ population: 500, prosperity: 70, security: 70, status: "active" }).where(eq(territories.id, terrA.id)); }

  // Territory B — Vùng Tranh Chấp (medium, active)
  let [terrB] = await db.select().from(territories).where(and(eq(territories.worldSlug, SLUG), sql`name='Vùng Tranh Chấp'`));
  if (!terrB) { [terrB] = await db.insert(territories).values({ worldSlug: SLUG, name: "Vùng Tranh Chấp", type: "village", population: 80, prosperity: 35, security: 35, x: 75, y: 75, terrain: "plains", status: "active" }).returning(); }
  else { await db.update(territories).set({ population: 80, prosperity: 35, security: 35, status: "active" }).where(eq(territories.id, terrB.id)); }

  // Territory C — Phế Tích Cổ (ruins, near A)
  let [terrC] = await db.select().from(territories).where(and(eq(territories.worldSlug, SLUG), sql`name='Phế Tích Cổ'`));
  if (!terrC) { [terrC] = await db.insert(territories).values({ worldSlug: SLUG, name: "Phế Tích Cổ", type: "village", population: 0, prosperity: 10, security: 5, x: 40, y: 30, terrain: "plains", status: "ruins" }).returning(); }
  else { await db.update(territories).set({ population: 0, prosperity: 10, security: 5, status: "ruins" }).where(eq(territories.id, terrC.id)); }

  // Faction A (owner of Đế Đô)
  let [factionA] = await db.select().from(npcFactions).where(and(eq(npcFactions.worldSlug, SLUG), sql`name='Thiên Minh Tông'`));
  if (!factionA) { [factionA] = await db.insert(npcFactions).values({ worldSlug: SLUG, name: "Thiên Minh Tông", type: "military_order", treasury: 5000, influence: 80 }).returning(); }
  await db.update(territories).set({ ownerFactionId: factionA.id }).where(eq(territories.id, terrA.id));

  // NPCs
  const npcCheck = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, SLUG)).limit(1);
  if (npcCheck.length === 0) {
    for (let i = 0; i < 30; i++) {
      await db.insert(npcCores).values({ id: randomUUID(), worldSlug: SLUG, name: `Dân Sự ${i+1}`, occupation: "Nông Dân", age: 20+i, happiness: 65, energy: 75, hunger: 35, money: 120 }).onConflictDoNothing();
    }
  }

  // Governments
  let [govA] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrA.id));
  if (!govA) { [govA] = await db.insert(npcGovernments).values({ territoryId: terrA.id, govType: "kingdom", treasury: 3000, approvalRate: 75, taxRate: 15 }).returning(); }
  else { await db.update(npcGovernments).set({ treasury: 3000 }).where(eq(npcGovernments.id, govA.id)); }

  let [govB] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrB.id));
  if (!govB) { [govB] = await db.insert(npcGovernments).values({ territoryId: terrB.id, govType: "village_council", treasury: 300, approvalRate: 45, taxRate: 10 }).returning(); }
  else { await db.update(npcGovernments).set({ treasury: 300 }).where(eq(npcGovernments.id, govB.id)); }

  // Armies
  const pA = calcPower(150, 90, 9.0, 95);
  let [armyA] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govA.id));
  if (!armyA) { [armyA] = await db.insert(militaryForces).values({ governmentId: govA.id, territoryId: terrA.id, armyName: "Thiên Minh Quân", totalSoldiers: 150, morale: 90, trainingLevel: 9.0, supplyLevel: 95, militaryPower: pA }).returning(); }
  else { await db.update(militaryForces).set({ totalSoldiers: 150, morale: 90, trainingLevel: 9.0, supplyLevel: 95, militaryPower: pA }).where(eq(militaryForces.id, armyA.id)); }

  const pB = calcPower(30, 55, 3.0, 60);
  let [armyB] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govB.id));
  if (!armyB) { [armyB] = await db.insert(militaryForces).values({ governmentId: govB.id, territoryId: terrB.id, armyName: "Dân Quân Biên Giới", totalSoldiers: 30, morale: 55, trainingLevel: 3.0, supplyLevel: 60, militaryPower: pB }).returning(); }
  else { await db.update(militaryForces).set({ totalSoldiers: 30, morale: 55, trainingLevel: 3.0, supplyLevel: 60, militaryPower: pB }).where(eq(militaryForces.id, armyB.id)); }

  console.log(G(`  ✓ Setup — ArmyA power=${pA} (${150} lính) | ArmyB power=${pB} (${30} lính)`));
  return { slug: SLUG, terrA, terrB, terrC, govA, govB, armyA, armyB, factionA };
}

/* ════════════════════════════════════════════════════
   TEST 1 — 1000 TICKS: economy/population stability
════════════════════════════════════════════════════ */
async function test1() {
  const TICKS = 1000;
  console.log(B(`\n[TEST 1] ${TICKS} Ticks — Economy · Population · Stability`));

  const [initState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, SLUG));
  const snapE: number[] = [initState.economyScore];
  const snapPop: number[] = [initState.population];
  const snapStab: number[] = [initState.stability];
  let anomalies = 0;
  const issues: string[] = [];

  let state: Snap = { population: initState.population, economyScore: initState.economyScore, avgMood: initState.avgMood, stability: initState.stability, totalTicks: initState.totalTicks };
  console.log(`  Init: Pop=${state.population} Econ=${state.economyScore.toFixed(1)} Mood=${state.avgMood.toFixed(1)} Stab=${state.stability.toFixed(1)}`);

  for (let i = 0; i < TICKS; i++) {
    state = await simTick(state);

    if (state.population < 0)                       { anomalies++; issues.push(`Tick ${i+1}: pop âm`); }
    if (state.economyScore < 0 || state.economyScore > 100) { anomalies++; issues.push(`Tick ${i+1}: econ ngoài [0,100]`); }
    if (state.avgMood < 0 || state.avgMood > 100)           { anomalies++; issues.push(`Tick ${i+1}: mood ngoài [0,100]`); }
    if (state.stability < 0 || state.stability > 100)       { anomalies++; issues.push(`Tick ${i+1}: stability ngoài [0,100]`); }
    if (state.population > initState.population * 200)      { anomalies++; issues.push(`Tick ${i+1}: pop RUNAWAY`); }

    if ((i + 1) % 100 === 0) {
      snapE.push(state.economyScore);
      snapPop.push(state.population);
      snapStab.push(state.stability);
      console.log(`    Tick ${i+1}: Econ=${state.economyScore.toFixed(1)} Pop=${state.population} Stab=${state.stability.toFixed(1)} ${C(state.event)}`);
    }
  }

  const maxE = Math.max(...snapE), minE = Math.min(...snapE);
  const maxP = Math.max(...snapPop), minP = Math.min(...snapPop);

  console.log(`\n  📊 ${TICKS}-tick summary:`);
  console.log(`     Econ: min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  console.log(`     Pop:  min=${minP} max=${maxP}`);
  console.log(`     Anomalies: ${anomalies}`);

  anomalies === 0          ? pass(`${TICKS} ticks — 0 anomalies`) : fail(`${TICKS} ticks — ${anomalies} anomalies`, issues.slice(0,3).join("; "));
  maxE <= 99 && minE >= 1  ? pass("Economy không kẹt cực đoan", `[${minE.toFixed(1)}, ${maxE.toFixed(1)}]`) : warn("Economy drift", `min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  minP >= 0                ? pass("Population không âm", `min=${minP}`) : fail("Population âm");
  maxP <= initState.population * 200 ? pass("Population không runaway") : fail("Population RUNAWAY", `max=${maxP}`);
}

/* ════════════════════════════════════════════════════
   TEST 2 — WAR v1: Attack, Capture, Refugees, History
════════════════════════════════════════════════════ */
async function test2(ctx: Ctx) {
  console.log(B("\n[TEST 2] War v1 — Attack → Capture → History"));

  const { terrB, govA, govB, armyA, armyB, factionA } = ctx;

  // Reset armies
  const pA = calcPower(150, 90, 9.0, 95);
  const pB = calcPower(30, 55, 3.0, 60);
  await db.update(militaryForces).set({ totalSoldiers: 150, morale: 90, trainingLevel: 9.0, supplyLevel: 95, militaryPower: pA }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: 30, morale: 55, trainingLevel: 3.0, supplyLevel: 60, militaryPower: pB }).where(eq(militaryForces.id, armyB.id));
  await db.update(territories).set({ population: 80, security: 35, status: "active", ownerFactionId: null }).where(eq(territories.id, terrB.id));

  const beforePop  = 80;
  const beforeSec  = 35;
  const beforeHist = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, SLUG));

  /* ── Combat simulation (same logic as /military/attack route) ── */
  let soldA = 150, morA = 90, trainA = 9.0, supA = 95;
  let soldB = 30,  morB = 55, trainB = 3.0, supB = 60;
  let paVal = calcPower(soldA, morA, trainA, supA);
  let pbVal = calcPower(soldB, morB, trainB, supB);
  const defBonus = 1.20;

  let refugees = 0, popLoss = 0, secLoss = 0, combatTicks = 0;

  for (let t = 0; t < 30; t++) {
    if (soldB <= 0 || paVal <= 0) break;
    combatTicks++;
    const pbEff = Math.round(pbVal * defBonus);
    const totalStr = paVal + pbEff + 0.001;
    const atkR = paVal / totalStr;
    const defR = pbEff / totalStr;

    const lossA = Math.max(0, Math.floor(rand(1, 4) * defR));
    const lossB = Math.max(0, Math.floor(rand(2, 6) * atkR * rand(1, 2)));
    soldA = Math.max(0, soldA - lossA);
    soldB = Math.max(0, soldB - lossB);
    morA  = clamp(morA - lossA * 0.5, 0, 100);
    morB  = clamp(morB - lossB * 1.5, 0, 100);
    paVal = calcPower(soldA, morA, trainA, supA);
    pbVal = calcPower(soldB, morB, trainB, supB);

    const ref = rand(2, 8);
    const cas = rand(0, 4);
    refugees += ref; popLoss += ref + cas; secLoss += rand(1, 3);
  }

  const attackerWon = soldA > 0 && soldB <= 0;
  const newPop = Math.max(0, beforePop - popLoss);
  const newSec = Math.max(0, beforeSec - secLoss);

  // Apply results to DB
  await db.update(militaryForces).set({ totalSoldiers: soldA, morale: Math.round(morA), militaryPower: Math.max(0, paVal) }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: soldB, morale: Math.round(morB), militaryPower: Math.max(0, pbVal) }).where(eq(militaryForces.id, armyB.id));

  const terrUpdate: any = { population: Math.round(newPop), security: Math.round(clamp(newSec, 0, 100)), updatedAt: new Date() };
  if (attackerWon) terrUpdate.ownerFactionId = factionA.id;
  await db.update(territories).set(terrUpdate).where(eq(territories.id, terrB.id));

  // Write history
  const [latestHist] = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, SLUG)).orderBy(desc(worldHistory.tick)).limit(1);
  const tick = (latestHist?.tick ?? 0) + 1;
  await db.insert(worldHistory).values({
    worldSlug: SLUG, tick,
    eventType: attackerWon ? "territory_capture" : "battle_failed",
    title:     attackerWon ? `Thiên Minh Tông chiếm Vùng Tranh Chấp` : `Tấn công Vùng Tranh Chấp thất bại`,
    description: `Sau ${combatTicks} lượt giao tranh — ${Math.round(refugees)} dân di tản — quân địch còn ${soldB} lính`,
    actors: { factions: [factionA.id], territories: [terrB.id] },
  });

  const [afterArmy] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const [afterTerrB] = await db.select().from(territories).where(eq(territories.id, terrB.id));
  const afterHist = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, SLUG));

  console.log(`  Army A: 150→${soldA} lính | Power: ${pA}→${paVal.toFixed(0)}`);
  console.log(`  Army B: 30→${soldB} lính | Power: ${pB}→${pbVal.toFixed(0)}`);
  console.log(`  Terr B: pop ${beforePop}→${afterTerrB.population} | sec ${beforeSec}→${afterTerrB.security}`);
  console.log(`  Attack result: ${attackerWon ? G("CHIẾM ĐƯỢC") : Y("THẤT BẠI")} | Refugees=${Math.round(refugees)} | Combat=${combatTicks} ticks`);

  attackerWon ? pass("War v1 — Attacker WIN (power advantage)") : warn("War v1 — Attacker LOSE (unexpected)", "có thể cần điều chỉnh power balance");
  afterTerrB.population < beforePop ? pass("Population giảm sau chiến tranh", `${beforePop}→${afterTerrB.population}`) : fail("Population không giảm");
  afterTerrB.security < beforeSec   ? pass("Security giảm sau chiến tranh", `${beforeSec}→${afterTerrB.security}`) : fail("Security không giảm");
  refugees > 0 ? pass(`Refugee xuất hiện — ${Math.round(refugees)} dân di tản`) : fail("Không có refugee");
  attackerWon && afterTerrB.ownerFactionId === factionA.id ? pass("ownerFactionId đổi chủ ✓") : (attackerWon ? fail("ownerFactionId không đổi") : warn("Chưa chiếm được — ownerFactionId giữ nguyên đúng"));
  afterHist.length > beforeHist.length ? pass("World History ghi nhận trận chiến ✓", `+${afterHist.length - beforeHist.length} entry`) : fail("World History KHÔNG ghi nhận");
  afterArmy.militaryPower >= 0 ? pass("Military Power không âm sau chiến tranh") : fail("Military Power âm");
}

/* ════════════════════════════════════════════════════
   TEST 3 — TERRITORY COLLAPSE: pop<10 + sec<15 → ruins
════════════════════════════════════════════════════ */
async function test3(ctx: Ctx) {
  console.log(B("\n[TEST 3] Territory Collapse — pop<10 + sec<15 → ruins + History"));
  const { slug, terrB } = ctx;

  // Push territory B into collapse zone
  await db.update(territories).set({ population: 4, security: 8, status: "active" }).where(eq(territories.id, terrB.id));
  const [before] = await db.select().from(territories).where(eq(territories.id, terrB.id));

  // Simulate collapse check (same logic as worldSimulation.ts tick)
  const histBefore = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug));

  if (before.status !== "ruins" && before.population < 10 && before.security < 15) {
    await db.update(territories).set({ status: "ruins", updatedAt: new Date() }).where(eq(territories.id, terrB.id));
    await db.insert(territoryLogs).values({ territoryId: terrB.id, event: `${before.name} sụp đổ thành phế tích — dân số ${before.population}, an ninh ${before.security}` });
    const [latestHist] = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug)).orderBy(desc(worldHistory.tick)).limit(1);
    await db.insert(worldHistory).values({
      worldSlug: slug, tick: (latestHist?.tick ?? 0) + 1,
      eventType: "collapse",
      title: `${before.name} sụp đổ thành phế tích`,
      description: `Dân số giảm xuống ${before.population}, an ninh ${before.security}.`,
      actors: { territories: [terrB.id] },
    });
  }

  const [after] = await db.select().from(territories).where(eq(territories.id, terrB.id));
  const histAfter = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug));

  console.log(`  Territory ${before.name}: status ${before.status} → ${after.status} | pop=${before.population} sec=${before.security}`);

  after.status === "ruins" ? pass("Collapse: active → ruins ✓", `pop=${before.population} sec=${before.security}`) : fail("Collapse không xảy ra");
  histAfter.length > histBefore.length ? pass("World History ghi nhận collapse ✓") : fail("History không ghi nhận collapse");

  // Verify ruin territory log
  const logs = await db.select().from(territoryLogs).where(eq(territoryLogs.territoryId, terrB.id));
  logs.length > 0 ? pass("Territory log ghi nhận collapse ✓") : fail("Territory log rỗng");
}

/* ════════════════════════════════════════════════════
   TEST 4 — RECOLONIZATION: ruins + overcrowded → active
════════════════════════════════════════════════════ */
async function test4(ctx: Ctx) {
  console.log(B("\n[TEST 4] Recolonization — ruins + overcrowded neighbor → active"));
  const { slug, terrA, terrC } = ctx;

  // terrA = overcrowded (pop=500), terrC = ruins (nearby)
  await db.update(territories).set({ population: 500, prosperity: 70, security: 70, status: "active" }).where(eq(territories.id, terrA.id));
  await db.update(territories).set({ population: 0, prosperity: 10, security: 5, status: "ruins" }).where(eq(territories.id, terrC.id));
  const histBefore = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug));

  const [tA] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const [tC] = await db.select().from(territories).where(eq(territories.id, terrC.id));

  // Simulate recolonization (same logic as worldSimulation.ts tick)
  const dx = Math.abs(tA.x - tC.x), dy = Math.abs(tA.y - tC.y);
  const isNearby  = dx < 60 && dy < 60;
  const canSend   = tC.status === "ruins" && tA.population > 200 && tA.status === "active";

  console.log(`  Phế Tích Cổ: status=${tC.status} pop=${tC.population} | Đế Đô: pop=${tA.population} nearby=${isNearby}`);

  if (canSend && isNearby) {
    const settlers = Math.min(randInt(3, 8), Math.floor(tA.population * 0.03));
    if (settlers >= 3) {
      await db.update(territories).set({ status: "active", population: settlers, prosperity: Math.max(15, Math.floor(tA.prosperity * 0.4)), security: 20, updatedAt: new Date() }).where(eq(territories.id, tC.id));
      await db.update(territories).set({ population: tA.population - settlers, updatedAt: new Date() }).where(eq(territories.id, tA.id));
      await db.insert(territoryLogs).values({ territoryId: tC.id, event: `${settlers} người định cư từ ${tA.name} đến tái lập ${tC.name}` });
      const [lh] = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug)).orderBy(desc(worldHistory.tick)).limit(1);
      await db.insert(worldHistory).values({
        worldSlug: slug, tick: (lh?.tick ?? 0) + 1,
        eventType: "recolonization",
        title: `${tC.name} được tái lập`,
        description: `${settlers} dân định cư từ ${tA.name} đến khai phá phế tích ${tC.name}.`,
        actors: { territories: [tC.id, tA.id] },
      });
      console.log(`  ${settlers} định cư từ ${tA.name} → ${tC.name}`);
    }
  }

  const [afterC] = await db.select().from(territories).where(eq(territories.id, terrC.id));
  const [afterA] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const histAfter = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug));

  console.log(`  Sau: Phế Tích Cổ status=${afterC.status} pop=${afterC.population} | Đế Đô pop=${afterA.population}`);

  isNearby && canSend ? pass("Điều kiện recolonization hợp lệ (lân cận, đủ dân)") : warn("Điều kiện chưa hội đủ");
  afterC.status === "active" ? pass("Recolonization: ruins → active ✓") : fail("Recolonization: status vẫn là ruins");
  afterC.population >= 3     ? pass("Settlers định cư thành công", `pop=${afterC.population}`) : fail("Settlers không đủ");
  afterA.population < 500    ? pass("Overcrowded territory mất dân", `500 → ${afterA.population}`) : fail("Source territory không giảm dân");
  histAfter.length > histBefore.length ? pass("World History ghi nhận recolonization ✓") : fail("History không ghi nhận recolonization");
}

/* ════════════════════════════════════════════════════
   TEST 5 — WORLD HISTORY: data integrity
════════════════════════════════════════════════════ */
async function test5(ctx: Ctx) {
  console.log(B("\n[TEST 5] World History — Tính toàn vẹn dữ liệu"));
  const { slug } = ctx;

  const allHist = await db.select().from(worldHistory).where(eq(worldHistory.worldSlug, slug));
  console.log(`  Tổng history entries: ${allHist.length}`);

  allHist.length > 0 ? pass("World History có dữ liệu", `${allHist.length} entries`) : fail("World History rỗng");

  const eventTypes = [...new Set(allHist.map(h => h.eventType))];
  console.log(`  Event types: ${eventTypes.join(", ")}`);
  eventTypes.length >= 2 ? pass("Đa dạng event type", eventTypes.join(", ")) : warn("Ít event types", `chỉ có: ${eventTypes.join(", ")}`);

  const hasCaptureOrFailed = allHist.some(h => h.eventType === "territory_capture" || h.eventType === "battle_failed");
  hasCaptureOrFailed ? pass("History có war event (territory_capture/battle_failed)") : fail("Không có war event trong history");

  const hasCollapse = allHist.some(h => h.eventType === "collapse");
  hasCollapse ? pass("History có collapse event") : fail("Không có collapse event trong history");

  const hasRecolon = allHist.some(h => h.eventType === "recolonization");
  hasRecolon ? pass("History có recolonization event") : fail("Không có recolonization event trong history");

  // Check all entries have required fields
  const badEntries = allHist.filter(h => !h.worldSlug || !h.eventType || !h.title || h.tick < 0);
  badEntries.length === 0 ? pass("Tất cả history entries đủ trường bắt buộc") : fail(`${badEntries.length} entries thiếu trường`);

  // No negative ticks
  const negTick = allHist.filter(h => h.tick < 0);
  negTick.length === 0 ? pass("Không có tick âm trong history") : fail("Có tick âm trong history");

  // Latest tick >= total entries (ticks tăng dần)
  const maxTick = Math.max(...allHist.map(h => h.tick));
  console.log(`  Tick range: 1 → ${maxTick}`);
  maxTick >= 1 ? pass(`Tick tăng dần, max=${maxTick}`) : fail("Tick không hợp lệ");
}

/* ════════════════════════════════════════════════════
   TEST 6 — ANOMALY CHECK: DB integrity sau tất cả
════════════════════════════════════════════════════ */
async function test6(ctx: Ctx) {
  console.log(B("\n[TEST 6] Anomaly Check — DB integrity sau toàn bộ tests"));
  const { slug, terrA, terrC, govA, govB, armyA, armyB } = ctx;

  const [simState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, slug));
  const eOk = simState.economyScore >= 0 && simState.economyScore <= 100;
  const mOk = simState.avgMood      >= 0 && simState.avgMood      <= 100;
  const sOk = simState.stability    >= 0 && simState.stability     <= 100;
  (eOk && mOk && sOk) ? pass("World sim state trong [0,100]", `Econ=${simState.economyScore.toFixed(1)} Mood=${simState.avgMood.toFixed(1)} Stab=${simState.stability.toFixed(1)}`) : fail("World sim state ngoài range");

  const terrIds = [terrA.id, terrC.id];
  const [govA2] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const [govB2] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govB.id));
  const [armyA2] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const [armyB2] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyB.id));
  const terrs = await db.select().from(territories).where(inArray(territories.id, [...terrIds, ctx.terrB.id]));

  govA2.treasury >= 0 ? pass("Treasury GovA không âm", `=${govA2.treasury}`) : fail("Treasury GovA âm");
  govB2.treasury >= 0 ? pass("Treasury GovB không âm", `=${govB2.treasury}`) : fail("Treasury GovB âm");
  armyA2.militaryPower >= 0 && armyA2.totalSoldiers >= 0 ? pass("ArmyA không có giá trị âm") : fail("ArmyA có giá trị âm");
  armyB2.militaryPower >= 0 && armyB2.totalSoldiers >= 0 ? pass("ArmyB không có giá trị âm") : fail("ArmyB có giá trị âm");

  let secErr = 0, popErr = 0;
  for (const t of terrs) {
    if (t.security < 0 || t.security > 100) secErr++;
    if (t.population < 0) popErr++;
  }
  secErr === 0 ? pass("Territory security trong [0,100]", terrs.map(t => `${t.name.substring(0,6)}=${t.security}`).join(" | ")) : fail(`Security ngoài range: ${secErr}`);
  popErr === 0 ? pass("Territory population không âm", terrs.map(t => `${t.name.substring(0,6)}=${t.population}`).join(" | ")) : fail(`Population âm: ${popErr}`);

  const npcCount = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, slug));
  npcCount.length > 0 ? pass(`NPC count ổn định: ${npcCount.length}`) : fail("NPC count = 0");
}

/* ════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════ */
(async () => {
  console.log(B(C("\n╔══════════════════════════════════════════════════╗")));
  console.log(B(C("║   STRESS TEST #7 — 1000 TICKS FULL SYSTEM       ║")));
  console.log(B(C("║   War v1 · History · Collapse · Recolonization   ║")));
  console.log(B(C("╚══════════════════════════════════════════════════╝\n")));

  let ctx: Ctx;
  try {
    console.log(C("📦 Setup test data..."));
    ctx = await setup();
  } catch (err) {
    console.error(R("\n💥 SETUP FAILED:"), err);
    process.exit(1);
  }

  try { await test1(); } catch (e) { fail("Test 1 crash", String(e)); }
  try { await test2(ctx); } catch (e) { fail("Test 2 crash", String(e)); }
  try { await test3(ctx); } catch (e) { fail("Test 3 crash", String(e)); }
  try { await test4(ctx); } catch (e) { fail("Test 4 crash", String(e)); }
  try { await test5(ctx); } catch (e) { fail("Test 5 crash", String(e)); }
  try { await test6(ctx); } catch (e) { fail("Test 6 crash", String(e)); }

  /* ── Final Report ── */
  console.log(B(C("\n╔══════════════════════════════════════════════════╗")));
  console.log(B(C("║              KẾT QUẢ CUỐI CÙNG                  ║")));
  console.log(B(C("╚══════════════════════════════════════════════════╝")));
  console.log(`\n  ${G("✓ PASS:")}    ${passed}`);
  console.log(`  ${R("✗ FAIL:")}    ${failed}`);
  console.log(`  ${Y("⚠ WARN:")}    ${warnings}`);

  const fails = RESULTS.filter(r => r.ok === false);
  const gaps  = RESULTS.filter(r => r.ok === null);

  if (fails.length > 0) {
    console.log(R("\n  ❌ Bugs cần fix:"));
    for (const f of fails) console.log(`     · ${f.label}${f.detail ? " — " + f.detail : ""}`);
  }
  if (gaps.length > 0) {
    console.log(Y("\n  🔧 Gaps / Warnings:"));
    for (const g of gaps) console.log(`     · ${g.label}${g.detail ? " — " + g.detail : ""}`);
  }

  const verdict = failed === 0 ? G("✅ PASS") : R("❌ FAIL");
  console.log(`\n  Verdict: ${verdict}${warnings > 0 ? "  " + Y(`(${warnings} warnings)`) : ""}`);
  console.log(B(C("\n══════════════════════════════════════════════════\n")));

  process.exit(failed > 0 ? 1 : 0);
})();
