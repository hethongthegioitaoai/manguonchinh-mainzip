/**
 * Phase 65B — Event Bus
 *
 * emitEvent() is the single point-of-truth for all simulation events:
 *   1. Writes to persistent `world_event_log` table (replay-safe)
 *   2. Broadcasts via WebSocket to all subscribed clients (React, Unity)
 *
 * Format (Unity-ready):
 *   { event, worldSlug, tick, ts, payload }
 */

import { db } from "@workspace/db";
import { worldEventLog } from "@workspace/db/schema";
import { broadcastEvent, type WorldEvent } from "./unityWs.js";

export type { WorldEvent };

// ─── Canonical event names ───────────────────────────────────────────────────

export const EVENT = {
  // Territory
  TERRITORY_CAPTURE:       "territory_capture",
  TERRITORY_COLLAPSE:      "territory_collapse",
  TERRITORY_RECOLONIZED:   "territory_recolonized",

  // Army
  ARMY_MOVE:               "army_move",
  ARMY_ARRIVED:            "army_arrived",
  ARMY_SIEGE_STARTED:      "army_siege_started",
  ARMY_SIEGE_ENDED:        "army_siege_ended",

  // NPC
  NPC_MIGRATE:             "npc_migrate",
  NPC_GOAL_CHANGED:        "npc_goal_changed",
  NPC_BIRTH:               "npc_birth",
  NPC_DEATH:               "npc_death",

  // Faction / Government
  FACTION_CREATED:         "faction_created",
  FACTION_LEADER_CHANGED:  "faction_leader_changed",
  ELECTION_RESULT:         "election_result",
  DIPLOMACY_ACTION:        "diplomacy_action",

  // World
  WORLD_TICK:              "world_tick",
  WORLD_SNAPSHOT_CREATED:  "world_snapshot_created",
  WORLD_WAR_START:         "world_war_start",
  WORLD_WAR_END:           "world_war_end",

  // Battle
  BATTLE_RESULT:           "battle_result",
} as const;

export type EventName = typeof EVENT[keyof typeof EVENT];

// ─── Primary emit function ───────────────────────────────────────────────────

/**
 * Emit a world event:
 * - Writes to DB (persistent, replay-safe)
 * - Broadcasts to WS subscribers (realtime)
 *
 * Never throws — logs errors silently.
 */
export async function emitEvent(
  worldSlug: string,
  tick: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const ts = Date.now();
  const evt: WorldEvent = { event, worldSlug, tick, ts, payload };

  // 1. Persist to event log
  try {
    await db.insert(worldEventLog).values({ worldSlug, tick, event, payload, ts });
  } catch (e) {
    console.warn(`[EventBus] DB write failed for ${event}:`, e);
  }

  // 2. Broadcast via WebSocket
  try {
    broadcastEvent(evt);
  } catch (e) {
    console.warn(`[EventBus] WS broadcast failed for ${event}:`, e);
  }
}

/**
 * Synchronous variant — broadcasts only (no DB write).
 * Use when you cannot await (legacy sync code).
 */
export function emitEventSync(
  worldSlug: string,
  tick: number,
  event: string,
  payload: Record<string, unknown>,
): void {
  const ts = Date.now();
  broadcastEvent({ event, worldSlug, tick, ts, payload });
  // Fire-and-forget DB write
  db.insert(worldEventLog).values({ worldSlug, tick, event, payload, ts })
    .catch(e => console.warn(`[EventBus] async DB write failed for ${event}:`, e));
}
