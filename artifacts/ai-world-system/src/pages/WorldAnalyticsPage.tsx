import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Loader2, ChevronRight, Users, Crown, TrendingUp,
  Swords, Smile, Star, Shield, Landmark, BarChart3,
  BookOpen, Clock, Zap, RefreshCw, Camera, X, ChevronDown,
  ChevronUp, Heart, AlertTriangle, Coins, Scale, Baby,
  TreePine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* ══════════════════════════════════════════ TYPES */
interface WorldStats {
  population: number; familyCount: number; factionCount: number;
  governmentCount: number; electionCount: number; warCount: number;
  gdp: number; totalWealth: number; avgHappiness: number;
  inequalityIndex: number; worldYear: number; worldTick: number;
}

interface CivMetrics {
  politicalStability: number; populationGrowth: number; economicGrowth: number;
  warLevel: number; happinessIndex: number; inequalityScore: number; overallScore: number;
}

interface NpcEvent {
  id: string; worldSlug: string; eventType: string; title: string;
  description: string; actorName: string | null; targetName: string | null;
  worldYear: number; worldTick: number; importance: number; createdAt: string;
}

interface Chronicle {
  id: string; worldYear: number; worldTick: number; title: string;
  content: string; highlights: string[]; importance: number; createdAt: string;
}

interface Dynasty {
  name: string; memberCount: number; totalWealth: number; avgHappiness: number;
  oldestMember: string; richestMember: string; maxAge: number; occupations: string[];
}

interface StatSnapshot {
  id: string; worldYear: number; worldTick: number; population: number;
  gdp: number; totalWealth: number; avgHappiness: number; inequalityIndex: number; createdAt: string;
}

interface Overview {
  stats: WorldStats; events: NpcEvent[]; chronicles: Chronicle[];
  topDynasties: { name: string; totalWealth: number; memberCount: number; richestMember: string }[];
  metrics: CivMetrics;
}

/* ══════════════════════════════════════════ EVENT META */
const EVENT_META: Record<string, { icon: string; color: string; label: string }> = {
  birth:          { icon: "👶", color: "text-pink-400",    label: "Sinh Ra" },
  death:          { icon: "💀", color: "text-slate-400",   label: "Qua Đời" },
  marriage:       { icon: "💍", color: "text-rose-400",    label: "Hôn Nhân" },
  faction_formed: { icon: "🛡️", color: "text-emerald-400", label: "Thành Lập Hội" },
  election:       { icon: "🗳️", color: "text-blue-400",    label: "Bầu Cử" },
  war:            { icon: "⚔️", color: "text-red-400",     label: "Chiến Tranh" },
  treaty:         { icon: "🤝", color: "text-teal-400",    label: "Hiệp Ước" },
  crisis:         { icon: "🚨", color: "text-orange-400",  label: "Khủng Hoảng" },
  achievement:    { icon: "⭐", color: "text-amber-400",   label: "Thành Tựu" },
  political:      { icon: "👑", color: "text-violet-400",  label: "Chính Trị" },
  economic:       { icon: "💰", color: "text-yellow-400",  label: "Kinh Tế" },
};

function getEventMeta(type: string) { return EVENT_META[type] ?? { icon: "📌", color: "text-slate-400", label: type }; }

/* ══════════════════════════════════════════ MINI SVG LINE CHART */
function MiniLineChart({ data, color = "#a78bfa", label }: { data: number[]; color?: string; label: string }) {
  if (data.length < 2) return (
    <div className="h-16 flex items-center justify-center text-[10px] text-slate-600">Chưa đủ dữ liệu</div>
  );
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 200; const H = 48;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  const area = `M${data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" L")} L${W},${H} L0,${H} Z`;

  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${label})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={data.map((_, i) => (i / (data.length - 1)) * W).at(-1)} cy={H - ((data.at(-1)! - min) / range) * H} r="2.5" fill={color} />
      </svg>
      <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
        <span>{min.toLocaleString()}</span><span className="font-bold" style={{ color }}>{data.at(-1)?.toLocaleString()}</span><span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ CIVILIZATION METER */
function CivMeter({ label, value, max = 100, icon, color, note }: {
  label: string; value: number; max?: number; icon: React.ReactNode; color: string; note?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[11px] text-slate-300">{label}</span>
          <span className={`text-xs font-bold ${color}`}>{value}{note}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: color.replace("text-", "").includes("-") ? undefined : color }}
          >
            <div className={`h-full rounded-full bg-current ${color}`} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ CHRONICLE CARD */
function ChronicleCard({ chronicle }: { chronicle: Chronicle }) {
  const [expanded, setExpanded] = useState(false);
  const imp = chronicle.importance ?? 0;
  const color = imp >= 3 ? "border-amber-500/40 bg-amber-500/5" : imp >= 1 ? "border-slate-600/50 bg-slate-800/40" : "border-slate-700/30 bg-slate-800/20";

  return (
    <div className={`rounded-xl border ${color} transition-all`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
            <span className="text-lg">📜</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-400">Năm {chronicle.worldYear}</span>
              {imp >= 3 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">✨ Đáng Chú Ý</span>}
            </div>
            <p className="text-sm text-slate-200 font-medium mt-0.5">{chronicle.title}</p>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{chronicle.content}</p>
          </div>
          <div className="shrink-0 text-slate-600">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3">
              <p className="text-[12px] text-slate-300 leading-relaxed">{chronicle.content}</p>
              {chronicle.highlights && chronicle.highlights.length > 0 && (
                <div className="space-y-1">
                  {chronicle.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-amber-400 mt-0.5">•</span>{h}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════ MAIN PAGE */
export default function WorldAnalyticsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [worldSlug, setWorldSlug] = useState("");
  const [worldInput, setWorldInput] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "chronicle" | "timeline" | "dynasties" | "charts">("overview");

  const overviewQuery = useQuery<Overview>({
    queryKey: ["world-analytics-overview", worldSlug],
    queryFn: () => fetch(`/api/world-analytics/overview/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug,
    refetchInterval: 30000,
  });

  const dynastiesQuery = useQuery<Dynasty[]>({
    queryKey: ["world-analytics-dynasties", worldSlug],
    queryFn: () => fetch(`/api/world-analytics/dynasties/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug && activeTab === "dynasties",
  });

  const timelineQuery = useQuery<NpcEvent[]>({
    queryKey: ["world-analytics-timeline", worldSlug],
    queryFn: () => fetch(`/api/world-analytics/timeline/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug && activeTab === "timeline",
  });

  const snapshotsQuery = useQuery<StatSnapshot[]>({
    queryKey: ["world-analytics-snapshots", worldSlug],
    queryFn: () => fetch(`/api/world-analytics/snapshots/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug && activeTab === "charts",
  });

  const snapshotMutation = useMutation<{ snapshot: StatSnapshot; chronicle: Chronicle; stats: WorldStats }, Error>({
    mutationFn: () => fetch(`/api/world-analytics/snapshot/${worldSlug}`, { method: "POST" }).then(r => {
      if (!r.ok) throw new Error("Lỗi");
      return r.json();
    }),
    onSuccess: (data) => {
      toast({ title: "📸 Snapshot chụp thành công", description: `Biên niên sử Năm ${data.chronicle.worldYear} đã được ghi`, duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ["world-analytics-overview", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["world-analytics-snapshots", worldSlug] });
    },
    onError: () => toast({ title: "Lỗi", description: "Không thể chụp snapshot", variant: "destructive" }),
  });

  const handleLoad = () => { const s = worldInput.trim(); if (s) setWorldSlug(s); };

  const ov = overviewQuery.data;
  const stats = ov?.stats;
  const metrics = ov?.metrics;

  const TABS = [
    { id: "overview",   label: "Tổng Quan",    icon: <Globe size={12} /> },
    { id: "chronicle",  label: "Biên Niên Sử", icon: <BookOpen size={12} /> },
    { id: "timeline",   label: "Dòng Thời Gian", icon: <Clock size={12} /> },
    { id: "dynasties",  label: "Gia Tộc",      icon: <Crown size={12} /> },
    { id: "charts",     label: "Biểu Đồ",      icon: <BarChart3 size={12} /> },
  ] as const;

  /* ── Loading / world selector ── */
  if (!worldSlug) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        <div className="bg-slate-800/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center"><Globe size={16} /></div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">EMERGENT WORLD ANALYTICS</h1>
            <p className="text-[10px] text-slate-400">Đo lường sự phát triển tự nhiên của thế giới NPC</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto">
                <Globe size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold">Phân Tích Thế Giới</h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Theo dõi sự phát triển tự nhiên của văn minh NPC — dân số, kinh tế, gia tộc, chiến tranh, và lịch sử
              </p>
            </div>
            <div className="flex gap-2">
              <Input value={worldInput} onChange={e => setWorldInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLoad()} placeholder="Nhập world slug..." className="bg-slate-800 border-slate-600 text-slate-100" />
              <Button onClick={handleLoad} className="bg-emerald-600 hover:bg-emerald-700 shrink-0"><ChevronRight size={16} /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                { icon: "👥", label: "Thống kê dân số thời gian thực" },
                { icon: "📜", label: "Biên niên sử tự động tạo" },
                { icon: "👑", label: "Xếp hạng gia tộc quyền lực" },
                { icon: "📊", label: "Biểu đồ lịch sử phát triển" },
                { icon: "⚔️", label: "Theo dõi chiến tranh & hòa bình" },
                { icon: "🏛️", label: "Chỉ số văn minh tổng hợp" },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                  <span>{f.icon}</span><span className="text-slate-400">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center"><Globe size={16} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm tracking-wide">EMERGENT WORLD ANALYTICS</h1>
          <p className="text-[10px] text-slate-400 font-mono truncate">{worldSlug}</p>
        </div>
        {stats && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400 font-bold">Năm {stats.worldYear}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{stats.population} dân</span>
          </div>
        )}
        <Button size="sm" variant="ghost"
          className="h-7 text-[11px] text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 shrink-0"
          onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
          {snapshotMutation.isPending ? <Loader2 size={11} className="animate-spin mr-1" /> : <Camera size={11} className="mr-1" />}
          Chụp Snapshot
        </Button>
        <button onClick={() => { setWorldSlug(""); setWorldInput(""); }} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 bg-slate-800/30 shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id ? "text-emerald-400 border-emerald-500" : "text-slate-500 border-transparent hover:text-slate-300"
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
        <div className="ml-auto px-2 flex items-center">
          {overviewQuery.isFetching && <Loader2 size={12} className="animate-spin text-slate-500" />}
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ["world-analytics-overview", worldSlug] })} className="text-slate-600 hover:text-slate-300 p-1 ml-1"><RefreshCw size={11} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {overviewQuery.isLoading && (
          <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-emerald-400" /></div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && ov && (
          <div className="p-4 space-y-5 max-w-4xl mx-auto">
            {/* World Stats Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {[
                { label: "Dân Số", value: stats!.population, icon: <Users size={14} />, color: "text-blue-400", format: (v: number) => v.toLocaleString() },
                { label: "Gia Tộc", value: stats!.familyCount, icon: <TreePine size={14} />, color: "text-emerald-400", format: (v: number) => String(v) },
                { label: "Hội Nhóm", value: stats!.factionCount, icon: <Shield size={14} />, color: "text-violet-400", format: (v: number) => String(v) },
                { label: "Chính Quyền", value: stats!.governmentCount, icon: <Landmark size={14} />, color: "text-amber-400", format: (v: number) => String(v) },
                { label: "Bầu Cử", value: stats!.electionCount, icon: <Star size={14} />, color: "text-teal-400", format: (v: number) => String(v) },
                { label: "Chiến Tranh", value: stats!.warCount, icon: <Swords size={14} />, color: "text-red-400", format: (v: number) => String(v) },
                { label: "GDP", value: stats!.gdp, icon: <TrendingUp size={14} />, color: "text-yellow-400", format: (v: number) => v.toLocaleString() + "g" },
                { label: "Tổng Tài Sản", value: stats!.totalWealth, icon: <Coins size={14} />, color: "text-orange-400", format: (v: number) => v.toLocaleString() + "g" },
                { label: "Hạnh Phúc", value: stats!.avgHappiness, icon: <Smile size={14} />, color: "text-pink-400", format: (v: number) => v + "%" },
                { label: "Bất Bình Đẳng", value: Math.round(stats!.inequalityIndex * 100), icon: <Scale size={14} />, color: "text-slate-400", format: (v: number) => (v / 100).toFixed(2) },
              ].map(card => (
                <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40 text-center">
                  <div className={`flex justify-center mb-1.5 ${card.color}`}>{card.icon}</div>
                  <div className="text-lg font-bold text-slate-100">{card.format(card.value)}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{card.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Two column: Civ Metrics + Top Dynasties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Civilization Metrics */}
              {metrics && (
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4 space-y-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-slate-200">Chỉ Số Văn Minh</h3>
                    <div className="px-2.5 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30">
                      <span className="text-emerald-400 text-xs font-bold">{metrics.overallScore}/100</span>
                    </div>
                  </div>
                  <CivMeter label="Ổn định chính trị" value={metrics.politicalStability} icon={<Landmark size={13} />} color="text-blue-400" note="%" />
                  <CivMeter label="Hạnh phúc nhân dân" value={metrics.happinessIndex} icon={<Smile size={13} />} color="text-pink-400" note="%" />
                  <CivMeter label="Hòa bình (ngược chiến)" value={100 - metrics.warLevel} icon={<Heart size={13} />} color="text-emerald-400" note="%" />
                  <CivMeter label="Công bằng (ngược BPĐ)" value={100 - metrics.inequalityScore} icon={<Scale size={13} />} color="text-teal-400" note="%" />
                  {metrics.populationGrowth !== 0 && (
                    <div className={`flex items-center gap-2 text-[11px] ${metrics.populationGrowth > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <TrendingUp size={11} />
                      Tăng trưởng dân số: {metrics.populationGrowth > 0 ? "+" : ""}{metrics.populationGrowth}%
                    </div>
                  )}
                  {metrics.economicGrowth !== 0 && (
                    <div className={`flex items-center gap-2 text-[11px] ${metrics.economicGrowth > 0 ? "text-yellow-400" : "text-red-400"}`}>
                      <Coins size={11} />
                      Tăng trưởng kinh tế: {metrics.economicGrowth > 0 ? "+" : ""}{metrics.economicGrowth}%
                    </div>
                  )}
                </div>
              )}

              {/* Top Dynasties */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Crown size={13} className="text-amber-400" /> Gia Tộc Nổi Bật
                </h3>
                {ov.topDynasties.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">Chưa có gia tộc nào</p>
                ) : (
                  <div className="space-y-2">
                    {ov.topDynasties.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-slate-500/20 text-slate-300" : "bg-orange-900/20 text-orange-400"}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate">Gia tộc {d.name}</div>
                          <div className="text-[10px] text-slate-500">{d.memberCount} thành viên · {d.richestMember}</div>
                        </div>
                        <div className="text-[11px] font-mono text-yellow-400 shrink-0">{d.totalWealth.toLocaleString()}g</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Chronicle */}
            {ov.chronicles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
                  <BookOpen size={13} className="text-amber-400" /> Biên Niên Sử Gần Đây
                </h3>
                <div className="space-y-2.5">
                  {ov.chronicles.slice(0, 3).map(c => <ChronicleCard key={c.id} chronicle={c} />)}
                </div>
              </div>
            )}

            {/* Recent Events */}
            {ov.events.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
                  <Zap size={13} className="text-violet-400" /> Sự Kiện Gần Đây
                </h3>
                <div className="space-y-1.5">
                  {ov.events.slice(0, 8).map(ev => {
                    const meta = getEventMeta(ev.eventType);
                    return (
                      <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/30">
                        <span className="text-base shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-200 font-medium truncate">{ev.title}</div>
                          {ev.actorName && <div className="text-[10px] text-slate-500">{ev.actorName}</div>}
                        </div>
                        <span className="text-[10px] text-slate-600 shrink-0">Năm {ev.worldYear}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {ov.events.length === 0 && ov.chronicles.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <Camera size={28} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">Chưa có dữ liệu lịch sử</p>
                <p className="text-xs text-slate-600">Nhấn "Chụp Snapshot" để bắt đầu ghi lại lịch sử thế giới</p>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs mt-2"
                  onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
                  {snapshotMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Camera size={12} className="mr-1" />}
                  Chụp Snapshot Đầu Tiên
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── CHRONICLE TAB ── */}
        {activeTab === "chronicle" && ov && (
          <div className="p-4 space-y-3 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><BookOpen size={14} className="text-amber-400" /> Biên Niên Sử Thế Giới</h2>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-400 border border-emerald-500/30"
                onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
                <Camera size={11} className="mr-1" /> Thêm Trang Mới
              </Button>
            </div>
            {ov.chronicles.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <BookOpen size={28} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">Chưa có trang biên niên sử nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ov.chronicles.map(c => <ChronicleCard key={c.id} chronicle={c} />)}
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE TAB ── */}
        {activeTab === "timeline" && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><Clock size={14} className="text-violet-400" /> Dòng Thời Gian Lịch Sử</h2>
            {timelineQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
            ) : !timelineQuery.data?.length ? (
              <div className="text-center py-16 space-y-2">
                <Clock size={24} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">Chưa có sự kiện nào được ghi nhận</p>
                <p className="text-xs text-slate-600">Các hệ thống NPC sẽ tự động ghi lại sự kiện quan trọng</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {timelineQuery.data.map((ev, i) => {
                  const meta = getEventMeta(ev.eventType);
                  const imp = ev.importance ?? 1;
                  return (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full mt-3 ${imp >= 3 ? "bg-amber-400" : imp >= 2 ? "bg-violet-400" : "bg-slate-600"}`} />
                        {i < timelineQuery.data!.length - 1 && <div className="w-0.5 flex-1 bg-slate-700/40 mt-1" />}
                      </div>
                      <div className="flex-1 pb-2.5">
                        <div className={`flex items-start gap-3 p-3 rounded-lg ${imp >= 3 ? "bg-amber-500/5 border border-amber-500/20" : "bg-slate-800/40 border border-slate-700/30"}`}>
                          <span className="text-lg shrink-0">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                              <span className="text-[10px] text-slate-600">Năm {ev.worldYear}</span>
                            </div>
                            <div className="text-xs font-semibold text-slate-200 mt-0.5">{ev.title}</div>
                            {ev.description && <p className="text-[11px] text-slate-400 mt-0.5">{ev.description}</p>}
                            {ev.actorName && (
                              <div className="text-[10px] text-slate-500 mt-1">
                                {ev.actorName}{ev.targetName ? ` → ${ev.targetName}` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DYNASTIES TAB ── */}
        {activeTab === "dynasties" && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><Crown size={14} className="text-amber-400" /> Gia Tộc & Dòng Dõi</h2>
            {dynastiesQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-amber-400" /></div>
            ) : !dynastiesQuery.data?.length ? (
              <div className="text-center py-16 space-y-2">
                <Crown size={24} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">Chưa có gia tộc nào được lập</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {dynastiesQuery.data.map((d, i) => (
                  <motion.div key={d.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-xl border p-4 ${i === 0 ? "border-amber-500/40 bg-amber-500/5" : i === 1 ? "border-slate-500/30 bg-slate-500/5" : "border-slate-700/40 bg-slate-800/40"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-slate-500/20 text-slate-300" : "bg-slate-700/50 text-slate-500"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-100">Gia Tộc {d.name}</span>
                          {i === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">👑 Giàu Nhất</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                          <div className="text-[11px] text-slate-400">👥 {d.memberCount} thành viên</div>
                          <div className="text-[11px] text-yellow-400 font-mono">💰 {d.totalWealth.toLocaleString()}g</div>
                          {d.oldestMember && <div className="text-[11px] text-slate-500">🧓 {d.oldestMember} ({d.maxAge}t)</div>}
                          {d.richestMember && <div className="text-[11px] text-slate-500">🤑 {d.richestMember}</div>}
                          <div className="text-[11px] text-slate-500">😊 Hạnh phúc {d.avgHappiness}%</div>
                          {d.occupations?.length > 0 && <div className="text-[11px] text-slate-600 truncate">{d.occupations.join(", ")}</div>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHARTS TAB ── */}
        {activeTab === "charts" && (
          <div className="p-4 max-w-3xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><BarChart3 size={14} className="text-teal-400" /> Lịch Sử Phát Triển</h2>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-400 border border-emerald-500/30"
                onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
                <Camera size={11} className="mr-1" /> Thêm Điểm Dữ Liệu
              </Button>
            </div>
            {snapshotsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-teal-400" /></div>
            ) : !snapshotsQuery.data?.length ? (
              <div className="text-center py-16 space-y-3">
                <BarChart3 size={28} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500">Cần ít nhất 2 snapshot để vẽ biểu đồ</p>
                <p className="text-xs text-slate-600">Nhấn "Chụp Snapshot" nhiều lần để tích lũy dữ liệu lịch sử</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Dân Số", data: snapshotsQuery.data.map(s => s.population), color: "#60a5fa" },
                  { label: "Tổng Tài Sản (vàng)", data: snapshotsQuery.data.map(s => s.totalWealth), color: "#fbbf24" },
                  { label: "GDP (lương/kỳ)", data: snapshotsQuery.data.map(s => s.gdp), color: "#34d399" },
                  { label: "Chỉ Số Hạnh Phúc (%)", data: snapshotsQuery.data.map(s => s.avgHappiness), color: "#f472b6" },
                  { label: "Bất Bình Đẳng (Gini)", data: snapshotsQuery.data.map(s => Math.round(s.inequalityIndex * 100) / 100), color: "#a78bfa" },
                ].map(chart => (
                  <div key={chart.label} className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                    <MiniLineChart data={chart.data} color={chart.color} label={chart.label} />
                  </div>
                ))}
                {/* Snapshot timeline */}
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                  <div className="text-[10px] text-slate-500 mb-2">Lịch Sử Snapshot ({snapshotsQuery.data.length} điểm)</div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {[...snapshotsQuery.data].reverse().map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-600">{new Date(s.createdAt).toLocaleDateString("vi-VN")}</span>
                        <span className="text-emerald-400">Năm {s.worldYear}</span>
                        <span className="text-slate-400">{s.population} dân</span>
                        <span className="text-yellow-400">{s.totalWealth.toLocaleString()}g</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
