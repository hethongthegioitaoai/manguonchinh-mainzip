import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Crown, Vote, ScrollText, Shield, ArrowLeft, Loader2, Plus, CheckCircle, XCircle, ChevronDown, ChevronUp, Swords, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

function StabilityBar({ value }: { value: number }) {
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#eab308" : "#ef4444";
  const label = value >= 70 ? "Ổn Định" : value >= 40 ? "Bất Ổn" : "Hỗn Loạn";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-mono text-xs text-muted-foreground">Chỉ số ổn định</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{value}/100 — {label}</span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function VoteCard({ vote, onVote, userCharId }: { vote: any; onVote: (voteId: string, support: boolean) => void; userCharId?: string }) {
  const voters = vote.voters as string[] || [];
  const hasVoted = userCharId ? voters.includes(userCharId) : false;
  const total = vote.votesFor + vote.votesAgainst || 1;
  const forPct = Math.round((vote.votesFor / total) * 100);
  const typeColor: Record<string, string> = { law: "#22c55e", tax: "#eab308", war_declaration: "#ef4444", trade_policy: "#3b82f6", other: "#a855f7" };

  return (
    <div className="border border-border/50 bg-card/30 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs border px-2 py-0.5" style={{ color: typeColor[vote.proposalType] ?? "#94a3b8", borderColor: typeColor[vote.proposalType] + "40" ?? "#94a3b8" }}>
              {vote.proposalType.toUpperCase().replace("_", " ")}
            </span>
            {vote.status === "open" && <span className="font-mono text-xs text-green-400 border border-green-400/30 px-2 py-0.5">ĐANG MỞ</span>}
            {vote.status === "passed" && <span className="font-mono text-xs text-blue-400 border border-blue-400/30 px-2 py-0.5">ĐÃ THÔNG QUA</span>}
            {vote.status === "failed" && <span className="font-mono text-xs text-red-400 border border-red-400/30 px-2 py-0.5">BỊ BÁC BỎ</span>}
          </div>
          <p className="font-orbitron text-sm font-bold">{vote.proposalTitle}</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">{vote.proposalContent}</p>
        </div>
      </div>

      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${forPct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-xs">
        <span className="text-green-400">✓ {vote.votesFor} phiếu ({forPct}%)</span>
        <span className="text-red-400">✗ {vote.votesAgainst} phiếu ({100 - forPct}%)</span>
      </div>

      {vote.status === "open" && userCharId && !hasVoted && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 font-mono text-xs h-7 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
            onClick={() => onVote(vote.id, true)}>
            <CheckCircle className="w-3 h-3 mr-1" /> Đồng Thuận
          </Button>
          <Button size="sm" className="flex-1 font-mono text-xs h-7 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30"
            onClick={() => onVote(vote.id, false)}>
            <XCircle className="w-3 h-3 mr-1" /> Phản Đối
          </Button>
        </div>
      )}
      {hasVoted && <p className="font-mono text-xs text-muted-foreground/50 text-center">Bạn đã bỏ phiếu</p>}
    </div>
  );
}

export default function GovernancePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "vote" | "decree" | "history">("overview");
  const [selectedWorld, setSelectedWorld] = useState("");
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [showDecreeForm, setShowDecreeForm] = useState(false);
  const [proposeType, setProposeType] = useState("law");
  const [proposeTitle, setProposeTitle] = useState("");
  const [proposeContent, setProposeContent] = useState("");
  const [decreeName, setDecreeName] = useState("");
  const [decreeContent, setDecreeContent] = useState("");
  const [stabilityDelta, setStabilityDelta] = useState("0");

  const { data: mapData } = useQuery<any>({
    queryKey: ["/api/diplomacy/map"],
    queryFn: () => fetch("/api/diplomacy/map").then(r => r.json()),
  });
  const allWorlds = mapData?.worlds ?? [];

  const { data: govData, isLoading } = useQuery<any>({
    queryKey: ["/api/governance", selectedWorld],
    queryFn: () => fetch(`/api/governance/${selectedWorld}`).then(r => r.json()),
    enabled: !!selectedWorld,
  });

  const { data: historyData } = useQuery<any>({
    queryKey: ["/api/governance/history", selectedWorld],
    queryFn: () => fetch(`/api/governance/${selectedWorld}/history`).then(r => r.json()),
    enabled: !!selectedWorld && activeTab === "history",
  });

  const { data: myChar } = useQuery<any>({
    queryKey: ["/api/characters/my-character"],
    queryFn: () => fetch("/api/characters/my-character").then(r => r.json()),
    enabled: !!user,
  });

  const proposeMut = useMutation({
    mutationFn: (body: any) => fetch(`/api/governance/propose/${selectedWorld}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Đề xuất đã được gửi! Hội đồng có 48h để bỏ phiếu.");
      setProposeTitle(""); setProposeContent(""); setShowProposeForm(false);
      qc.invalidateQueries({ queryKey: ["/api/governance", selectedWorld] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const voteMut = useMutation({
    mutationFn: ({ voteId, support }: any) => fetch(`/api/governance/vote/${voteId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ support, characterId: myChar?.id }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Đã bỏ phiếu!");
      qc.invalidateQueries({ queryKey: ["/api/governance", selectedWorld] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decreeMut = useMutation({
    mutationFn: (body: any) => fetch(`/api/governance/decree/${selectedWorld}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Sắc lệnh đã được ban hành!");
      setDecreeName(""); setDecreeContent(""); setStabilityDelta("0"); setShowDecreeForm(false);
      qc.invalidateQueries({ queryKey: ["/api/governance", selectedWorld] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tabs = [
    { id: "overview", label: "TỔNG QUAN",   icon: Scale },
    { id: "vote",     label: "BỎ PHIẾU",    icon: Vote },
    { id: "decree",   label: "SẮC LỆNH",    icon: Crown },
    { id: "history",  label: "LỊCH SỬ",     icon: ScrollText },
  ] as const;

  const constitution = govData?.constitution;
  const stability = constitution?.stability ?? 75;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-green-400">QUẢN TRỊ THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Hiến pháp — Hội đồng — Bỏ phiếu — Sắc lệnh</p>
          </div>
        </div>

        {/* Chọn thế giới */}
        <div className="flex items-center gap-3">
          <Select value={selectedWorld} onValueChange={setSelectedWorld}>
            <SelectTrigger className="font-mono text-xs max-w-xs"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
            <SelectContent>
              {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {constitution && (
            <div className="flex-1 max-w-xs">
              <StabilityBar value={stability} />
            </div>
          )}
        </div>

        {!selectedWorld && (
          <div className="border border-border/30 bg-card/20 p-8 text-center">
            <Scale className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-mono text-xs text-muted-foreground/50">Chọn thế giới để xem hệ thống quản trị</p>
          </div>
        )}

        {selectedWorld && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                      activeTab === t.id ? "text-green-400 border-b-2 border-green-400" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{t.label}
                    {t.id === "vote" && govData?.openVotes?.length > 0 && (
                      <span className="font-mono text-xs bg-green-400/20 text-green-400 px-1.5 rounded-full">{govData.openVotes.length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-green-400" /></div>
            ) : (
              <AnimatePresence mode="wait">
                {/* Tab: Tổng quan */}
                {activeTab === "overview" && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    {/* Chính sách */}
                    {constitution && (
                      <div className="grid md:grid-cols-3 gap-3">
                        {[
                          { label: "CHÍNH SÁCH NHẬP CỬ", value: constitution.entryPolicy, icon: Shield, map: { open: "Mở cửa", restricted: "Hạn chế", closed: "Đóng cửa" } },
                          { label: "CHÍNH SÁCH THƯƠNG MẠI", value: constitution.tradePolicy, icon: TrendingUp, map: { free: "Tự do", protected: "Bảo hộ", embargo: "Cấm vận" } },
                          { label: "CHÍNH SÁCH CHIẾN TRANH", value: constitution.warPolicy, icon: Swords, map: { aggressive: "Xâm lược", defensive: "Phòng thủ", pacifist: "Hòa bình" } },
                        ].map(p => {
                          const Icon = p.icon;
                          return (
                            <div key={p.label} className="border border-border/50 bg-card/30 p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">{p.label}</span>
                              </div>
                              <p className="font-orbitron text-sm font-bold text-foreground">{(p.map as any)[p.value] ?? p.value}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Thuế */}
                    {constitution?.taxPolicy && (
                      <div className="border border-yellow-500/20 bg-card/30 p-3">
                        <p className="font-mono text-xs text-yellow-400 mb-1">CHÍNH SÁCH THUẾ</p>
                        <p className="font-orbitron text-sm font-bold text-yellow-300">{(constitution.taxPolicy as any).rate}% — {(constitution.taxPolicy as any).target}</p>
                        <p className="font-mono text-xs text-muted-foreground">{(constitution.taxPolicy as any).description}</p>
                      </div>
                    )}

                    {/* Hội đồng */}
                    <div className="border border-border/50 bg-card/30 p-4">
                      <p className="font-mono text-xs text-muted-foreground mb-3">HỘI ĐỒNG ({govData?.council?.length ?? 0} thành viên)</p>
                      {!govData?.council?.length ? (
                        <p className="font-mono text-xs text-muted-foreground/50">Hội đồng trống — owner có thể bổ nhiệm thành viên</p>
                      ) : (
                        <div className="space-y-2">
                          {govData.council.map((m: any) => {
                            const roleColors: Record<string, string> = { minister: "#a855f7", ambassador: "#3b82f6", citizen_rep: "#22c55e" };
                            return (
                              <div key={m.id} className="flex items-center gap-3 border border-border/30 bg-card/20 px-3 py-2">
                                <span className="font-mono text-xs flex-1">{m.characterName}</span>
                                <span className="font-mono text-xs" style={{ color: roleColors[m.role] ?? "#94a3b8" }}>
                                  {m.role === "minister" ? "Bộ Trưởng" : m.role === "ambassador" ? "Đại Sứ" : "Đại Diện Dân"}
                                </span>
                                <span className="font-mono text-xs text-yellow-400">{m.votingPower}x phiếu</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Luật hiện hành */}
                    {constitution?.laws && (constitution.laws as any[]).length > 0 && (
                      <div className="border border-border/50 bg-card/30 p-4">
                        <p className="font-mono text-xs text-muted-foreground mb-3">LUẬT HIỆN HÀNH ({(constitution.laws as any[]).length})</p>
                        <div className="space-y-2">
                          {(constitution.laws as any[]).map((law: any) => (
                            <div key={law.id} className="border border-border/20 bg-card/20 px-3 py-2">
                              <p className="font-mono text-xs font-bold text-green-400">{law.title}</p>
                              <p className="font-mono text-xs text-muted-foreground/70">{law.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Tab: Bỏ phiếu */}
                {activeTab === "vote" && (
                  <motion.div key="vote" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="font-mono text-xs text-muted-foreground">{govData?.openVotes?.length ?? 0} đề xuất đang mở · 48h hết hạn</p>
                      <Button size="sm" variant="outline" className="font-mono text-xs h-7"
                        onClick={() => setShowProposeForm(!showProposeForm)}>
                        <Plus className="w-3 h-3 mr-1" /> Đề Xuất Mới
                      </Button>
                    </div>

                    {showProposeForm && (
                      <div className="border border-green-500/30 bg-card/30 p-4 space-y-3">
                        <p className="font-orbitron text-xs text-green-400">ĐỀ XUẤT LUẬT/NGHỊ QUYẾT</p>
                        <Select value={proposeType} onValueChange={setProposeType}>
                          <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="law" className="font-mono text-xs">Luật Mới</SelectItem>
                            <SelectItem value="tax" className="font-mono text-xs">Chính Sách Thuế</SelectItem>
                            <SelectItem value="trade_policy" className="font-mono text-xs">Chính Sách Thương Mại</SelectItem>
                            <SelectItem value="entry_policy" className="font-mono text-xs">Chính Sách Nhập Cửa</SelectItem>
                            <SelectItem value="other" className="font-mono text-xs">Khác</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input value={proposeTitle} onChange={e => setProposeTitle(e.target.value)} placeholder="Tên đề xuất..." className="font-mono text-xs" />
                        <Textarea value={proposeContent} onChange={e => setProposeContent(e.target.value)} placeholder="Nội dung đề xuất..." className="font-mono text-xs resize-none h-20" />
                        <Button className="w-full font-mono text-xs" size="sm"
                          onClick={() => proposeMut.mutate({ proposalType: proposeType, proposalTitle: proposeTitle, proposalContent: proposeContent })}
                          disabled={!proposeTitle || !proposeContent || proposeMut.isPending}>
                          {proposeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Vote className="w-3 h-3 mr-1" />} Gửi Đề Xuất
                        </Button>
                      </div>
                    )}

                    {!govData?.openVotes?.length ? (
                      <p className="font-mono text-xs text-muted-foreground/50">Không có đề xuất nào đang mở</p>
                    ) : (
                      govData.openVotes.map((vote: any) => (
                        <VoteCard key={vote.id} vote={vote} userCharId={myChar?.id}
                          onVote={(voteId, support) => voteMut.mutate({ voteId, support })} />
                      ))
                    )}
                  </motion.div>
                )}

                {/* Tab: Sắc lệnh */}
                {activeTab === "decree" && (
                  <motion.div key="decree" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="font-mono text-xs text-muted-foreground">{govData?.decrees?.length ?? 0} sắc lệnh đang hiệu lực</p>
                      <Button size="sm" variant="outline" className="font-mono text-xs h-7"
                        onClick={() => setShowDecreeForm(!showDecreeForm)}>
                        <Crown className="w-3 h-3 mr-1" /> Ban Hành Sắc Lệnh
                      </Button>
                    </div>

                    {showDecreeForm && (
                      <div className="border border-yellow-500/30 bg-card/30 p-4 space-y-3">
                        <p className="font-orbitron text-xs text-yellow-400">BAN HÀNH SẮC LỆNH (chỉ owner)</p>
                        <p className="font-mono text-xs text-muted-foreground/60">AI sẽ sinh lore text phù hợp phong cách thế giới</p>
                        <Input value={decreeName} onChange={e => setDecreeName(e.target.value)} placeholder="Tên sắc lệnh..." className="font-mono text-xs" />
                        <Textarea value={decreeContent} onChange={e => setDecreeContent(e.target.value)} placeholder="Nội dung sắc lệnh..." className="font-mono text-xs resize-none h-20" />
                        <div className="space-y-1">
                          <label className="font-mono text-xs text-muted-foreground">Tác động đến ổn định (-30 đến +30)</label>
                          <Input type="number" min="-30" max="30" value={stabilityDelta}
                            onChange={e => setStabilityDelta(e.target.value)} className="font-mono text-xs" />
                        </div>
                        <Button className="w-full font-mono text-xs bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30" size="sm"
                          onClick={() => decreeMut.mutate({ decreeName, decreeContent, stabilityDelta: parseInt(stabilityDelta) || 0, effect: {} })}
                          disabled={!decreeName || !decreeContent || decreeMut.isPending}>
                          {decreeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown className="w-3 h-3 mr-1" />} Phong Ấn Sắc Lệnh
                        </Button>
                      </div>
                    )}

                    {!govData?.decrees?.length ? (
                      <p className="font-mono text-xs text-muted-foreground/50">Chưa có sắc lệnh nào đang hiệu lực</p>
                    ) : (
                      govData.decrees.map((d: any) => (
                        <div key={d.id} className="border border-yellow-500/20 bg-card/30 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-orbitron text-sm font-bold text-yellow-300">{d.decreeName}</p>
                            {d.stabilityDelta !== 0 && (
                              <span className={`font-mono text-xs flex items-center gap-1 ${d.stabilityDelta > 0 ? "text-green-400" : "text-red-400"}`}>
                                {d.stabilityDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {d.stabilityDelta > 0 ? "+" : ""}{d.stabilityDelta}
                              </span>
                            )}
                          </div>
                          {d.loreText && <p className="font-mono text-xs text-yellow-200/60 italic leading-relaxed">{d.loreText}</p>}
                          <p className="font-mono text-xs text-muted-foreground/60">— {d.issuerName}</p>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {/* Tab: Lịch sử */}
                {activeTab === "history" && (
                  <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <p className="font-mono text-xs text-muted-foreground">Tất cả votes và sắc lệnh trong lịch sử</p>
                    {historyData?.votes?.map((vote: any) => (
                      <VoteCard key={vote.id} vote={vote} userCharId={undefined} onVote={() => {}} />
                    ))}
                    {!historyData?.votes?.length && <p className="font-mono text-xs text-muted-foreground/50">Chưa có lịch sử nào</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}
