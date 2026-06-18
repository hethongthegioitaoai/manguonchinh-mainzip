import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sword, Loader2, ArrowLeft, Users, Crown, Play, History, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const ROUND_LABELS: Record<number, string> = { 1: "Vòng 1", 2: "Tứ Kết", 3: "Bán Kết", 4: "Chung Kết" };

function MatchCard({ match }: { match: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/40 bg-card/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-right">
          <p className={`font-mono text-sm font-bold ${match.winnerId === match.char1Id ? "text-yellow-400" : "text-muted-foreground/50 line-through"}`}>{match.char1Name ?? "TBD"}</p>
        </div>
        <div className="flex items-center gap-2 mx-3">
          <span className="font-orbitron text-xs text-muted-foreground/50">VS</span>
        </div>
        <div className="flex-1">
          <p className={`font-mono text-sm font-bold ${match.winnerId === match.char2Id ? "text-yellow-400" : "text-muted-foreground/50 line-through"}`}>{match.char2Name ?? "TBD"}</p>
        </div>
        {match.aiCommentary && (
          <button className="ml-2" onClick={() => setExpanded(v => !v)}>
            <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>
      {expanded && match.aiCommentary && (
        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="font-mono text-xs text-muted-foreground/70 mt-2 italic border-l-2 border-yellow-500/30 pl-2">
          {match.aiCommentary}
        </motion.p>
      )}
    </div>
  );
}

export default function TournamentPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"bracket" | "register" | "history">("bracket");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/tournament/current"],
    queryFn: () => fetch("/api/tournament/current").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/tournament/history"],
    queryFn: () => fetch("/api/tournament/history").then(r => r.json()),
    enabled: activeTab === "history",
  });

  const { data: myChar } = useQuery<any>({
    queryKey: ["/api/characters/my-character"],
    queryFn: () => fetch("/api/characters/my-character").then(r => r.json()),
    enabled: !!user,
  });

  const registerMut = useMutation({
    mutationFn: () => fetch("/api/tournament/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/tournament/current"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const simulateMut = useMutation({
    mutationFn: (tournamentId: string) => fetch("/api/tournament/simulate-round", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tournamentId }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      if (d.ended) toast.success(d.message, { duration: 6000 });
      else toast.success(`Vòng ${d.round} hoàn thành! ${d.remaining} người còn lại.`);
      qc.invalidateQueries({ queryKey: ["/api/tournament/current"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tournament = data?.tournament;
  const participants = data?.participants ?? [];
  const matches = data?.matches ?? [];

  const maxRound = matches.length > 0 ? Math.max(...matches.map((m: any) => m.round)) : 0;
  const isRegistered = participants.some((p: any) => p.characterId === myChar?.id);

  const groupedMatches: Record<number, any[]> = {};
  for (const m of matches) {
    if (!groupedMatches[m.round]) groupedMatches[m.round] = [];
    groupedMatches[m.round].push(m);
  }

  const tabs = [
    { id: "bracket",  label: "BRACKET",    icon: Trophy },
    { id: "register", label: "ĐĂNG KÝ",    icon: Users },
    { id: "history",  label: "LỊCH SỬ",    icon: History },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-yellow-400">ĐẠI HỘI VÕ LÂM</h1>
            <p className="font-mono text-xs text-muted-foreground">Giải đấu PvP toàn server — AI commentary — phần thưởng "Thiên Hạ Đệ Nhất"</p>
          </div>
        </div>

        {/* Tournament info */}
        {tournament && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Mùa", value: `#${tournament.season}`, color: "#eab308" },
              { label: "Trạng thái", value: tournament.status === "registration" ? "Đăng Ký" : tournament.status === "active" ? "Đang Diễn" : "Kết Thúc", color: tournament.status === "registration" ? "#22c55e" : tournament.status === "active" ? "#f97316" : "#6b7280" },
              { label: "Người Tham Gia", value: `${participants.length}/${tournament.maxParticipants}`, color: "#a855f7" },
              { label: "Giải Thưởng", value: `${tournament.prizePool} gold`, color: "#f97316" },
            ].map(s => (
              <div key={s.label} className="border border-border/40 bg-card/30 p-3 text-center">
                <p className="font-orbitron text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="font-mono text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Simulate btn (for active tournaments) */}
        {tournament?.status === "active" && (
          <Button className="font-mono text-xs bg-orange-600/20 text-orange-400 border border-orange-600/30"
            onClick={() => simulateMut.mutate(tournament.id)} disabled={simulateMut.isPending}>
            {simulateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
            Simulate Vòng Tiếp Theo
          </Button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-yellow-400 border-b-2 border-yellow-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-yellow-400" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "bracket" && (
              <motion.div key="bracket" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                {Object.keys(groupedMatches).length === 0 ? (
                  <div className="border border-border/30 bg-card/20 p-8 text-center">
                    <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="font-mono text-xs text-muted-foreground/50">Chưa có trận đấu nào. Đăng ký và simulate để bắt đầu!</p>
                  </div>
                ) : (
                  Object.entries(groupedMatches).sort(([a], [b]) => Number(b) - Number(a)).map(([round, roundMatches]) => (
                    <div key={round}>
                      <div className="flex items-center gap-2 mb-3">
                        <Sword className="w-4 h-4 text-yellow-400" />
                        <h3 className="font-orbitron text-xs text-yellow-400">{ROUND_LABELS[Number(round)] ?? `Vòng ${round}`}</h3>
                      </div>
                      <div className="space-y-2">
                        {(roundMatches as any[]).map((m: any) => <MatchCard key={m.id} match={m} />)}
                      </div>
                    </div>
                  ))
                )}
                {tournament?.status === "ended" && tournament?.winnerName && (
                  <div className="border border-yellow-500/40 bg-yellow-500/5 p-6 text-center">
                    <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="font-mono text-xs text-muted-foreground">THIÊN HẠ ĐỆ NHẤT MÙA {tournament.season}</p>
                    <p className="font-orbitron text-2xl font-black text-yellow-400">{tournament.winnerName}</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "register" && (
              <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="border border-green-500/20 bg-card/30 p-4 space-y-3 max-w-sm">
                  <p className="font-orbitron text-xs text-green-400">ĐĂNG KÝ THAM GIA</p>
                  <p className="font-mono text-xs text-muted-foreground/70">Phí đăng ký: 50 gold (vào prize pool)</p>
                  <p className="font-mono text-xs text-muted-foreground/70">Slot: {participants.length}/{tournament?.maxParticipants ?? 16}</p>
                  {isRegistered ? (
                    <div className="flex items-center gap-2 font-mono text-xs text-green-400">
                      <Trophy className="w-3.5 h-3.5" /> Đã đăng ký!
                    </div>
                  ) : tournament?.status === "registration" ? (
                    <Button className="w-full font-mono text-xs bg-green-600/20 text-green-400 border border-green-600/30" size="sm"
                      onClick={() => registerMut.mutate()} disabled={registerMut.isPending}>
                      {registerMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 mr-1" />}
                      Đăng Ký Chiến Đấu
                    </Button>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground/50">Giải không trong giai đoạn đăng ký</p>
                  )}
                </div>

                {/* Danh sách đã đăng ký */}
                <div>
                  <p className="font-mono text-xs text-muted-foreground mb-2">CHIẾN THỦ ĐÃ ĐĂNG KÝ ({participants.length})</p>
                  <div className="space-y-1.5">
                    {participants.map((p: any, i: number) => (
                      <div key={p.id} className={`border border-border/30 bg-card/20 px-3 py-2 flex items-center gap-3 ${p.isEliminated ? "opacity-40" : ""}`}>
                        <span className="font-mono text-xs text-muted-foreground/50 w-5">#{i + 1}</span>
                        <span className="font-mono text-xs flex-1">{p.characterName}</span>
                        <span className="font-mono text-xs text-muted-foreground/50">{p.worldSlug}</span>
                        {p.isEliminated && <span className="font-mono text-xs text-red-400/60">LOẠI</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "history" && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {history.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/40 py-8 text-center">Chưa có lịch sử</p>
                ) : (
                  history.map((t: any) => (
                    <div key={t.id} className="border border-border/30 bg-card/20 px-4 py-3 flex items-center gap-4">
                      <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-mono text-sm font-bold text-yellow-400">{t.winnerName ?? "?"}</p>
                        <p className="font-mono text-xs text-muted-foreground/60">Mùa #{t.season} · {t.participantCount} người</p>
                      </div>
                      <p className="font-mono text-xs text-yellow-400/70">{t.prizePool} gold</p>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
