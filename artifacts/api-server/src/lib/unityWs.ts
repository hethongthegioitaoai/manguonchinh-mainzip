import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

// ─── Unity-ready event types ────────────────────────────────────────────────

export type UnityEvent =
  | { type: "npc_move";   worldSlug: string; npcId: string; name: string; fromPos: Pos | null; toPos: Pos; action: string }
  | { type: "battle";     worldSlug: string; attacker: string; defender: string; winner: string; territory: string }
  | { type: "election";   worldSlug: string; govId: string; territory: string; electionType: string; winner: string }
  | { type: "diplomacy";  worldSlug: string; govA: string; govB: string; action: string; relation: string }
  | { type: "birth";      worldSlug: string; npcId: string; name: string; parentName: string; pos: Pos | null }
  | { type: "death";      worldSlug: string; npcId: string; name: string; pos: Pos | null; reason: string }
  | { type: "war_start";  worldSlug: string; warId: string; attacker: string; defender: string }
  | { type: "war_end";    worldSlug: string; warId: string; winner: string }
  | { type: "world_tick"; worldSlug: string; ts: number };

export interface Pos { x: number; y: number }

// ─── Per-world subscriber map ─────────────────────────────────────────────

// worldSlug → Set<WebSocket>
const worldSubs = new Map<string, Set<WebSocket>>();

export function setupUnityWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/unity" });

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

        // { type: "subscribe", worlds: ["tu-tien", "cyberpunk"] }
        if (msg.type === "subscribe" && Array.isArray(msg.worlds)) {
          for (const slug of msg.worlds as string[]) {
            if (!worldSubs.has(slug)) worldSubs.set(slug, new Set());
            worldSubs.get(slug)!.add(ws);
            subscribedWorlds.add(slug);
          }
          ws.send(JSON.stringify({ type: "subscribed", worlds: [...subscribedWorlds] }));
        }

        // { type: "unsubscribe", worlds: ["tu-tien"] }
        if (msg.type === "unsubscribe" && Array.isArray(msg.worlds)) {
          for (const slug of msg.worlds as string[]) {
            worldSubs.get(slug)?.delete(ws);
            subscribedWorlds.delete(slug);
          }
        }

        // { type: "ping" }
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {}
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}

/** Broadcast a Unity event to all clients subscribed to the world. */
export function broadcastUnity(event: UnityEvent) {
  const subs = worldSubs.get(event.worldSlug);
  if (!subs || subs.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch {}
    }
  }
}

export function unitySubscriberCount(worldSlug: string): number {
  return worldSubs.get(worldSlug)?.size ?? 0;
}
