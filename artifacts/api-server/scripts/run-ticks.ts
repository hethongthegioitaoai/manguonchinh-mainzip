import { tickWorld } from "../src/routes/worldSimulation.js";
import { db } from "@workspace/db";
import { worldSnapshots, worldSimState } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const WORLD  = "cultivation";
const TICKS  = 200;

interface SnapRow { tick: number; population: number; economyScore: number; stability: number; avgMood: number }

async function main() {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Phase 7.2B — Running ${TICKS} simulation ticks`);
  console.log(`  World: ${WORLD}`);
  console.log(`═══════════════════════════════════════════════\n`);

  const snapshots: SnapRow[] = [];
  let crashes   = 0;
  let anomalies = 0;
  const issues: string[] = [];

  // Get or create initial state
  let [initState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, WORLD));
  const initPop  = initState?.population  ?? 0;
  const initEcon = initState?.economyScore ?? 0;

  console.log(`Before: population=${initPop}, economy=${initEcon?.toFixed?.(2)}`);
  console.log(`Running ticks...`);

  for (let i = 1; i <= TICKS; i++) {
    try {
      const result = await tickWorld(WORLD);
      const s = result.state;
      if (!s) { crashes++; issues.push(`Tick ${i}: null state`); continue; }

      // Anomaly checks
      if (s.population < 0)                               { anomalies++; issues.push(`Tick ${i}: pop=${s.population}`); }
      if (s.economyScore < 0 || s.economyScore > 100)    { anomalies++; issues.push(`Tick ${i}: econ=${s.economyScore.toFixed(2)}`); }
      if (s.avgMood < 0 || s.avgMood > 100)              { anomalies++; issues.push(`Tick ${i}: mood=${s.avgMood.toFixed(2)}`); }
      if (s.stability < 0 || s.stability > 100)          { anomalies++; issues.push(`Tick ${i}: stab=${s.stability.toFixed(2)}`); }

      // Snapshot every 20 ticks
      if (i % 20 === 0) {
        snapshots.push({
          tick:         i,
          population:   s.population,
          economyScore: parseFloat(s.economyScore.toFixed(2)),
          stability:    parseFloat(s.stability.toFixed(2)),
          avgMood:      parseFloat(s.avgMood.toFixed(2)),
        });
        process.stdout.write(`  ✓ Tick ${String(i).padStart(3)}: pop=${s.population} econ=${s.economyScore.toFixed(1)} stab=${s.stability.toFixed(1)} mood=${s.avgMood.toFixed(1)}\n`);
      }
    } catch (e: any) {
      crashes++;
      issues.push(`Tick ${i}: crash — ${e?.message?.slice(0, 60)}`);
    }
  }

  const [finalState] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, WORLD));

  // ─── Snapshot summary ────────────────────────────────────────────────
  console.log(`\n─── Snapshots (every 20 ticks) ───────────────────`);
  console.log(`Tick  | Population | Economy | Stability | Mood`);
  console.log(`------+------------+---------+-----------+------`);
  for (const s of snapshots) {
    console.log(`${String(s.tick).padStart(5)} | ${String(s.population).padStart(10)} | ${String(s.economyScore).padStart(7)} | ${String(s.stability).padStart(9)} | ${s.avgMood}`);
  }

  // ─── Final report ────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Simulation Complete`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`Ticks run  : ${TICKS}`);
  console.log(`Crashes    : ${crashes}`);
  console.log(`Anomalies  : ${anomalies}`);
  console.log(`Verdict    : ${anomalies === 0 && crashes === 0 ? "✅ PASS" : `❌ FAIL — ${anomalies} anomalies, ${crashes} crashes`}`);
  console.log(`\nInitial    : pop=${initPop}  econ=${initEcon?.toFixed?.(2)}`);
  if (finalState) {
    console.log(`Final      : pop=${finalState.population}  econ=${finalState.economyScore.toFixed(2)}  stab=${finalState.stability.toFixed(2)}  mood=${finalState.avgMood.toFixed(2)}  totalTicks=${finalState.totalTicks}`);
  }

  if (issues.length > 0) {
    console.log(`\nIssues (${issues.length}):`);
    for (const iss of issues.slice(0, 20)) console.log(`  ${iss}`);
  }

  // Check world_snapshots table (saved every 50 ticks by tickWorld itself)
  const savedSnaps = await db.select({ tick: worldSnapshots.tick })
    .from(worldSnapshots)
    .where(eq(worldSnapshots.worldSlug, WORLD))
    .orderBy(desc(worldSnapshots.tick))
    .limit(10);
  console.log(`\nWorld snapshots in DB: ${savedSnaps.length} entries`);
  if (savedSnaps.length > 0) console.log(`  Latest ticks: ${savedSnaps.map(s => s.tick).join(", ")}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
