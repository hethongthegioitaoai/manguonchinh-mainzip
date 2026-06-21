/**
 * Unity Delta Stream
 *
 * Gửi delta events thay vì full world state.
 * Server giữ lastTickSent per-world trong DB (world_stream_state).
 * Unity chỉ nhận delta: { type, tick, entityId, changes }
 *
 * API:
 *   GET /api/unity/delta/:worldSlug
 *       ?lastTick=N          — explicit cursor override (bỏ qua DB cursor)
 *       ?limit=200           — max events trả về (default 200, max 1000)
 *
 *   GET /api/unity/delta/:worldSlug/snapshot-size
 *       — trả về byte size của full-state snapshot (để so sánh với delta)
 *
 *   POST /api/unity/delta/:worldSlug/benchmark
 *       body: { ticks: 1000 | 5000 }
 *       — chạy benchmark so sánh full-state vs delta bandwidth
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { worldEventLog, worldSimState, worldStreamState } from "@workspace/db/schema";
import { eq, gt, and, asc } from "drizzle-orm";
import { isAuthenticated } from "../auth/replitAuth.js";
import { validateWorldSlug } from "../middleware/validateWorldSlug.js";

const router = Router();
router.param("worldSlug", validateWorldSlug);

// ─── Delta Event Format ───────────────────────────────────────────────────────

export interface DeltaEvent {
  type:     string;
  tick:     number;
  entityId: string;
  changes:  Record<string, unknown>;
}

// ─── Event type mapping ───────────────────────────────────────────────────────

const EVENT_TYPE_MAP: Record<string, string> = {
  npc_migrate:           "npc_move",
  npc_goal_changed:      "npc_move",
  npc_birth:             "npc_move",
  npc_death:             "npc_move",
  territory_capture:     "territory_capture",
  territory_collapse:    "territory_collapse",
  territory_recolonized: "territory_recolonized",
  army_move:             "army_move",
  army_arrived:          "army_arrived",
  army_siege_started:    "army_siege",
  army_siege_ended:      "army_siege",
  faction_created:       "faction_changed",
  faction_leader_changed:"faction_changed",
  election_result:       "faction_changed",
  diplomacy_action:      "faction_changed",
  world_war_start:       "faction_changed",
  world_war_end:         "faction_changed",
  battle_result:         "faction_changed",
  world_tick:            "world_tick",
  route_disrupted:       "world_tick",
  route_restored:        "world_tick",
};

function extractEntityId(
  event: string,
  payload: Record<string, unknown>,
  worldSlug: string,
): string {
  const p = payload as Record<string, string | null | undefined>;
  switch (event) {
    case "npc_migrate":
    case "npc_goal_changed":
    case "npc_birth":
    case "npc_death":
      return p.npcId ?? p.id ?? worldSlug;
    case "territory_capture":
    case "territory_collapse":
    case "territory_recolonized":
      return p.territoryId ?? p.id ?? worldSlug;
    case "army_move":
    case "army_arrived":
    case "army_siege_started":
    case "army_siege_ended":
      return p.armyMovementId ?? p.armyId ?? p.id ?? worldSlug;
    case "faction_created":
    case "faction_leader_changed":
    case "election_result":
    case "world_war_start":
    case "world_war_end":
    case "battle_result":
      return p.factionId ?? p.govId ?? p.warId ?? p.battleId ?? p.id ?? worldSlug;
    case "diplomacy_action":
      return p.govA ?? p.factionId ?? p.id ?? worldSlug;
    default:
      return p.id ?? worldSlug;
  }
}

function toDelta(row: {
  event: string;
  tick: number;
  payload: Record<string, unknown>;
  worldSlug: string;
}): DeltaEvent {
  return {
    type:     EVENT_TYPE_MAP[row.event] ?? row.event,
    tick:     row.tick,
    entityId: extractEntityId(row.event, row.payload, row.worldSlug),
    changes:  row.payload,
  };
}

// ─── Persistent cursor helpers ────────────────────────────────────────────────

async function getPersistedCursor(worldSlug: string): Promise<number> {
  const [row] = await db
    .select({ lastTickSent: worldStreamState.lastTickSent })
    .from(worldStreamState)
    .where(eq(worldStreamState.worldSlug, worldSlug))
    .limit(1);
  return row?.lastTickSent ?? 0;
}

async function setPersistedCursor(worldSlug: string, tick: number): Promise<void> {
  await db
    .insert(worldStreamState)
    .values({ worldSlug, lastTickSent: tick, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: worldStreamState.worldSlug,
      set: { lastTickSent: tick, updatedAt: new Date() },
    });
}

// ─── GET /api/unity/delta/:worldSlug ─────────────────────────────────────────

router.get("/unity/delta/:worldSlug", async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;
  const explicitLastTick = req.query.lastTick !== undefined
    ? Number(req.query.lastTick)
    : null;
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);

  try {
    // Use explicit override if provided, otherwise read persisted cursor
    const since = explicitLastTick !== null
      ? explicitLastTick
      : await getPersistedCursor(worldSlug);

    const rows = await db
      .select({
        event:     worldEventLog.event,
        tick:      worldEventLog.tick,
        payload:   worldEventLog.payload,
        worldSlug: worldEventLog.worldSlug,
        ts:        worldEventLog.ts,
      })
      .from(worldEventLog)
      .where(and(
        eq(worldEventLog.worldSlug, worldSlug),
        gt(worldEventLog.tick, since),
      ))
      .orderBy(asc(worldEventLog.tick), asc(worldEventLog.ts))
      .limit(limit);

    const deltas  = rows.map(toDelta);
    const maxTick = rows.length > 0 ? rows[rows.length - 1].tick : since;

    // Persist the new cursor so restarts don't re-replay events
    if (rows.length > 0) {
      await setPersistedCursor(worldSlug, maxTick);
    }

    return res.json({
      worldSlug,
      lastTickSent:   maxTick,
      previousCursor: since,
      count:          deltas.length,
      events:         deltas,
    });
  } catch (err) {
    console.error("[UnityDelta] fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch delta events" });
  }
});

// ─── GET /api/unity/delta/:worldSlug/snapshot-size ───────────────────────────

router.get("/unity/delta/:worldSlug/snapshot-size", async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;
  try {
    const { territories, npcCores, npcFactions, militaryForces, armyMovements } =
      await import("@workspace/db/schema");
    const { sql: rawSql } = await import("drizzle-orm");

    const [terrRows, npcRows, factionRows, armyRows, movementRows] = await Promise.all([
      db.select().from(territories).where(eq(territories.worldSlug, worldSlug)),
      db.select({
          id: npcCores.id, name: npcCores.name, territoryId: npcCores.territoryId,
          occupation: npcCores.occupation, energy: npcCores.energy,
          hunger: npcCores.hunger, happiness: npcCores.happiness,
          currentGoal: npcCores.currentGoal,
        })
        .from(npcCores).where(eq(npcCores.worldSlug, worldSlug)).limit(300),
      db.select().from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug)),
      db.select().from(militaryForces).where(
        rawSql`${militaryForces.territoryId} IN (SELECT id FROM territories WHERE world_slug = ${worldSlug})`
      ),
      db.select().from(armyMovements).where(eq(armyMovements.worldSlug, worldSlug)),
    ]);

    const snapshot = { worldSlug, ts: Date.now(), territories: terrRows, npcs: npcRows, factions: factionRows, armies: armyRows, movements: movementRows };
    const json = JSON.stringify(snapshot);

    return res.json({
      worldSlug,
      entityCounts: {
        territories: terrRows.length,
        npcs:        npcRows.length,
        factions:    factionRows.length,
        armies:      armyRows.length,
        movements:   movementRows.length,
      },
      snapshotBytes: Buffer.byteLength(json, "utf8"),
      snapshotKb:    Math.round(Buffer.byteLength(json, "utf8") / 1024),
    });
  } catch (err) {
    console.error("[UnityDelta] snapshot-size error:", err);
    return res.status(500).json({ error: "Failed to compute snapshot size" });
  }
});

// ─── POST /api/unity/delta/:worldSlug/benchmark ───────────────────────────────

router.post("/unity/delta/:worldSlug/benchmark", isAuthenticated, async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;
  const requestedTicks = Number(req.body?.ticks ?? 1000);
  const ticks = Math.min(requestedTicks, 5000);

  try {
    const { territories, npcCores, npcFactions, militaryForces, armyMovements } =
      await import("@workspace/db/schema");
    const { sql: rawSql } = await import("drizzle-orm");

    const [terrRows, npcRows, factionRows, armyRows, movRows] = await Promise.all([
      db.select().from(territories).where(eq(territories.worldSlug, worldSlug)),
      db.select({
          id: npcCores.id, name: npcCores.name, territoryId: npcCores.territoryId,
          occupation: npcCores.occupation, energy: npcCores.energy,
          hunger: npcCores.hunger, happiness: npcCores.happiness,
          currentGoal: npcCores.currentGoal,
        })
        .from(npcCores).where(eq(npcCores.worldSlug, worldSlug)).limit(300),
      db.select().from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug)),
      db.select().from(militaryForces).where(
        rawSql`${militaryForces.territoryId} IN (SELECT id FROM territories WHERE world_slug = ${worldSlug})`
      ),
      db.select().from(armyMovements).where(eq(armyMovements.worldSlug, worldSlug)),
    ]);

    const fullSnapshot = { worldSlug, ts: Date.now(), territories: terrRows, npcs: npcRows, factions: factionRows, armies: armyRows, movements: movRows };
    const fullStateBytes = Buffer.byteLength(JSON.stringify(fullSnapshot), "utf8");

    const maxTickRes = await db.execute(
      rawSql`SELECT MAX(tick) as max_tick FROM world_event_log WHERE world_slug = ${worldSlug}`
    );
    const currentMaxTick = Number((maxTickRes as any).rows?.[0]?.max_tick ?? 0);
    const startTick = Math.max(0, currentMaxTick - ticks);

    const deltaRows = await db
      .select({
        event:     worldEventLog.event,
        tick:      worldEventLog.tick,
        payload:   worldEventLog.payload,
        worldSlug: worldEventLog.worldSlug,
        ts:        worldEventLog.ts,
      })
      .from(worldEventLog)
      .where(and(
        eq(worldEventLog.worldSlug, worldSlug),
        gt(worldEventLog.tick, startTick),
      ))
      .orderBy(asc(worldEventLog.tick))
      .limit(ticks * 10);

    const deltaEvents      = deltaRows.map(toDelta);
    const deltaTotalBytes  = Buffer.byteLength(JSON.stringify(deltaEvents), "utf8");
    const fullPollEvery    = 10;
    const numFullPolls     = Math.ceil(ticks / fullPollEvery);
    const fullStateTotalBytes = numFullPolls * fullStateBytes;
    const savingsBytes     = fullStateTotalBytes - deltaTotalBytes;
    const savingsPct       = fullStateTotalBytes > 0
      ? Math.round((savingsBytes / fullStateTotalBytes) * 100)
      : 0;

    const byType: Record<string, number> = {};
    for (const evt of deltaEvents) {
      byType[evt.type] = (byType[evt.type] ?? 0) + 1;
    }

    return res.json({
      worldSlug,
      ticks,
      fullState: {
        entityCounts: {
          territories: terrRows.length,
          npcs:        npcRows.length,
          factions:    factionRows.length,
          armies:      armyRows.length,
          movements:   movRows.length,
        },
        singleSnapshotBytes:  fullStateBytes,
        singleSnapshotKb:     Math.round(fullStateBytes / 1024),
        pollEveryNTicks:      fullPollEvery,
        numPolls:             numFullPolls,
        totalBandwidthBytes:  fullStateTotalBytes,
        totalBandwidthKb:     Math.round(fullStateTotalBytes / 1024),
        totalBandwidthMb:     Math.round((fullStateTotalBytes / 1024 / 1024) * 100) / 100,
      },
      delta: {
        eventsFound:         deltaRows.length,
        eventsInRange:       `tick ${startTick} → ${currentMaxTick}`,
        totalBandwidthBytes: deltaTotalBytes,
        totalBandwidthKb:    Math.round(deltaTotalBytes / 1024),
        totalBandwidthMb:    Math.round((deltaTotalBytes / 1024 / 1024) * 100) / 100,
        avgBytesPerEvent:    deltaEvents.length > 0
          ? Math.round(deltaTotalBytes / deltaEvents.length)
          : 0,
        byType,
      },
      comparison: {
        savingsBytes,
        savingsKb:  Math.round(savingsBytes / 1024),
        savingsMb:  Math.round((savingsBytes / 1024 / 1024) * 100) / 100,
        savingsPct: `${savingsPct}%`,
        winner:     savingsPct > 0 ? "delta" : "full-state",
      },
    });
  } catch (err) {
    console.error("[UnityDelta] benchmark error:", err);
    return res.status(500).json({ error: "Benchmark failed", detail: String(err) });
  }
});

export default router;
