/**
 * Phase 7.2B — Full Audit Suite (raw SQL edition)
 * Runs: Database Audit, Political Map Audit, War Audit, Collapse Audit
 */

import { pool } from "@workspace/db";

const WORLD = "cultivation";

type Status = "PASS" | "WARN" | "FAIL";
interface Row { label: string; value: string | number; status: Status; note?: string }

const pass = (label: string, value: string | number, note?: string): Row => ({ label, value, status: "PASS", note });
const warn = (label: string, value: string | number, note?: string): Row => ({ label, value, status: "WARN", note });
const fail = (label: string, value: string | number, note?: string): Row => ({ label, value, status: "FAIL", note });

async function q(sql: string, params: any[] = []): Promise<any[]> {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function n1(sql: string, params: any[] = []): Promise<number> {
  const rows = await q(sql, params);
  return Number(rows[0]?.count ?? rows[0]?.n ?? 0);
}

function printSection(title: string, rows: Row[]) {
  const p = rows.filter(r => r.status === "PASS").length;
  const w = rows.filter(r => r.status === "WARN").length;
  const f = rows.filter(r => r.status === "FAIL").length;
  const icon = f > 0 ? "❌" : w > 0 ? "⚠️ " : "✅";
  console.log(`\n${"─".repeat(58)}`);
  console.log(`  ${icon} ${title}   [${p}P / ${w}W / ${f}F]`);
  console.log("─".repeat(58));
  for (const r of rows) {
    const ic = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️ " : "❌";
    const nt = r.note ? `  ← ${r.note}` : "";
    console.log(`  ${ic} ${r.label.padEnd(36)} ${String(r.value).padStart(8)}${nt}`);
  }
}

// ─── 1. DATABASE AUDIT ───────────────────────────────────────────────────────
async function databaseAudit(): Promise<Row[]> {
  const [terr, npcs, facs, govs, armies, logs, snaps, members] = await Promise.all([
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_cores WHERE world_slug=$1 AND active=1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_factions WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_governments WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    n1("SELECT COUNT(*) FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    n1("SELECT COUNT(*) FROM world_sim_log WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM world_snapshots WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_faction_members WHERE faction_id IN (SELECT id FROM npc_factions WHERE world_slug=$1)", [WORLD]),
  ]);

  return [
    terr  >= 10  ? pass("Territories",          terr,    "≥10 ✓") : terr > 0  ? warn("Territories",         terr,   "need ≥10") : fail("Territories",         terr,   "empty"),
    npcs  >= 100 ? pass("Active NPCs",           npcs,    "≥100 ✓"): npcs > 0  ? warn("Active NPCs",         npcs,   "need ≥100"): fail("Active NPCs",         npcs,   "empty"),
    facs  >= 3   ? pass("Factions",              facs,    "≥3 ✓")  : facs > 0  ? warn("Factions",            facs,   "need ≥3")  : fail("Factions",            facs,   "empty"),
    govs  >= 3   ? pass("Governments",           govs,    "≥3 ✓")  : govs > 0  ? warn("Governments",         govs,   "need ≥3")  : fail("Governments",         govs,   "empty"),
    armies >= 3  ? pass("Military forces",       armies,  "≥3 ✓")  : armies > 0? warn("Military forces",     armies, "need ≥3")  : fail("Military forces",     armies, "empty"),
    logs  >= 10  ? pass("WorldSimLog entries",   logs)              : logs > 0  ? warn("WorldSimLog entries", logs,   "low")      : fail("WorldSimLog entries", logs,   "empty"),
    snaps >= 1   ? pass("World snapshots",       snaps)             : warn("World snapshots",     snaps, "none saved"),
    members >= 3 ? pass("Faction members",       members)           : warn("Faction members",     members, "low"),
  ];
}

// ─── 2. POLITICAL MAP AUDIT ───────────────────────────────────────────────────
async function politicalMapAudit(): Promise<Row[]> {
  const [active, ruins, owned, facs, leaderFacs, govCoverage, lowApproval, avgProsperity] = await Promise.all([
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='active'", [WORLD]),
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='ruins'", [WORLD]),
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='active' AND owner_faction_id IS NOT NULL", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_factions WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_factions WHERE world_slug=$1 AND leader_npc_id IS NOT NULL", [WORLD]),
    n1(`SELECT COUNT(*) FROM npc_governments g
         WHERE g.territory_id IN (SELECT id FROM territories WHERE world_slug=$1 AND status='active')`, [WORLD]),
    n1(`SELECT COUNT(*) FROM npc_governments g
         WHERE g.territory_id IN (SELECT id FROM territories WHERE world_slug=$1)
           AND g.approval_rate < 20`, [WORLD]),
    q("SELECT COALESCE(AVG(prosperity),0) AS avg FROM territories WHERE world_slug=$1 AND status='active'", [WORLD]),
  ]);

  const prosperity = Math.round(Number(avgProsperity[0]?.avg ?? 0));
  const activeCount = active;

  return [
    active >= 10       ? pass("Active territories",          active,  "≥10 ✓") : warn("Active territories",          active,  "need ≥10"),
    ruins === 0        ? pass("Ruined territories",          ruins,   "none")   : warn("Ruined territories",          ruins,   "collapse exists"),
    owned > 0          ? pass("Faction-owned territories",   owned)             : warn("Faction-owned territories",   owned,   "none claimed"),
    facs >= 3          ? pass("Active factions",             facs,    "≥3 ✓")  : warn("Active factions",             facs,    "need ≥3"),
    leaderFacs >= 3    ? pass("Factions with leaders",      leaderFacs, "≥3 ✓"): warn("Factions with leaders",      leaderFacs, "some leaderless"),
    govCoverage >= activeCount * 0.8 ? pass("Government coverage", `${govCoverage}/${activeCount}`, "≥80% ✓") : warn("Government coverage", `${govCoverage}/${activeCount}`, "<80%"),
    lowApproval === 0  ? pass("Low-approval governments",    lowApproval, "none in crisis") : warn("Low-approval governments", lowApproval, "political crisis"),
    prosperity >= 40   ? pass("Avg territory prosperity",   prosperity)        : warn("Avg territory prosperity",    prosperity, "low"),
  ];
}

// ─── 3. WAR AUDIT ─────────────────────────────────────────────────────────────
async function warAudit(): Promise<Row[]> {
  const [armies, soldiers, avgMoraleRow, avgPowerRow, lowMorale, lowSupply, activeConflicts, warEvents] = await Promise.all([
    n1("SELECT COUNT(*) FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    q("SELECT COALESCE(SUM(total_soldiers),0) AS s FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    q("SELECT COALESCE(AVG(morale),0) AS m FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    q("SELECT COALESCE(AVG(military_power),0) AS p FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    n1("SELECT COUNT(*) FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1) AND morale < 30", [WORLD]),
    n1("SELECT COUNT(*) FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1) AND supply_level < 40", [WORLD]),
    n1("SELECT COUNT(*) FROM army_movements WHERE world_slug=$1 AND status IN ('moving','sieging')", [WORLD]),
    n1("SELECT COUNT(*) FROM world_sim_log WHERE world_slug=$1 AND event_type IN ('world_war_start','war_declaration','battle_result','rebellion')", [WORLD]),
  ]);

  const totalSoldiers = Number(soldiers[0]?.s ?? 0);
  const avgMorale     = Math.round(Number(avgMoraleRow[0]?.m ?? 0));
  const avgPower      = Math.round(Number(avgPowerRow[0]?.p ?? 0));

  return [
    armies >= 3      ? pass("Total armies",           armies,       "≥3 ✓")  : warn("Total armies",         armies,         "need ≥3"),
    totalSoldiers > 0? pass("Total soldiers",          totalSoldiers)          : fail("Total soldiers",       totalSoldiers,  "no troops"),
    avgMorale >= 40  ? pass("Avg army morale",         avgMorale)              : warn("Avg army morale",      avgMorale,      "low"),
    avgPower > 0     ? pass("Avg military power",      avgPower)               : warn("Avg military power",   avgPower,       "zero"),
    lowMorale === 0  ? pass("Armies low morale",       lowMorale,   "none")   : warn("Armies low morale",    lowMorale,      "critical"),
    lowSupply === 0  ? pass("Armies low supply",       lowSupply,   "none")   : warn("Armies low supply",    lowSupply,      "at risk"),
    pass("Active conflicts",          activeConflicts, "tracked"),
    warEvents > 0    ? pass("War events in sim log",   warEvents)              : warn("War events in sim log",warEvents,      "none yet"),
  ];
}

// ─── 4. COLLAPSE AUDIT ────────────────────────────────────────────────────────
async function collapseAudit(): Promise<Row[]> {
  const [ruins, nearCollapse, depop, dead, live, simStateRows, collapseEvts] = await Promise.all([
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='ruins'", [WORLD]),
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='active' AND prosperity < 10", [WORLD]),
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1 AND status='active' AND population = 0", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_cores WHERE world_slug=$1 AND active=0", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_cores WHERE world_slug=$1 AND active=1", [WORLD]),
    q("SELECT economy_score, stability, avg_mood, total_ticks FROM world_sim_state WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM world_sim_log WHERE world_slug=$1 AND event_type='territory_collapse'", [WORLD]),
  ]);

  const deathRate  = live + dead > 0 ? Math.round((dead / (live + dead)) * 100) : 0;
  const economy    = Number((simStateRows[0]?.economy_score ?? 0)).toFixed(1);
  const stability  = Number((simStateRows[0]?.stability    ?? 0)).toFixed(1);
  const mood       = Number((simStateRows[0]?.avg_mood      ?? 0)).toFixed(1);
  const totalTicks = Number(simStateRows[0]?.total_ticks   ?? 0);

  return [
    ruins === 0        ? pass("Collapsed territories",    ruins,      "none")          : warn("Collapsed territories",    ruins,      "ruins exist"),
    nearCollapse === 0 ? pass("Near-collapse zones",      nearCollapse,"none")         : warn("Near-collapse zones",      nearCollapse,"prosperity<10"),
    depop === 0        ? pass("Depopulated territories",  depop,      "none")          : warn("Depopulated territories",  depop,      "pop=0"),
    deathRate < 20     ? pass("NPC death rate",           `${deathRate}%`)             : warn("NPC death rate",           `${deathRate}%`, "high"),
    Number(economy) >= 20   ? pass("Economy score",       economy)                    : warn("Economy score",            economy,    "low"),
    Number(stability) >= 10 ? pass("World stability",     stability)                  : warn("World stability",          stability,  "fragile"),
    Number(mood) >= 20      ? pass("World avg mood",      mood)                       : warn("World avg mood",           mood,       "low"),
    totalTicks >= 200  ? pass("Total ticks run",          totalTicks, "≥200 ✓")       : warn("Total ticks run",          totalTicks, "< 200"),
    collapseEvts === 0 ? pass("Collapse events",          collapseEvts,"none")        : warn("Collapse events",          collapseEvts,"collapses logged"),
  ];
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const BEFORE = { terr: 0, npcs: 0, facs: 0, armies: 0, govs: 0, snaps: 0, logs: 2, ticks: 0, pass: 46, warn: 17, fail: 0, score: 73 };

async function main() {
  console.log(`\n${"═".repeat(58)}`);
  console.log(`  PHASE 7.2B — LIVE WORLD VALIDATION AUDIT REPORT`);
  console.log(`  World: ${WORLD}  |  ${new Date().toISOString()}`);
  console.log(`${"═".repeat(58)}`);

  console.log(`\n${"─".repeat(58)}`);
  console.log(`  BEFORE  (Phase 7.1E — empty world baseline)`);
  console.log("─".repeat(58));
  console.log(`  Territories : ${BEFORE.terr.toString().padStart(4)}   Active NPCs: ${BEFORE.npcs.toString().padStart(4)}   Factions: ${BEFORE.facs}`);
  console.log(`  Armies      : ${BEFORE.armies.toString().padStart(4)}   Governments: ${BEFORE.govs.toString().padStart(4)}   Snapshots:${BEFORE.snaps}`);
  console.log(`  SimLogs     : ${BEFORE.logs.toString().padStart(4)}   Total ticks: ${BEFORE.ticks.toString().padStart(4)}   Readiness:${BEFORE.score}%`);
  console.log(`  Result      : [${BEFORE.pass}P / ${BEFORE.warn}W / ${BEFORE.fail}F]  — zero-count WARNs on every entity`);

  const [dbR, mapR, warR, colR] = await Promise.all([
    databaseAudit(), politicalMapAudit(), warAudit(), collapseAudit(),
  ]);

  printSection("1. DATABASE AUDIT",       dbR);
  printSection("2. POLITICAL MAP AUDIT",  mapR);
  printSection("3. WAR AUDIT",            warR);
  printSection("4. COLLAPSE AUDIT",       colR);

  const all    = [...dbR, ...mapR, ...warR, ...colR];
  const totalP = all.filter(r => r.status === "PASS").length;
  const totalW = all.filter(r => r.status === "WARN").length;
  const totalF = all.filter(r => r.status === "FAIL").length;
  const score  = Math.round((totalP / all.length) * 100);

  // Pull final DB state for the report
  const finalState = await q("SELECT total_ticks, economy_score, stability, avg_mood FROM world_sim_state WHERE world_slug=$1", [WORLD]);
  const [terr, npcs, facs, armies, govs, snaps, logs] = await Promise.all([
    n1("SELECT COUNT(*) FROM territories WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_cores WHERE world_slug=$1 AND active=1", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_factions WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM military_forces WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    n1("SELECT COUNT(*) FROM npc_governments WHERE territory_id IN (SELECT id FROM territories WHERE world_slug=$1)", [WORLD]),
    n1("SELECT COUNT(*) FROM world_snapshots WHERE world_slug=$1", [WORLD]),
    n1("SELECT COUNT(*) FROM world_sim_log WHERE world_slug=$1", [WORLD]),
  ]);

  console.log(`\n${"═".repeat(58)}`);
  console.log(`  BEFORE / AFTER COMPARISON`);
  console.log("═".repeat(58));
  console.log(`  Entity           BEFORE   AFTER   CHANGE`);
  console.log("  " + "─".repeat(44));
  const row = (label: string, before: number, after: number) =>
    console.log(`  ${label.padEnd(16)} ${String(before).padStart(6)}  ${String(after).padStart(6)}   ${after > before ? "+" : ""}${after - before}`);
  row("Territories",   BEFORE.terr,   terr);
  row("Active NPCs",   BEFORE.npcs,   npcs);
  row("Factions",      BEFORE.facs,   facs);
  row("Armies",        BEFORE.armies, armies);
  row("Governments",   BEFORE.govs,   govs);
  row("Snapshots",     BEFORE.snaps,  snaps);
  row("SimLog entries",BEFORE.logs,   logs);
  row("Total ticks",   BEFORE.ticks,  Number(finalState[0]?.total_ticks ?? 0));
  console.log("  " + "─".repeat(44));
  row("PASS",          BEFORE.pass,   totalP);
  row("WARN",          BEFORE.warn,   totalW);
  row("FAIL",          BEFORE.fail,   totalF);
  row("Readiness %",   BEFORE.score,  score);

  console.log(`\n${"═".repeat(58)}`);
  console.log(`  OVERALL: [${totalP}P / ${totalW}W / ${totalF}F]   Readiness ${score}%`);
  const verdict = totalF === 0 && totalW <= 5 ? "✅ PASS — cultivation world fully validated"
                : totalF === 0               ? "⚠️  PASS with warnings — see details above"
                                             : "❌ FAIL — critical issues found";
  console.log(`  ${verdict}`);
  console.log("═".repeat(58) + "\n");

  process.exit(0);
}

main().catch(e => { console.error("Audit error:", e); process.exit(1); });
