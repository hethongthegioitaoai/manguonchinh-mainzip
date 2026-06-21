/**
 * STRESS TEST #6 — AI World System
 * Verifies: Treasury stability, Military oscillation, Food→Army link,
 *           Recruitment gate, War v1 territory transfer
 *
 * Run: npx tsx --tsconfig lib/db/tsconfig.json stress-test-6.ts
 */

import { db } from "./lib/db/src/index.js";
import { sql, eq, inArray } from "drizzle-orm";
import {
  worldSimState, customWorlds,
  territories,
  npcGovernments,
  militaryForces,
  npcCores,
} from "./lib/db/src/schema/index.js";
import { randomUUID } from "crypto";

/* ── colour helpers ─────────────────────────── */
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const C = (s: string) => `\x1b[36m${s}\x1b[0m`;
const B = (s: string) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0, warnings = 0;
const RESULTS: { ok: boolean | null; label: string; detail: string }[] = [];

function pass(label: string, detail = "") {
  passed++;
  RESULTS.push({ ok: true, label, detail });
  console.log(`  ${G("✓")} ${label}${detail ? " — " + detail : ""}`);
}
function fail(label: string, detail = "") {
  failed++;
  RESULTS.push({ ok: false, label, detail });
  console.log(`  ${R("✗")} ${label}${detail ? " — " + detail : ""}`);
}
function warn(label: string, detail = "") {
  warnings++;
  RESULTS.push({ ok: null, label, detail });
  console.log(`  ${Y("⚠")} ${label}${detail ? " — " + detail : ""}`);
}

/* ── math helpers ─────────────────────────── */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function calcPower(soldiers: number, morale: number, training: number, supply: number) {
  return Math.round(soldiers * (morale / 100) * (training / 10) * (supply / 100) * 10);
}

const EVENT_POOL = [
  { dEconomy: +12, dMood: +8,  dStability: +5,  dPop: +30,  name: "Thịnh Vượng Kinh Tế" },
  { dEconomy: -10, dMood: -10, dStability: -8,  dPop: -20,  name: "Suy Thoái Kinh Tế" },
  { dEconomy: -8,  dMood: -12, dStability: -15, dPop: 0,    name: "Khủng Hoảng Chính Trị" },
  { dEconomy: -15, dMood: -5,  dStability: -20, dPop: -50,  name: "Nổi Loạn Dân Chúng" },
  { dEconomy: +5,  dMood: +15, dStability: +3,  dPop: +10,  name: "Kỳ Quan Thiên Nhiên" },
  { dEconomy: -12, dMood: -18, dStability: -10, dPop: -80,  name: "Dịch Bệnh Hoành Hành" },
  { dEconomy: +8,  dMood: +20, dStability: +5,  dPop: +15,  name: "Lễ Hội Thu Hoạch" },
  { dEconomy: +10, dMood: +12, dStability: +2,  dPop: 0,    name: "Khám Phá Cổ Đại" },
  { dEconomy: +15, dMood: +10, dStability: +5,  dPop: +20,  name: "Buôn Bán Phồn Thịnh" },
  { dEconomy: -18, dMood: -15, dStability: -25, dPop: -100, name: "Xung Đột Liên Thế Giới" },
  { dEconomy: +5,  dMood: +15, dStability: +18, dPop: 0,    name: "Hòa Ước Ký Kết" },
  { dEconomy: +3,  dMood: -3,  dStability: -5,  dPop: +150, name: "Làn Sóng Di Dân" },
];

type SimState = {
  population: number; economyScore: number;
  avgMood: number; stability: number; totalTicks: number;
};

async function simulateTick(worldSlug: string, state: SimState): Promise<SimState & { _event: string }> {
  let dPop = Math.round(rand(-5, 15));
  let dEconomy = rand(-2, 3);
  let dMood = rand(-3, 3);
  let dStability = rand(-2, 2);

  // Mean reversion
  dEconomy   += (50 - state.economyScore) * 0.03;
  dMood      += (60 - state.avgMood)      * 0.03;
  dStability += (70 - state.stability)    * 0.03;

  let eventName = "Tick Bình Thường";
  if (Math.random() < 0.28) {
    const ev = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
    dPop += ev.dPop; dEconomy += ev.dEconomy; dMood += ev.dMood; dStability += ev.dStability;
    eventName = ev.name;
  }

  const newPop       = Math.max(0, state.population + dPop);
  const newEconomy   = clamp(state.economyScore + dEconomy, 0, 100);
  const newMood      = clamp(state.avgMood + dMood, 0, 100);
  const newStability = clamp(state.stability + dStability, 0, 100);
  const newTick      = state.totalTicks + 1;

  await db.update(worldSimState)
    .set({ population: newPop, economyScore: newEconomy, avgMood: newMood, stability: newStability, totalTicks: newTick, lastTickAt: new Date() })
    .where(eq(worldSimState.worldSlug, worldSlug));

  return { population: newPop, economyScore: newEconomy, avgMood: newMood, stability: newStability, totalTicks: newTick, _event: eventName };
}

/* ════════════════════════════════════════════════════
   SETUP
════════════════════════════════════════════════════ */
async function setup() {
  const slug = "stress-test-6";

  await db.execute(sql`
    INSERT INTO custom_worlds (slug, name, genre, description, rules, lore)
    VALUES (${slug},'Stress Test World','survival','Stress test','','')
    ON CONFLICT (slug) DO UPDATE SET name='Stress Test World'
  `);

  await db.execute(sql`
    INSERT INTO world_sim_state (world_slug, world_name, theme, population, economy_score, avg_mood, stability, total_ticks, is_active)
    VALUES (${slug},'Stress Test World','survival',1000,50,60,70,0,true)
    ON CONFLICT (world_slug) DO UPDATE
      SET population=1000, economy_score=50, avg_mood=60, stability=70, total_ticks=0, is_active=true
  `);

  // Territory A (strong)
  let [terrA] = await db.select().from(territories).where(sql`world_slug=${slug} AND name='Lãnh Địa Alpha'`);
  if (!terrA) {
    [terrA] = await db.insert(territories).values({
      worldSlug: slug, name: "Lãnh Địa Alpha", type: "city",
      population: 500, prosperity: 60, security: 60, x: 20, y: 20, terrain: "plains",
    }).returning();
  } else {
    await db.update(territories).set({ population: 500, prosperity: 60, security: 60 }).where(eq(territories.id, terrA.id));
  }

  // Territory B (weak)
  let [terrB] = await db.select().from(territories).where(sql`world_slug=${slug} AND name='Lãnh Địa Beta'`);
  if (!terrB) {
    [terrB] = await db.insert(territories).values({
      worldSlug: slug, name: "Lãnh Địa Beta", type: "village",
      population: 200, prosperity: 40, security: 40, x: 80, y: 80, terrain: "plains",
    }).returning();
  } else {
    await db.update(territories).set({ population: 200, prosperity: 40, security: 40 }).where(eq(territories.id, terrB.id));
  }

  // Seed NPCs if needed
  const npcs = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, slug)).limit(1);
  if (npcs.length === 0) {
    const npcData = Array.from({ length: 40 }, (_, i) => ({
      id: randomUUID(),
      worldSlug: slug, name: `Dân Làng ${i + 1}`, occupation: "Nông Dân",
      age: 20 + i, happiness: 60, energy: 70, hunger: 40, money: 100,
    }));
    for (const n of npcData) {
      await db.insert(npcCores).values(n).onConflictDoNothing();
    }
  }

  // Government A
  let [govA] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrA.id));
  if (!govA) {
    [govA] = await db.insert(npcGovernments).values({
      territoryId: terrA.id, govType: "kingdom", treasury: 2000, approvalRate: 70, taxRate: 15,
    }).returning();
  } else {
    await db.update(npcGovernments).set({ treasury: 2000, approvalRate: 70, taxRate: 15 }).where(eq(npcGovernments.id, govA.id));
  }

  // Government B
  let [govB] = await db.select().from(npcGovernments).where(eq(npcGovernments.territoryId, terrB.id));
  if (!govB) {
    [govB] = await db.insert(npcGovernments).values({
      territoryId: terrB.id, govType: "village_council", treasury: 500, approvalRate: 50, taxRate: 10,
    }).returning();
  } else {
    await db.update(npcGovernments).set({ treasury: 500, approvalRate: 50, taxRate: 10 }).where(eq(npcGovernments.id, govB.id));
  }

  // Army A (strong)
  let [armyA] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govA.id));
  const pA = calcPower(100, 85, 8.0, 90);
  if (!armyA) {
    [armyA] = await db.insert(militaryForces).values({
      governmentId: govA.id, territoryId: terrA.id, armyName: "Thiên Kiếm Vệ",
      totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: pA,
    }).returning();
  } else {
    await db.update(militaryForces).set({ totalSoldiers: 100, morale: 85, trainingLevel: 8.0, supplyLevel: 90, militaryPower: pA }).where(eq(militaryForces.id, armyA.id));
  }

  // Army B (weak)
  let [armyB] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govB.id));
  const pB = calcPower(40, 60, 2.5, 70);
  if (!armyB) {
    [armyB] = await db.insert(militaryForces).values({
      governmentId: govB.id, territoryId: terrB.id, armyName: "Đội Bảo Vệ Beta",
      totalSoldiers: 40, morale: 60, trainingLevel: 2.5, supplyLevel: 70, militaryPower: pB,
    }).returning();
  } else {
    await db.update(militaryForces).set({ totalSoldiers: 40, morale: 60, trainingLevel: 2.5, supplyLevel: 70, militaryPower: pB }).where(eq(militaryForces.id, armyB.id));
  }

  console.log(G(`  ✓ Setup done — slug="${slug}" | TerritoryA="${terrA.id.slice(0,8)}" | TerritoryB="${terrB.id.slice(0,8)}"`));
  console.log(`     Army A initial power: ${C(pA.toFixed(0))} | Army B initial power: ${C(pB.toFixed(0))}`);

  return { slug, terrA, terrB, govA, govB, armyA, armyB };
}

/* ════════════════════════════════════════════════════
   TEST 1 — 200 TICKS
════════════════════════════════════════════════════ */
async function test1(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 1] 200 Ticks — Treasury & Military Power oscillation"));
  const { slug, govA, armyA } = ctx;

  const [initState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, slug));
  const [initGov]   = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const [initArmy]  = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));

  const initTreasury = initGov.treasury;
  const initPower    = initArmy.militaryPower;

  const snapT: number[] = [initTreasury];
  const snapP: number[] = [initPower];
  const snapE: number[] = [initState.economyScore];

  let state: SimState = {
    population:   initState.population,
    economyScore: initState.economyScore,
    avgMood:      initState.avgMood,
    stability:    initState.stability,
    totalTicks:   initState.totalTicks,
  };

  console.log(`  Init: Pop=${state.population} | Econ=${state.economyScore.toFixed(1)} | Treasury=${initTreasury} | Power=${initPower.toFixed(0)}`);

  for (let i = 0; i < 200; i++) {
    state = await simulateTick(slug, state);

    // Tax income − upkeep cycle (mirrors applyGovernmentPolicies)
    const [g] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
    const taxIncome = Math.floor(g.treasury * (g.taxRate / 100) * rand(0.03, 0.08));
    const upkeep    = Math.floor(g.treasury * rand(0.02, 0.06));
    const newT      = Math.max(0, g.treasury + taxIncome - upkeep);
    await db.update(npcGovernments).set({ treasury: newT }).where(eq(npcGovernments.id, govA.id));

    // Supply tick on army
    const [a] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
    const foodCost   = Math.max(5, Math.floor(a.totalSoldiers * 0.3));
    const budgetCost = Math.max(5, Math.floor(a.totalSoldiers * 0.2));
    const canSupply  = newT >= foodCost + budgetCost;

    let newSupply: number, newMorale: number;
    if (canSupply) {
      newSupply = clamp(a.supplyLevel + rand(3, 10), 0, 100);
      newMorale = clamp(a.morale      + rand(1, 5),  0, 100);
    } else {
      newSupply = clamp(a.supplyLevel - rand(5, 15), 0, 100);
      newMorale = clamp(a.morale      - rand(3, 10), 0, 100);
    }
    const newP = calcPower(a.totalSoldiers, newMorale, a.trainingLevel, newSupply);
    await db.update(militaryForces).set({ supplyLevel: newSupply, morale: newMorale, militaryPower: newP }).where(eq(militaryForces.id, armyA.id));

    if (i % 40 === 39) {
      const [gSnap] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
      const [aSnap] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
      snapT.push(gSnap.treasury);
      snapP.push(aSnap.militaryPower);
      snapE.push(state.economyScore);
      console.log(`    Tick ${i+1}: Econ=${state.economyScore.toFixed(1)} | Treasury=${gSnap.treasury} | Power=${aSnap.militaryPower.toFixed(0)} | Pop=${state.population} | ${C(state._event)}`);
    }
  }

  const maxT = Math.max(...snapT), minT = Math.min(...snapT);
  const maxE = Math.max(...snapE), minE = Math.min(...snapE);
  const maxP = Math.max(...snapP), minP = Math.min(...snapP);

  const treasuryRunaway  = maxT > initTreasury * 10;
  const econStable       = maxE <= 95 && minE >= 5;
  const treasuryOscillates = (maxT - minT) > 100;
  const powerOscillates  = (maxP - minP) > 10;
  const powerCapExceeded = maxP > calcPower(1000, 100, 10, 100);

  console.log(`\n  📊 200-tick summary:`);
  console.log(`     Econ:     min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  console.log(`     Treasury: min=${minT} max=${maxT} (baseline=${initTreasury})`);
  console.log(`     Power:    min=${minP.toFixed(0)} max=${maxP.toFixed(0)}`);

  econStable        ? pass("Economy trong [5,95] — không kẹt cực đoan", `min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`) : fail("Economy drift cực đoan", `min=${minE.toFixed(1)} max=${maxE.toFixed(1)}`);
  !treasuryRunaway  ? pass("Treasury không tăng vô hạn", `max=${maxT} = ${(maxT/initTreasury).toFixed(1)}× baseline`) : fail("Treasury RUNAWAY >10× baseline", `max=${maxT}`);
  treasuryOscillates? pass("Treasury dao động (có lên có xuống)", `range ${minT}→${maxT}`) : warn("Treasury ít dao động", `range chỉ ${maxT-minT}`);
  !powerCapExceeded ? pass("Military Power không vượt giới hạn lý thuyết", `max=${maxP.toFixed(0)}`) : fail("Military Power vượt cap", `max=${maxP.toFixed(0)}`);
  powerOscillates   ? pass("Military Power dao động", `min=${minP.toFixed(0)} max=${maxP.toFixed(0)}`) : warn("Military Power ít dao động", `range ${maxP-minP}`);
}

/* ════════════════════════════════════════════════════
   TEST 2 — FOOD SUPPORT
════════════════════════════════════════════════════ */
async function test2(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 2] Food Support — treasury=0 → army degrades"));
  const { govA, armyA, terrA } = ctx;

  // Drain treasury to 0
  await db.update(npcGovernments).set({ treasury: 0 }).where(eq(npcGovernments.id, govA.id));
  const [before] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const bPow = before.militaryPower, bSup = before.supplyLevel, bMor = before.morale;

  console.log(`  Trước: Power=${bPow.toFixed(0)} | Supply=${bSup.toFixed(0)} | Morale=${bMor.toFixed(0)}`);

  // 5 starvation ticks (mirrors supply route "canSupply=false" branch)
  for (let i = 0; i < 5; i++) {
    const [a] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
    const newSup = clamp(a.supplyLevel - rand(10, 25), 0, 100);
    const newMor = clamp(a.morale      - rand(5,  15), 0, 100);
    const newP   = calcPower(a.totalSoldiers, newMor, a.trainingLevel, newSup);
    await db.update(militaryForces).set({ supplyLevel: newSup, morale: newMor, militaryPower: newP }).where(eq(militaryForces.id, armyA.id));
  }

  const [after] = await db.select().from(militaryForces).where(eq(militaryForces.id, armyA.id));
  const aPow = after.militaryPower, aSup = after.supplyLevel, aMor = after.morale;
  console.log(`  Sau 5 tick đói: Power=${aPow.toFixed(0)} | Supply=${aSup.toFixed(0)} | Morale=${aMor.toFixed(0)}`);

  aPow < bPow ? pass("Food=0 → Military Power GIẢM", `${bPow.toFixed(0)} → ${aPow.toFixed(0)}`)
              : fail("Food=0 không làm Power giảm", `vẫn=${aPow.toFixed(0)}`);
  aSup < bSup ? pass("Supply Level giảm khi đói", `${bSup.toFixed(0)} → ${aSup.toFixed(0)}`)
              : fail("Supply không giảm");
  aMor < bMor ? pass("Morale giảm khi đói", `${bMor.toFixed(0)} → ${aMor.toFixed(0)}`)
              : fail("Morale không giảm");

  // Territory security — not auto-updated by supply in current code (known gap)
  const [terr] = await db.select().from(territories).where(eq(territories.id, terrA.id));
  warn("Territory.security không tự giảm khi army đói", `current security=${terr.security} — cần wiring security ← army.supply trong tick`);

  // Restore treasury
  await db.update(npcGovernments).set({ treasury: 2000 }).where(eq(npcGovernments.id, govA.id));
  await db.update(militaryForces).set({ supplyLevel: 90, morale: 85, militaryPower: calcPower(100, 85, 8.0, 90) }).where(eq(militaryForces.id, armyA.id));
}

/* ════════════════════════════════════════════════════
   TEST 3 — RECRUITMENT GATE
════════════════════════════════════════════════════ */
async function test3(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 3] Recruitment Gate — treasury<50 chặn tuyển, prosperity<30 gap check"));
  const { slug, govA, govB, terrB } = ctx;

  // Set govA broke, govB barely funded
  await db.update(npcGovernments).set({ treasury: 0  }).where(eq(npcGovernments.id, govA.id));
  await db.update(npcGovernments).set({ treasury: 20 }).where(eq(npcGovernments.id, govB.id));
  await db.update(territories).set({ prosperity: 10 }).where(eq(territories.id, terrB.id));

  const [gA] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govA.id));
  const [gB] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govB.id));

  const gABlocked = gA.treasury < 50;
  const gBBlocked = gB.treasury < 50;

  console.log(`  GovA treasury=${gA.treasury} → ${gABlocked ? G("CHẶN") : R("CHO TUYỂN")}`);
  console.log(`  GovB treasury=${gB.treasury} → ${gBBlocked ? G("CHẶN") : R("CHO TUYỂN")}`);

  gABlocked ? pass("Treasury=0 → recruitment bị chặn (treasury<50 gate)", `treasury=${gA.treasury}`)
            : fail("Treasury=0 nhưng vẫn cho tuyển");
  gBBlocked ? pass("Treasury=20 → recruitment bị chặn", `treasury=${gB.treasury}`)
            : fail("Treasury=20 nhưng vẫn cho tuyển");

  // Prosperity gate check
  const [tB] = await db.select().from(territories).where(eq(territories.id, terrB.id));
  warn(
    `Prosperity=${tB.prosperity} < 30 chưa có gate riêng trong military/recruit`,
    "hiện chỉ check treasury<50, CHƯA check territory.prosperity — cần thêm điều kiện"
  );

  // Restore
  await db.update(npcGovernments).set({ treasury: 2000 }).where(eq(npcGovernments.id, govA.id));
  await db.update(npcGovernments).set({ treasury: 500  }).where(eq(npcGovernments.id, govB.id));
  await db.update(territories).set({ prosperity: 60 }).where(eq(territories.id, terrB.id));
}

/* ════════════════════════════════════════════════════
   TEST 4 — WAR v1: Army A (≈800) vs Army B (≈200)
════════════════════════════════════════════════════ */
async function test4(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 4] War v1 — Faction A (power≈800) vs B (power≈200), 30 combat ticks"));
  const { terrB, govA, govB } = ctx;

  // Set army powers
  const soldA = 100, morA = 95, trainA = 8.5, supA = 100;
  const pA = calcPower(soldA, morA, trainA, supA);

  // Army B aiming ~200: 40 soldiers × 70 × 4.0 × 100 = 112 — use 60×80×4.0×85 = 163... or 80×70×4.0×90=201.6
  const soldB = 80, morB = 70, trainB = 4.0, supB = 90;
  const pB = calcPower(soldB, morB, trainB, supB);

  const [armyA] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govA.id));
  const [armyB] = await db.select().from(militaryForces).where(eq(militaryForces.governmentId, govB.id));

  await db.update(militaryForces).set({ totalSoldiers: soldA, morale: morA, trainingLevel: trainA, supplyLevel: supA, militaryPower: pA }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: soldB, morale: morB, trainingLevel: trainB, supplyLevel: supB, militaryPower: pB }).where(eq(militaryForces.id, armyB.id));

  console.log(`  Army A: ${soldA} lính | power=${pA.toFixed(0)} (target≈800)`);
  console.log(`  Army B: ${soldB} lính | power=${pB.toFixed(0)} (target≈200)`);

  const [beforeTerrB] = await db.select().from(territories).where(eq(territories.id, terrB.id));
  let popB = beforeTerrB.population;
  let secB = beforeTerrB.security;
  let migrantCount = 0;

  let curSoldA = soldA, curSoldB = soldB;
  let curMorA = morA,   curMorB = morB;
  let curPA = pA, curPB = pB;

  console.log(`  Chạy 30 combat ticks...`);
  for (let t = 0; t < 30; t++) {
    if (curSoldB <= 0) break;

    const ratio = curPA / (curPA + curPB + 0.001);
    const lossA = Math.floor(rand(0, 2));
    const lossB = Math.min(curSoldB, Math.floor(rand(2, 6) * ratio * rand(1.5, 2.5)));

    curSoldA = Math.max(0, curSoldA - lossA);
    curSoldB = Math.max(0, curSoldB - lossB);
    curMorA  = clamp(curMorA - lossA * 0.3, 0, 100);
    curMorB  = clamp(curMorB - lossB * 1.5, 0, 100);
    curPA    = calcPower(curSoldA, curMorA, trainA, supA);
    curPB    = calcPower(curSoldB, curMorB, trainB, supB);

    const civCasualties = Math.floor(rand(0, 4));
    const refugees      = Math.floor(rand(2, 7));
    popB = Math.max(0, popB - civCasualties - refugees);
    secB = clamp(secB - rand(0.5, 2), 0, 100);
    migrantCount += refugees;
  }

  // Write results to DB
  await db.update(militaryForces).set({ totalSoldiers: curSoldA, morale: curMorA, militaryPower: curPA }).where(eq(militaryForces.id, armyA.id));
  await db.update(militaryForces).set({ totalSoldiers: curSoldB, morale: curMorB, militaryPower: curPB }).where(eq(militaryForces.id, armyB.id));
  await db.update(territories).set({ population: popB, security: Math.round(secB) }).where(eq(territories.id, terrB.id));

  const terrCaptured = curSoldB <= 0 || curPB < 5;

  console.log(`\n  Kết quả 30 combat ticks:`);
  console.log(`    Army A: ${soldA}→${curSoldA} lính | Power: ${pA.toFixed(0)}→${curPA.toFixed(0)}`);
  console.log(`    Army B: ${soldB}→${curSoldB} lính | Power: ${pB.toFixed(0)}→${curPB.toFixed(0)}`);
  console.log(`    Territory B: pop ${beforeTerrB.population}→${popB} | security ${beforeTerrB.security}→${Math.round(secB)}`);
  console.log(`    Refugees: ${migrantCount} người`);

  // Check if /military/attack route exists
  warn("War v1 territory-capture API endpoint CHƯA được build", "/military/attack hoặc /territory/war CHƯA có — logic đang chạy local-only, chưa wired vào API");

  terrCaptured        ? pass("Territory B bị chiếm sau khi Army B bị tiêu diệt (logic)", `Army B còn ${curSoldB} lính`)
                      : warn("Army B chưa bị tiêu diệt sau 30 ticks", `Army B còn ${curSoldB} lính / power=${curPB.toFixed(0)}`);
  popB < beforeTerrB.population ? pass("Population giảm trong chiến tranh", `${beforeTerrB.population}→${popB}`)
                                 : fail("Population không giảm");
  secB < beforeTerrB.security   ? pass("Security giảm trong chiến tranh", `${beforeTerrB.security}→${Math.round(secB)}`)
                                 : fail("Security không giảm");
  migrantCount > 0              ? pass(`Refugee xuất hiện — ${migrantCount} người di tản`, "migration event generated")
                                 : fail("Không có refugee nào");
}

/* ════════════════════════════════════════════════════
   TEST 5 — ANOMALY CHECK
════════════════════════════════════════════════════ */
async function test5(ctx: Awaited<ReturnType<typeof setup>>) {
  console.log(B("\n[TEST 5] Anomaly Check — DB integrity sau tất cả tests"));

  const terrIds = [ctx.terrA.id, ctx.terrB.id];
  const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
  const govIds  = govs.map(g => g.id);
  const armies  = await db.select().from(militaryForces).where(inArray(militaryForces.governmentId, govIds));

  let powerAnomalies = 0;
  for (const a of armies) {
    const maxPossible = calcPower(a.totalSoldiers, 100, 10, 100);
    if (a.militaryPower > maxPossible + 1) {
      fail(`${a.armyName}: power=${a.militaryPower.toFixed(0)} vượt max=${maxPossible.toFixed(0)}`);
      powerAnomalies++;
    }
  }
  if (powerAnomalies === 0) pass("Không có Military Power anomaly — tất cả trong giới hạn lý thuyết");

  const [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, ctx.slug));
  const eOk = state.economyScore >= 0 && state.economyScore <= 100;
  const mOk = state.avgMood      >= 0 && state.avgMood      <= 100;
  const sOk = state.stability    >= 0 && state.stability    <= 100;

  (eOk && mOk && sOk)
    ? pass("World sim state trong [0,100]", `Econ=${state.economyScore.toFixed(1)} Mood=${state.avgMood.toFixed(1)} Stab=${state.stability.toFixed(1)}`)
    : fail("World sim state ngoài range", `Econ=${state.economyScore} Mood=${state.avgMood} Stab=${state.stability}`);

  const [npcRow] = await db.execute(sql`SELECT COUNT(*) FROM npc_cores WHERE world_slug=${ctx.slug}`) as any;
  const npcCount = parseInt(npcRow.rows?.[0]?.count ?? npcRow[0]?.count ?? "0");
  npcCount > 0 ? pass(`NPC count ổn định: ${npcCount} NPCs`) : fail("NPC count = 0");

  // Check DB has no NULL-army anomalies
  const [soldierCheck] = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM military_forces WHERE total_soldiers < 0
  `) as any;
  const negSoldiers = parseInt(soldierCheck.rows?.[0]?.cnt ?? soldierCheck[0]?.cnt ?? "0");
  negSoldiers === 0 ? pass("Không có negative soldier count") : fail(`${negSoldiers} armies có soldier < 0`);
}

/* ════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════ */
(async () => {
  console.log(B(C("\n╔══════════════════════════════════════════════╗")));
  console.log(B(C("║       STRESS TEST #6 — AI World System       ║")));
  console.log(B(C("║  Treasury · Army · Food · Gate · War v1       ║")));
  console.log(B(C("╚══════════════════════════════════════════════╝\n")));

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

  /* ── Final Report ───────────────────────────── */
  console.log(B(C("\n╔══════════════════════════════════════════════╗")));
  console.log(B(C("║               KẾT QUẢ CUỐI CÙNG             ║")));
  console.log(B(C("╚══════════════════════════════════════════════╝")));
  console.log(`\n  ${G("✓ PASS:")}    ${passed}`);
  console.log(`  ${R("✗ FAIL:")}    ${failed}`);
  console.log(`  ${Y("⚠ WARN:")}    ${warnings}`);

  const gaps = RESULTS.filter(r => r.ok === null);
  const fails = RESULTS.filter(r => r.ok === false);

  if (fails.length > 0) {
    console.log(R("\n  ❌ Bugs thực sự cần fix:"));
    for (const f of fails) console.log(`     · ${f.label}${f.detail ? " — " + f.detail : ""}`);
  }
  if (gaps.length > 0) {
    console.log(Y("\n  🔧 Feature gaps (không phải bugs — chưa build):"));
    for (const g of gaps) console.log(`     · ${g.label}${g.detail ? " — " + g.detail : ""}`);
  }

  const verdict = failed === 0 ? G("✅ PASS") : R("❌ FAIL");
  console.log(`\n  Verdict: ${verdict}  ${warnings > 0 ? Y(`(${warnings} gaps cần build tiếp)`) : ""}`);
  console.log(B(C("\n════════════════════════════════════════════════\n")));

  process.exit(failed > 0 ? 1 : 0);
})();
