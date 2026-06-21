import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BarChart3, TrendingUp, Users, Shield, Wheat,
  Swords, Globe, RefreshCw, Camera, ChevronDown, Flag,
  Activity, AlertTriangle, Skull, Sprout, Crown, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

/* ══════════════════════════════════════════ TYPES */
interface AnalyticsSeries {
  tick: number;
  populationTotal: number;
  activeCount: number;
  ruinsCount: number;
  factionCount: number;
  armyCount: number;
  avgFoodSupply: number;
  avgProsperity: number;
  avgSecurity: number;
  totalMilitaryPower: number;
}

interface AnalyticsResponse {
  worldSlug: string;
  count: number;
  series: AnalyticsSeries[];
}

interface FactionSummary { id: string; name: string; type: string; }

interface FactionTimelinePoint {
  tick: number;
  territories: number;
  treasury: number;
  military: number;
  influence: number;
}

interface FactionEvent { id: string; tick: number; eventType: string; title: string; }

interface FactionTimelineResponse {
  faction: FactionSummary;
  timeline: FactionTimelinePoint[];
  events: FactionEvent[];
}

interface WorldState { worldSlug: string; worldName: string; currentTick: number; }

/* ══════════════════════════════════════════ WORLD LIST */
const WORLDS = [
  { slug: "cultivation", name: "Tu Tiên" },
  { slug: "cyberpunk",   name: "Cyberpunk" },
  { slug: "fantasy",     name: "Fantasy" },
];

/* ══════════════════════════════════════════ EVENT ICON */
const eventIcon = (type: string) => {
  if (type.includes("war") || type.includes("battle") || type.includes("siege")) return { icon: "⚔", label: "Chiến tranh", color: "#ef4444" };
  if (type.includes("collapse") || type.includes("ruin"))                         return { icon: "💀", label: "Sụp đổ",    color: "#9ca3af" };
  if (type.includes("recolon") || type.includes("migration"))                     return { icon: "🌱", label: "Tái lập",   color: "#34d399" };
  if (type.includes("peace") || type.includes("treaty"))                          return { icon: "🕊", label: "Hòa ước",  color: "#60a5fa" };
  if (type.includes("economic") || type.includes("trade"))                        return { icon: "💰", label: "Kinh tế",  color: "#fbbf24" };
  return { icon: "📌", label: type, color: "#a78bfa" };
};

/* ══════════════════════════════════════════ TOOLTIP */
const CyberTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-cyan-900/60 rounded px-3 py-2 text-xs shadow-xl">
      <div className="text-cyan-400 font-mono mb-1">Tick {label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-2 items-center">
          <span style={{ color: p.color }}>■</span>
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════ CHART CARD */
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
        <span className="text-cyan-400">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════ STAT CARD */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`bg-slate-900/60 border rounded-lg p-3 flex flex-col gap-1`} style={{ borderColor: color + "44" }}>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════ MAIN PAGE */
export default function SimulationAnalyticsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [worldSlug, setWorldSlug] = useState(WORLDS[0].slug);
  const [tab, setTab] = useState<"world" | "faction">("world");
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [showWorldPicker, setShowWorldPicker] = useState(false);

  /* ── Queries ── */
  const { data: stateData } = useQuery<WorldState>({
    queryKey: ["/api/simulation/state", worldSlug],
    queryFn: () => fetch(`/api/simulation/state/${worldSlug}`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/simulation/analytics", worldSlug],
    queryFn: () => fetch(`/api/simulation/analytics/${worldSlug}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: factions } = useQuery<FactionSummary[]>({
    queryKey: ["/api/simulation/factions", worldSlug],
    queryFn: () =>
      fetch(`/api/simulation/state/${worldSlug}`)
        .then(r => r.json())
        .then((d: any) => (d?.factions ?? []) as FactionSummary[]),
  });

  const { data: factionTimeline, isLoading: ftLoading } = useQuery<FactionTimelineResponse>({
    queryKey: ["/api/simulation/faction-timeline", worldSlug, selectedFactionId],
    queryFn: () =>
      fetch(`/api/simulation/faction-timeline/${worldSlug}/${selectedFactionId}`).then(r => r.json()),
    enabled: !!selectedFactionId,
  });

  /* ── Mutation: force snapshot ── */
  const snapshotMut = useMutation({
    mutationFn: () => fetch(`/api/simulation/snapshot-now/${worldSlug}`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d) => {
      toast({ title: "Snapshot saved", description: `Tick ${d.tick} ghi lại thành công.` });
      qc.invalidateQueries({ queryKey: ["/api/simulation/analytics", worldSlug] });
    },
    onError: () => toast({ title: "Snapshot failed", variant: "destructive" }),
  });

  const series = analytics?.series ?? [];
  const latest = series[series.length - 1];

  /* ── Faction events with tick mapping ── */
  const ftData = factionTimeline?.timeline ?? [];
  const ftEvents = factionTimeline?.events ?? [];
  const ftTicks = new Set(ftData.map(t => t.tick));
  const eventsByTick = new Map<number, FactionEvent[]>();
  for (const ev of ftEvents) {
    if (!eventsByTick.has(ev.tick)) eventsByTick.set(ev.tick, []);
    eventsByTick.get(ev.tick)!.push(ev);
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-slate-800/80 bg-slate-950/80 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/simulation")} className="text-slate-400 hover:text-cyan-400 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <BarChart3 size={16} className="text-cyan-400" />
          <span className="font-bold text-sm tracking-wide">ANALYTICS</span>
          <span className="text-slate-600 text-xs">Phase 61–62</span>
        </div>

        {/* World picker */}
        <div className="relative">
          <button
            onClick={() => setShowWorldPicker(v => !v)}
            className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded px-3 py-1.5 text-xs hover:border-cyan-700/60 transition-colors"
          >
            <Globe size={12} className="text-cyan-400" />
            <span>{WORLDS.find(w => w.slug === worldSlug)?.name ?? worldSlug}</span>
            <ChevronDown size={11} className="text-slate-500" />
          </button>
          <AnimatePresence>
            {showWorldPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-8 bg-slate-900 border border-slate-700 rounded shadow-xl z-50 min-w-[140px]"
              >
                {WORLDS.map(w => (
                  <button
                    key={w.slug}
                    onClick={() => { setWorldSlug(w.slug); setShowWorldPicker(false); setSelectedFactionId(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${worldSlug === w.slug ? "text-cyan-400" : "text-slate-300"}`}
                  >
                    {w.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {stateData && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded">
              Tick {stateData.currentTick}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => snapshotMut.mutate()}
            disabled={snapshotMut.isPending}
            className="h-7 text-xs border-cyan-800/60 text-cyan-400 hover:bg-cyan-900/30"
          >
            <Camera size={12} className="mr-1" />
            {snapshotMut.isPending ? "Saving…" : "Snapshot Now"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => qc.invalidateQueries({ queryKey: ["/api/simulation/analytics", worldSlug] })}
            className="h-7 text-xs text-slate-400"
          >
            <RefreshCw size={12} />
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-slate-800/60 px-4">
        {[
          { id: "world",   label: "🌍 World Analytics",   phase: "61" },
          { id: "faction", label: "🏛 Faction Timeline",  phase: "62" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[9px] text-slate-600">P{t.phase}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════ TAB: WORLD ANALYTICS ══════════════════════════ */}
      {tab === "world" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {analyticsLoading && (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm gap-2">
              <Activity size={16} className="animate-pulse" /> Đang tải analytics…
            </div>
          )}
          {!analyticsLoading && series.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
              <BarChart3 size={32} className="text-slate-700" />
              <div className="text-sm">Chưa có snapshot nào.</div>
              <div className="text-xs text-slate-600">Bấm "Snapshot Now" hoặc chạy simulation đến tick 50 để snapshot đầu tiên được ghi.</div>
              <Button size="sm" onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending} className="bg-cyan-900/50 text-cyan-300 text-xs">
                <Camera size={12} className="mr-1" /> Tạo Snapshot Ngay
              </Button>
            </div>
          )}

          {series.length > 0 && (
            <>
              {/* ── Summary row ── */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                <StatCard label="Dân Số"       value={latest?.populationTotal ?? 0}   sub={`+${(latest?.populationTotal ?? 0) - (series[0]?.populationTotal ?? 0)} từ đầu`} color="#60a5fa" />
                <StatCard label="Lãnh Thổ"     value={latest?.activeCount ?? 0}        sub={`${latest?.ruinsCount ?? 0} phế tích`}  color="#34d399" />
                <StatCard label="Phe Phái"     value={latest?.factionCount ?? 0}       sub={`${latest?.armyCount ?? 0} quân`}       color="#a78bfa" />
                <StatCard label="Thịnh Vượng"  value={`${latest?.avgProsperity ?? 0}`} sub="trung bình"                             color="#fbbf24" />
                <StatCard label="An Ninh"      value={`${latest?.avgSecurity ?? 0}`}   sub="trung bình"                             color="#fb923c" />
              </div>

              {/* ── Population ── */}
              <ChartCard title="Dân Số Theo Thời Gian" icon={<Users size={14} />}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip content={<CyberTooltip />} />
                    <Area type="monotone" dataKey="populationTotal" name="Dân số" stroke="#60a5fa" strokeWidth={2} fill="url(#popGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Prosperity + Security ── */}
              <ChartCard title="Thịnh Vượng & An Ninh Trung Bình" icon={<TrendingUp size={14} />}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} width={35} />
                    <Tooltip content={<CyberTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    <Line type="monotone" dataKey="avgProsperity" name="Thịnh vượng" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="avgSecurity"   name="An ninh"     stroke="#fb923c" strokeWidth={2} dot={false} />
                    <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} label={{ value: "Nguy hiểm", fill: "#ef4444", fontSize: 9 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Food Supply ── */}
              <ChartCard title="Nguồn Lương Thực Trung Bình" icon={<Wheat size={14} />}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="foodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} width={35} />
                    <Tooltip content={<CyberTooltip />} />
                    <Area type="monotone" dataKey="avgFoodSupply" name="Lương thực" stroke="#34d399" strokeWidth={2} fill="url(#foodGrad)" />
                    <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Military Power ── */}
              <ChartCard title="Sức Mạnh Quân Sự Tổng" icon={<Swords size={14} />}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="milGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip content={<CyberTooltip />} />
                    <Area type="monotone" dataKey="totalMilitaryPower" name="Military" stroke="#ef4444" strokeWidth={2} fill="url(#milGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Territory counts ── */}
              <ChartCard title="Lãnh Thổ: Hoạt Động vs Phế Tích" icon={<Globe size={14} />}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ruinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#9ca3af" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={<CyberTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    <Area type="monotone" dataKey="activeCount" name="Hoạt động" stroke="#34d399" strokeWidth={2} fill="url(#actGrad)" />
                    <Area type="monotone" dataKey="ruinsCount"  name="Phế tích"  stroke="#9ca3af" strokeWidth={1.5} fill="url(#ruinGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* ── Data table ── */}
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg overflow-auto">
                <div className="px-4 py-2 border-b border-slate-800/60 text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Activity size={12} /> Raw Snapshot Data ({series.length} điểm)
                </div>
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-slate-500">
                      {["Tick","Dân Số","Lãnh Thổ","Phế Tích","Phe","Quân","Food","Prosperity","Security","Military"].map(h => (
                        <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...series].reverse().slice(0, 20).map(s => (
                      <tr key={s.tick} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <td className="px-3 py-1 text-cyan-400">{s.tick}</td>
                        <td className="px-3 py-1 text-blue-300">{s.populationTotal.toLocaleString()}</td>
                        <td className="px-3 py-1 text-emerald-400">{s.activeCount}</td>
                        <td className="px-3 py-1 text-slate-400">{s.ruinsCount}</td>
                        <td className="px-3 py-1 text-violet-400">{s.factionCount}</td>
                        <td className="px-3 py-1 text-red-400">{s.armyCount.toLocaleString()}</td>
                        <td className="px-3 py-1 text-green-400">{s.avgFoodSupply}</td>
                        <td className="px-3 py-1 text-yellow-400">{s.avgProsperity}</td>
                        <td className="px-3 py-1 text-orange-400">{s.avgSecurity}</td>
                        <td className="px-3 py-1 text-red-300">{s.totalMilitaryPower.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════ TAB: FACTION TIMELINE ══════════════════════════ */}
      {tab === "faction" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Faction selector ── */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
              <Flag size={12} /> Chọn Phe Phái
            </div>
            {(!factions || factions.length === 0) ? (
              <div className="text-slate-500 text-xs">Chưa có phe phái trong thế giới này.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {factions.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFactionId(f.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                      selectedFactionId === f.id
                        ? "bg-violet-900/60 border-violet-500/60 text-violet-200"
                        : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                  >
                    <Crown size={10} className="inline mr-1 opacity-60" />{f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Loading ── */}
          {ftLoading && selectedFactionId && (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm gap-2">
              <Activity size={14} className="animate-pulse" /> Đang tải faction timeline…
            </div>
          )}

          {/* ── No faction selected ── */}
          {!selectedFactionId && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
              <Crown size={28} className="text-slate-700" />
              <div className="text-sm">Chọn một phe phái để xem lịch sử phát triển.</div>
            </div>
          )}

          {/* ── Faction data ── */}
          {factionTimeline && !ftLoading && (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 bg-violet-950/30 border border-violet-800/40 rounded-lg px-4 py-2.5">
                <Crown size={16} className="text-violet-400" />
                <div>
                  <div className="text-sm font-bold text-violet-200">{factionTimeline.faction.name}</div>
                  <div className="text-[10px] text-violet-400/70">{factionTimeline.faction.type} · {ftData.length} điểm dữ liệu · {ftEvents.length} sự kiện</div>
                </div>
              </div>

              {ftData.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  Phe phái này chưa xuất hiện trong bất kỳ snapshot nào.
                </div>
              ) : (
                <>
                  {/* ── Summary ── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <StatCard label="Lãnh Thổ Peak"   value={Math.max(...ftData.map(t => t.territories))}   sub={`Hiện: ${ftData[ftData.length-1]?.territories ?? 0}`} color="#a78bfa" />
                    <StatCard label="Ngân Khố Peak"    value={Math.max(...ftData.map(t => t.treasury)).toLocaleString()} sub={`Hiện: ${(ftData[ftData.length-1]?.treasury ?? 0).toLocaleString()}`} color="#fbbf24" />
                    <StatCard label="Quân Lực Peak"    value={Math.max(...ftData.map(t => t.military)).toLocaleString()} sub={`Hiện: ${(ftData[ftData.length-1]?.military ?? 0).toLocaleString()}`} color="#ef4444" />
                    <StatCard label="Ảnh Hưởng Peak"   value={Math.max(...ftData.map(t => t.influence))}    sub={`Hiện: ${ftData[ftData.length-1]?.influence ?? 0}`} color="#34d399" />
                  </div>

                  {/* ── Territories over time ── */}
                  <ChartCard title="Lãnh Thổ Theo Thời Gian" icon={<Globe size={14} />}>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={ftData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="terrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                        <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={25} allowDecimals={false} />
                        <Tooltip content={<CyberTooltip />} />
                        <Area type="monotone" dataKey="territories" name="Lãnh thổ" stroke="#a78bfa" strokeWidth={2} fill="url(#terrGrad)" />
                        {ftEvents.map(ev => {
                          const meta = eventIcon(ev.eventType);
                          return (
                            <ReferenceLine
                              key={ev.id} x={ev.tick}
                              stroke={meta.color} strokeDasharray="3 3" opacity={0.6}
                              label={{ value: meta.icon, fill: meta.color, fontSize: 12, position: "top" }}
                            />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* ── Treasury + Influence ── */}
                  <ChartCard title="Ngân Khố & Ảnh Hưởng" icon={<Coins size={14} />}>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={ftData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                        <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left"  tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={35} domain={[0, 100]} />
                        <Tooltip content={<CyberTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                        <Line yAxisId="left"  type="monotone" dataKey="treasury"  name="Ngân khố"    stroke="#fbbf24" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="influence" name="Ảnh hưởng"   stroke="#34d399" strokeWidth={2} dot={false} />
                        {ftEvents.map(ev => {
                          const meta = eventIcon(ev.eventType);
                          return (
                            <ReferenceLine key={ev.id} x={ev.tick} yAxisId="left" stroke={meta.color} strokeDasharray="3 3" opacity={0.5} />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* ── Military ── */}
                  <ChartCard title="Sức Mạnh Quân Sự" icon={<Swords size={14} />}>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={ftData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="milFacGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                        <XAxis dataKey="tick" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                        <Tooltip content={<CyberTooltip />} />
                        <Area type="monotone" dataKey="military" name="Quân lực" stroke="#ef4444" strokeWidth={2} fill="url(#milFacGrad)" />
                        {ftEvents.map(ev => {
                          const meta = eventIcon(ev.eventType);
                          return (
                            <ReferenceLine key={ev.id} x={ev.tick} stroke={meta.color} strokeDasharray="3 3" opacity={0.5} />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* ── Event log ── */}
                  {ftEvents.length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-800/60 text-xs font-semibold text-slate-400 flex items-center gap-2">
                        <AlertTriangle size={12} /> Sự Kiện Quan Trọng ({ftEvents.length})
                      </div>
                      <div className="divide-y divide-slate-800/40 max-h-60 overflow-y-auto">
                        {ftEvents.map(ev => {
                          const meta = eventIcon(ev.eventType);
                          return (
                            <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/20 transition-colors">
                              <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-200 truncate">{ev.title}</div>
                                <div className="text-[10px] text-slate-500">{meta.label}</div>
                              </div>
                              <div className="text-[10px] font-mono text-cyan-500/70 shrink-0">Tick {ev.tick}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
