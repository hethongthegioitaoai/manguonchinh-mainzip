import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Vote, Crown, Users, Loader2, RefreshCw,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Zap,
  BarChart3, History, ScrollText, Trophy,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

interface Candidate {
  id: string; npcId: string; name: string; occupation: string; money: number; happiness: number;
  factionId: string | null; campaignScore: number; totalVotes: number; isIncumbent: number;
}
interface ElectionRecord {
  id: string; governmentId: string; electionType: string; typeLabel: string;
  status: string; totalVotes: number; turnout: number;
  winnerNpcId: string | null; winnerName: string;
  createdAt: string; resolvedAt: string | null;
  territory: { id: string; name: string; type: string; population: number; prosperity: number; security: number } | null;
  gov: { id: string; approvalRate: number; taxRate: number; treasury: number; govType: string } | null;
  candidates: Candidate[];
}

const STATUS_COLOR: Record<string, string> = { open: "#22c55e", resolved: "#6b7280" };
const STATUS_LABEL: Record<string, string>  = { open: "ĐANG MỞ", resolved: "ĐÃ KẾT THÚC" };

function VoteBar({ votes, total, color }: { votes: number; total: number; color: string }) {
  const pct = total > 0 ? (votes / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function ElectionCard({ el, expanded, onToggle }: {
  el: ElectionRecord; expanded: boolean; onToggle: () => void;
}) {
  const isOpen   = el.status === "open";
  const statColor = STATUS_COLOR[el.status] ?? "#6b7280";
  const totalV   = el.totalVotes || el.candidates.reduce((s, c) => s + c.totalVotes, 0);

  const sortedCands = [...el.candidates].sort((a, b) => b.totalVotes - a.totalVotes);
  const winner = sortedCands[0];

  return (
    <motion.div layout className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-900/40">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{isOpen ? "🗳️" : "📜"}</span>
              <span className="font-bold text-white">{el.territory?.name ?? "Lãnh thổ"}</span>
              <span className="text-xs px-2 py-0.5 rounded-full border"
                style={{ color: statColor, borderColor: statColor + "55", background: statColor + "11" }}>
                {STATUS_LABEL[el.status] ?? el.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{el.typeLabel}</div>
            {!isOpen && el.winnerName && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-yellow-400 text-xs font-bold">{el.winnerName}</span>
                <span className="text-gray-600 text-xs">thắng cử</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-500">Phiếu bầu</div>
              <div className="text-sm font-bold text-cyan-400">{totalV.toLocaleString()}</div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          <span>👥 {el.candidates.length} ứng viên</span>
          <span>📊 {el.turnout}% tham gia</span>
          {el.gov && <span>💡 Ủng hộ: {Math.round(el.gov.approvalRate)}%</span>}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-3">
              {/* Candidates */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wide">Kết Quả Bỏ Phiếu</span>
                </div>
                <div className="space-y-2">
                  {sortedCands.map((c, idx) => {
                    const isWinner = !isOpen && c.npcId === el.winnerNpcId;
                    const pct      = totalV > 0 ? Math.round((c.totalVotes / totalV) * 100) : 0;
                    const barColor = isWinner ? "#f59e0b" : idx === 0 && isOpen ? "#06b6d4" : "#374151";
                    return (
                      <div key={c.id} className={`rounded-lg p-2.5 ${isWinner ? "bg-yellow-900/20 border border-yellow-700/30" : "bg-gray-800/40"}`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                            {c.isIncumbent === 1 && !isWinner && <Crown className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                            <span className={`text-xs font-bold truncate ${isWinner ? "text-yellow-300" : "text-white"}`}>{c.name}</span>
                            {c.isIncumbent === 1 && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 shrink-0">Đương nhiệm</span>
                            )}
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${isWinner ? "text-yellow-400" : "text-gray-400"}`}>
                            {c.totalVotes} phiếu
                          </span>
                        </div>
                        <VoteBar votes={c.totalVotes} total={totalV} color={barColor} />
                        <div className="flex gap-2 mt-1.5 text-xs text-gray-600">
                          <span>{c.occupation}</span>
                          <span>• Điểm vận động: {c.campaignScore}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="flex gap-3 text-xs text-gray-600">
                <div>
                  <span className="text-gray-500">Mở: </span>
                  {new Date(el.createdAt).toLocaleDateString("vi-VN")}
                </div>
                {el.resolvedAt && (
                  <div>
                    <span className="text-gray-500">Kết thúc: </span>
                    {new Date(el.resolvedAt).toLocaleDateString("vi-VN")}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function NpcElectionPage() {
  const [, setLocation]   = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData]   = useState<{ elections: ElectionRecord[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "resolved">("all");
  const [msg, setMsg]     = useState<string | null>(null);

  const [openLoading,    setOpenLoading]    = useState(false);
  const [voteLoading,    setVoteLoading]    = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [autoLoading,    setAutoLoading]    = useState(false);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/npc-elections/${activeWorld}`, { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, [activeWorld]);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const act = async (url: string, method: string, setL: (v: boolean) => void) => {
    setL(true);
    try {
      const r = await fetch(url, { method, credentials: "include" });
      const j = await r.json();
      flash(j.message ?? "Hoàn thành");
      loadData();
    } catch { flash("Có lỗi xảy ra"); }
    setL(false);
  };

  const allEls = data?.elections ?? [];

  /* Stats */
  const openCount     = allEls.filter(e => e.status === "open").length;
  const resolvedCount = allEls.filter(e => e.status === "resolved").length;
  const totalVotesAll = allEls.reduce((s, e) => s + e.totalVotes, 0);
  const avgTurnout    = allEls.length ? Math.round(allEls.reduce((s, e) => s + e.turnout, 0) / allEls.length) : 0;

  const filtered = allEls.filter(e => filterStatus === "all" || e.status === filterStatus);

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Vote className="w-5 h-5" style={{ color: worldColor }} />
              <span className="font-bold tracking-wider" style={{ color: worldColor }}>BẦU CỬ NPC</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} className="text-gray-400 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* World selector */}
        <div className="flex gap-2">
          {WORLDS.map(w => (
            <button key={w.slug} onClick={() => setActiveWorld(w.slug as WorldSlug)}
              className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider border transition-all"
              style={activeWorld === w.slug
                ? { background: w.color + "22", borderColor: w.color, color: w.color }
                : { borderColor: "#374151", color: "#6b7280" }}>
              {w.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Zap className="w-4 h-4" />,       label: "Đang Mở",     value: openCount,                  color: "#22c55e" },
            { icon: <History className="w-4 h-4" />,    label: "Đã Kết Thúc", value: resolvedCount,              color: "#6b7280" },
            { icon: <Users className="w-4 h-4" />,      label: "Tổng Phiếu",  value: totalVotesAll.toLocaleString(), color: "#06b6d4" },
            { icon: <BarChart3 className="w-4 h-4" />,  label: "TB Tham Gia", value: `${avgTurnout}%`,           color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
              <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Action buttons — row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => act(`/api/npc-elections/open/${activeWorld}`, "POST", setOpenLoading)}
            disabled={openLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {openLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
            MỞ BẦU CỬ
          </button>
          <button onClick={() => act(`/api/npc-elections/vote/${activeWorld}`, "POST", setVoteLoading)}
            disabled={voteLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {voteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            BỎ PHIẾU
          </button>
          <button onClick={() => act(`/api/npc-elections/resolve/${activeWorld}`, "POST", setResolveLoading)}
            disabled={resolveLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {resolveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
            CÔNG BỐ KQ
          </button>
        </div>

        {/* Action button — auto */}
        <button onClick={() => act(`/api/npc-elections/auto-election/${activeWorld}`, "POST", setAutoLoading)}
          disabled={autoLoading}
          className="w-full py-2.5 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          BẦU CỬ TỰ ĐỘNG (MỞ → BỎ PHIẾU → CÔNG BỐ)
        </button>

        {/* Flash */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg px-4 py-2 text-cyan-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        {allEls.length > 0 && (
          <div className="flex gap-1.5">
            {(["all", "open", "resolved"] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={filterStatus === f
                  ? { background: worldColor + "22", borderColor: worldColor, color: worldColor }
                  : { borderColor: "#374151", color: "#6b7280" }}>
                {f === "all" ? `TẤT CẢ (${allEls.length})` : f === "open" ? `ĐANG MỞ (${openCount})` : `ĐÃ XONG (${resolvedCount})`}
              </button>
            ))}
          </div>
        )}

        {/* Election list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Vote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có cuộc bầu cử nào.</p>
            <p className="text-xs mt-1">
              Nhấn <span className="text-green-400">"MỞ BẦU CỬ"</span> hoặc <span className="text-purple-400">"BẦU CỬ TỰ ĐỘNG"</span>.
            </p>
            <p className="text-xs mt-1 text-gray-700">Cần có lãnh thổ + chính phủ trước.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{filtered.length} cuộc bầu cử</span>
            {filtered.map(el => (
              <ElectionCard key={el.id} el={el}
                expanded={expandedId === el.id}
                onToggle={() => setExpandedId(expandedId === el.id ? null : el.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
