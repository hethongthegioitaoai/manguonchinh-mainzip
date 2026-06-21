import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

// ─── Canonical event format (Phase 65 — Unity-ready) ─────────────────────────
// Format used by all broadcasts and the persistent event log.
// Unity, React, and any other client all receive the same structure.

export interface WorldEvent {
  event:     string;                   // e.g. "territory_capture"
  worldSlug: string;
  tick:      number;
  ts:        number;                   // Unix ms
  payload:   Record<string, unknown>;
}

// ─── Legacy event types (kept for backward-compat call sites) ─────────────────

export interface BattleEvent {
  type: "battle";
  worldSlug: string;
  battleId: string;
  winner: string;
  loser: string;
  winnerName: string;
  loserName: string;
  expGained: number;
  goldReward: number;
  territoryChanged: boolean;
  timestamp: string;
  playerId?: string;
  playerWon?: boolean;
  levelUp?: boolean;
  territoryId?: string;
  territoryName?: string;
  captured?: boolean;
}

export type LegacyUnityEvent =
  | { type: "npc_move";   worldSlug: string; npcId: string; name: string; fromPos: Pos | null; toPos: Pos; action: string }
  | BattleEvent
  | { type: "election";   worldSlug: string; govId: string; territory: string; electionType: string; winner: string }
  | { type: "diplomacy";  worldSlug: string; govA: string; govB: string; action: string; relation: string }
  | { type: "birth";      worldSlug: string; npcId: string; name: string; parentName: string; pos: Pos | null }
  | { type: "death";      worldSlug: string; npcId: string; name: string; pos: Pos | null; reason: string }
  | { type: "war_start";  worldSlug: string; warId: string; attacker: string; defender: string; reason?: string }
  | { type: "war_end";    worldSlug: string; warId: string; winner: string }
  | { type: "world_tick"; worldSlug: string; ts: number };

/** @deprecated use WorldEvent + broadcastEvent() */
export type UnityEvent = LegacyUnityEvent;

export interface Pos { x: number; y: number }

// ─── Per-world subscriber map ─────────────────────────────────────────────────

const worldSubs = new Map<string, Set<WebSocket>>();

export function setupUnityWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws/unity" });

  wss.on("connection", (ws) => {
    let subscribedWorlds: Set<string> = new Set();

    function cleanup() {
      for (const slug of subscribedWorlds) {
        worldSubs.get(slug)?.delete(ws);
        if (worldSubs.get(slug)?.size === 0) worldSubs.delete(slug);
      }
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "subscribe" && Array.isArray(msg.worlds)) {
          for (const slug of msg.worlds as string[]) {
            if (!worldSubs.has(slug)) worldSubs.set(slug, new Set());
            worldSubs.get(slug)!.add(ws);
            subscribedWorlds.add(slug);
          }
          ws.send(JSON.stringify({ type: "subscribed", worlds: [...subscribedWorlds] }));
        }

        if (msg.type === "unsubscribe" && Array.isArray(msg.worlds)) {
          for (const slug of msg.worlds as string[]) {
            worldSubs.get(slug)?.delete(ws);
            subscribedWorlds.delete(slug);
          }
        }

        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {}
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}

/**
 * Broadcast a canonical WorldEvent to all WS clients subscribed to the world.
 * This is the primary broadcast function — use this for all new code.
 */
export function broadcastEvent(evt: WorldEvent): void {
  const subs = worldSubs.get(evt.worldSlug);
  if (!subs || subs.size === 0) return;
  const payload = JSON.stringify(evt);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch {}
    }
  }
}

/**
 * @deprecated Legacy broadcast — wraps LegacyUnityEvent into canonical format.
 * Kept for backward-compat call sites that still use old { type } format.
 */
export function broadcastUnity(event: LegacyUnityEvent): void {
  const slug = event.worldSlug;
  const canonical: WorldEvent = {
    event:     event.type,
    worldSlug: slug,
    tick:      0,
    ts:        Date.now(),
    payload:   event as unknown as Record<string, unknown>,
  };
  broadcastEvent(canonical);
}

export function unitySubscriberCount(worldSlug: string): number {
  return worldSubs.get(worldSlug)?.size ?? 0;
}
