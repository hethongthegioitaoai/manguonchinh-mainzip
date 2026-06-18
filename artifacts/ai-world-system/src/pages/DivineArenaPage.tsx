import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, Loader2, Swords, Trophy, Crown,
  ChevronDown, ChevronUp, Zap, Shield, Star, Globe2, BarChart3,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "Tu Tiên",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "Cyberpunk", color: "#a855f7" },
  { slug: "wasteland",   label: "Hoang Phế", color: "#ef4444" },
] as const;

const TIER_META: Record<string, { label: string; color: string; emoji: string }> = {
  bronze:   { label: "Đồng",     color: "#d97706", emoji: "🥉" },
  silver:   { label: "Bạc",      color: "#9ca3af", emoji: "🥈" },
  gold:     { label: "Vàng",     color: "#eab308", emoji: "🥇" },
  platinum: { label: "Bạch Kim", color: "#06b6d4", emoji: "💎" },
  diamond:  { label: "Kim Cương",color: "#a855f7", emoji: "💜" },
  divine:   { label: "Thần",     color: "#ef4444", emoji: "⚡" },
};

const WORLD_COLOR: Record<string, string> = {
  cultivation: "#06b6d4", cyberpunk: "#a855f7", wasteland: "#ef4444",
};
const WORLD_LABEL: Record<string, string> = {
  cultivation: "Tu Tiên", cyberpunk: "Cyberpunk", wasteland: "Hoang Phế",
};

interface Match {
  id: string; challengerName: string; challengerWorld: string;
  defenderName: string; defenderWorld: string;
  ruleSet: string; winnerName: string | null; aiNarrative: string | null;
  expReward: number; goldReward: number; matchedAt: string; completedAt: string | null;
}
interface Ranking {
  id: string; characterName: string; worldSlug: string;
  wins: number; losses: number; divinePoints: number; tier: string; rank: number;
}
interface RuleSetInfo { label: string; desc: string; icon: string; }
interface TierInfo { id: string; label: string; color: string; minPts: number; }

function MatchCard({ m, expanded, onToggle }: { m: Match; expanded: boolean; onToggle: () => void }) {
  const cColor = WORLD_COLOR[m.challengerWorld] ?? "#6b7280";
  const dColor = WORLD_COLOR[m.defenderWorld]   ?? "#6b7280";
  const isComplete = !!m.completedAt;
  const winnerIsChallenger = m.winnerName === m.challengerName;

  return (
    <motion.div layout className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-900/40">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {/* Challenger */}
          <div className="flex-1 min-w-0 text-left">
            <div className={`font-bold text-sm truncate ${isComplete && winnerIsChallenger ? "text-yellow-300" : "text-white"}`}>
              {isComplete && winnerIsChallenger && "🏆 "}{m.challengerName}
            </div>
            <div className="text-xs" style={{ color: cColor }}>{WORLD_LABEL[m.challengerWorld] ?? m.challengerWorld}</div>
          </div>

          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <Swords className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">VS</span>
          </div>

          {/* Defender */}
          <div className="flex-1 min-w-0 text-right">
            <div className={`font-bold text-sm truncate ${isComplete && !winnerIsChallenger ? "text-yellow-300" : "text-white"}`}>
              {isComplete && !winnerIsChallenger && "🏆 "}{m.defenderName}
            </div>
            <div className="text-xs" style={{ color: dColor }}>{WORLD_LABEL[m.defenderWorld] ?? m.defenderWorld}</div>
          </div>

          <div className="shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-600">{m.ruleSet.replace(/_/g, " ").toUpperCase()}</span>
          <div className="flex gap-2 text-xs text-gray-600">
            <span className="text-cyan-600">+{m.expReward} EXP</span>
            <span className="text-yellow-600">+{m.goldReward}g</span>
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-gray-700/40 pt-3">
              {m.aiNarrative && (
                <p className="text-xs text-gray-400 leading-relaxed italic">{m.aiNarrative}</p>
              )}
              <div className="text-xs text-gray-600 mt-2">
                {new Date(m.matchedAt).toLocaleString("vi-VN")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DivineArenaPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<{
    matches: Match[]; rankings: Ranking[]; totalMatches: number; completedMatches: number;
    tiers: TierInfo[]; ruleSets: Record<string, RuleSetInfo>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "rankings">("matches");
  const [msg, setMsg] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [tournamentLoading, setTournamentLoading] = useState(false);

  /* Match form */
  const [cWorld, setCWorld] = useState("cultivation");
  const [dWorld, setDWorld] = useState("cyberpunk");
  const [ruleSet, setRuleSet] = useState("cross_world");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/divine-arena", { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, []);

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

  const matches   = data?.matches   ?? [];
  const rankings  = data?.rankings  ?? [];
  const ruleSets  = data?.ruleSets  ?? {};
  const tiers     = data?.tiers     ?? [];

  const RULE_KEYS = Object.keys(ruleSets);

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
              <Swords className="w-5 h-5 text-red-500" />
              <span className="font-bold tracking-wider text-red-400">VŨ ĐÀI THẦN LỰC</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} className="text-gray-400 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Swords className="w-4 h-4" />,   label: "Tổng Trận",       value: data?.totalMatches ?? 0,     color: "#ef4444" },
            { icon: <Trophy className="w-4 h-4" />,   label: "Đã Hoàn Thành",  value: data?.completedMatches ?? 0, color: "#f59e0b" },
            { icon: <Crown className="w-4 h-4" />,    label: "Chiến Binh",      value: rankings.length,              color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
              <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Match creator */}
        <div className="bg-gray-900/60 border border-red-800/30 rounded-xl p-4 space-y-3">
          <div className="text-xs text-red-400 font-semibold uppercase tracking-wide flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" /> Tạo Trận Đấu
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">Challenger</div>
              <select value={cWorld} onChange={e => setCWorld(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                {["cultivation","cyberpunk","wasteland"].map(w => (
                  <option key={w} value={w}>{WORLD_LABEL[w]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Defender</div>
              <select value={dWorld} onChange={e => setDWorld(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                {["cultivation","cyberpunk","wasteland"].map(w => (
                  <option key={w} value={w}>{WORLD_LABEL[w]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Rule Set</div>
            <select value={ruleSet} onChange={e => setRuleSet(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
              {RULE_KEYS.length > 0
                ? RULE_KEYS.map(k => (
                    <option key={k} value={k}>{ruleSets[k].icon} {ruleSets[k].label}</option>
                  ))
                : (
                    <>
                      <option value="cross_world">🌌 Liên Giới Đại Chiến</option>
                      <option value="cultivation_duel">⚔️ Kiếm Khí Tu Tiên</option>
                      <option value="cyber_duel">🤖 Mech Cyber Duel</option>
                      <option value="wasteland_survival">💀 Sinh Tồn Hoang Phế</option>
                    </>
                  )
              }
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => act("/api/divine-arena/match", "POST", setMatchLoading,
                { challengerWorld: cWorld, defenderWorld: dWorld, ruleSet })}
              disabled={matchLoading}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-red-800 hover:bg-red-700 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {matchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              BẮT ĐẦU CHIẾN
            </button>
            <button onClick={() => act("/api/divine-arena/tournament", "POST", setTournamentLoading)}
              disabled={tournamentLoading}
              className="px-4 py-2.5 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center gap-1.5">
              {tournamentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              GIẢI ĐẤU (5)
            </button>
          </div>
        </div>

        {/* Flash */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-2 text-red-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tier legend */}
        <div className="flex gap-2 flex-wrap">
          {tiers.map(t => {
            const tm = TIER_META[t.id] ?? { emoji: "🔵", label: t.label ?? t.id, color: "#6b7280" };
            return (
              <div key={t.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                style={{ borderColor: tm.color + "40", color: tm.color, background: tm.color + "0A" }}>
                <span>{tm.emoji}</span>
                <span className="font-bold">{tm.label}</span>
                <span className="text-gray-600">≥{t.minPts}đ</span>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["matches","rankings"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all"
              style={activeTab === t
                ? { background: "#ef444422", borderColor: "#ef4444", color: "#ef4444" }
                : { borderColor: "#374151", color: "#6b7280" }}>
              {t === "matches" ? `⚔️ TRẬN ĐẤU (${matches.length})` : `🏆 XẾP HẠNG (${rankings.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : activeTab === "matches" ? (
          matches.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Vũ Đài chưa có trận đấu nào.</p>
              <p className="text-xs mt-1">Nhấn <span className="text-red-400">"BẮT ĐẦU CHIẾN"</span> để tạo trận đầu tiên!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(m => (
                <MatchCard key={m.id} m={m}
                  expanded={expandedId === m.id}
                  onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                />
              ))}
            </div>
          )
        ) : (
          rankings.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chưa có dữ liệu bảng xếp hạng.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rankings.slice(0, 20).map((r, i) => {
                const tm = TIER_META[r.tier] ?? { emoji: "🥉", color: "#d97706", label: r.tier };
                const wc = WORLD_COLOR[r.worldSlug] ?? "#6b7280";
                return (
                  <div key={r.id} className="flex items-center gap-3 bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3">
                    <div className="text-sm font-bold w-6 text-center"
                      style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#d97706" : "#4b5563" }}>
                      {i === 0 ? "👑" : i < 3 ? `#${i+1}` : `#${i+1}`}
                    </div>
                    <div className="text-lg">{tm.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{r.characterName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: tm.color, background: tm.color + "20" }}>
                          {tm.label}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: wc }}>
                        {WORLD_LABEL[r.worldSlug] ?? r.worldSlug} · {r.wins}W {r.losses}L
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm" style={{ color: tm.color }}>{r.divinePoints}</div>
                      <div className="text-xs text-gray-600">điểm</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
