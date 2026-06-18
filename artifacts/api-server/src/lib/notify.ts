import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";

export type NotificationEvent =
  | { type: "pvp_challenged"; challengerName: string; result: "win" | "lose" | "draw"; rpChange: number }
  | { type: "level_up"; characterName: string; newLevel: number }
  | { type: "guild_war_declared"; attackerGuildName: string; defenderGuildName: string }
  | { type: "guild_war_ended"; winnerGuildName: string | null; yourGuildName: string }
  | { type: "world_event"; worldSlug: string; eventTitle: string }
  | { type: "quest_complete"; questTitle: string; expGained: number }
  | { type: "achievement_unlocked"; title: string; icon: string; xpReward: number }
  | { type: "auth_ok" }
  | { type: "ping" };

function eventToNotification(event: NotificationEvent): { title: string; body: string; icon: string } | null {
  switch (event.type) {
    case "pvp_challenged": {
      const resultLabel = event.result === "win" ? "Thắng" : event.result === "lose" ? "Thua" : "Hòa";
      const sign = event.rpChange >= 0 ? "+" : "";
      return {
        title: "⚔️ Bị tấn công PvP",
        body: `${event.challengerName} đã tấn công bạn! ${resultLabel} — ${sign}${event.rpChange} RP`,
        icon: "⚔️",
      };
    }
    case "level_up":
      return {
        title: "⬆️ Thăng Cấp!",
        body: `${event.characterName} đã lên cấp ${event.newLevel}!`,
        icon: "⬆️",
      };
    case "guild_war_declared":
      return {
        title: "⚔️ Chiến Tranh Bang Hội",
        body: `${event.attackerGuildName} tuyên chiến với ${event.defenderGuildName}!`,
        icon: "🏯",
      };
    case "guild_war_ended": {
      const won = event.winnerGuildName === event.yourGuildName;
      return {
        title: won ? "🏆 Thắng Chiến!" : "💀 Thua Trận",
        body: won
          ? `${event.yourGuildName} đã chiến thắng!`
          : `${event.yourGuildName} đã thất bại. ${event.winnerGuildName ?? "Hòa"} giành chiến thắng.`,
        icon: won ? "🏆" : "💀",
      };
    }
    case "world_event":
      return {
        title: "🌍 Sự Kiện Thế Giới",
        body: event.eventTitle,
        icon: "🌍",
      };
    case "quest_complete":
      return {
        title: "✅ Quest Hoàn Thành",
        body: `${event.questTitle} — +${event.expGained} EXP`,
        icon: "✅",
      };
    case "achievement_unlocked":
      return {
        title: "🏅 Thành Tựu Mở Khóa",
        body: `${event.icon} ${event.title} (+${event.xpReward} XP)`,
        icon: "🏅",
      };
    default:
      return null;
  }
}

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    let userId: string | null = null;
    let pingTimer: NodeJS.Timeout | null = null;

    function cleanup() {
      if (pingTimer) clearInterval(pingTimer);
      if (userId) {
        clients.get(userId)?.delete(ws);
        if (clients.get(userId)?.size === 0) clients.delete(userId);
      }
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth" && typeof msg.userId === "string") {
          const uid = msg.userId as string;
          userId = uid;
          if (!clients.has(uid)) clients.set(uid, new Set());
          clients.get(uid)!.add(ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));

          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
          }, 25000);
        }
      } catch {}
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}

export function notifyUser(userId: string, event: NotificationEvent) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of userClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch {}
    }
  }
}

export function notifyMany(userIds: string[], event: NotificationEvent) {
  for (const uid of userIds) notifyUser(uid, event);
}

export async function saveAndNotify(userId: string, event: NotificationEvent) {
  notifyUser(userId, event);
  const n = eventToNotification(event);
  if (!n) return;
  try {
    await db.insert(notifications).values({
      userId,
      type: event.type,
      title: n.title,
      body: n.body,
      icon: n.icon,
      metadata: event as unknown as Record<string, unknown>,
    });
  } catch {}
}

export async function saveAndNotifyMany(userIds: string[], event: NotificationEvent) {
  notifyMany(userIds, event);
  const n = eventToNotification(event);
  if (!n) return;
  try {
    const rows = userIds.map(userId => ({
      userId,
      type: event.type,
      title: n.title,
      body: n.body,
      icon: n.icon,
      metadata: event as unknown as Record<string, unknown>,
    }));
    await db.insert(notifications).values(rows);
  } catch {}
}

export function connectedCount() {
  return clients.size;
}
