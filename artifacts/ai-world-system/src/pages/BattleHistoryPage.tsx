import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Trophy, Skull, Minus, Swords, Zap, Bot,
  Puzzle, BookOpen, Dices, TrendingUp, Clock, Star,
  Filter, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type BattleMode = "turn-based" | "real-time" | "auto" | "puzzle" | "narrative" | "dice" | "all";
type ResultFilter = "all" | "win" | "lose" | "draw";

interface BattleRecord {
  id: string;
  enemyName: string;
  enemyLevel: number;
  battleMode: string;
  result: string;
  expGained: number;
  hpLeft: number | null;
  duration: number | null;
  createdAt: string;
  metadata: { enemyType?: string; worldSlug?: string };
}

interface Stats {
  total: number;
  win: number;
  lose: number;
  draw: number;
  totalExp: number;
  byMode: Record<string, { total: number; win: number; lose: number; draw: number }>;
}

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { world_slug: string };
}

const MODE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "turn-based": { label: "Lượt Chiến", icon: <Swords className="w-4 h-4" />, color: "text-red-400" },
  "real-time":  { label: "Thời Gian Thực", icon: <Zap className="w-4 h-4" />, color: "text-yellow-400" },
  "auto":       { label: "Tự Động", icon: <Bot className="w-4 h-4" />, color: "text-green-400" },
  "puzzle":     { label: "Đố Trí Tuệ", icon: <Puzzle className="w-4 h-4" />, color: "text-blue-400" },
  "narrative":  { label: "Kể Chuyện", icon: <BookOpen className="w-4 h-4" />, color: "text-purple-400" },
  "dice":       { label: "Xúc Xắc", icon: <Dices className="w-4 h-4" />, color: "text-indigo-400" },
};

const RESULT_META = {
  win:  { label: "Thắng", icon: <Trophy className="w-4 h-4" />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  lose: { label: "Thua",  icon: <Skull className="w-4 h-4" />,  color: "text-red-400",    bg: "bg-red-900/20 border-red-700/30" },
  draw: { label: "Hòa",   icon: <Minus className="w-4 h-4" />,  color: "text-gray-400",   bg: "bg-gray-800/40 border-gray-600/30" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function fmtDuration(s: number | null) {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function WinRateBar({ win, total }: { win: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((win / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-yellow-400 font-bold w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function BattleHistoryPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(true);
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [modeFilter, setModeFilter] = useState<BattleMode>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(data);
          setActiveChar(data[0]);
        }
      })
      .finally(() => setFetching(false));
  }, [user]);

  useEffect(() => {
    if (!activeChar) return;
    loadHistory(activeChar.id);
  }, [activeChar]);

  async function loadHistory(characterId: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/battle/history/${characterId}`, { credentials: "include" });
      const data = await res.json();
      setBattles(data.battles ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoadingHistory(false);
    }
  }

  const filtered = battles.filter(b => {
    if (modeFilter !== "all" && b.battleMode !== modeFilter) return false;
    if (resultFilter !== "all" && b.result !== resultFilter) return false;
    return true;
  });

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeChar) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6">
        <Swords className="w-12 h-12 text-gray-600" />
        <p className="text-gray-400">Chưa có nhân vật.</p>
      </div>
    );
  }

  const winRate = stats && stats.total > 0 ? Math.round((stats.win / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-black/80 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 backdrop-blur">
        <button onClick={() => setLocation("/battle")} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <TrendingUp className="w-5 h-5 text-cyan-400" />
        <span className="font-bold text-sm tracking-wide">LỊCH SỬ CHIẾN ĐẤU</span>
        {characters.length > 1 && (
          <div className="ml-auto flex gap-1">
            {characters.map(c => (
              <button key={c.id} onClick={() => setActiveChar(c)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${activeChar?.id === c.id ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Stats tổng quan */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 border border-gray-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Nhân vật</div>
                <div className="font-bold text-cyan-300">{activeChar.name} · Lv.{activeChar.level}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Tổng EXP từ chiến đấu</div>
                <div className="font-bold text-yellow-400">+{stats.totalExp} EXP</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Tổng", value: stats.total, color: "text-white" },
                { label: "Thắng", value: stats.win, color: "text-yellow-400" },
                { label: "Thua", value: stats.lose, color: "text-red-400" },
                { label: "Hòa", value: stats.draw, color: "text-gray-400" },
              ].map(s => (
                <div key={s.label} className="bg-black/50 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Tỉ lệ thắng</span>
              <span>{stats.total} trận</span>
            </div>
            <WinRateBar win={stats.win} total={stats.total} />
          </motion.div>
        )}

        {/* Thống kê theo mode */}
        {stats && Object.keys(stats.byMode).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-black/40 border border-gray-700/50 rounded-2xl p-4">
            <div className="text-xs text-gray-400 font-semibold mb-3 tracking-wide">THEO CHẾ ĐỘ</div>
            <div className="space-y-3">
              {Object.entries(stats.byMode).map(([mode, ms]) => {
                const meta = MODE_META[mode];
                if (!meta) return null;
                return (
                  <div key={mode}>
                    <div className="flex items-center justify-between mb-1">
                      <div className={`flex items-center gap-1.5 text-sm ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {ms.win}W / {ms.lose}L / {ms.draw}D
                      </div>
                    </div>
                    <WinRateBar win={ms.win} total={ms.total} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Filter */}
        <div>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mb-2">
            <Filter className="w-3.5 h-3.5" />
            Bộ lọc
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            {(modeFilter !== "all" || resultFilter !== "all") && (
              <span className="bg-cyan-600 text-white text-xs px-1.5 py-0.5 rounded-full">Đang lọc</span>
            )}
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="bg-black/40 border border-gray-700/40 rounded-xl p-4 space-y-3 mb-2">
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Chế độ</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "turn-based", "real-time", "auto", "puzzle", "narrative", "dice"] as BattleMode[]).map(m => (
                        <button key={m} onClick={() => setModeFilter(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${modeFilter === m ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                          {m === "all" ? "Tất cả" : (MODE_META[m]?.label ?? m)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Kết quả</div>
                    <div className="flex gap-1.5">
                      {(["all", "win", "lose", "draw"] as ResultFilter[]).map(r => (
                        <button key={r} onClick={() => setResultFilter(r)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${resultFilter === r ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                          {r === "all" ? "Tất cả" : r === "win" ? "Thắng" : r === "lose" ? "Thua" : "Hòa"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Danh sách trận */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-400 font-semibold tracking-wide">
              DANH SÁCH TRẬN {filtered.length !== battles.length && `(${filtered.length}/${battles.length})`}
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{battles.length === 0 ? "Chưa có trận chiến nào" : "Không có trận nào khớp bộ lọc"}</p>
              {battles.length === 0 && (
                <button onClick={() => setLocation("/battle")}
                  className="mt-4 text-xs text-cyan-500 hover:text-cyan-300 transition-colors">
                  Vào chiến trường →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((b, i) => {
                const rm = RESULT_META[b.result as keyof typeof RESULT_META] ?? RESULT_META.draw;
                const mm = MODE_META[b.battleMode];
                return (
                  <motion.div key={b.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border rounded-xl p-3.5 ${rm.bg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className={`${rm.color} flex-shrink-0`}>{rm.icon}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">{b.enemyName}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Lv.{b.enemyLevel}</span>
                            {mm && (
                              <span className={`flex items-center gap-1 ${mm.color}`}>
                                {mm.icon} {mm.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-bold ${rm.color}`}>{rm.label}</div>
                        {b.expGained > 0 && (
                          <div className="text-xs text-yellow-400 mt-0.5">+{b.expGained} EXP</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(b.duration)}</span>
                      {b.hpLeft !== null && b.result === "win" && (
                        <span>HP còn: {b.hpLeft}</span>
                      )}
                      <span className="ml-auto">{fmtDate(b.createdAt)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA nếu chưa có trận nào */}
        {!loadingHistory && battles.length > 0 && (
          <div className="pb-4">
            <button onClick={() => setLocation("/battle")}
              className="w-full py-3 border border-gray-700/50 rounded-xl text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-colors flex items-center justify-center gap-2">
              <Swords className="w-4 h-4" /> Tiếp tục chiến đấu
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
