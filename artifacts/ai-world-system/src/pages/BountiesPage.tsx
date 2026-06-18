import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Skull, Trophy, ArrowLeft, Loader2, Plus, Clock, Crown, AlertCircle, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLOR: Record<string, string> = {
  active:    "#ef4444",
  claimed:   "#22c55e",
  expired:   "#6b7280",
  cancelled: "#94a3b8",
};

function BountyCard({ bounty, myCharId, onClaim, onCancel }: {
  bounty: any; myCharId?: string; onClaim: (id: string) => void; onCancel: (id: string) => void;
}) {
  const isOwner = bounty.postedByCharId === myCharId;
  const isTarget = bounty.targetCharId === myCharId;
  const canClaim = !isOwner && !isTarget && bounty.status === "active";
  const canCancel = isOwner && bounty.status === "active";
  const now = Date.now();
  const expires = new Date(bounty.expiresAt).getTime();
  const hoursLeft = Math.max(0, Math.floor((expires - now) / 3600000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="border border-red-500/20 bg-card/30 p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-400" />
          <div>
            <p className="font-mono text-sm font-bold text-red-400">{bounty.targetCharName}</p>
            <p className="font-mono text-xs text-muted-foreground/60">{bounty.targetWorldSlug}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-orbitron text-lg font-black text-yellow-400">{bounty.reward.toLocaleString()}</p>
          <p className="font-mono text-xs text-muted-foreground/60">gold</p>
        </div>
      </div>

      {bounty.reason && (
        <p className="font-mono text-xs text-muted-foreground/80 border-l-2 border-red-500/30 pl-2 italic">"{bounty.reason}"</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground/50">Đặt bởi: <span className="text-foreground/70">{bounty.postedByName}</span></span>
          {bounty.status === "active" && <span className="font-mono text-xs text-yellow-400/70"><Clock className="w-3 h-3 inline mr-1" />{hoursLeft}h</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs px-2 py-0.5 border`} style={{ color: STATUS_COLOR[bounty.status], borderColor: STATUS_COLOR[bounty.status] + "40" }}>
            {bounty.status === "active" ? "ACTIVE" : bounty.status === "claimed" ? `✓ ${bounty.claimedByName ?? "?"}` : bounty.status.toUpperCase()}
          </span>
          {canClaim && (
            <Button size="sm" className="font-mono text-xs h-7 bg-green-600/20 text-green-400 border border-green-600/30"
              onClick={() => onClaim(bounty.id)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Claim
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" className="font-mono text-xs h-7 text-muted-foreground hover:text-red-400"
              onClick={() => onCancel(bounty.id)}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function BountiesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"board" | "leaderboard" | "my">("board");
  const [postOpen, setPostOpen] = useState(false);
  const [targetCharId, setTargetCharId] = useState("");
  const [reward, setReward] = useState("");
  const [reason, setReason] = useState("");

  const { data: activeBounties = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/bounties/active"],
    queryFn: () => fetch("/api/bounties/active").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: myData } = useQuery<any>({
    queryKey: ["/api/bounties/my"],
    queryFn: () => fetch("/api/bounties/my").then(r => r.json()),
    enabled: !!user && activeTab === "my",
  });

  const { data: leaderboard = [] } = useQuery<any[]>({
    queryKey: ["/api/bounties/leaderboard"],
    queryFn: () => fetch("/api/bounties/leaderboard").then(r => r.json()),
    enabled: activeTab === "leaderboard",
  });

  const postMut = useMutation({
    mutationFn: (body: any) => fetch("/api/bounties/post", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(d.message);
      setPostOpen(false); setTargetCharId(""); setReward(""); setReason("");
      qc.invalidateQueries({ queryKey: ["/api/bounties"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const claimMut = useMutation({
    mutationFn: (bountyId: string) => fetch(`/api/bounties/claim/${bountyId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: "" }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/bounties"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (bountyId: string) => fetch(`/api/bounties/${bountyId}`, { method: "DELETE" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/bounties"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const myCharId = myData?.charId;
  const tabs = [
    { id: "board",       label: "BẢNG TRUY NÃ", icon: Target },
    { id: "leaderboard", label: "DANH SÁCH ĐEN",  icon: Crown },
    { id: "my",          label: "CỦA TÔI",       icon: Trophy },
  ] as const;

  const totalBounties = activeBounties.length;
  const totalReward = activeBounties.reduce((s: number, b: any) => s + (b.reward ?? 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold tracking-wider text-red-400">BẢNG TRUY NÃ</h1>
              <p className="font-mono text-xs text-muted-foreground">Đặt tiền truy nã — hạ mục tiêu nhận thưởng — thợ săn tiền thưởng</p>
            </div>
          </div>
          <Button size="sm" className="font-mono text-xs bg-red-600/20 text-red-400 border border-red-600/30"
            onClick={() => setPostOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Đặt Truy Nã
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bounty Active", value: totalBounties, color: "#ef4444" },
            { label: "Tổng Tiền Thưởng", value: totalReward.toLocaleString(), color: "#eab308" },
            { label: "Kẻ Thù Thiên Hạ", value: activeBounties[0]?.targetCharName ?? "—", color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="border border-border/50 bg-card/30 p-3 text-center">
              <div className="font-orbitron text-sm font-bold truncate" style={{ color: s.color }}>{s.value}</div>
              <div className="font-mono text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Post bounty form */}
        <AnimatePresence>
          {postOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="border border-red-500/30 bg-red-500/5 p-4 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="font-orbitron text-xs text-red-400">ĐẶT TIỀN TRUY NÃ</p>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPostOpen(false)}><X className="w-3 h-3" /></Button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted-foreground">ID nhân vật mục tiêu</label>
                  <Input value={targetCharId} onChange={e => setTargetCharId(e.target.value)}
                    placeholder="UUID nhân vật..." className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-xs text-muted-foreground">Tiền thưởng (tối thiểu 100 gold)</label>
                  <Input type="number" value={reward} onChange={e => setReward(e.target.value)}
                    placeholder="100+" className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-xs text-muted-foreground">Lý do truy nã</label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Kẻ này đã dám cướp bảo vật của ta..." className="font-mono text-xs resize-none h-16" />
              </div>
              <Button size="sm" className="font-mono text-xs bg-red-600/20 text-red-400 border border-red-600/30 w-full"
                onClick={() => postMut.mutate({ targetCharId, reward: parseInt(reward), reason })}
                disabled={!targetCharId || !reward || parseInt(reward) < 100 || postMut.isPending}>
                {postMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5 mr-1" />} Công Bố Truy Nã
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

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
          {/* Tab: Bảng Truy Nã */}
          {activeTab === "board" && (
            <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-red-400" /></div>
              ) : activeBounties.length === 0 ? (
                <div className="border border-border/30 bg-card/20 p-8 text-center">
                  <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-mono text-xs text-muted-foreground/50">Chưa có lệnh truy nã nào đang active</p>
                </div>
              ) : (
                activeBounties.map((b: any) => (
                  <BountyCard key={b.id} bounty={b} myCharId={myCharId}
                    onClaim={id => claimMut.mutate(id)}
                    onCancel={id => cancelMut.mutate(id)} />
                ))
              )}
            </motion.div>
          )}

          {/* Tab: Leaderboard */}
          {activeTab === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground/60">Những nhân vật bị truy nã nhiều nhất toàn server</p>
              {leaderboard.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/40 py-8 text-center">Chưa có dữ liệu</p>
              ) : (
                leaderboard.map((item: any, idx: number) => (
                  <div key={item.target_char_id} className="border border-red-500/20 bg-card/30 px-4 py-3 flex items-center gap-4">
                    <span className="font-orbitron text-2xl font-black w-8 text-center" style={{ color: idx === 0 ? "#eab308" : idx === 1 ? "#94a3b8" : idx === 2 ? "#cd7f32" : "#6b7280" }}>
                      #{idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-mono text-sm font-bold text-red-400">{item.target_char_name}</p>
                      <p className="font-mono text-xs text-muted-foreground/60">{item.target_world_slug} · {item.bounty_count} lệnh</p>
                    </div>
                    <div className="text-right">
                      <p className="font-orbitron text-base font-bold text-yellow-400">{parseInt(item.total_reward).toLocaleString()}</p>
                      <p className="font-mono text-xs text-muted-foreground/50">gold truy nã</p>
                    </div>
                    {idx === 0 && <div className="font-mono text-xs text-red-400 border border-red-400/30 px-2 py-1">KẺ THÙ THIÊN HẠ</div>}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* Tab: Của tôi */}
          {activeTab === "my" && (
            <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Đặt bởi tôi */}
              <div>
                <p className="font-mono text-xs text-muted-foreground mb-2">TÔI ĐÃ ĐẶT ({myData?.posted?.length ?? 0})</p>
                {myData?.posted?.length === 0 && <p className="font-mono text-xs text-muted-foreground/40">Chưa đặt truy nã nào</p>}
                {myData?.posted?.map((b: any) => (
                  <BountyCard key={b.id} bounty={b} myCharId={myCharId}
                    onClaim={id => claimMut.mutate(id)} onCancel={id => cancelMut.mutate(id)} />
                ))}
              </div>
              {/* Bị truy nã */}
              <div>
                <p className="font-mono text-xs text-muted-foreground mb-2">TÔI BỊ TRUY NÃ ({myData?.targeted?.filter((b: any) => b.status === "active").length ?? 0})</p>
                {myData?.targeted?.filter((b: any) => b.status === "active").length === 0
                  ? <p className="font-mono text-xs text-muted-foreground/40">Không có lệnh truy nã nào nhắm vào bạn</p>
                  : myData?.targeted?.filter((b: any) => b.status === "active").map((b: any) => (
                    <div key={b.id} className="border border-red-500/30 bg-card/30 px-4 py-3 flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <div className="flex-1"><p className="font-mono text-xs">Bị truy nã bởi <span className="text-red-400">{b.postedByName}</span></p></div>
                      <p className="font-orbitron text-sm text-yellow-400">{b.reward.toLocaleString()} gold</p>
                    </div>
                  ))
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
