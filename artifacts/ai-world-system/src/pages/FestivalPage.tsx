import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, Loader2, Star, Trophy, Zap,
  ChevronDown, ChevronUp, Users, Calendar, Gift, Sword,
  CheckCircle, Clock, PartyPopper,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

const SEASON_META: Record<string, { emoji: string; label: string; color: string }> = {
  spring: { emoji: "🌸", label: "Mùa Xuân", color: "#22c55e" },
  summer: { emoji: "☀️", label: "Mùa Hạ",   color: "#f59e0b" },
  autumn: { emoji: "🍂", label: "Mùa Thu",   color: "#ef4444" },
  winter: { emoji: "❄️", label: "Mùa Đông",  color: "#06b6d4" },
};

const SEASONS = ["spring","summer","autumn","winter"];
const SEASON_LABELS: Record<string, string> = { spring: "Xuân", summer: "Hạ", autumn: "Thu", winter: "Đông" };

interface Quest { title: string; desc: string; reward: number; }
interface Reward { type: string; label: string; exclusive: boolean; }
interface Festival {
  id: string; worldSlug: string; season: string; festivalName: string; theme: string;
  startDate: string; endDate: string | null; rewards: Reward[]; aiNarrative: string | null;
  quests: Quest[]; participantCount: number; isActive: number; createdAt: string;
}
interface Participation {
  id: string; festivalId: string; characterId: string; characterName: string | null;
  tasksCompleted: number; rewardsClaimed: number; score: number; joinedAt: string;
}
interface CurrentSeason { id: string; label: string; emoji: string; }

function Countdown({ endDate }: { endDate: string }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTime("Đã kết thúc"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTime(`${d}n ${h}g ${m}p`);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [endDate]);
  return <span className="text-xs text-yellow-400 font-bold">{time}</span>;
}

function FestivalCard({ festival, participations, expanded, onToggle, onJoin, onTask, onEnd, joinLoading, taskLoading }: {
  festival: Festival; participations: Participation[]; expanded: boolean; onToggle: () => void;
  onJoin: (id: string) => void; onTask: (id: string, idx: number) => void; onEnd: (id: string) => void;
  joinLoading: boolean; taskLoading: number | null;
}) {
  const sm = SEASON_META[festival.season] ?? { emoji: "🎉", label: festival.season, color: "#06b6d4" };
  const isActive = festival.isActive === 1;
  const leaderboard = [...participations].filter(p => p.festivalId === festival.id).sort((a,b) => b.score - a.score);

  return (
    <motion.div layout className="border rounded-xl overflow-hidden bg-gray-900/40 transition-all"
      style={{ borderColor: sm.color + "50" }}>
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-2xl">{sm.emoji}</span>
              <div>
                <div className="font-bold text-white">{festival.festivalName}</div>
                <div className="text-xs text-gray-500">{sm.label}</div>
              </div>
              {isActive ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400 font-bold">ĐANG DIỄN RA</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/60 border border-gray-700/40 text-gray-500">ĐÃ KẾT THÚC</span>
              )}
            </div>
            <div className="text-xs text-gray-500 italic">{festival.theme}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-500">Người tham gia</div>
              <div className="text-sm font-bold" style={{ color: sm.color }}>{festival.participantCount}</div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        {isActive && festival.endDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600">
            <Clock className="w-3 h-3" /> Còn lại: <Countdown endDate={festival.endDate} />
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t pt-3 space-y-4" style={{ borderColor: sm.color + "30" }}>
              {/* Narrative */}
              {festival.aiNarrative && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">📖 Câu Chuyện Lễ Hội</div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">{festival.aiNarrative}</p>
                </div>
              )}

              {/* Quests */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: sm.color }}>
                  <Sword className="w-3.5 h-3.5" /> Nhiệm Vụ Lễ Hội
                </div>
                <div className="space-y-2">
                  {(festival.quests as Quest[]).map((q, idx) => (
                    <div key={idx} className="bg-gray-800/50 rounded-xl p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">{q.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{q.desc}</div>
                        <div className="text-xs font-bold mt-1" style={{ color: sm.color }}>+{q.reward} điểm</div>
                      </div>
                      {isActive && (
                        <button onClick={() => onTask(festival.id, idx)} disabled={taskLoading === idx}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40"
                          style={{ borderColor: sm.color + "60", color: sm.color, background: sm.color + "11" }}>
                          {taskLoading === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 text-yellow-400">
                  <Gift className="w-3.5 h-3.5" /> Phần Thưởng Độc Quyền
                </div>
                <div className="flex flex-wrap gap-2">
                  {(festival.rewards as Reward[]).map((r, i) => (
                    <div key={i} className={`text-xs px-2.5 py-1.5 rounded-xl border ${r.exclusive ? "border-yellow-700/50 bg-yellow-900/20 text-yellow-300" : "border-gray-700 text-gray-400"}`}>
                      {r.exclusive && <Star className="w-3 h-3 inline mr-1 text-yellow-500" />}
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 text-purple-400">
                    <Trophy className="w-3.5 h-3.5" /> Bảng Xếp Hạng
                  </div>
                  <div className="space-y-1.5">
                    {leaderboard.slice(0,5).map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "#6b7280" }}>
                            #{i+1}
                          </span>
                          <span className="text-xs text-white">{p.characterName ?? "Ẩn Danh"}</span>
                        </div>
                        <div className="text-xs font-bold" style={{ color: sm.color }}>{p.score.toLocaleString()} điểm</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {isActive && (
                  <>
                    <button onClick={() => onJoin(festival.id)} disabled={joinLoading}
                      className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                      style={{ borderColor: sm.color + "60", color: sm.color, background: sm.color + "11" }}>
                      {joinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                      THAM GIA
                    </button>
                    <button onClick={() => onEnd(festival.id)}
                      className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-700 text-gray-500 hover:border-gray-600 transition-all">
                      KẾT THÚC
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FestivalPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData] = useState<{
    festivals: Festival[]; active: Festival | null;
    participations: Participation[]; currentSeason: CurrentSeason;
  } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [msg, setMsg]                 = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [seasonOverride, setSeasonOverride] = useState("");
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState<{ [festId: string]: number | null }>({});
  const [endLoading, setEndLoading]   = useState<string | null>(null);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/festivals/${activeWorld}`, { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, [activeWorld]);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 5000); };

  const act = async (url: string, method: string, setL: (v: boolean) => void, body?: unknown) => {
    setL(true);
    try {
      const r = await fetch(url, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) flash(j.error ?? "Có lỗi"); else { flash(j.message ?? "Hoàn thành"); loadData(); }
    } catch { flash("Có lỗi xảy ra"); }
    setL(false);
  };

  const handleJoin = (festId: string) => {
    setJoinLoading(festId);
    act(`/api/festivals/join/${festId}`, "POST", (v) => { if (!v) setJoinLoading(null); },
      { characterId: "player-demo", characterName: "Chiến Binh" });
  };

  const handleTask = async (festId: string, idx: number) => {
    setTaskLoading(prev => ({ ...prev, [festId]: idx }));
    try {
      const r = await fetch(`/api/festivals/complete-task/${festId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: "player-demo", taskIndex: idx }),
      });
      const j = await r.json();
      if (!r.ok) flash(j.error ?? "Có lỗi"); else { flash(j.message ?? "Hoàn thành quest!"); loadData(); }
    } catch { flash("Có lỗi"); }
    setTaskLoading(prev => ({ ...prev, [festId]: null }));
  };

  const handleEnd = (festId: string) => {
    setEndLoading(festId);
    act(`/api/festivals/end/${festId}`, "POST", (v) => { if (!v) setEndLoading(null); });
  };

  const cs       = data?.currentSeason;
  const csm      = cs ? SEASON_META[cs.id] : null;
  const festivals = data?.festivals ?? [];
  const participations = data?.participations ?? [];

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
              <PartyPopper className="w-5 h-5" style={{ color: worldColor }} />
              <span className="font-bold tracking-wider" style={{ color: worldColor }}>LỄ HỘI THEO MÙA</span>
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

        {/* Current season banner */}
        {csm && (
          <div className="rounded-xl p-4 border flex items-center gap-3"
            style={{ borderColor: csm.color + "50", background: csm.color + "0A" }}>
            <span className="text-3xl">{csm.emoji}</span>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Mùa Hiện Tại</div>
              <div className="font-bold" style={{ color: csm.color }}>{csm.label}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-gray-500">Lễ hội hoạt động</div>
              <div className="font-bold text-lg" style={{ color: csm.color }}>
                {festivals.filter(f => f.isActive === 1).length}
              </div>
            </div>
          </div>
        )}

        {/* Create festival */}
        <div className="flex gap-2">
          <select value={seasonOverride} onChange={e => setSeasonOverride(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300">
            <option value="">Mùa hiện tại ({csm?.label ?? "..."})</option>
            {SEASONS.map(s => (
              <option key={s} value={s}>{SEASON_META[s].emoji} {SEASON_LABELS[s]}</option>
            ))}
          </select>
          <button onClick={() => act(`/api/festivals/create/${activeWorld}`, "POST", setCreateLoading,
              { seasonOverride: seasonOverride || undefined })}
            disabled={createLoading}
            className="px-4 py-2 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center gap-1.5">
            {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            TẠO LỄ HỘI
          </button>
        </div>

        {/* Flash */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-purple-900/30 border border-purple-700/50 rounded-lg px-4 py-2 text-purple-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Calendar className="w-4 h-4" />, label: "Tổng Lễ Hội", value: festivals.length, color: worldColor },
            { icon: <Users className="w-4 h-4" />,    label: "Người Tham Gia", value: participations.length, color: "#22c55e" },
            { icon: <Trophy className="w-4 h-4" />,   label: "Phần Thưởng", value: festivals.reduce((s,f) => s+(f.rewards as any[]).length, 0), color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
              <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Festival list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : festivals.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <PartyPopper className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có lễ hội nào.</p>
            <p className="text-xs mt-1">Nhấn <span className="text-purple-400">"TẠO LỄ HỘI"</span> để bắt đầu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active first */}
            {festivals.filter(f => f.isActive === 1).map(f => (
              <FestivalCard key={f.id} festival={f} participations={participations}
                expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                onJoin={handleJoin} onTask={handleTask} onEnd={handleEnd}
                joinLoading={joinLoading === f.id} taskLoading={taskLoading[f.id] ?? null}
              />
            ))}
            {/* Past */}
            {festivals.filter(f => f.isActive === 0).length > 0 && (
              <div className="text-xs text-gray-600 uppercase tracking-wider pt-2">Lễ hội đã qua</div>
            )}
            {festivals.filter(f => f.isActive === 0).map(f => (
              <FestivalCard key={f.id} festival={f} participations={participations}
                expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                onJoin={handleJoin} onTask={handleTask} onEnd={handleEnd}
                joinLoading={joinLoading === f.id} taskLoading={taskLoading[f.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
