import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type WSEvent =
  | { type: "auth_ok" }
  | { type: "pvp_challenged"; challengerName: string; result: "win" | "lose" | "draw"; rpChange: number }
  | { type: "level_up"; characterName: string; newLevel: number }
  | { type: "guild_war_declared"; attackerGuildName: string; defenderGuildName: string }
  | { type: "guild_war_ended"; winnerGuildName: string | null; yourGuildName: string }
  | { type: "world_event"; worldSlug: string; eventTitle: string }
  | { type: "quest_complete"; questTitle: string; expGained: number }
  | { type: "achievement_unlocked"; title: string; icon: string; xpReward: number }
  | { type: "ping" };

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function handleEvent(event: WSEvent) {
  switch (event.type) {
    case "pvp_challenged": {
      const resultEmoji = event.result === "win" ? "🏆 Thắng" : event.result === "lose" ? "💀 Thua" : "⚖️ Hòa";
      const rpText = event.rpChange >= 0 ? `+${event.rpChange}` : `${event.rpChange}`;
      if (event.result === "lose") {
        toast.error(`⚔️ ${event.challengerName} đã tấn công bạn! ${resultEmoji} — ${rpText} RP`, { duration: 6000 });
      } else if (event.result === "win") {
        toast(`⚔️ ${event.challengerName} tấn công nhưng thất bại! ${resultEmoji} — ${rpText} RP`, { duration: 6000 });
      } else {
        toast(`⚔️ ${event.challengerName} tấn công bạn — ${resultEmoji} — ${rpText} RP`, { duration: 6000 });
      }
      break;
    }
    case "level_up": {
      toast.success(`⬆️ ${event.characterName} lên cấp ${event.newLevel}!`, {
        description: "Sức mạnh tăng thêm — tiếp tục chiến đấu!",
        duration: 5000,
      });
      break;
    }
    case "guild_war_declared": {
      toast.warning(`⚔️ CHIẾN TRANH BANG HỘI!`, {
        description: `${event.attackerGuildName} tuyên chiến với ${event.defenderGuildName}!`,
        duration: 8000,
      });
      break;
    }
    case "guild_war_ended": {
      if (event.winnerGuildName === event.yourGuildName) {
        toast.success(`🏆 ${event.yourGuildName} CHIẾN THẮNG!`, {
          description: "Bang hội của bạn đã đánh bại kẻ thù — nhận thưởng danh vọng!",
          duration: 8000,
        });
      } else if (event.winnerGuildName) {
        toast.error(`💀 ${event.yourGuildName} bại trận`, {
          description: `${event.winnerGuildName} giành chiến thắng.`,
          duration: 6000,
        });
      } else {
        toast(`⚖️ Chiến tranh kết thúc hòa`, { duration: 5000 });
      }
      break;
    }
    case "world_event": {
      toast(`🌍 Sự kiện thế giới: "${event.eventTitle}"`, {
        description: `Thế giới ${event.worldSlug} đang thay đổi!`,
        duration: 6000,
      });
      break;
    }
    case "quest_complete": {
      toast.success(`✅ Quest hoàn thành: "${event.questTitle}"`, {
        description: `+${event.expGained} EXP`,
        duration: 5000,
      });
      break;
    }
    case "achievement_unlocked": {
      toast.success(`${event.icon} Thành tựu mới: ${event.title}`, {
        description: `+${event.xpReward} EXP`,
        duration: 5000,
      });
      break;
    }
  }
}

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!user?.id || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", userId: user.id }));
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WSEvent;
          handleEvent(event);
          if (event.type !== "auth_ok" && event.type !== "ping") {
            import("@/components/NotificationBell").then(m => m.refetchNotifications?.());
          }
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(connect, 4000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    if (user?.id) connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id, connect]);
}
