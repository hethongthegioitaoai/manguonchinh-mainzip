import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Smile, Loader2, RefreshCw, Zap, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/* ── Emotion metadata ── */
const EMOTIONS = [
  { key: "happiness",  label: "Hạnh Phúc",  icon: "😊", color: "text-yellow-400",  bar: "bg-yellow-400" },
  { key: "anger",      label: "Tức Giận",   icon: "😡", color: "text-red-400",     bar: "bg-red-400" },
  { key: "fear",       label: "Sợ Hãi",     icon: "😨", color: "text-purple-400",  bar: "bg-purple-400" },
  { key: "sadness",    label: "Buồn Bã",    icon: "😢", color: "text-blue-400",    bar: "bg-blue-400" },
  { key: "confidence", label: "Tự Tin",     icon: "💪", color: "text-green-400",   bar: "bg-green-400" },
  { key: "stress",     label: "Căng Thẳng", icon: "😰", color: "text-orange-400",  bar: "bg-orange-400" },
] as const;

type EmotionKey = typeof EMOTIONS[number]["key"];

const TRIGGER_EVENTS: Array<{ id: string; label: string; icon: string }> = [
  { id: "nhận_tiền",     label: "Nhận Tiền",       icon: "💰" },
  { id: "mất_tiền",      label: "Mất Tiền",         icon: "📉" },
  { id: "bị_phản_bội",   label: "Bị Phản Bội",      icon: "🗡️" },
  { id: "chiến_thắng",   label: "Chiến Thắng",      icon: "🏆" },
  { id: "thất_bại",      label: "Thất Bại",         icon: "💔" },
  { id: "kết_hôn",       label: "Kết Hôn",          icon: "💍" },
  { id: "mất_người_thân",label: "Mất Người Thân",   icon: "🕯️" },
  { id: "thăng_cấp",     label: "Thăng Tiến",       icon: "⭐" },
  { id: "bị_cướp",       label: "Bị Cướp",          icon: "😤" },
  { id: "gặp_bạn",       label: "Gặp Bạn Bè",       icon: "🤝" },
];

interface Emotion {
  id: string; npcId: string;
  happiness: number; anger: number; fear: number;
  sadness: number; confidence: number; stress: number;
  updatedAt: string;
}

interface EmotionLog {
  id: string; npcId: string; emotionType: string;
  delta: number; reason: string; createdAt: string;
}

interface Behavior {
  avoidsConflict: boolean; likelyToRunForLeader: boolean;
  workEfficiency: number; likelyToExpand: boolean; aggressive: boolean;
}

interface NpcEmotionData {
  npc: { id: string; name: string; occupation: string; age: number; money: number };
  emotion: Emotion;
  recentLogs: EmotionLog[];
  behavior: Behavior;
}

interface Summary {
  avg: Record<EmotionKey, number>;
  dominant: string;
  count: number;
}

function EmotionBar({ label, icon, value, barColor, textColor }: {
  label: string; icon: string; value: number; barColor: string; textColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/50 flex items-center gap-1">
          <span>{icon}</span>{label}
        </span>
        <span className={`text-xs font-mono font-bold ${textColor}`}>{value}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-1.5 rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />;
  return <Minus className="w-3 h-3 text-white/30 flex-shrink-0" />;
}

function BehaviorBadges({ behavior }: { behavior: Behavior }) {
  const badges: Array<{ label: string; color: string }> = [];
  if (behavior.aggressive)          badges.push({ label: "⚔️ Hiếu Chiến",    color: "border-red-400/30 text-red-400" });
  if (behavior.avoidsConflict)      badges.push({ label: "🕊️ Tránh Xung Đột", color: "border-blue-400/30 text-blue-400" });
  if (behavior.likelyToRunForLeader)badges.push({ label: "👑 Muốn Lãnh Đạo", color: "border-yellow-400/30 text-yellow-400" });
  if (behavior.likelyToExpand)      badges.push({ label: "📈 Mở Rộng KD",    color: "border-green-400/30 text-green-400" });
  if (behavior.workEfficiency < 0.6)badges.push({ label: "😮‍💨 Kém Hiệu Quả", color: "border-orange-400/30 text-orange-400" });

  if (badges.length === 0) return <span className="text-xs text-white/30 font-mono">Hành vi bình thường</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <span key={i} className={`text-xs font-mono border rounded-full px-2 py-0.5 ${b.color}`}>{b.label}</span>
      ))}
    </div>
  );
}

function NpcEmotionCard({ item, worldSlug }: { item: NpcEmotionData; worldSlug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [triggeringNpc, setTriggeringNpc] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const triggerMut = useMutation({
    mutationFn: (event: string) =>
      fetch(`/api/npc-emotions/trigger/${item.npc.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      }).then((r) => r.json()),
    onSuccess: (data, event) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-emotions/world", worldSlug] });
      qc.invalidateQueries({ queryKey: ["/api/npc-emotions/summary", worldSlug] });
      const evObj = TRIGGER_EVENTS.find((e) => e.id === event);
      toast({ title: `${evObj?.icon ?? "⚡"} ${item.npc.name}`, description: data.message });
      setTriggeringNpc(null);
    },
  });

  const { emotion, recentLogs, behavior } = item;
  const dominant = EMOTIONS.reduce((a, b) =>
    (emotion[b.key as EmotionKey] ?? 0) > (emotion[a.key as EmotionKey] ?? 0) ? b : a
  );

  return (
    <motion.div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden" layout>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-xl">
            {dominant.icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-mono font-bold text-white">{item.npc.name}</div>
            <div className="text-xs text-white/40">{item.npc.occupation} · {item.npc.age} tuổi</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right space-y-1">
            <div className={`text-xs font-mono font-bold ${dominant.color}`}>{dominant.icon} {dominant.label}: {emotion[dominant.key as EmotionKey]}</div>
            <BehaviorBadges behavior={behavior} />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3"
        >
          {/* Emotion bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {EMOTIONS.map((em) => (
              <EmotionBar
                key={em.key}
                label={em.label}
                icon={em.icon}
                value={emotion[em.key as EmotionKey]}
                barColor={em.bar}
                textColor={em.color}
              />
            ))}
          </div>

          {/* Trigger events */}
          <div>
            <div className="text-xs font-mono text-white/30 mb-2">KÍCH HOẠT SỰ KIỆN</div>
            {triggeringNpc === item.npc.id ? (
              <div className="flex flex-wrap gap-1.5">
                {TRIGGER_EVENTS.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => triggerMut.mutate(ev.id)}
                    disabled={triggerMut.isPending}
                    className="text-xs font-mono bg-white/5 border border-white/10 rounded-full px-2.5 py-1 hover:bg-white/10 transition-colors"
                  >
                    {ev.icon} {ev.label}
                  </button>
                ))}
                <button
                  onClick={() => setTriggeringNpc(null)}
                  className="text-xs font-mono text-white/30 border border-white/10 rounded-full px-2.5 py-1 hover:bg-white/5"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => setTriggeringNpc(item.npc.id)}
                className="text-xs font-mono bg-white/5 border border-white/10 rounded-full px-3 py-1 hover:bg-white/10 transition-colors"
              >⚡ Kích Hoạt Sự Kiện</button>
            )}
          </div>

          {/* Recent logs */}
          {recentLogs.length > 0 && (
            <div>
              <div className="text-xs font-mono text-white/30 mb-2">LỊCH SỬ CẢM XÚC</div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {recentLogs.map((log) => {
                  const em = EMOTIONS.find((e) => e.key === log.emotionType);
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <DeltaIcon delta={log.delta} />
                      <span className={`font-mono font-bold flex-shrink-0 ${em?.color ?? "text-white"}`}>
                        {em?.icon ?? "○"} {em?.label ?? log.emotionType} {log.delta > 0 ? "+" : ""}{log.delta}
                      </span>
                      <span className="text-white/30 truncate">{log.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function NpcEmotionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const worldSlug = localStorage.getItem("activeWorldSlug") ?? "cultivation";

  const { data: worldData, isLoading } = useQuery<NpcEmotionData[]>({
    queryKey: ["/api/npc-emotions/world", worldSlug],
    queryFn: () => fetch(`/api/npc-emotions/world/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/npc-emotions/summary", worldSlug],
    queryFn: () => fetch(`/api/npc-emotions/summary/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const tickMut = useMutation({
    mutationFn: () => fetch(`/api/npc-emotions/tick/${worldSlug}`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-emotions/world"] });
      qc.invalidateQueries({ queryKey: ["/api/npc-emotions/summary"] });
      toast({ title: "⚡ Tick cảm xúc xong", description: data.message });
    },
    onError: () => toast({ title: "❌ Lỗi", variant: "destructive" }),
  });

  const dominantEm = summary?.dominant
    ? EMOTIONS.find((e) => e.key === summary.dominant) ?? null
    : null;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/30 to-pink-600/30 border border-yellow-500/30 flex items-center justify-center">
            <Smile className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-yellow-400">CẢM XÚC NPC</h1>
            <p className="text-xs text-white/40 font-mono">Emotion System · Hành vi · Ký ức · Tích hợp</p>
          </div>
        </div>

        {/* World average emotion bars */}
        {summary?.avg && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-white/40">TRUNG BÌNH TOÀN THẾ GIỚI ({summary.count} NPC)</span>
              {dominantEm && (
                <span className={`text-xs font-mono font-bold ${dominantEm.color}`}>
                  Trội nhất: {dominantEm.icon} {dominantEm.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
              {EMOTIONS.map((em) => (
                <EmotionBar
                  key={em.key}
                  label={em.label}
                  icon={em.icon}
                  value={summary.avg[em.key as EmotionKey] ?? 0}
                  barColor={em.bar}
                  textColor={em.color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => tickMut.mutate()}
            disabled={tickMut.isPending}
            className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 font-mono text-xs"
          >
            {tickMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            TICK CẢM XÚC
          </Button>
        </div>

        {/* World indicator */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-white/30 font-mono">THẾ GIỚI:</span>
          <span className="text-xs font-mono text-yellow-400 uppercase">{worldSlug}</span>
        </div>

        {/* NPC emotion cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-sm">Đang tải...</span>
          </div>
        ) : !worldData || worldData.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-mono text-sm">Chưa có NPC nào</p>
            <p className="text-white/20 font-mono text-xs mt-1">Seed NPC tại trang NPC Simulation trước</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...worldData]
              .sort((a, b) => {
                const aMax = Math.max(a.emotion.anger, a.emotion.stress, a.emotion.fear);
                const bMax = Math.max(b.emotion.anger, b.emotion.stress, b.emotion.fear);
                return bMax - aMax;
              })
              .map((item) => (
                <NpcEmotionCard key={item.npc.id} item={item} worldSlug={worldSlug} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
