import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Swords, Trophy, ArrowLeft, Shield, ChevronRight, Flame, Star, TrendingUp, Zap } from "lucide-react";

interface TierInfo { name: string; label: string; icon: string; color: string; minRp: number; maxRp: number }
interface MyRanking {
  ratingPoints: number; wins: number; losses: number; draws: number;
  currentStreak: number; bestStreak: number; tier: TierInfo;
}
interface MyCharacter {
  id: string; name: string; level: number; power: number; system: string;
  ranking: MyRanking;
}
interface Opponent {
  id: string; name: string; level: number; system: string; worldSlug: string; power: number;
}
interface OpponentsData { myCharacter: MyCharacter; opponents: Opponent[] }
interface BattleRound { attacker: string; damage: number; hp: number }
interface PvPResult {
  result: "win" | "lose" | "draw";
  challenger: { name: string; level: number; hpLeft: number };
  defender: { name: string; level: number; hpLeft: number };
  rounds: BattleRound[];
  expGained: number; leveledUp: boolean; newLevel: number;
  rpChange: number; newRp: number; newTier: TierInfo; streak: number;
}
interface PvPHistoryItem {
  id: string; enemyName: string; enemyLevel: number; result: string;
  expGained: number; hpLeft: number;
  metadata: { defenderName?: string; rpChange?: number; newRp?: number };
  createdAt: string;
}
interface LeaderboardEntry {
  rank: number; characterId: string; name: string; level: number;
  system: string; worldSlug: string; ratingPoints: number;
  wins: number; losses: number; draws: number; winRate: number;
  currentStreak: number; bestStreak: number; tier: TierInfo;
}

const SYSTEM_ICONS: Record<string, string> = {
  sword: "⚔️", alchemy: "⚗️", merchant: "💰", summoner: "✨",
  beast: "🐉", necromancer: "💀", unknown: "❓",
};
const WORLD_COLORS: Record<string, string> = {
  cultivation: "#a855f7", cyberpunk: "#06b6d4", zombie: "#ef4444", wasteland: "#ef4444",
};

function TierBadge({ tier, size = "sm" }: { tier: TierInfo; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "text-3xl" : "text-base";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border font-mono font-bold ${size === "lg" ? "px-3 py-1 text-sm" : "text-xs"}`}
      style={{ color: tier.color, borderColor: `${tier.color}50`, backgroundColor: `${tier.color}10` }}
    >
      <span className={sz}>{tier.icon}</span> {tier.label}
    </span>
  );
}

function RpBar({ rp, tier }: { rp: number; tier: TierInfo }) {
  const range = tier.maxRp === Infinity ? 500 : tier.maxRp - tier.minRp;
  const progress = Math.min(100, Math.round(((rp - tier.minRp) / range) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span style={{ color: tier.color }}>{rp} RP</span>
        <span className="text-slate-500">{tier.maxRp === Infinity ? "MAX" : `${tier.maxRp} RP`}</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: tier.color }}
        />
      </div>
    </div>
  );
}

function PowerBar({ power, maxPower }: { power: number; maxPower: number }) {
  const pct = Math.min(100, Math.round((power / Math.max(maxPower, 1)) * 100));
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
      />
    </div>
  );
}

type Tab = "arena" | "ranking" | "history";

export default function PvPPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [battleResult, setBattleResult] = useState<PvPResult | null>(null);
  const [tab, setTab] = useState<Tab>("arena");

  const { data, isLoading, error } = useQuery<OpponentsData>({
    queryKey: ["/api/pvp/opponents"],
    queryFn: async () => {
      const r = await fetch("/api/pvp/opponents", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const { data: history } = useQuery<PvPHistoryItem[]>({
    queryKey: ["/api/pvp/history"],
    queryFn: async () => {
      const r = await fetch("/api/pvp/history", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/pvp/leaderboard"],
    queryFn: async () => {
      const r = await fetch("/api/pvp/leaderboard", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: tab === "ranking",
  });

  const challengeMutation = useMutation({
    mutationFn: async (defenderId: string) => {
      const r = await fetch(`/api/pvp/challenge/${defenderId}`, { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message ?? "Lỗi thách đấu"); }
      return r.json() as Promise<PvPResult>;
    },
    onSuccess: (result) => {
      setBattleResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/opponents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pvp/leaderboard"] });
      if (result.result === "win") toast.success(`🏆 Thắng! +${result.expGained} EXP · ${result.rpChange >= 0 ? "+" : ""}${result.rpChange} RP`);
      else if (result.result === "draw") toast(`⚖️ Hòa! +${result.expGained} EXP · ${result.rpChange >= 0 ? "+" : ""}${result.rpChange} RP`);
      else toast.error(`💀 Thua! ${result.rpChange} RP`);
      if (result.leveledUp) toast.success(`⬆️ Lên cấp ${result.newLevel}!`);
      if (result.streak >= 3) toast.success(`🔥 Chuỗi thắng ${result.streak}!`);
    },
    onError: (err: any) => toast.error(err.message ?? "Lỗi thách đấu"),
  });

  const maxPower = Math.max(data?.myCharacter.power ?? 1, ...(data?.opponents.map(o => o.power) ?? []));
  const myRanking = data?.myCharacter.ranking;

  const TABS: { key: Tab; label: string }[] = [
    { key: "arena", label: "ĐẤU TRƯỜNG" },
    { key: "ranking", label: "BXH" },
    { key: "history", label: "LỊCH SỬ" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-slate-950 to-black text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-red-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> ĐẤU TRƯỜNG PvP
          </h1>
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded px-2 py-1 text-xs font-mono transition-colors ${tab === t.key ? "bg-red-900/60 text-red-300 border border-red-700/50" : "text-slate-500 hover:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* ── MY CARD (always visible) ── */}
        {data && myRanking && (
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `${myRanking.tier.color}40`, backgroundColor: `${myRanking.tier.color}08` }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-slate-100 text-lg">{data.myCharacter.name}</p>
                  <TierBadge tier={myRanking.tier} />
                </div>
                <p className="text-xs text-slate-500">Cấp {data.myCharacter.level} · {SYSTEM_ICONS[data.myCharacter.system] ?? "❓"} {data.myCharacter.system}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="font-mono font-bold text-xl" style={{ color: myRanking.tier.color }}>{myRanking.ratingPoints} RP</p>
                {myRanking.currentStreak >= 2 && (
                  <p className="text-xs text-orange-400 flex items-center justify-end gap-1">
                    <Flame className="w-3 h-3" /> Chuỗi {myRanking.currentStreak} trận
                  </p>
                )}
              </div>
            </div>
            <RpBar rp={myRanking.ratingPoints} tier={myRanking.tier} />
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Thắng", value: myRanking.wins, color: "text-green-400" },
                { label: "Thua", value: myRanking.losses, color: "text-red-400" },
                { label: "Hòa", value: myRanking.draws, color: "text-slate-400" },
                { label: "Best Streak", value: myRanking.bestStreak, color: "text-orange-400" },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-slate-900/40 py-2">
                  <p className={`font-mono font-bold text-lg ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ARENA TAB ── */}
        {tab === "arena" && (
          <>
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6 text-center text-red-400">
                <p className="font-bold">Chưa có nhân vật</p>
                <p className="text-sm mt-1 text-slate-500">Tạo nhân vật trước khi tham chiến</p>
                <button onClick={() => navigate("/worlds")} className="mt-4 rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-2 text-sm text-red-300 hover:bg-red-800/40 transition-colors">
                  Tạo Nhân Vật
                </button>
              </div>
            )}
            {data && (
              <>
                {data.opponents.length === 0 ? (
                  <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center text-slate-500">
                    <Swords className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Chưa có đối thủ nào trong thế giới này</p>
                    <p className="text-xs mt-1">Đợi người chơi khác tạo nhân vật cùng thế giới</p>
                  </div>
                ) : (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                      <Swords className="w-3.5 h-3.5" /> Chọn Đối Thủ ({data.opponents.length})
                    </h2>
                    <div className="space-y-2">
                      {data.opponents.map(opp => {
                        const color = WORLD_COLORS[opp.worldSlug] ?? "#a855f7";
                        const diff = opp.level - (data.myCharacter.level ?? 1);
                        const diffLabel = diff > 5 ? "⚠️ Mạnh hơn" : diff < -5 ? "🟢 Yếu hơn" : "⚖️ Tương đương";
                        return (
                          <motion.div key={opp.id}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => { setSelectedOpponent(opp); setBattleResult(null); }}
                            className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedOpponent?.id === opp.id ? "border-red-500/60 bg-red-950/30" : "border-slate-700/40 bg-slate-900/30 hover:border-slate-600/60"}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700/40" style={{ backgroundColor: `${color}15` }}>
                                  <span className="text-lg">{SYSTEM_ICONS[opp.system] ?? "❓"}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-slate-200 text-sm">{opp.name}</p>
                                  <p className="text-xs text-slate-500">Cấp {opp.level} · {diffLabel}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-sm" style={{ color }}>{opp.power}</p>
                                <p className="text-xs text-slate-600">chiến lực</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <PowerBar power={opp.power} maxPower={maxPower} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Challenge confirm */}
                <AnimatePresence>
                  {selectedOpponent && !battleResult && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="rounded-xl border border-red-700/60 bg-red-950/30 p-5 space-y-3">
                      <p className="text-center text-sm text-slate-300">
                        Thách đấu <span className="font-bold text-red-300">{selectedOpponent.name}</span> (Cấp {selectedOpponent.level})?
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setSelectedOpponent(null)}
                          className="flex-1 rounded-lg border border-slate-600/50 bg-slate-800/40 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                          Hủy
                        </button>
                        <button onClick={() => challengeMutation.mutate(selectedOpponent.id)}
                          disabled={challengeMutation.isPending}
                          className="flex-1 rounded-lg border border-red-600/60 bg-red-900/40 py-2.5 text-sm font-bold text-red-300 hover:bg-red-800/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                          {challengeMutation.isPending
                            ? <><div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> Đang chiến...</>
                            : <><Swords className="w-4 h-4" /> THÁCH ĐẤU!</>}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Battle result */}
                <AnimatePresence>
                  {battleResult && (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className={`rounded-xl border p-5 space-y-4 ${battleResult.result === "win" ? "border-yellow-600/60 bg-yellow-950/20" : battleResult.result === "draw" ? "border-slate-600/60 bg-slate-900/30" : "border-red-800/60 bg-red-950/20"}`}>
                      <div className="text-center space-y-1">
                        <p className="text-4xl">{battleResult.result === "win" ? "🏆" : battleResult.result === "draw" ? "⚖️" : "💀"}</p>
                        <p className={`text-xl font-bold ${battleResult.result === "win" ? "text-yellow-400" : battleResult.result === "draw" ? "text-slate-300" : "text-red-400"}`}>
                          {battleResult.result === "win" ? "CHIẾN THẮNG!" : battleResult.result === "draw" ? "HÒA TRẬN" : "THẤT BẠI"}
                        </p>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {battleResult.expGained > 0 && <span className="text-sm text-green-400">+{battleResult.expGained} EXP</span>}
                          <span className={`text-sm font-mono font-bold ${battleResult.rpChange >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                            {battleResult.rpChange >= 0 ? "+" : ""}{battleResult.rpChange} RP → {battleResult.newRp} RP
                          </span>
                        </div>
                        <div className="flex justify-center gap-2 flex-wrap">
                          <TierBadge tier={battleResult.newTier} />
                          {battleResult.streak >= 3 && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-orange-600/50 bg-orange-950/30 text-xs text-orange-400">
                              <Flame className="w-3 h-3" /> Chuỗi {battleResult.streak} trận
                            </span>
                          )}
                        </div>
                        {battleResult.leveledUp && <p className="text-sm text-cyan-400">⬆️ Lên cấp {battleResult.newLevel}!</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                          { label: "Ngươi", char: battleResult.challenger },
                          { label: "Đối thủ", char: battleResult.defender },
                        ].map(({ label, char }) => (
                          <div key={label} className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-3 text-center">
                            <p className="text-xs text-slate-500 mb-1">{label}</p>
                            <p className="font-bold text-slate-200 text-sm">{char.name}</p>
                            <p className="font-mono text-xs mt-1">
                              HP: <span className={char.hpLeft > 0 ? "text-green-400" : "text-red-400"}>{char.hpLeft}</span>
                            </p>
                          </div>
                        ))}
                      </div>

                      {battleResult.rounds.length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 select-none flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                            Xem diễn biến ({battleResult.rounds.length} lượt)
                          </summary>
                          <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                            {battleResult.rounds.map((r, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900/40">
                                <span className="text-slate-600">[{i + 1}]</span>
                                <span className="text-red-300 truncate max-w-[100px]">{r.attacker}</span>
                                <span className="text-red-400">-{r.damage}</span>
                                <span className="text-slate-500">HP {r.hp}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <div className="flex gap-3">
                        <button onClick={() => { setBattleResult(null); setSelectedOpponent(null); }}
                          className="flex-1 rounded-lg border border-slate-600/50 bg-slate-800/40 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                          Tìm đối thủ mới
                        </button>
                        <button onClick={() => { setTab("ranking"); setBattleResult(null); setSelectedOpponent(null); }}
                          className="flex-1 rounded-lg border border-cyan-700/50 bg-cyan-900/20 py-2 text-sm text-cyan-300 hover:bg-cyan-800/30 transition-colors flex items-center justify-center gap-1">
                          <Trophy className="w-4 h-4" /> Xem BXH
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}

        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <section className="space-y-4">
            {/* Tier guide */}
            <div className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Bậc Xếp Hạng</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: "🥉", label: "Đồng", range: "0–1199", color: "#cd7f32" },
                  { icon: "🥈", label: "Bạc", range: "1200–1499", color: "#94a3b8" },
                  { icon: "🥇", label: "Vàng", range: "1500–1799", color: "#f59e0b" },
                  { icon: "💎", label: "Bạch Kim", range: "1800–2099", color: "#38bdf8" },
                  { icon: "🔷", label: "Kim Cương", range: "2100–2499", color: "#818cf8" },
                  { icon: "☯️", label: "Bất Tử", range: "2500+", color: "#c084fc" },
                ].map(t => (
                  <div key={t.label} className="rounded-lg p-2 text-center border border-slate-800/60">
                    <p className="text-lg">{t.icon}</p>
                    <p className="text-xs font-bold" style={{ color: t.color }}>{t.label}</p>
                    <p className="text-xs text-slate-600 font-mono">{t.range}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" /> Bảng Xếp Hạng PvP
              </h2>
              {!leaderboard || leaderboard.length === 0 ? (
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center text-slate-500">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Chưa có dữ liệu xếp hạng</p>
                  <p className="text-xs mt-1">Hoàn thành trận PvP đầu tiên để xuất hiện</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map(entry => {
                    const isMe = entry.characterId === data?.myCharacter.id;
                    const total = entry.wins + entry.losses + entry.draws;
                    return (
                      <motion.div key={entry.characterId}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: entry.rank * 0.03 }}
                        className={`rounded-xl border p-3 ${isMe ? "border-cyan-700/50 bg-cyan-950/20" : "border-slate-700/40 bg-slate-900/20"}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center">
                            {entry.rank <= 3 ? (
                              <span className="text-lg">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</span>
                            ) : (
                              <span className="font-mono text-sm text-slate-500">#{entry.rank}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-bold text-sm ${isMe ? "text-cyan-300" : "text-slate-200"} truncate`}>{entry.name}</p>
                              <TierBadge tier={entry.tier} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500">Cấp {entry.level}</span>
                              <span className="text-xs text-green-400">{entry.wins}W</span>
                              <span className="text-xs text-red-400">{entry.losses}L</span>
                              {entry.draws > 0 && <span className="text-xs text-slate-500">{entry.draws}D</span>}
                              <span className="text-xs text-slate-500">{entry.winRate}% WR</span>
                              {entry.currentStreak >= 3 && (
                                <span className="text-xs text-orange-400 flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5" />{entry.currentStreak}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-sm" style={{ color: entry.tier.color }}>{entry.ratingPoints}</p>
                            <p className="text-xs text-slate-600">RP</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Lịch Sử PvP
            </h2>
            {!history || history.length === 0 ? (
              <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center text-slate-500">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Chưa có trận PvP nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(h => {
                  const rpChange = (h.metadata as any)?.rpChange as number | undefined;
                  return (
                    <motion.div key={h.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className={`rounded-xl border p-4 ${h.result === "win" ? "border-yellow-700/40 bg-yellow-950/10" : h.result === "draw" ? "border-slate-700/40 bg-slate-900/20" : "border-red-900/40 bg-red-950/10"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{h.result === "win" ? "🏆" : h.result === "draw" ? "⚖️" : "💀"}</span>
                          <div>
                            <p className="font-bold text-slate-200 text-sm">
                              vs {(h.metadata as any)?.defenderName ?? h.enemyName.replace("[PvP] ", "")}
                            </p>
                            <p className="text-xs text-slate-500">Cấp {h.enemyLevel}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className={`font-mono text-sm font-bold ${h.result === "win" ? "text-yellow-400" : h.result === "draw" ? "text-slate-400" : "text-red-400"}`}>
                            {h.result === "win" ? "THẮNG" : h.result === "draw" ? "HÒA" : "THUA"}
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            {h.expGained > 0 && <span className="text-xs text-green-400">+{h.expGained} EXP</span>}
                            {rpChange !== undefined && (
                              <span className={`text-xs font-mono ${rpChange >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                                {rpChange >= 0 ? "+" : ""}{rpChange} RP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 text-right">
                        {new Date(h.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
