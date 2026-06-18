import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Sparkles, Heart, Sword, Zap, Eye,
  BookOpen, Clock, User, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

/* ── Trait metadata ── */
const TRAITS = [
  { key: "kindness",     label: "Lòng Tốt",    icon: Heart,  color: "#ec4899", bar: "bg-pink-500" },
  { key: "greed",        label: "Tham Vọng",   icon: Zap,    color: "#f59e0b", bar: "bg-amber-500" },
  { key: "bravery",      label: "Dũng Cảm",    icon: Sword,  color: "#ef4444", bar: "bg-red-500" },
  { key: "intelligence", label: "Trí Tuệ",     icon: Brain,  color: "#3b82f6", bar: "bg-blue-500" },
  { key: "curiosity",    label: "Tò Mò",       icon: Eye,    color: "#8b5cf6", bar: "bg-violet-500" },
] as const;

type TraitKey = typeof TRAITS[number]["key"];

const CAUSE_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  memory:       { label: "Ký ức",       color: "text-cyan-400" },
  emotion:      { label: "Cảm xúc",     color: "text-yellow-400" },
  relationship: { label: "Quan hệ",     color: "text-green-400" },
};

/* ── Types ── */
interface Personality {
  kindness: number; greed: number; bravery: number;
  intelligence: number; curiosity: number;
}

interface PersonalityLog {
  id: string; trait: string; delta: number; cause: string;
  causeType: string; journal: string; createdAt: string;
}

interface HistorySnapshot {
  id: string; createdAt: string;
  kindness: number; greed: number; bravery: number;
  intelligence: number; curiosity: number;
}

interface NpcData {
  npc: { id: string; name: string; occupation: string; age: number };
  personality: Personality | null;
  recentLogs: PersonalityLog[];
  history: HistorySnapshot[];
}

interface DashboardData {
  npcs: NpcData[];
  journals: Array<{
    id: string; journal: string; trait: string; delta: number;
    cause: string; causeType: string; createdAt: string; npcName: string;
  }>;
}

/* ── Helpers ── */
function pct(v: number) { return Math.round(v * 100); }

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0.005) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < -0.005) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-white/30" />;
}

function TraitBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <motion.div
        className="h-1.5 rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct(value)}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/* ── NPC Radar Chart ── */
function PersonalityRadar({ personality }: { personality: Personality }) {
  const data = TRAITS.map(t => ({
    trait: t.label,
    value: pct(personality[t.key]),
    fullMark: 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="trait" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
        <Radar name="Tính cách" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Personality History Line Chart ── */
function HistoryChart({ history }: { history: HistorySnapshot[] }) {
  if (history.length < 2) {
    return <p className="text-center text-white/30 text-xs py-6">Cần ít nhất 2 lần tiến hóa để hiển thị biểu đồ</p>;
  }
  const data = history.map((h, i) => ({
    tick: `#${i + 1}`,
    "Lòng Tốt":  pct(h.kindness),
    "Tham Vọng": pct(h.greed),
    "Dũng Cảm":  pct(h.bravery),
    "Trí Tuệ":   pct(h.intelligence),
    "Tò Mò":     pct(h.curiosity),
  }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="tick" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "rgba(255,255,255,0.7)" }}
        />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
        {TRAITS.map(t => (
          <Line key={t.key} type="monotone" dataKey={t.label} stroke={t.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── NPC Card ── */
function NpcCard({ data, onEvolve, evolving }: {
  data: NpcData;
  onEvolve: (id: string) => void;
  evolving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { npc, personality, recentLogs, history } = data;

  return (
    <motion.div
      layout
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <User className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{npc.name}</p>
            <p className="text-white/40 text-xs">{npc.occupation} · {npc.age} tuổi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 text-xs"
            onClick={() => onEvolve(npc.id)}
            disabled={evolving}
          >
            {evolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          </Button>
          <button onClick={() => setExpanded(e => !e)} className="text-white/30 hover:text-white/60 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Trait bars */}
      {personality ? (
        <div className="px-4 pb-3 space-y-2">
          {TRAITS.map(t => (
            <div key={t.key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-mono">{t.label}</span>
                <span className="text-xs font-bold font-mono" style={{ color: t.color }}>
                  {pct(personality[t.key])}%
                </span>
              </div>
              <TraitBar value={personality[t.key]} color={t.color} />
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 pb-3 text-xs text-white/30">Chưa có dữ liệu tính cách</p>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-4">
              {/* Radar */}
              {personality && (
                <div>
                  <p className="text-xs text-white/40 font-mono mb-2 uppercase tracking-wider">Bản đồ tính cách</p>
                  <PersonalityRadar personality={personality} />
                </div>
              )}

              {/* History chart */}
              <div>
                <p className="text-xs text-white/40 font-mono mb-2 uppercase tracking-wider">Lịch sử thay đổi</p>
                <HistoryChart history={history} />
              </div>

              {/* Recent logs */}
              {recentLogs.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 font-mono mb-2 uppercase tracking-wider">Nhật ký gần đây</p>
                  <div className="space-y-2">
                    {recentLogs.map(log => {
                      const trait = TRAITS.find(t => t.key === log.trait);
                      const ct = CAUSE_TYPE_LABEL[log.causeType] ?? { label: log.causeType, color: "text-white/50" };
                      return (
                        <div key={log.id} className="bg-white/3 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-start gap-2">
                            <DeltaIcon delta={log.delta} />
                            <p className="text-xs text-white/80 leading-relaxed flex-1">{log.journal}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {trait && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: `${trait.color}22`, color: trait.color }}>
                                {trait.label}
                              </span>
                            )}
                            <span className={`text-[10px] ${ct.color} font-mono`}>← {ct.label}</span>
                            <span className="text-[10px] text-white/25 font-mono ml-auto">
                              {log.delta > 0 ? "+" : ""}{Math.round(log.delta * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
export default function PersonalityEvolutionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [worldSlug, setWorldSlug] = useState<string>("");
  const [activeWorld, setActiveWorld] = useState<string>("");
  const [evolvingId, setEvolvingId] = useState<string | null>(null);
  const [filterTrait, setFilterTrait] = useState<string>("all");

  /* ── Fetch dashboard ── */
  const { data, isLoading, isFetching } = useQuery<DashboardData>({
    queryKey: ["personality-dashboard", activeWorld],
    queryFn: async () => {
      const r = await fetch(`/api/personality-evolution/dashboard/${activeWorld}`, { credentials: "include" });
      if (!r.ok) throw new Error("Không thể tải dữ liệu");
      return r.json();
    },
    enabled: !!activeWorld,
    refetchInterval: false,
  });

  /* ── Tick toàn world ── */
  const tickMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/personality-evolution/tick/${activeWorld}`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Lỗi tick");
      return r.json();
    },
    onSuccess: (res) => {
      toast({ title: "✨ Tiến hóa hoàn tất", description: res.message });
      queryClient.invalidateQueries({ queryKey: ["personality-dashboard", activeWorld] });
    },
    onError: () => toast({ title: "Lỗi", description: "Không thể tiến hóa", variant: "destructive" }),
  });

  /* ── Evolve một NPC ── */
  const evolveMutation = useMutation({
    mutationFn: async (npcId: string) => {
      setEvolvingId(npcId);
      const r = await fetch(`/api/personality-evolution/evolve/${npcId}`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Lỗi");
      return r.json();
    },
    onSuccess: (res) => {
      if (res.changed) {
        toast({ title: "Tính cách thay đổi", description: res.journals?.[0] ?? "Có thay đổi mới" });
      } else {
        toast({ title: "Không có thay đổi", description: "Tính cách ổn định" });
      }
      queryClient.invalidateQueries({ queryKey: ["personality-dashboard", activeWorld] });
    },
    onError: () => toast({ title: "Lỗi", variant: "destructive" }),
    onSettled: () => setEvolvingId(null),
  });

  /* ── Filter journals by trait ── */
  const filteredJournals = data?.journals?.filter(
    j => filterTrait === "all" || j.trait === filterTrait
  ) ?? [];

  return (
    <div className="min-h-screen bg-[#060b14] text-white">
      {/* ── Header ── */}
      <div className="border-b border-white/5 bg-[#0a1120]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Tiến Hóa Tính Cách</h1>
              <p className="text-xs text-white/40">Personality Evolution System</p>
            </div>
          </div>
          {activeWorld && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white border border-white/10 h-8 px-3"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["personality-dashboard", activeWorld] })}
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-500 text-white h-8 px-4 text-xs gap-1.5"
                onClick={() => tickMutation.mutate()}
                disabled={tickMutation.isPending}
              >
                {tickMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Tiến hóa tất cả
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── World selector ── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Chọn Thế Giới
          </p>
          <div className="flex gap-3">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
              placeholder="Nhập world slug (vd: cyberpunk-2077)..."
              value={worldSlug}
              onChange={e => setWorldSlug(e.target.value)}
              onKeyDown={e => e.key === "Enter" && worldSlug.trim() && setActiveWorld(worldSlug.trim())}
            />
            <Button
              className="bg-violet-600 hover:bg-violet-500 text-white px-5"
              onClick={() => worldSlug.trim() && setActiveWorld(worldSlug.trim())}
              disabled={!worldSlug.trim()}
            >
              Tải
            </Button>
          </div>
        </div>

        {!activeWorld && (
          <div className="text-center py-20">
            <Brain className="w-12 h-12 text-violet-400/30 mx-auto mb-4" />
            <p className="text-white/30 text-sm">Nhập world slug để xem dashboard tính cách</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            <span className="text-sm">Đang tải dữ liệu...</span>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Left: NPC list ── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/70">
                  {data.npcs.length} NPC trong <span className="text-violet-400">{activeWorld}</span>
                </p>
              </div>

              {data.npcs.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  Không có NPC nào trong thế giới này
                </div>
              ) : (
                <div className="space-y-3">
                  {data.npcs.map(npcData => (
                    <NpcCard
                      key={npcData.npc.id}
                      data={npcData}
                      onEvolve={(id) => evolveMutation.mutate(id)}
                      evolving={evolvingId === npcData.npc.id && evolveMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Journal feed ── */}
            <div className="space-y-4">
              {/* World stats */}
              {data.npcs.length > 0 && (() => {
                const withP = data.npcs.filter(n => n.personality);
                if (withP.length === 0) return null;
                const avg = (key: TraitKey) =>
                  Math.round(withP.reduce((s, n) => s + (n.personality?.[key] ?? 0), 0) / withP.length * 100);
                return (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-3">
                      Trung Bình Thế Giới
                    </p>
                    <div className="space-y-2.5">
                      {TRAITS.map(t => (
                        <div key={t.key} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/50 flex items-center gap-1.5">
                              <t.icon className="w-3 h-3" style={{ color: t.color }} />
                              {t.label}
                            </span>
                            <span className="text-xs font-bold font-mono" style={{ color: t.color }}>
                              {avg(t.key)}%
                            </span>
                          </div>
                          <TraitBar value={avg(t.key) / 100} color={t.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Journal feed */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-white/40 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Nhật Ký Phát Triển
                  </p>
                  <select
                    className="text-[10px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/50 focus:outline-none"
                    value={filterTrait}
                    onChange={e => setFilterTrait(e.target.value)}
                  >
                    <option value="all">Tất cả</option>
                    {TRAITS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>

                {filteredJournals.length === 0 ? (
                  <p className="text-xs text-white/20 text-center py-6">
                    Chưa có nhật ký nào. Nhấn "Tiến hóa tất cả" để bắt đầu.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scroll">
                    <AnimatePresence>
                      {filteredJournals.map(j => {
                        const trait = TRAITS.find(t => t.key === j.trait);
                        const ct = CAUSE_TYPE_LABEL[j.causeType] ?? { label: j.causeType, color: "text-white/40" };
                        return (
                          <motion.div
                            key={j.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white/3 rounded-lg p-2.5 space-y-1.5"
                          >
                            <div className="flex items-start gap-2">
                              <DeltaIcon delta={j.delta} />
                              <p className="text-xs text-white/80 leading-relaxed flex-1">{j.journal}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-violet-300">{j.npcName}</span>
                              {trait && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                                  style={{ backgroundColor: `${trait.color}22`, color: trait.color }}>
                                  {trait.label}
                                </span>
                              )}
                              <span className={`text-[10px] ${ct.color} font-mono`}>{ct.label}</span>
                              <span className="text-[10px] text-white/25 font-mono ml-auto flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(j.createdAt).toLocaleDateString("vi-VN", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Cause type legend */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 font-mono uppercase tracking-wider mb-3">Nguồn Thay Đổi</p>
                <div className="space-y-2">
                  {Object.entries(CAUSE_TYPE_LABEL).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${val.color.replace("text-", "bg-")}`} />
                      <span className={val.color + " font-mono"}>{val.label}</span>
                      <span className="text-white/30">—</span>
                      <span className="text-white/40">
                        {key === "memory" && "Sự kiện và ký ức trong cuộc đời"}
                        {key === "emotion" && "Cảm xúc kéo dài tác động"}
                        {key === "relationship" && "Quan hệ xã hội thay đổi"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
