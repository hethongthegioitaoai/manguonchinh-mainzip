import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Swords, Crown, Shield, Zap, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Guild { id: string; name: string; description?: string; memberCount?: number; }
interface ClanWar {
  id: string; guildId1: string; guildId2: string; guildName1: string; guildName2: string;
  score1: number; score2: number; active: boolean; winnerId: string | null;
  startAt: string; endAt: string | null; rewardDistributed: boolean;
}
interface GuildWarData { activeWar: ClanWar | null; myGuild: Guild | null; allGuilds: Guild[]; history: ClanWar[]; isLeader: boolean; }

function timeLeft(endAt: string | null): string {
  if (!endAt) return "∞";
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return "Đã kết thúc";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function GuildWarPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [targetGuildId, setTargetGuildId] = useState("");
  const [showDeclare, setShowDeclare] = useState(false);

  const { data, isLoading } = useQuery<GuildWarData>({
    queryKey: ["/api/guild-war/status"],
    queryFn: async () => {
      const r = await fetch("/api/guild-war/status", { credentials: "include" });
      if (!r.ok) throw new Error("failed"); return r.json();
    },
    refetchInterval: 30000,
  });

  const declareMutation = useMutation({
    mutationFn: async (targetId: string) => {
      const r = await fetch(`/api/guild-war/declare/${targetId}`, { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guild-war/status"] });
      toast.success(`⚔️ Đã tuyên chiến với ${result.war.guildName2}!`);
      setShowDeclare(false); setTargetGuildId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const endWarMutation = useMutation({
    mutationFn: async (warId: string) => {
      const r = await fetch(`/api/guild-war/end/${warId}`, { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guild-war/status"] });
      if (result.winnerId) toast.success(`🏆 ${result.winnerName} thắng! Điểm: ${result.score1}–${result.score2}`);
      else toast("Hòa! Không có phần thưởng.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const myGuildId = data?.myGuild?.id;
  const isMyGuild1 = data?.activeWar?.guildId1 === myGuildId;
  const myScore = isMyGuild1 ? data?.activeWar?.score1 : data?.activeWar?.score2;
  const enemyScore = isMyGuild1 ? data?.activeWar?.score2 : data?.activeWar?.score1;
  const enemyName = isMyGuild1 ? data?.activeWar?.guildName2 : data?.activeWar?.guildName1;
  const availableTargets = data?.allGuilds?.filter(g => g.id !== myGuildId) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-slate-950 to-black text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-red-400 flex items-center gap-2">
            <Swords className="w-5 h-5" /> CHIẾN TRANH BANG HỘI
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          </div>
        )}

        {data && !data.myGuild && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center space-y-2">
            <Swords className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-slate-400">Cần gia nhập bang hội để tham gia chiến tranh</p>
            <button onClick={() => navigate("/guilds")} className="rounded-xl border border-red-700/40 bg-red-950/20 px-4 py-2 text-sm text-red-300 hover:bg-red-900/30 transition-colors">
              Đến trang Bang Hội
            </button>
          </div>
        )}

        {data?.myGuild && (
          <>
            {/* My guild */}
            <div className="rounded-xl border border-red-700/30 bg-red-950/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Bang Hội Của Bạn</p>
                <p className="font-bold text-slate-100 text-lg">⚔️ {data.myGuild.name}</p>
              </div>
              {data.isLeader && <span className="rounded-full border border-yellow-700/50 bg-yellow-950/20 px-3 py-1 text-xs text-yellow-400 flex items-center gap-1"><Crown className="w-3 h-3" /> Thủ Lĩnh</span>}
            </div>

            {/* Active war */}
            {data.activeWar ? (
              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-red-400 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 animate-pulse" /> Chiến Tranh Đang Diễn Ra
                </h2>

                <div className="rounded-xl border border-red-600/50 bg-red-950/15 p-5">
                  {/* Scoreboard */}
                  <div className="grid grid-cols-3 items-center text-center gap-2">
                    <div>
                      <p className="font-bold text-slate-100 truncate">{data.activeWar.guildName1}</p>
                      <p className="font-mono font-black text-4xl text-cyan-400">{data.activeWar.score1}</p>
                      {data.activeWar.guildId1 === myGuildId && <p className="text-xs text-cyan-600 mt-0.5">👤 Bạn</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl">⚔️</p>
                      <p className="text-xs text-slate-500 mt-1">VS</p>
                      {data.activeWar.endAt && (
                        <p className="text-xs text-red-400 font-mono mt-1 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> {timeLeft(data.activeWar.endAt)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-100 truncate">{data.activeWar.guildName2}</p>
                      <p className="font-mono font-black text-4xl text-red-400">{data.activeWar.score2}</p>
                      {data.activeWar.guildId2 === myGuildId && <p className="text-xs text-cyan-600 mt-0.5">👤 Bạn</p>}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <p className="text-xs text-slate-500 text-center">Thắng PvP với thành viên bang địch để tích điểm</p>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      {(() => {
                        const total = (data.activeWar.score1 + data.activeWar.score2) || 1;
                        const pct = (data.activeWar.score1 / total) * 100;
                        return <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-red-500" animate={{ width: `${pct}%` }} />;
                      })()}
                    </div>
                  </div>
                </div>

                {data.isLeader && (
                  <button onClick={() => endWarMutation.mutate(data.activeWar!.id)}
                    disabled={endWarMutation.isPending}
                    className="w-full rounded-xl border border-slate-700/40 bg-slate-900/20 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 disabled:opacity-50 transition-all">
                    {endWarMutation.isPending ? "Đang kết thúc..." : "Kết Thúc Chiến Tranh (Admin)"}
                  </button>
                )}

                <div className="rounded-xl border border-slate-700/30 bg-slate-900/10 p-3 text-xs text-slate-500 space-y-0.5">
                  <p className="font-bold text-slate-400">📋 Luật Chiến</p>
                  <p>• Mỗi chiến thắng PvP với thành viên bang địch: +1 điểm</p>
                  <p>• Chiến tranh kéo dài 24h từ lúc tuyên chiến</p>
                  <p>• Bang thắng nhận +50 uy tín phe phái cho tất cả thành viên</p>
                  <p>• Hòa nếu bằng điểm — không có phần thưởng</p>
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="rounded-xl border border-slate-700/30 bg-slate-900/10 p-6 text-center space-y-2">
                  <Swords className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-slate-400 text-sm">Không có chiến tranh đang diễn ra</p>
                  {data.isLeader && (
                    <button onClick={() => setShowDeclare(!showDeclare)}
                      className="rounded-xl border border-red-600/50 bg-red-950/20 px-4 py-2 text-sm text-red-300 hover:bg-red-900/30 transition-colors flex items-center gap-2 mx-auto">
                      <Swords className="w-4 h-4" /> Tuyên Chiến
                    </button>
                  )}
                  {!data.isLeader && <p className="text-xs text-slate-600">Chỉ thủ lĩnh bang mới có thể tuyên chiến</p>}
                </div>

                <AnimatePresence>
                  {showDeclare && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-red-700/40 bg-red-950/15 p-4 space-y-3">
                      <p className="text-sm font-bold text-red-300">⚔️ Chọn Bang Hội Để Tuyên Chiến</p>
                      {availableTargets.length === 0 ? (
                        <p className="text-xs text-slate-500">Không có bang hội nào khác để tuyên chiến</p>
                      ) : (
                        <div className="space-y-2">
                          {availableTargets.map(g => (
                            <div key={g.id}
                              onClick={() => setTargetGuildId(g.id)}
                              className={`rounded-xl border p-3 cursor-pointer transition-all ${targetGuildId === g.id ? "border-red-500/60 bg-red-950/30" : "border-slate-700/30 bg-slate-900/20 hover:border-slate-600/40"}`}>
                              <p className="font-bold text-sm text-slate-100">⚔️ {g.name}</p>
                              {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => { if (targetGuildId) declareMutation.mutate(targetGuildId); }}
                          disabled={!targetGuildId || declareMutation.isPending}
                          className="flex-1 rounded-xl border border-red-600/50 bg-red-900/30 py-2.5 font-bold text-red-300 text-sm hover:bg-red-800/40 disabled:opacity-50 transition-all">
                          {declareMutation.isPending ? "Đang tuyên chiến..." : "⚔️ Xác Nhận Tuyên Chiến"}
                        </button>
                        <button onClick={() => setShowDeclare(false)} className="rounded-xl border border-slate-700/40 px-4 py-2.5 text-slate-400 text-sm hover:text-slate-200 hover:bg-slate-800/30 transition-all">Hủy</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* History */}
            {data.history?.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Lịch Sử Chiến Tranh</h2>
                <div className="space-y-2">
                  {data.history.map(war => {
                    const iWon = war.winnerId === myGuildId;
                    const iLost = war.winnerId && war.winnerId !== myGuildId;
                    const isDraw = !war.winnerId && !war.active;
                    const enemyNameHist = war.guildId1 === myGuildId ? war.guildName2 : war.guildName1;
                    const myScoreHist = war.guildId1 === myGuildId ? war.score1 : war.score2;
                    const enemyScoreHist = war.guildId1 === myGuildId ? war.score2 : war.score1;
                    return (
                      <div key={war.id} className={`rounded-xl border p-3 flex items-center justify-between ${iWon ? "border-green-700/30 bg-green-950/10" : iLost ? "border-red-700/30 bg-red-950/10" : "border-slate-700/30 bg-slate-900/10"}`}>
                        <div>
                          <p className="font-bold text-sm text-slate-200">vs ⚔️ {enemyNameHist}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(war.startAt).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${iWon ? "text-green-400" : iLost ? "text-red-400" : "text-slate-500"}`}>
                            {iWon ? "🏆 Thắng" : iLost ? "💀 Thua" : "🤝 Hòa"}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">{myScoreHist}–{enemyScoreHist}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
