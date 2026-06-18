import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Shield, Trophy, Clock, Skull, Zap, ScrollText, ChevronDown, ChevronUp, ArrowLeft, Loader2, Flag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

function WarCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return (
    <span className="font-mono text-xs text-yellow-400">
      ⏱ {h}h {m}m còn lại
    </span>
  );
}

function WarCard({ war, onSelect, selected }: { war: any; onSelect: (id: string) => void; selected: boolean }) {
  const attackWins = war.attackerScore >= war.defenderScore;
  const total = war.attackerScore + war.defenderScore || 1;
  const attackPct = Math.round((war.attackerScore / total) * 100);

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      onClick={() => onSelect(war.id)}
      className={`border cursor-pointer p-4 transition-all ${selected ? "border-red-500/60 bg-red-500/5" : "border-border/50 bg-card/30 hover:border-border"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-red-400" />
          <span className="font-orbitron text-sm font-bold text-red-400">CHIẾN TRANH</span>
          {war.status === "active" ? (
            <span className="font-mono text-xs border border-red-500/40 text-red-400 px-2 py-0.5">ĐANG DIỄN RA</span>
          ) : (
            <span className="font-mono text-xs border border-muted-foreground/20 text-muted-foreground px-2 py-0.5">ĐÃ KẾT THÚC</span>
          )}
        </div>
        {war.status === "active" && <WarCountdown endsAt={war.endsAt} />}
        {war.status === "ended" && war.winnerId && (
          <span className="font-mono text-xs text-yellow-400 flex items-center gap-1">
            <Trophy className="w-3 h-3" /> {war.winnerId === war.attackerWorldSlug ? war.attackerWorldName : war.defenderWorldName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-right">
          <div className="font-orbitron text-sm font-bold text-red-300">{war.attackerWorldName}</div>
          <div className="font-mono text-xs text-muted-foreground">Tấn công</div>
        </div>
        <div className="text-center px-3">
          <div className="font-orbitron text-lg font-black text-foreground">
            {war.attackerScore} <span className="text-muted-foreground/40">vs</span> {war.defenderScore}
          </div>
        </div>
        <div className="flex-1">
          <div className="font-orbitron text-sm font-bold text-blue-300">{war.defenderWorldName}</div>
          <div className="font-mono text-xs text-muted-foreground">Phòng thủ</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
          style={{ width: `${attackPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-xs text-red-400">{attackPct}%</span>
        <span className="font-mono text-xs text-blue-400">{100 - attackPct}%</span>
      </div>

      {war.warBulletin && (
        <p className="font-mono text-xs text-muted-foreground/70 mt-2 border-t border-border/30 pt-2 leading-relaxed line-clamp-2">{war.warBulletin}</p>
      )}
    </motion.div>
  );
}

export default function WorldWarPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"active" | "declare" | "history">("active");
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null);
  const [fromWorld, setFromWorld] = useState("");
  const [targetWorld, setTargetWorld] = useState("");
  const [warReason, setWarReason] = useState("");
  const [showContribs, setShowContribs] = useState(false);

  const { data: activeWars = [], isLoading: activeLoading } = useQuery<any[]>({
    queryKey: ["/api/world-war/active"],
    queryFn: () => fetch("/api/world-war/active").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: warHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/world-war/history"],
    queryFn: () => fetch("/api/world-war/history").then(r => r.json()),
  });

  const { data: warDetail } = useQuery<any>({
    queryKey: ["/api/world-war", selectedWarId],
    queryFn: () => fetch(`/api/world-war/${selectedWarId}`).then(r => r.json()),
    enabled: !!selectedWarId,
    refetchInterval: 15000,
  });

  const { data: mapData } = useQuery<any>({
    queryKey: ["/api/diplomacy/map"],
    queryFn: () => fetch("/api/diplomacy/map").then(r => r.json()),
  });

  const allWorlds = mapData?.worlds ?? [];
  const otherWorlds = allWorlds.filter((w: any) => w.slug !== fromWorld);

  const declareMut = useMutation({
    mutationFn: (body: any) => fetch(`/api/world-war/declare/${body.targetWorldSlug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWorldSlug: body.fromWorldSlug, reason: body.reason }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success("Tuyên chiến thành công! Chiến tranh bắt đầu!");
      setWarReason("");
      setSelectedWarId(d.war.id);
      setActiveTab("active");
      qc.invalidateQueries({ queryKey: ["/api/world-war"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const surrenderMut = useMutation({
    mutationFn: ({ warId, worldSlug }: any) => fetch(`/api/world-war/${warId}/surrender`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldSlug }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(d.message);
      qc.invalidateQueries({ queryKey: ["/api/world-war"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulletinMut = useMutation({
    mutationFn: (warId: string) => fetch(`/api/world-war/${warId}/bulletin`, {
      method: "POST",
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Tường thuật chiến sự đã cập nhật!");
      qc.invalidateQueries({ queryKey: ["/api/world-war"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tabs = [
    { id: "active", label: "ĐANG DIỄN RA", icon: Swords },
    { id: "declare", label: "TUYÊN CHIẾN", icon: Flag },
    { id: "history", label: "LỊCH SỬ CHIẾN", icon: ScrollText },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-red-400">CHIẾN TRANH THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Tuyên chiến — PvP tích điểm — thế giới thắng chiếm kho bạc đối phương</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Swords, label: "Đang Chiến", value: activeWars.length, color: "#ef4444" },
            { icon: Trophy, label: "Đã Kết Thúc", value: warHistory.length, color: "#eab308" },
            { icon: Skull, label: "Tổng Trận", value: activeWars.length + warHistory.length, color: "#a855f7" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="border border-border/50 bg-card/30 p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
                <div className="font-orbitron text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="font-mono text-xs text-muted-foreground">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-red-400 border-b-2 border-red-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Tab: Đang Diễn Ra */}
          {activeTab === "active" && (
            <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {activeLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-red-400" /></div>
              ) : activeWars.length === 0 ? (
                <div className="border border-border/30 bg-card/20 p-8 text-center">
                  <Swords className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-mono text-sm text-muted-foreground/50">Hiện không có chiến tranh nào đang diễn ra</p>
                  <Button className="mt-4 font-mono text-xs" variant="outline" onClick={() => setActiveTab("declare")}>
                    Tuyên Chiến Ngay
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWars.map((war: any) => (
                    <WarCard key={war.id} war={war} onSelect={setSelectedWarId} selected={selectedWarId === war.id} />
                  ))}
                </div>
              )}

              {/* Chi tiết chiến tranh được chọn */}
              {selectedWarId && warDetail && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="border border-red-500/30 bg-card/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-orbitron text-sm text-red-400">CHI TIẾT CHIẾN TRANH</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="font-mono text-xs h-7"
                        onClick={() => bulletinMut.mutate(selectedWarId)} disabled={bulletinMut.isPending}>
                        {bulletinMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScrollText className="w-3 h-3 mr-1" />}
                        Tường Thuật AI
                      </Button>
                    </div>
                  </div>

                  {warDetail.war.warBulletin && (
                    <div className="border border-yellow-500/20 bg-yellow-500/5 p-3">
                      <p className="font-mono text-xs text-yellow-300/80 leading-relaxed">{warDetail.war.warBulletin}</p>
                    </div>
                  )}

                  {/* Bảng đóng góp */}
                  <div>
                    <button onClick={() => setShowContribs(!showContribs)}
                      className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                      {showContribs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      BẢNG ĐÓNG GÓP ({warDetail.contributions?.length ?? 0} chiến binh)
                    </button>
                    {showContribs && (
                      <div className="mt-2 space-y-1.5">
                        {warDetail.contributions?.length === 0 ? (
                          <p className="font-mono text-xs text-muted-foreground/50">Chưa có đóng góp nào</p>
                        ) : (
                          warDetail.contributions?.map((c: any, i: number) => (
                            <div key={c.id} className="flex items-center gap-3 border border-border/30 bg-card/20 px-3 py-2">
                              <span className="font-orbitron text-xs text-muted-foreground w-6">#{i + 1}</span>
                              <span className="font-mono text-xs flex-1">{c.characterName}</span>
                              <span className="font-mono text-xs text-muted-foreground">[{c.worldSlug}]</span>
                              <span className="font-mono text-xs text-red-400">{c.pvpKills} kills</span>
                              <span className="font-orbitron text-xs text-yellow-400">{c.contribution} pts</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Đầu hàng */}
                  {warDetail.war.status === "active" && (
                    <div className="border-t border-border/30 pt-3">
                      <p className="font-mono text-xs text-muted-foreground mb-2">ĐẦU HÀNG SỚM — mất 30% kho bạc thay vì 50%</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="font-mono text-xs h-7"
                          onClick={() => surrenderMut.mutate({ warId: selectedWarId, worldSlug: warDetail.war.attackerWorldSlug })}
                          disabled={surrenderMut.isPending}>
                          <Flag className="w-3 h-3 mr-1" />
                          {warDetail.war.attackerWorldName} Đầu Hàng
                        </Button>
                        <Button size="sm" variant="destructive" className="font-mono text-xs h-7"
                          onClick={() => surrenderMut.mutate({ warId: selectedWarId, worldSlug: warDetail.war.defenderWorldSlug })}
                          disabled={surrenderMut.isPending}>
                          <Flag className="w-3 h-3 mr-1" />
                          {warDetail.war.defenderWorldName} Đầu Hàng
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Tab: Tuyên Chiến */}
          {activeTab === "declare" && (
            <motion.div key="declare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="border border-red-500/30 bg-card/30 p-5 space-y-4 max-w-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="w-5 h-5 text-red-400" />
                  <p className="font-orbitron text-sm text-red-400">KHAI CHIẾN</p>
                </div>
                <div className="border border-yellow-500/20 bg-yellow-500/5 p-3">
                  <p className="font-mono text-xs text-yellow-400/80">
                    ⚠️ Chiến tranh kéo dài 72h. Thế giới thắng (điểm PvP cao hơn) nhận 20% kho bạc đối phương. Không thể tuyên chiến đồng minh.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted-foreground">Thế giới của bạn</label>
                  <Select value={fromWorld} onValueChange={setFromWorld}>
                    <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
                    <SelectContent>
                      {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted-foreground">Tuyên chiến với</label>
                  <Select value={targetWorld} onValueChange={setTargetWorld}>
                    <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Thế giới mục tiêu..." /></SelectTrigger>
                    <SelectContent>
                      {otherWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted-foreground">Lý do khai chiến</label>
                  <Textarea value={warReason} onChange={e => setWarReason(e.target.value)}
                    placeholder="Vì danh dự, lãnh thổ, hay chỉ vì muốn chinh phục..." className="font-mono text-xs resize-none h-20" />
                </div>

                <Button className="w-full font-orbitron text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30"
                  onClick={() => declareMut.mutate({ fromWorldSlug: fromWorld, targetWorldSlug: targetWorld, reason: warReason })}
                  disabled={!fromWorld || !targetWorld || declareMut.isPending}>
                  {declareMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4 mr-2" />}
                  TUYÊN CHIẾN
                </Button>
              </div>
            </motion.div>
          )}

          {/* Tab: Lịch Sử */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {warHistory.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/50">Chưa có chiến tranh nào kết thúc</p>
              ) : (
                warHistory.map((war: any) => (
                  <WarCard key={war.id} war={war} onSelect={setSelectedWarId} selected={selectedWarId === war.id} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
