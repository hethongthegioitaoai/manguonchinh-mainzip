import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Handshake, Shield, Sword, Building2, AlertTriangle, CheckCircle, XCircle, ScrollText, Users, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  neutral:       { label: "Trung Lập",         color: "#64748b", icon: Globe,     desc: "Không có hiệp ước nào" },
  ally:          { label: "Liên Minh",          color: "#22d3ee", icon: Shield,    desc: "Liên minh phòng thủ — giảm 50% thuế giao thương" },
  trade_partner: { label: "Đối Tác Thương Mại", color: "#a855f7", icon: Handshake, desc: "Tăng 10% tỷ giá ưu đãi" },
  enemy:         { label: "Thù Địch",           color: "#ef4444", icon: Sword,     desc: "Phí giao dịch ×2, không thể đề xuất hiệp ước" },
};

const TREATY_TYPES = [
  { value: "trade",          label: "Hiệp Định Thương Mại",       desc: "Ưu đãi tỷ giá +10% cho cả hai bên" },
  { value: "alliance",       label: "Liên Minh Phòng Thủ",        desc: "Giảm 50% thuế giao thương, hỗ trợ khi bị tuyên chiến" },
  { value: "non_aggression", label: "Hiệp Ước Bất Xâm Phạm",      desc: "Cam kết không tuyên chiến trong 30 ngày" },
];

const EVENT_ICONS: Record<string, any> = {
  proposal: ScrollText, accept: CheckCircle, reject: XCircle,
  embassy: Building2, sanction: AlertTriangle, peace: Handshake,
};

const EVENT_COLORS: Record<string, string> = {
  proposal: "#a855f7", accept: "#22c55e", reject: "#ef4444",
  embassy: "#22d3ee", sanction: "#f97316", peace: "#22d3ee",
};

function RelationBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 border font-mono text-xs" style={{ borderColor: cfg.color + "60", color: cfg.color, background: cfg.color + "10" }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function DiplomacyPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"map" | "propose" | "embassies" | "events">("map");
  const [selectedFromWorld, setSelectedFromWorld] = useState("");
  const [selectedToWorld, setSelectedToWorld] = useState("");
  const [treatyType, setTreatyType] = useState("trade");
  const [proposeMsg, setProposeMsg] = useState("");
  const [ambassadorCharId, setAmbassadorCharId] = useState("");
  const [sanctionReason, setSanctionReason] = useState("");

  const { data: mapData, isLoading: mapLoading } = useQuery<any>({
    queryKey: ["/api/diplomacy/map"],
    queryFn: () => fetch("/api/diplomacy/map").then(r => r.json()),
  });

  const { data: myWorlds } = useQuery<any[]>({
    queryKey: ["/api/diplomacy/my-worlds"],
    queryFn: () => fetch("/api/diplomacy/my-worlds").then(r => r.json()),
    enabled: !!user,
  });

  const { data: worldDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/diplomacy/world", selectedFromWorld],
    queryFn: () => fetch(`/api/diplomacy/world/${selectedFromWorld}`).then(r => r.json()),
    enabled: !!selectedFromWorld,
  });

  const { data: allChars } = useQuery<any[]>({
    queryKey: ["/api/characters/my"],
    queryFn: () => fetch("/api/characters/my").then(r => r.json()),
    enabled: !!user,
  });

  const proposeMut = useMutation({
    mutationFn: (body: any) => fetch("/api/diplomacy/propose", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(`Đã gửi đề xuất ${d.label}!`);
      setProposeMsg("");
      qc.invalidateQueries({ queryKey: ["/api/diplomacy"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const respondMut = useMutation({
    mutationFn: ({ eventId, accept }: any) => fetch(`/api/diplomacy/respond/${eventId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(d.accepted ? "Đã chấp nhận hiệp ước!" : "Đã từ chối đề xuất.");
      qc.invalidateQueries({ queryKey: ["/api/diplomacy"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const embassyMut = useMutation({
    mutationFn: (body: any) => fetch("/api/diplomacy/establish-embassy", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Đại sứ quán đã được thành lập!");
      qc.invalidateQueries({ queryKey: ["/api/diplomacy"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sanctionMut = useMutation({
    mutationFn: ({ fromWorldSlug, targetWorldSlug, reason }: any) =>
      fetch(`/api/diplomacy/sanction/${targetWorldSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromWorldSlug, reason }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Đã ban hành cấm vận!");
      qc.invalidateQueries({ queryKey: ["/api/diplomacy"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const peaceMut = useMutation({
    mutationFn: ({ fromWorldSlug, targetWorldSlug }: any) =>
      fetch(`/api/diplomacy/peace/${targetWorldSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromWorldSlug }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Hòa ước đã được ký kết!");
      qc.invalidateQueries({ queryKey: ["/api/diplomacy"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allWorlds = mapData?.worlds ?? [];
  const otherWorlds = allWorlds.filter((w: any) => w.slug !== selectedFromWorld);

  const getRelationStatus = (slugA: string, slugB: string) => {
    const rels = mapData?.relations ?? [];
    const [a, b] = [slugA, slugB].sort();
    return rels.find((r: any) => r.worldSlugA === a && r.worldSlugB === b)?.status ?? "neutral";
  };

  const tabs = [
    { id: "map", label: "BẢN ĐỒ QUAN HỆ", icon: Globe },
    { id: "propose", label: "GỬI ĐỀ XUẤT", icon: Handshake },
    { id: "embassies", label: "ĐẠI SỨ QUÁN", icon: Building2 },
    { id: "events", label: "LỊCH SỬ", icon: ScrollText },
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
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-cyan-400">NGOẠI GIAO LIÊN THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Ký kết hiệp ước — lập đại sứ quán — cấm vận kinh tế</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-cyan-400 border-b-2 border-cyan-400" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Tab: Bản Đồ Quan Hệ */}
          {activeTab === "map" && (
            <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {mapLoading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {allWorlds.map((world: any) => {
                      const others = allWorlds.filter((w: any) => w.slug !== world.slug);
                      return (
                        <div key={world.slug} className="border border-border/50 bg-card/30 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <Globe className="w-4 h-4 text-cyan-400" />
                            <span className="font-orbitron text-sm font-bold">{world.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">[{world.theme}]</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {others.map((other: any) => {
                              const status = getRelationStatus(world.slug, other.slug);
                              return (
                                <div key={other.slug} className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{other.name}:</span>
                                  <RelationBadge status={status} />
                                </div>
                              );
                            })}
                            {others.length === 0 && (
                              <span className="font-mono text-xs text-muted-foreground/50">Chưa có quan hệ ngoại giao</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="border border-border/30 bg-card/20 p-4">
                    <p className="font-mono text-xs text-muted-foreground mb-3">HIỆU ỨNG QUAN HỆ</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                            <div>
                              <span className="font-mono text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
                              <p className="font-mono text-xs text-muted-foreground/60">{cfg.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Tab: Gửi Đề Xuất */}
          {activeTab === "propose" && (
            <motion.div key="propose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4 border border-border/50 bg-card/30 p-4">
                  <p className="font-orbitron text-sm text-cyan-400">ĐỀ XUẤT HIỆP ƯỚC</p>

                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Thế giới của bạn</label>
                    <Select value={selectedFromWorld} onValueChange={setSelectedFromWorld}>
                      <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
                      <SelectContent>
                        {allWorlds.map((w: any) => (
                          <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Gửi tới thế giới</label>
                    <Select value={selectedToWorld} onValueChange={setSelectedToWorld}>
                      <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Chọn thế giới đích..." /></SelectTrigger>
                      <SelectContent>
                        {otherWorlds.map((w: any) => (
                          <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedFromWorld && selectedToWorld && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">Quan hệ hiện tại:</span>
                      <RelationBadge status={getRelationStatus(selectedFromWorld, selectedToWorld)} />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Loại hiệp ước</label>
                    <div className="grid gap-2">
                      {TREATY_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setTreatyType(t.value)}
                          className={`text-left p-3 border transition-all ${
                            treatyType === t.value ? "border-cyan-400/60 bg-cyan-400/5" : "border-border/40 hover:border-border"
                          }`}
                        >
                          <div className="font-mono text-xs font-bold">{t.label}</div>
                          <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Thông điệp ngoại giao (tuỳ chọn)</label>
                    <Textarea
                      value={proposeMsg}
                      onChange={e => setProposeMsg(e.target.value)}
                      placeholder="Lời nhắn của sứ giả..."
                      className="font-mono text-xs resize-none h-20"
                    />
                  </div>

                  <Button
                    className="w-full font-orbitron text-xs"
                    onClick={() => proposeMut.mutate({ fromWorldSlug: selectedFromWorld, toWorldSlug: selectedToWorld, treatyType, message: proposeMsg })}
                    disabled={!selectedFromWorld || !selectedToWorld || proposeMut.isPending}
                  >
                    {proposeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScrollText className="w-4 h-4 mr-2" />}
                    GỬI ĐỀ XUẤT
                  </Button>
                </div>

                {/* Cấm vận & Hòa ước */}
                <div className="space-y-4">
                  <div className="border border-red-500/30 bg-card/30 p-4 space-y-3">
                    <p className="font-orbitron text-sm text-red-400">CẤM VẬN KINH TẾ</p>
                    <p className="font-mono text-xs text-muted-foreground">Chuyển quan hệ sang Thù Địch — phí giao dịch ×2</p>
                    <Textarea
                      value={sanctionReason}
                      onChange={e => setSanctionReason(e.target.value)}
                      placeholder="Lý do cấm vận..."
                      className="font-mono text-xs resize-none h-16"
                    />
                    <Button
                      variant="destructive"
                      className="w-full font-mono text-xs"
                      onClick={() => sanctionMut.mutate({ fromWorldSlug: selectedFromWorld, targetWorldSlug: selectedToWorld, reason: sanctionReason })}
                      disabled={!selectedFromWorld || !selectedToWorld || sanctionMut.isPending}
                    >
                      {sanctionMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                      BAN HÀNH CẤM VẬN
                    </Button>
                  </div>

                  <div className="border border-green-500/30 bg-card/30 p-4 space-y-3">
                    <p className="font-orbitron text-sm text-green-400">KÝ HÒA ƯỚC</p>
                    <p className="font-mono text-xs text-muted-foreground">Chuyển về trạng thái Trung Lập từ Thù Địch</p>
                    <Button
                      className="w-full font-mono text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                      onClick={() => peaceMut.mutate({ fromWorldSlug: selectedFromWorld, targetWorldSlug: selectedToWorld })}
                      disabled={!selectedFromWorld || !selectedToWorld || peaceMut.isPending}
                    >
                      {peaceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5 mr-1.5" />}
                      KÝ HÒA ƯỚC
                    </Button>
                  </div>
                </div>
              </div>

              {/* Đề xuất đang chờ phản hồi */}
              {worldDetail?.events && (
                <div className="border border-border/50 bg-card/30 p-4 space-y-3">
                  <p className="font-orbitron text-sm text-cyan-400">ĐỀ XUẤT CHỜ PHẢN HỒI</p>
                  {worldDetail.events.filter((e: any) => e.eventType === "proposal").length === 0 ? (
                    <p className="font-mono text-xs text-muted-foreground/50">Không có đề xuất nào đang chờ</p>
                  ) : (
                    worldDetail.events.filter((e: any) => e.eventType === "proposal").map((e: any) => (
                      <div key={e.id} className="border border-purple-500/20 bg-purple-500/5 p-3">
                        <p className="font-mono text-xs mb-2">{e.content}</p>
                        <div className="flex gap-2">
                          <Button size="sm" className="font-mono text-xs h-7"
                            onClick={() => respondMut.mutate({ eventId: e.id, accept: true })}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Chấp Nhận
                          </Button>
                          <Button size="sm" variant="destructive" className="font-mono text-xs h-7"
                            onClick={() => respondMut.mutate({ eventId: e.id, accept: false })}>
                            <XCircle className="w-3 h-3 mr-1" /> Từ Chối
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Tab: Đại Sứ Quán */}
          {activeTab === "embassies" && (
            <motion.div key="embassies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="border border-border/50 bg-card/30 p-4 space-y-4">
                <p className="font-orbitron text-sm text-cyan-400">LẬP ĐẠI SỨ QUÁN</p>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Thế giới nhà</label>
                    <Select value={selectedFromWorld} onValueChange={setSelectedFromWorld}>
                      <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Thế giới của bạn..." /></SelectTrigger>
                      <SelectContent>
                        {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Đặt tại thế giới</label>
                    <Select value={selectedToWorld} onValueChange={setSelectedToWorld}>
                      <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Thế giới chủ nhà..." /></SelectTrigger>
                      <SelectContent>
                        {otherWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Đại sứ (nhân vật)</label>
                    <Select value={ambassadorCharId} onValueChange={setAmbassadorCharId}>
                      <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Chọn đại sứ..." /></SelectTrigger>
                      <SelectContent>
                        {(allChars ?? []).map((c: any) => <SelectItem key={c.id} value={c.id} className="font-mono text-xs">{c.name} Lv.{c.level}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="font-orbitron text-xs"
                  onClick={() => embassyMut.mutate({ homeWorldSlug: selectedFromWorld, hostWorldSlug: selectedToWorld, ambassadorCharId })}
                  disabled={!selectedFromWorld || !selectedToWorld || !ambassadorCharId || embassyMut.isPending}
                >
                  {embassyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
                  THÀNH LẬP ĐẠI SỨ QUÁN
                </Button>
              </div>

              {/* Danh sách đại sứ quán */}
              <div className="space-y-2">
                <p className="font-orbitron text-sm text-muted-foreground">ĐẠI SỨ QUÁN ĐANG HOẠT ĐỘNG</p>
                {(mapData?.worlds ?? []).length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/50">Chưa có đại sứ quán nào</p>
                ) : (
                  <div className="grid gap-2">
                    {worldDetail?.embassies?.map((e: any) => (
                      <div key={e.id} className="border border-cyan-400/20 bg-card/30 p-3 flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-cyan-400" />
                        <div>
                          <p className="font-mono text-xs">{e.homeWorldSlug} → {e.hostWorldSlug}</p>
                          {e.ambassadorName && <p className="font-mono text-xs text-muted-foreground">Đại sứ: {e.ambassadorName}</p>}
                        </div>
                        <span className="ml-auto font-mono text-xs text-green-400">{e.status}</span>
                      </div>
                    )) ?? <p className="font-mono text-xs text-muted-foreground/50">Chọn thế giới để xem đại sứ quán</p>}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Tab: Lịch Sử */}
          {activeTab === "events" && (
            <motion.div key="events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="space-y-1 mb-2">
                <label className="font-mono text-xs text-muted-foreground">Lọc theo thế giới</label>
                <Select value={selectedFromWorld} onValueChange={setSelectedFromWorld}>
                  <SelectTrigger className="font-mono text-xs w-64"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
                  <SelectContent>
                    {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
              ) : !selectedFromWorld ? (
                <p className="font-mono text-xs text-muted-foreground/50">Chọn thế giới để xem lịch sử ngoại giao</p>
              ) : !worldDetail?.events?.length ? (
                <p className="font-mono text-xs text-muted-foreground/50">Chưa có sự kiện ngoại giao nào</p>
              ) : (
                <div className="space-y-2">
                  {worldDetail.events.map((e: any) => {
                    const Icon = EVENT_ICONS[e.eventType] ?? ScrollText;
                    const color = EVENT_COLORS[e.eventType] ?? "#64748b";
                    return (
                      <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="border border-border/40 bg-card/30 p-3 flex items-start gap-3">
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold" style={{ color }}>{e.eventType.toUpperCase()}</span>
                            <span className="font-mono text-xs text-muted-foreground/50">
                              {new Date(e.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{e.content}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
