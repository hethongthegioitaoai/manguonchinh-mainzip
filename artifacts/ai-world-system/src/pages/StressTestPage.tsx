import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Play, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Zap, Globe, BarChart3, Users, TrendingUp, TrendingDown,
  Shield, Swords, Vote, Flame, RefreshCw, Eye, List,
  SkipForward, Radio,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

/* ─── API helpers ─── */
const api = async (url: string, opts?: RequestInit) => {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

/* ─── Types ─── */
interface World { slug: string; name: string; population: number | null; economy: number | null; ticks: number | null; }
interface Run {
  id: string; worldSlug: string; worldName: string;
  ticksRequested: number; ticksCompleted: number; status: string;
  durationMs: number | null; startedAt: string; completedAt: string | null;
  initPopulation: number; initEconomy: number;
  finalPopulation: number | null; finalEconomy: number | null;
  finalGdp: number | null; finalTotalAssets: number | null;
  totalFamilies: number; totalFactions: number; totalGovernments: number;
  totalWars: number; totalElections: number;
  avgUnemployment: number; avgMortality: number;
  warnings: string[]; initialState: any; finalState: any;
}
interface Snapshot {
  id: string; tickNumber: number; population: number; economyScore: number;
  gdp: number; totalAssets: number; unemploymentRate: number; mortalityRate: number;
  avgMood: number; stability: number; majorEventType: string | null; majorEventName: string | null;
}
interface Report {
  id: string; tickNumber: number; milestone: number; worldStatus: string;
  strongestNation: any; metrics: any; anomalies: string[];
}
interface ReplayEvent {
  id: string; tickNumber: number; eventType: string; eventName: string;
  category: string; impact: any; description: string;
}

/* ─── Constants ─── */
const TICK_OPTIONS = [
  { value: 100,    label: "100 ticks",    desc: "Nhanh (~2s)",      color: "cyan"   },
  { value: 1000,   label: "1,000 ticks",  desc: "Vừa (~10s)",       color: "blue"   },
  { value: 10000,  label: "10,000 ticks", desc: "Sâu (~60s)",       color: "purple" },
  { value: 100000, label: "100,000 ticks",desc: "Cực đại (~5 phút)","color": "red"  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  running:    "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  completed:  "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  failed:     "text-red-400 border-red-500/40 bg-red-500/10",
};

const WORLD_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  thriving:   { label: "Thịnh Vượng",   color: "text-green-400",  icon: TrendingUp   },
  prosperous: { label: "Phồn Thịnh",    color: "text-cyan-400",   icon: TrendingUp   },
  stable:     { label: "Ổn Định",       color: "text-blue-400",   icon: Shield       },
  struggling: { label: "Khó Khăn",      color: "text-yellow-400", icon: TrendingDown },
  chaotic:    { label: "Hỗn Loạn",      color: "text-orange-400", icon: Flame        },
  collapsed:  { label: "Sụp Đổ",        color: "text-red-400",    icon: TrendingDown },
  extinction: { label: "Tuyệt Chủng",   color: "text-red-600",    icon: Flame        },
};

const CATEGORY_COLOR: Record<string, string> = {
  war:        "text-red-400 bg-red-500/10 border-red-500/30",
  economy:    "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  government: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  population: "text-green-400 bg-green-500/10 border-green-500/30",
  event:      "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

/* ─── Sub-components ─── */
function StatCard({ label, value, sub, icon: Icon, color = "cyan" }: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  const colors: Record<string, string> = {
    cyan:   "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-400",
    yellow: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    green:  "border-green-500/30 bg-green-500/5 text-green-400",
    red:    "border-red-500/30 bg-red-500/5 text-red-400",
    blue:   "border-blue-500/30 bg-blue-500/5 text-blue-400",
    orange: "border-orange-500/30 bg-orange-500/5 text-orange-400",
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color] ?? colors.cyan}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-xs opacity-60 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs opacity-50 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon size={16} className="text-cyan-400" />}
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">{children}</h3>
      <div className="flex-1 h-px bg-cyan-500/20" />
    </div>
  );
}

/* ─── Live Progress Panel ─── */
function LiveProgress({ progress, onDone }: {
  progress: { pct: number; tick: number; population: number; economy: number; warnings: number; running: boolean; worldName: string; ticks: number; completed: boolean; durationMs?: number; finalState?: any; totalWars?: number; totalElections?: number };
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-cyan-500/30 rounded-xl bg-black/60 p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={progress.running ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <Radio size={18} className={progress.running ? "text-cyan-400" : "text-green-400"} />
          </motion.div>
          <div>
            <div className="text-sm font-semibold text-white">{progress.worldName}</div>
            <div className="text-xs text-gray-500">{progress.ticks.toLocaleString()} ticks</div>
          </div>
        </div>
        {progress.completed && (
          <button
            onClick={onDone}
            className="text-xs text-cyan-400 border border-cyan-500/30 rounded px-3 py-1 hover:bg-cyan-500/10 transition-colors flex items-center gap-1"
          >
            <Eye size={12} /> Xem kết quả
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800 rounded-full mb-3 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${progress.completed ? "bg-green-500" : "bg-cyan-500"}`}
          animate={{ width: `${progress.pct}%` }}
          transition={{ type: "spring", damping: 20 }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        <span>Tick {progress.tick.toLocaleString()} / {progress.ticks.toLocaleString()}</span>
        <span>{progress.pct}%</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Dân Số</div>
          <div className="text-sm font-mono text-cyan-300">{progress.population?.toLocaleString() ?? "-"}</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Kinh Tế</div>
          <div className="text-sm font-mono text-yellow-300">{progress.economy?.toFixed(1) ?? "-"}</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Cảnh Báo</div>
          <div className={`text-sm font-mono ${(progress.warnings ?? 0) > 0 ? "text-red-400" : "text-green-400"}`}>{progress.warnings ?? 0}</div>
        </div>
      </div>

      {progress.completed && progress.durationMs && (
        <div className="mt-3 text-center text-xs text-green-400">
          ✅ Hoàn thành trong {(progress.durationMs / 1000).toFixed(1)}s — {progress.totalWars ?? 0} chiến tranh · {progress.totalElections ?? 0} bầu cử
        </div>
      )}
    </motion.div>
  );
}

/* ─── Run List Item ─── */
function RunItem({ run, selected, onClick }: { run: Run; selected: boolean; onClick: () => void }) {
  const pctChange = run.finalPopulation != null
    ? ((run.finalPopulation - run.initPopulation) / Math.max(1, run.initPopulation) * 100).toFixed(0)
    : null;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ x: 3 }}
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        selected
          ? "border-cyan-500/60 bg-cyan-500/10"
          : "border-gray-700/50 bg-black/30 hover:border-gray-600"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{run.worldName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {new Date(run.startedAt).toLocaleString("vi-VN")}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${STATUS_COLORS[run.status] ?? STATUS_COLORS.completed}`}>
          {run.status === "running" ? "Đang chạy" : run.status === "completed" ? "Hoàn thành" : "Lỗi"}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Zap size={11} />{run.ticksCompleted.toLocaleString()} ticks</span>
        {pctChange !== null && (
          <span className={`flex items-center gap-1 ${Number(pctChange) >= 0 ? "text-green-400" : "text-red-400"}`}>
            <Users size={11} />{Number(pctChange) >= 0 ? "+" : ""}{pctChange}% dân số
          </span>
        )}
        {run.warnings?.length > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle size={11} />{run.warnings.length}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Run Detail ─── */
function RunDetail({ run }: { run: Run }) {
  const [tab, setTab] = useState<"summary" | "chart" | "reports" | "replay">("summary");

  const { data: snapshots = [] } = useQuery<Snapshot[]>({
    queryKey: ["stress-snapshots", run.id],
    queryFn: () => api(`/api/stress-test/runs/${run.id}/snapshots`),
    enabled: tab === "chart",
    staleTime: Infinity,
  });

  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ["stress-reports", run.id],
    queryFn: () => api(`/api/stress-test/runs/${run.id}/reports`),
    enabled: tab === "reports",
    staleTime: Infinity,
  });

  const { data: replay = [] } = useQuery<ReplayEvent[]>({
    queryKey: ["stress-replay", run.id],
    queryFn: () => api(`/api/stress-test/runs/${run.id}/replay?limit=300`),
    enabled: tab === "replay",
    staleTime: Infinity,
  });

  const statusCfg = WORLD_STATUS_CONFIG[run.finalState?.worldStatus ?? "stable"] ?? WORLD_STATUS_CONFIG.stable;
  const StatusIcon = statusCfg.icon;

  const popChange = run.finalPopulation != null
    ? ((run.finalPopulation - run.initPopulation) / Math.max(1, run.initPopulation) * 100)
    : 0;

  const chartData = snapshots.map(s => ({
    tick: s.tickNumber,
    "Dân Số (x10)": Math.round(s.population / 10),
    "Kinh Tế": +s.economyScore.toFixed(1),
    "Ổn Định": +s.stability.toFixed(1),
    "Tâm Trạng": +s.avgMood.toFixed(1),
    "Thất Nghiệp": +s.unemploymentRate.toFixed(1),
  }));

  const TABS_DETAIL = [
    { id: "summary", label: "Tổng Kết",   icon: BarChart3   },
    { id: "chart",   label: "Biểu Đồ",    icon: TrendingUp  },
    { id: "reports", label: "Báo Cáo",    icon: List        },
    { id: "replay",  label: "Replay",      icon: SkipForward },
  ] as const;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-3">
        {TABS_DETAIL.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── SUMMARY ── */}
        {tab === "summary" && (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* World status badge */}
            <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border border-gray-700/50 bg-black/30">
              <StatusIcon size={28} className={statusCfg.color} />
              <div>
                <div className={`text-xl font-bold ${statusCfg.color}`}>{statusCfg.label}</div>
                <div className="text-xs text-gray-500">Trạng thái cuối · {run.ticksCompleted.toLocaleString()} ticks · {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "–"}</div>
              </div>
            </div>

            {/* Core stats */}
            <SectionTitle icon={Activity}>Chỉ Số Cuối</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard label="Dân Số" value={(run.finalPopulation ?? run.initPopulation).toLocaleString()} sub={`Ban đầu: ${run.initPopulation.toLocaleString()}`} icon={Users} color={popChange >= 0 ? "green" : "red"} />
              <StatCard label="Kinh Tế" value={run.finalEconomy?.toFixed(1) ?? run.initEconomy.toFixed(1)} sub={`Ban đầu: ${run.initEconomy.toFixed(1)}`} icon={TrendingUp} color="yellow" />
              <StatCard label="GDP" value={run.finalGdp ? Math.round(run.finalGdp).toLocaleString() : "–"} icon={BarChart3} color="cyan" />
              <StatCard label="Chiến Tranh" value={run.totalWars} icon={Swords} color="red" />
              <StatCard label="Bầu Cử" value={run.totalElections} icon={Vote} color="blue" />
              <StatCard label="Thất Nghiệp TB" value={`${run.avgUnemployment.toFixed(1)}%`} icon={Users} color="orange" />
            </div>

            {/* World stats */}
            <SectionTitle icon={Globe}>Cơ Sở Hạ Tầng</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard label="Gia Tộc" value={run.totalFamilies} icon={Users} color="purple" />
              <StatCard label="Phe Phái" value={run.totalFactions} icon={Shield} color="blue" />
              <StatCard label="Chính Phủ" value={run.totalGovernments} icon={Globe} color="cyan" />
            </div>

            {/* Warnings */}
            {run.warnings?.length > 0 && (
              <>
                <SectionTitle icon={AlertTriangle}>Cảnh Báo Hệ Thống ({run.warnings.length})</SectionTitle>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {run.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-yellow-300 bg-yellow-500/5 border border-yellow-500/20 rounded px-3 py-2 font-mono">
                      {w}
                    </div>
                  ))}
                </div>
              </>
            )}

            {run.warnings?.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
                <CheckCircle2 size={16} /> Không có cảnh báo — hệ thống cân bằng tốt
              </div>
            )}
          </motion.div>
        )}

        {/* ── CHART ── */}
        {tab === "chart" && (
          <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionTitle icon={TrendingUp}>Biến Động Qua {snapshots.length} Snapshot</SectionTitle>
            {snapshots.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Đang tải dữ liệu...</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="tick" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", border: "1px solid #22d3ee30", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#9ca3af" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Kinh Tế" stroke="#facc15" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Ổn Định" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Tâm Trạng" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Thất Nghiệp" stroke="#f87171" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-4">
                  <SectionTitle icon={Users}>Dân Số</SectionTitle>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="tick" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#0a0a0f", border: "1px solid #22d3ee30", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#9ca3af" }}
                        formatter={(v: any) => [(v * 10).toLocaleString(), "Dân Số"]}
                      />
                      <Line type="monotone" dataKey="Dân Số (x10)" stroke="#4ade80" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── REPORTS ── */}
        {tab === "reports" && (
          <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionTitle icon={List}>Báo Cáo Milestone ({reports.length})</SectionTitle>
            {reports.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Không có báo cáo</div>
            ) : (
              <div className="space-y-4">
                {reports.map(r => {
                  const st = WORLD_STATUS_CONFIG[r.worldStatus] ?? WORLD_STATUS_CONFIG.stable;
                  const SIcon = st.icon;
                  return (
                    <div key={r.id} className="border border-gray-700/50 rounded-xl bg-black/30 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-cyan-400" />
                          <span className="text-sm font-semibold text-white">Tick {r.tickNumber.toLocaleString()}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${st.color}`}>
                          <SIcon size={13} />{st.label}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                        {[
                          { label: "Dân Số", val: r.metrics?.population?.toLocaleString() ?? "-" },
                          { label: "Kinh Tế", val: r.metrics?.economyScore ?? "-" },
                          { label: "Ổn Định", val: r.metrics?.stability ?? "-" },
                          { label: "GDP", val: r.metrics?.gdp?.toLocaleString() ?? "-" },
                          { label: "Chiến Tranh", val: r.metrics?.totalWars ?? "-" },
                          { label: "Bầu Cử", val: r.metrics?.totalElections ?? "-" },
                        ].map(m => (
                          <div key={m.label} className="bg-gray-900/50 rounded p-2 text-center">
                            <div className="text-gray-500 mb-1">{m.label}</div>
                            <div className="font-mono text-gray-200">{m.val}</div>
                          </div>
                        ))}
                      </div>

                      {r.anomalies?.length > 0 && (
                        <div className="space-y-1">
                          {r.anomalies.slice(0, 5).map((a, i) => (
                            <div key={i} className="text-xs text-yellow-300/80 font-mono bg-yellow-500/5 border border-yellow-500/15 rounded px-2 py-1">
                              {a}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── REPLAY ── */}
        {tab === "replay" && (
          <motion.div key="replay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionTitle icon={SkipForward}>Sự Kiện Lớn ({replay.length})</SectionTitle>
            {replay.length === 0 ? (
              <div className="text-center text-gray-500 py-12">Không có sự kiện lớn</div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-cyan-500/15" />
                <div className="space-y-3 pl-10 max-h-[520px] overflow-y-auto pr-1">
                  {replay.map(ev => {
                    const catClass = CATEGORY_COLOR[ev.category] ?? CATEGORY_COLOR.event;
                    return (
                      <div key={ev.id} className={`relative border rounded-lg px-4 py-3 ${catClass}`}>
                        <div className="absolute -left-[28px] top-3.5 w-2.5 h-2.5 rounded-full border border-current bg-black" />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs opacity-60 mr-2">Tick {ev.tickNumber.toLocaleString()}</span>
                            <span className="text-sm font-semibold">{ev.eventName}</span>
                          </div>
                          <span className="text-xs opacity-60 whitespace-nowrap">{ev.category}</span>
                        </div>
                        {ev.impact && (
                          <div className="mt-1 text-xs opacity-70 font-mono">
                            {ev.impact.dPop !== undefined && `👥 ${ev.impact.dPop >= 0 ? "+" : ""}${ev.impact.dPop}  `}
                            {ev.impact.dEconomy !== undefined && `💰 ${ev.impact.dEconomy >= 0 ? "+" : ""}${ev.impact.dEconomy}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
export default function StressTestPage() {
  const qc = useQueryClient();

  const [selectedWorld, setSelectedWorld] = useState("");
  const [selectedTicks, setSelectedTicks] = useState<100 | 1000 | 10000 | 100000>(100);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: worlds = [], isLoading: worldsLoading } = useQuery<World[]>({
    queryKey: ["stress-worlds"],
    queryFn: () => api("/api/stress-test/worlds"),
  });

  const { data: runs = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery<Run[]>({
    queryKey: ["stress-runs", selectedWorld],
    queryFn: () => api(`/api/stress-test/runs${selectedWorld ? `?worldSlug=${selectedWorld}` : ""}`),
    refetchInterval: isRunning ? 4000 : false,
  });

  const selectedRun = selectedRunId ? runs.find(r => r.id === selectedRunId) ?? null : null;

  const startRun = useCallback(async () => {
    if (!selectedWorld || isRunning) return;

    const world = worlds.find(w => w.slug === selectedWorld);
    setIsRunning(true);
    setProgress({ pct: 0, tick: 0, population: 0, economy: 0, warnings: 0, running: true, worldName: world?.name ?? selectedWorld, ticks: selectedTicks, completed: false });
    setSelectedRunId(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/stress-test/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldSlug: selectedWorld, ticks: selectedTicks }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Lỗi khởi động stress test");
        setIsRunning(false);
        setProgress(null);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedRunId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "started") {
              completedRunId = event.runId;
            } else if (event.type === "progress") {
              setProgress((prev: any) => ({
                ...prev,
                pct: event.pct,
                tick: event.tick,
                population: event.population,
                economy: event.economy,
                warnings: event.warnings,
              }));
            } else if (event.type === "completed") {
              setProgress((prev: any) => ({
                ...prev,
                pct: 100,
                tick: event.ticks,
                population: event.finalState?.population ?? prev.population,
                economy: event.finalState?.economyScore ?? prev.economy,
                warnings: event.warnings?.length ?? prev.warnings,
                running: false,
                completed: true,
                durationMs: event.durationMs,
                totalWars: event.totalWars,
                totalElections: event.totalElections,
              }));
              if (event.runId) completedRunId = event.runId;
            } else if (event.type === "error") {
              alert("Lỗi: " + event.message);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      setIsRunning(false);
      await refetchRuns();
      if (completedRunId) setSelectedRunId(completedRunId);

    } catch (e: any) {
      if (e.name !== "AbortError") {
        alert("Kết nối bị ngắt: " + e.message);
      }
      setIsRunning(false);
      setProgress(null);
    }
  }, [selectedWorld, selectedTicks, worlds, isRunning, refetchRuns]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/80 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Activity size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Kiểm Tra Cân Bằng Thế Giới</h1>
            <p className="text-sm text-gray-500">Stress test mô phỏng lịch sử — phát hiện lỗi cân bằng và dị thường</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* ── LEFT PANEL ── */}
          <div className="space-y-4">
            {/* Control Panel */}
            <div className="border border-cyan-500/20 rounded-xl bg-black/60 p-5">
              <SectionTitle icon={Play}>Chạy Stress Test</SectionTitle>

              {/* World select */}
              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Chọn Thế Giới</label>
                {worldsLoading ? (
                  <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
                ) : worlds.length === 0 ? (
                  <div className="text-xs text-gray-500 border border-dashed border-gray-700 rounded-lg p-3 text-center">
                    Chưa có thế giới nào. Tạo thế giới trước.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {worlds.map(w => (
                      <button
                        key={w.slug}
                        onClick={() => setSelectedWorld(w.slug)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                          selectedWorld === w.slug
                            ? "border-cyan-500/60 bg-cyan-500/10 text-white"
                            : "border-gray-700/50 bg-gray-900/30 text-gray-300 hover:border-gray-600"
                        }`}
                      >
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          👥 {(w.population ?? 0).toLocaleString()} · 💰 {(w.economy ?? 0).toFixed(0)} · ⚡ {(w.ticks ?? 0).toLocaleString()} ticks
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tick select */}
              <div className="mb-5">
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Số Tick Mô Phỏng</label>
                <div className="grid grid-cols-2 gap-2">
                  {TICK_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedTicks(opt.value as any)}
                      className={`px-3 py-2.5 rounded-lg border text-xs transition-all ${
                        selectedTicks === opt.value
                          ? "border-cyan-500/60 bg-cyan-500/10 text-white"
                          : "border-gray-700/50 bg-gray-900/30 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <div className="font-semibold font-mono">{opt.label}</div>
                      <div className="opacity-60">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Run button */}
              <button
                onClick={startRun}
                disabled={!selectedWorld || isRunning}
                className={`w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  !selectedWorld || isRunning
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-400 text-black"
                }`}
              >
                {isRunning ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={16} /></motion.div>Đang chạy...</>
                ) : (
                  <><Play size={16} />Bắt Đầu Stress Test</>
                )}
              </button>
            </div>

            {/* Run History */}
            <div className="border border-gray-700/50 rounded-xl bg-black/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle icon={Clock}>Lịch Sử ({runs.length})</SectionTitle>
              </div>
              {runsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />)}
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-6">Chưa có run nào</div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {runs.map(r => (
                    <RunItem
                      key={r.id}
                      run={r}
                      selected={selectedRunId === r.id}
                      onClick={() => setSelectedRunId(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div>
            {/* Live progress */}
            {(isRunning || (progress?.completed)) && progress && (
              <LiveProgress
                progress={progress}
                onDone={() => setProgress(null)}
              />
            )}

            {/* Run detail */}
            {selectedRun ? (
              <motion.div
                key={selectedRun.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-700/50 rounded-xl bg-black/40 p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1">
                    <div className="text-lg font-bold text-white">{selectedRun.worldName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(selectedRun.startedAt).toLocaleString("vi-VN")} · {selectedRun.ticksCompleted.toLocaleString()} / {selectedRun.ticksRequested.toLocaleString()} ticks
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[selectedRun.status]}`}>
                    {selectedRun.status === "completed" ? "✅ Hoàn thành" : selectedRun.status === "running" ? "⏳ Đang chạy" : "❌ Lỗi"}
                  </span>
                </div>
                <RunDetail run={selectedRun} />
              </motion.div>
            ) : !isRunning && !progress && (
              <div className="flex flex-col items-center justify-center h-96 border border-dashed border-gray-800 rounded-xl text-gray-600">
                <Activity size={40} className="mb-4 opacity-30" />
                <div className="text-sm">Chọn một run từ lịch sử để xem chi tiết</div>
                <div className="text-xs mt-1 opacity-60">hoặc chạy stress test mới</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
