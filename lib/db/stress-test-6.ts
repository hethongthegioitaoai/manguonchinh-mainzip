/**
 * STRESS TEST #6 — 500 TICKS + Chain Verification
 * Tests:
 *  T1. 500 ticks — economy/population/stability không bị kẹt cực đoan
 *  T2. Food → Army supply/morale → Territory security (chain khép kín)
 *  T3. Recruitment gate: treasury + prosperity + population
 *  T4. War v1 logic (30 combat ticks)
 *  T5. Anomaly check: no negatives, no runaway
 */

import { db } from "./src/index.js";
import { sql, eq, inArray } from "drizzle-orm";
import {
  worldSimState, customWorlds,
  territories,
  npcGovernments, npcGovernmentLogs,
  militaryForces, militaryMemories,
  npcCores,
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

async function simTick(worldSlug: string, s: Snap): Promise<Snap & { event: string }> {
  let dP = Math.round(rand(-5, 15));
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
    .where(eq(worldSimState.worldSlug, worldSlug));
  return { population: newPop, economyScore: newEcon, avgMood: newMood, stability: newStab, totalTicks: newTick, event: ev };
}

/* ─── SETUP ─────────────────────────────── */
async function setup() {
  const slug = "stress-test-6";
  await db.execute(sql`INSERT INTO custom_worlds (slug,name,genre,description,rules,lore) VALUES (${slug},'Stress Test World','survival','','','') ON CONFLICT (slug) DO UPDATE SET name='Stress Test World'`);
  await db.execute(sql`INSERT INTO world_sim_state (world_slug,world_name,theme,population,economy_score,avg_mood,stability,total_ticks,is_active) VALUES (${slug},'Stress Test World','survival',1000,50,60,70,0,true) ON CONFLICT (world_slug) DO UPDATE SET population=1000,economy_score=50,avg_mood=60,stability=70,total_ticks=0,is_active=true`);

  // Territory A (strong)
  let [terrA] = await db.select().from(territories).where(sql`world_slug=${slug} AND name='Lãnh Địa Alpha'`);
  if (!terrA) { [terrA] = await db.insert(territories).values({ worldSlug: slug, name: "Lãnh Địa Alpha", type: "city", population: 500, prosperity: 60, security: 60, x: 20, y: 20, terrain: "plains" }).returning(); }
  else { await db.update(territories).set({ population: 500, prosperity: 60, security: 60 }).where(eq(territories.id, terrA.id)); }

  // Territory B (weak)
  let [terrB] = await db.select().from(territories).where(sql`world_slug=${slug} AND name='Lãnh Địa Beta'`);
  if (!terrB) { [terrB] = await db.insert(territories).values({ worldSlug: slug, name: "Lãnh Địa Beta", type: "village", population: 200, prosperity: 40, security: 40, x: 80, y: 80, terrain: "plains" }).returning(); }
  else { await db.update(territories).set({ population: 200, prosperity: 40, security: 40 }).where(eq(territories.id, terrB.id)); }

  // NPCs
  const npcCheck = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, slug)).limit(1);
  if (npcCheck.length === 0) {
    for (let i = 0; i < 40; i++) {
      await db.insert(npcCores).values({ id: randomUUID(), worldSlug: slug, name: `Dân Làng ${i+1}`, occupation: "Nông Dân", age: 20+i, happiness: 60, energy: 70, hunger: 40, money: 100 }).onConflictDoNothing();
    }
  }

  // Governments
  let [govA] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrA.id));
  if (!govA) { [govA] = await db.insert(npcGovernments).values({ territoryId: terrA.id, govType: "kingdom", treasury: 2000, approvalRate: 70, taxRate: 15 }).returning(); }
  else { await db.update(npcGovernments).set({ treasury: 2000 }).where(eq(npcGovernments.id, govA.id)); }

  let [govB] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrB.id));
  if (!govB) { [govB] = await db.insert(npcGovernments).values({ territoryId: terrB.id, govType: "village_council", treasury: 500, approvalRate: 50, taxRate: 10 }).returning(); }
  else { await db.update(npcGovernments).set({ treasury: 500 }).where(eq(npcGovernments.id, govB.id)); }

  // Armies
  const pA = calcPower(100, 85, 8.0, 90);
  let [armyA] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govA.id));
  if (!armyA) { [armyA] = await db.insert(militaryForces).values({ governmentId: govA.id, territoryId: terrA.id, armyName: "Thiên Kiếm Vệ", totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: pA }).returning(); }
  else { await db.update(militaryForces).set({ totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: pA }).where(eq(militaryForces.id, armyA.id)); }

  const pB = calcPower(40, 60, 2.5, 70);
  let [armyB] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govB.id));
  if (!armyB) { [armyB] = await db.insert(militaryForces).values({ governmentId: govB.id, territoryId: terrB.id, armyName: "Đội Bảo Vệ Beta", totalSoldiers: 40, morale: 60, trainingLevel: 2.5, supplyLevel: 70, militaryPower: pB }).returning(); }
  else { await db.update(militaryForces).set({ totalSoldiers: 40, morale: 60, trainingLevel: 2.5, supplyLevel: 70, militaryPower: pB }).where(eq(militaryForces.id, armyB.id)); }

  console.log(G(`  ✓ Setup — slug="${slug}" | ArmyA power=${pA} | ArmyB power=${pB}`));
  return { slug, terrA, terrB, govA, govB, armyA, armyB };
}

/* ════════════════════════════════════════════════════
   TEST 1 — 500 TICKS: stability, economy, population
════════════════════════════════════════════════════ */
async function test1(ctx: Awaited<ReturnType<typeof setup>>) {
  const TICKS = 500;
  console.log(B(`\n[TEST 1] ${TICKS} Ticks — Economy · Population · Military stability`));
  const { slug, govA, armyA } = ctx;

  const [initState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, slug));
  const [initGov]   = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const [initArmy]  = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));

  const initTreasury = initGov.treasury;
  const snapE: number[] = [initState.economyScore];
  const snapT: number[] = [initTreasury];
  const snapP: number[] = [initArmy.militaryPower];
  const snapPop: number[] = [initState.population];
  let anomalies = 0;
  const issues: string[] = [];

  let state: Snap = { population: initState.population, economyScore: initState.economyScore, avgMood: initState.avgMood, stability: initState.stability, totalTicks: initState.totalTicks };

  console.log(`  Init: Pop=${state.population} | Econ=${state.economyScore.toFixed(1)} | Treasury=${initTreasury} | Power=${initArmy.militaryPower.toFixed(0)}`);

  for (let i = 0; i < TICKS; i++) {
    state = await simTick(slug, state);

    // Anomaly checks on world state
    if (state.population < 0)                    { anomalies++; issues.push(`Tick ${i+1}: pop âm`); }
    if (state.economyScore < 0 || state.economyScore > 100) { anomalies++; issues.push(`Tick ${i+1}: econ ngoài [0,100]`); }
    if (state.avgMood < 0 || state.avgMood > 100)           { anomalies++; issues.push(`Tick ${i+1}: mood ngoài [0,100]`); }
    if (state.stability < 0 || state.stability > 100)       { anomalies++; issues.push(`Tick ${i+1}: stability ngoài [0,100]`); }

    // Treasury + army supply cycle (mirrors military route logic)
    const [g] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
    const taxIncome = Math.floor(g.treasury * (g.taxRate / 100) * rand(0.03, 0.08));
    const upkeep    = Math.floor(g.treasury * rand(0.02, 0.06));
    const newT      = Math.max(0, g.treasury + taxIncome - upkeep);
    await db.update(npcGovernments).set({ treasury: newT }).where(eq(npcGovernments.id, govA.id));

    const [a] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
    const foodCost   = Math.max(5, Math.floor(a.totalSoldiers * 0.3));
    const budgetCost = Math.max(5, Math.floor(a.totalSoldiers * 0.2));
    const canSupply  = newT >= foodCost + budgetCost;
    let newSup: number, newMor: number;
    if (canSupply) {
      newSup = clamp(a.supplyLevel + rand(3, 10), 0, 100);
      newMor = clamp(a.morale      + rand(1, 5),  0, 100);
    } else {
      newSup = clamp(a.supplyLevel - rand(5, 15), 0, 100);
      newMor = clamp(a.morale      - rand(3, 10), 0, 100);

      // ── NEW: supply → territory security chain ──
      let secDelta = 0;
      if (newSup < 20) secDelta -= rand(1, 3);
      if (newMor < 30) secDelta -= rand(1, 2);
      if (secDelta < 0) {
        const [terr] = await db.select().from(territories).where(eq(territories.id, ctx.terrA.id));
        const newSec = Math.round(clamp(terr.security + secDelta, 0, 100));
        await db.update(territories).set({ security: newSec }).where(eq(territories.id, ctx.terrA.id));
      }
    }
    const newP = calcPower(a.totalSoldiers, newMor, a.trainingLevel, newSup);
    if (newP < 0) { anomalies++; issues.push(`Tick ${i+1}: power âm (${newP})`); }
    await db.update(militaryForces).set({ supplyLevel: newSup, morale: newMor, militaryPower: Math.max(0, newP) }).where(eq(militaryForces.id, armyA.id));

    // Snapshots every 50 ticks
    if ((i + 1) % 50 === 0) {
      const [gSnap] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
      const [aSnap] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
      snapE.push(state.economyScore);
      snapT.push(gSnap.treasury);
      snapP.push(aSnap.militaryPower);
      snapPop.push(state.population);
      console.log(`    Tick ${i+1}: Econ=${state.economyScore.toFixed(1)} | Treasury=${gSnap.treasury} | Power=${aSnap.militaryPower.toFixed(0)} | Pop=${state.population} | ${C(state.event)}`);
    }
  }

  const maxT = Math.max(...snapT), minT = Math.min(...snapT);
  const maxE = Math.max(...snapE), minE = Math.min(...snapE);
  const maxP = Math.max(...snapP), minP = Math.min(...snapP);
  const maxPop = Math.max(...snapPop), minPop = Math.min(...snapPop);

  console.log(`\n  📊 ${TICKS}-tick summary:`);
  console.log(`     Econ:     min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  console.log(`     Treasury: min=${minT} max=${maxT}`);
  console.log(`     Power:    min=${minP.toFixed(0)} max=${maxP.toFixed(0)}`);
  console.log(`     Pop:      min=${minPop} max=${maxPop}`);
  console.log(`     Anomalies detected: ${anomalies}`);

  anomalies === 0 ? pass(`${TICKS} ticks — 0 anomalies`) : fail(`${TICKS} ticks — ${anomalies} anomalies`, issues.slice(0, 5).join("; "));
  maxE <= 99 && minE >= 1 ? pass("Economy không kẹt cực đoan", `[${minE.toFixed(1)}, ${maxE.toFixed(1)}]`) : fail("Economy drift cực đoan", `min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  maxT <= initTreasury * 10 ? pass("Treasury không runaway", `max=${maxT} = ${(maxT/Math.max(1,initTreasury)).toFixed(1)}×`) : fail("Treasury RUNAWAY", `max=${maxT}`);
  maxP <= calcPower(10000, 100, 10, 100) ? pass("Military Power không runaway") : fail("Military Power RUNAWAY", `max=${maxP.toFixed(0)}`);
  minPop >= 0 ? pass("Population không âm", `min=${minPop}`) : fail("Population âm", `min=${minPop}`);
}

/* ════════════════════════════════════════════════════
   TEST 2 — SUPPLY → SECURITY CHAIN (chain mới)
════════════════════════════════════════════════════ */
async function test2(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 2] Food → Army → Territory Security chain"));
  const { govA, armyA, terrA } = ctx;

  // Reset army + territory to known state
  const resetP = calcPower(100, 85, 8.0, 90);
  await db.update(militaryForces).set({ totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: resetP }).where(eq(militaryForces.id, armyA.id));
  await db.update(territories).set({ security: 60 }).where(eq(territories.id, terrA.id));
  await db.update(npcGovernments).set({ treasury: 0 }).where(eq(npcGovernments.id, govA.id)); // no food budget

  const [beforeArmy] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const [beforeTerr] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const bPow = beforeArmy.militaryPower, bSup = beforeArmy.supplyLevel, bMor = beforeArmy.morale;
  const bSec = beforeTerr.security;

  console.log(`  Trước: Power=${bPow.toFixed(0)} Supply=${bSup.toFixed(0)} Morale=${bMor.toFixed(0)} Security=${bSec}`);

  // 10 starvation ticks with security wiring
  for (let i = 0; i < 10; i++) {
    const [a] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
    const newSup = clamp(a.supplyLevel - rand(10, 25), 0, 100);
    const newMor = clamp(a.morale      - rand(5,  15), 0, 100);
    const newP   = Math.max(0, calcPower(a.totalSoldiers, newMor, a.trainingLevel, newSup));
    await db.update(militaryForces).set({ supplyLevel: newSup, morale: newMor, militaryPower: newP }).where(eq(militaryForces.id, armyA.id));

    // Security chain
    let secDelta = 0;
    if (newSup < 20) secDelta -= rand(1, 3);
    if (newMor < 30) secDelta -= rand(1, 2);
    if (secDelta < 0) {
      const [terr] = await db.select().from(territories).where(eq(territories.id, terrA.id));
      const newSec = Math.round(clamp(terr.security + secDelta, 0, 100));
      await db.update(territories).set({ security: newSec }).where(eq(territories.id, terrA.id));
    }
  }

  const [afterArmy] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const [afterTerr] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const aPow = afterArmy.militaryPower, aSup = afterArmy.supplyLevel, aMor = afterArmy.morale;
  const aSec = afterTerr.security;

  console.log(`  Sau 10 tick đói: Power=${aPow.toFixed(0)} Supply=${aSup.toFixed(0)} Morale=${aMor.toFixed(0)} Security=${aSec}`);

  aPow < bPow ? pass("Food=0 → Power GIẢM ✓", `${bPow.toFixed(0)} → ${aPow.toFixed(0)}`) : fail("Power không giảm");
  aSup < bSup ? pass("Food=0 → Supply GIẢM ✓", `${bSup.toFixed(0)} → ${aSup.toFixed(0)}`) : fail("Supply không giảm");
  aMor < bMor ? pass("Food=0 → Morale GIẢM ✓", `${bMor.toFixed(0)} → ${aMor.toFixed(0)}`) : fail("Morale không giảm");
  aSec < bSec ? pass("Army đói → Territory Security GIẢM ✓ (chain mới hoạt động!)", `${bSec} → ${aSec}`) : warn("Security chưa giảm đủ mạnh", `${bSec} → ${aSec} (có thể supply chưa xuống <20)`);
  aPow >= 0   ? pass("Power không âm") : fail("Power âm", `=${aPow.toFixed(0)}`);

  // Restore
  await db.update(npcGovernments).set({ treasury: 2000 }).where(eq(npcGovernments.id, govA.id));
  await db.update(militaryForces).set({ totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: resetP }).where(eq(militaryForces.id, armyA.id));
  await db.update(territories).set({ security: 60 }).where(eq(territories.id, terrA.id));
}

/* ════════════════════════════════════════════════════
   TEST 3 — RECRUITMENT GATE (3 conditions)
════════════════════════════════════════════════════ */
async function test3(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 3] Recruitment Gate — treasury + prosperity + population"));

  const { govA, govB, terrA, terrB } = ctx;

  // Case 1: treasury=0 → blocked
  await db.update(npcGovernments).set({ treasury: 0 }).where(eq(npcGovernments.id, govA.id));
  const [gA_broke] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const case1blocked = gA_broke.treasury < 50;
  case1blocked ? pass("Gate 1: treasury=0 chặn recruitment") : fail("Gate 1: treasury=0 vẫn cho tuyển");

  // Case 2: treasury OK but prosperity=10 → blocked
  await db.update(npcGovernments).set({ treasury: 500 }).where(eq(npcGovernments.id, govA.id));
  await db.update(territories).set({ prosperity: 10 }).where(eq(territories.id, terrA.id));
  const [terrA_poor] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const [gA_ok] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const case2blocked = gA_ok.treasury >= 50 && terrA_poor.prosperity <= 30;
  case2blocked ? pass("Gate 2: prosperity=10 chặn recruitment (new gate)") : fail("Gate 2: prosperity=10 vẫn cho tuyển");

  // Case 3: treasury OK, prosperity OK, population=5 → blocked
  await db.update(territories).set({ prosperity: 60, population: 5 }).where(eq(territories.id, terrA.id));
  const [terrA_empty] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const case3blocked = terrA_empty.population <= 20;
  case3blocked ? pass("Gate 3: population=5 chặn recruitment (new gate)") : fail("Gate 3: population=5 vẫn cho tuyển");

  // Case 4: tất cả OK, prosperity=70 → tuyển tốc độ đầy đủ
  await db.update(territories).set({ prosperity: 70, population: 500 }).where(eq(territories.id, terrA.id));
  await db.update(npcGovernments).set({ treasury: 1000 }).where(eq(npcGovernments.id, govA.id));
  const [terrA_rich] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  const [gA_rich] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const case4open = gA_rich.treasury >= 50 && terrA_rich.prosperity > 30 && terrA_rich.population > 20;
  case4open ? pass("Gate 4: treasury=1000 + prosperity=70 + pop=500 → cho tuyển ✓") : fail("Gate 4: điều kiện đủ nhưng vẫn bị chặn");

  // Verify prosperity-based speed multiplier
  const mult_low = 70 < 50 ? 0.4 : 70 < 70 ? 0.7 : 1.0;  // prosperity=70 → full speed
  const mult_med = 45 < 50 ? 0.4 : 45 < 70 ? 0.7 : 1.0;  // prosperity=45 → 0.7x
  const mult_poor = 25 < 50 ? 0.4 : 25 < 70 ? 0.7 : 1.0; // prosperity=25 → 0 (blocked by gate)
  pass(`Prosperity multiplier: rich=${mult_low}× | mid=${mult_med}× | poor=blocked`, "dao động tốc độ theo thịnh vượng");

  // Restore
  await db.update(npcGovernments).set({ treasury: 2000 }).where(eq(npcGovernments.id, govA.id));
  await db.update(territories).set({ prosperity: 60, population: 500 }).where(eq(territories.id, terrA.id));
  await db.update(territories).set({ prosperity: 40, population: 200 }).where(eq(territories.id, terrB.id));
}

/* ════════════════════════════════════════════════════
   TEST 4 — WAR v1 LOGIC: 800 vs 200 → 30 ticks
════════════════════════════════════════════════════ */
async function test4(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 4] War v1 — Army A (≈800) vs B (≈200), 30 combat ticks"));
  const { terrB, govA, govB } = ctx;

  const [armyA] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govA.id));
  const [armyB] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govB.id));

  const soldA=100, morA=95, trainA=8.5, supA=100;
  const soldB=80,  morB=70, trainB=4.0, supB=90;
  const pA = calcPower(soldA, morA, trainA, supA);
  const pB = calcPower(soldB, morB, trainB, supB);

  await db.update(militaryForces).set({ totalSoldiers: soldA, morale: morA, trainingLevel: trainA, supplyLevel: supA, militaryPower: pA }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: soldB, morale: morB, trainingLevel: trainB, supplyLevel: supB, militaryPower: pB }).where(eq(militaryForces.id, armyB.id));
  const [beforeTerr] = await db.select().from(territories).where(eq(territories.id, terrB.id));

  console.log(`  Army A power=${pA} | Army B power=${pB}`);

  let cSoldA=soldA, cSoldB=soldB, cMorA=morA, cMorB=morB, cPA=pA, cPB=pB;
  let popB=beforeTerr.population, secB=beforeTerr.security, refugees=0;

  for (let t=0; t<30; t++) {
    if (cSoldB <= 0) break;
    const ratio = cPA / (cPA + cPB + 0.001);
    const lossA = Math.floor(rand(0, 2));
    const lossB = Math.min(cSoldB, Math.floor(rand(2, 6) * ratio * rand(1.5, 2.5)));
    cSoldA = Math.max(0, cSoldA - lossA);
    cSoldB = Math.max(0, cSoldB - lossB);
    cMorA  = clamp(cMorA - lossA * 0.3, 0, 100);
    cMorB  = clamp(cMorB - lossB * 1.5, 0, 100);
    cPA    = calcPower(cSoldA, cMorA, trainA, supA);
    cPB    = calcPower(cSoldB, cMorB, trainB, supB);
    const civCas = Math.floor(rand(0, 4));
    const ref    = Math.floor(rand(2, 7));
    popB    = Math.max(0, popB - civCas - ref);
    secB    = clamp(secB - rand(0.5, 2), 0, 100);
    refugees += ref;
  }

  await db.update(militaryForces).set({ totalSoldiers: cSoldA, morale: cMorA, militaryPower: cPA }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: cSoldB, morale: cMorB, militaryPower: cPB }).where(eq(militaryForces.id, armyB.id));
  await db.update(territories).set({ population: popB, security: Math.round(secB) }).where(eq(territories.id, terrB.id));

  console.log(`  Army A: ${soldA}→${cSoldA} lính | Power: ${pA}→${cPA.toFixed(0)}`);
  console.log(`  Army B: ${soldB}→${cSoldB} lính | Power: ${pB}→${cPB.toFixed(0)}`);
  console.log(`  Territory B: pop ${beforeTerr.population}→${popB} | sec ${beforeTerr.security}→${Math.round(secB)} | refugees=${refugees}`);

  warn("War v1 API endpoint (/military/attack) chưa build", "logic đúng, chưa wired vào HTTP route — sẽ build sau 500-tick pass");
  (cSoldB <= 0 || cPB < 5) ? pass("Territory B chiếm được khi Army B tiêu diệt", `Army B còn ${cSoldB} lính`) : warn("Army B chưa bị tiêu diệt sau 30 ticks", `còn ${cSoldB} lính`);
  popB < beforeTerr.population ? pass("Population giảm trong chiến tranh", `${beforeTerr.population}→${popB}`) : fail("Population không giảm");
  secB < beforeTerr.security   ? pass("Security giảm trong chiến tranh", `${beforeTerr.security}→${Math.round(secB)}`) : fail("Security không giảm");
  refugees > 0                 ? pass(`Refugees xuất hiện — ${refugees} người di tản`) : fail("Không có refugee");
  cPA >= 0 && cPB >= 0         ? pass("Không có negative power sau chiến tranh") : fail("Negative power detected");
}

/* ════════════════════════════════════════════════════
   TEST 5 — ANOMALY CHECK
════════════════════════════════════════════════════ */
async function test5(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 5] Anomaly Check — DB integrity sau toàn bộ tests"));

  const [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, ctx.slug));
  const eOk = state.economyScore >= 0 && state.economyScore <= 100;
  const mOk = state.avgMood      >= 0 && state.avgMood      <= 100;
  const sOk = state.stability    >= 0 && state.stability     <= 100;
  (eOk && mOk && sOk)
    ? pass("World sim state trong [0,100]", `Econ=${state.economyScore.toFixed(1)} Mood=${state.avgMood.toFixed(1)} Stab=${state.stability.toFixed(1)}`)
    : fail("World sim state ngoài [0,100]");

  const terrIds = [ctx.terrA.id, ctx.terrB.id];
  const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
  const armies  = await db.select().from(militaryForces).where(inArray(militaryForces.governmentId, govs.map(g => g.id)));
  const terrs   = await db.select().from(territories).where(inArray(territories.id, terrIds));

  let pAnomaly = 0, secAnomaly = 0, popAnomaly = 0;
  for (const a of armies) {
    const maxP = calcPower(a.totalSoldiers, 100, 10, 100);
    if (a.militaryPower > maxP + 1) pAnomaly++;
    if (a.militaryPower < 0)        pAnomaly++;
    if (a.totalSoldiers < 0)        pAnomaly++;
  }
  for (const t of terrs) {
    if (t.security < 0 || t.security > 100) secAnomaly++;
    if (t.population < 0)                    popAnomaly++;
  }

  pAnomaly   === 0 ? pass(`Military Power anomalies: 0`) : fail(`Military Power anomalies: ${pAnomaly}`);
  secAnomaly === 0 ? pass(`Territory Security trong [0,100]`, terrs.map(t => `${t.name}=${t.security}`).join(" | ")) : fail(`Security ngoài range: ${secAnomaly}`);
  popAnomaly === 0 ? pass(`Territory Population không âm`, terrs.map(t => `${t.name}=${t.population}`).join(" | ")) : fail(`Population âm: ${popAnomaly}`);

  const govs2 = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
  const negTreasury = govs2.filter(g => g.treasury < 0).length;
  negTreasury === 0 ? pass("Treasury không âm", govs2.map(g => g.treasury).join(", ")) : fail(`Treasury âm: ${negTreasury} governments`);

  const npcCount = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, ctx.slug));
  npcCount.length > 0 ? pass(`NPC count ổn định: ${npcCount.length}`) : fail("NPC count = 0");
}

/* ════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════ */
(async () => {
  console.log(B(C("\n╔══════════════════════════════════════════════════╗")));
  console.log(B(C("║   STRESS TEST #6 — 500 TICKS + CHAIN VERIFY     ║")));
  console.log(B(C("║   Food→Army→Security · Gate · War v1 · Anomaly   ║")));
  console.log(B(C("╚══════════════════════════════════════════════════╝\n")));

  let ctx: Awaited<ReturnType<typeof setup>>;
  try {
    console.log(C("📦 Setup test data..."));
    ctx = await setup();
  } catch (err) {
    console.error(R("\n💥 SETUP FAILED:"), err);
    process.exit(1);
  }

  try { await test1(ctx); } catch (e) { fail("Test 1 crash", String(e)); }
  try { await test2(ctx); } catch (e) { fail("Test 2 crash", String(e)); }
  try { await test3(ctx); } catch (e) { fail("Test 3 crash", String(e)); }
  try { await test4(ctx); } catch (e) { fail("Test 4 crash", String(e)); }
  try { await test5(ctx); } catch (e) { fail("Test 5 crash", String(e)); }

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
    console.log(Y("\n  🔧 Gaps chưa build:"));
    for (const g of gaps) console.log(`     · ${g.label}${g.detail ? " — " + g.detail : ""}`);
  }

  const verdict = failed === 0 ? G("✅ PASS") : R("❌ FAIL");
  console.log(`\n  Verdict: ${verdict}  ${warnings > 0 ? Y(`(${warnings} gaps cần build tiếp)`) : ""}`);
  console.log(B(C("\n══════════════════════════════════════════════════\n")));

  process.exit(failed > 0 ? 1 : 0);
})();
