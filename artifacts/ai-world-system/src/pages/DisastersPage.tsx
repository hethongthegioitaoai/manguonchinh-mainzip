import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Globe, AlertTriangle, Sparkles, ArrowLeft, Loader2, HandHeart, History, Plus, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  minor:        { label: "Nhẹ",       color: "#eab308", bg: "#eab308/10" },
  major:        { label: "Nặng",      color: "#f97316", bg: "#f97316/10" },
  catastrophic: { label: "Thảm Họa", color: "#ef4444", bg: "#ef4444/10" },
};

function EventCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return <span className="font-mono text-xs text-yellow-400">⏱ {h}h {m}m còn lại</span>;
}

function EventCard({ event, onPray, userCharId, myChar }: { event: any; onPray: (id: string, text: string) => void; userCharId?: string; myChar?: any }) {
  const [prayerText, setPrayerText] = useState("");
  const [showPray, setShowPray] = useState(false);
  const isDisaster = event.eventType === "disaster";
  const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.minor;
  const threshold = event.severity === "catastrophic" ? 2000 : event.severity === "major" ? 1000 : 500;
  const progress = Math.min(100, Math.round((event.prayerPower / threshold) * 100));
  const effect = event.effect as any;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`border p-4 space-y-3`}
      style={{ borderColor: sev.color + "40", background: sev.color + "08" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isDisaster ? <AlertTriangle className="w-4 h-4" style={{ color: sev.color }} /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
          <span className="font-orbitron text-sm font-bold" style={{ color: isDisaster ? sev.color : "#eab308" }}>
            {event.eventName}
          </span>
          <span className="font-mono text-xs border px-1.5 py-0.5" style={{ color: sev.color, borderColor: sev.color + "40" }}>
            {isDisaster ? sev.label : "PHÚC LÀNH"}
          </span>
        </div>
        <EventCountdown endsAt={event.endsAt} />
      </div>

      <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">{event.aiNarrative || event.description}</p>

      {/* Hiệu ứng */}
      <div className="flex flex-wrap gap-2">
        {effect?.expMult && effect.expMult !== 1 && (
          <div className={`flex items-center gap-1 font-mono text-xs px-2 py-1 border ${effect.expMult > 1 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
            {effect.expMult > 1 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            EXP ×{effect.expMult}
          </div>
        )}
        {effect?.resourceMult && effect.resourceMult !== 1 && (
          <div className={`flex items-center gap-1 font-mono text-xs px-2 py-1 border ${effect.resourceMult > 1 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
            {effect.resourceMult > 1 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            Tài nguyên ×{effect.resourceMult}
          </div>
        )}
        {effect?.bonusDrop && (
          <div className="flex items-center gap-1 font-mono text-xs px-2 py-1 border text-purple-400 border-purple-400/30">
            <Sparkles className="w-3 h-3" /> Drop thêm vật phẩm
          </div>
        )}
      </div>

      {/* Thanh cầu nguyện (chỉ disaster) */}
      {isDisaster && (
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs">
            <span className="text-muted-foreground">Sức mạnh cầu nguyện</span>
            <span className="text-cyan-400">{event.prayerPower}/{threshold} ({event.prayerCount} tu sĩ)</span>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
          </div>
          <p className="font-mono text-xs text-muted-foreground/50">
            {event.severity === "catastrophic" ? "Cần 2000 — giảm xuống Nặng" :
             event.severity === "major" ? "Cần 1000 — giảm xuống Nhẹ" :
             "Cần 500 — tiêu trừ thiên tai"}
          </p>

          {!showPray ? (
            <Button size="sm" variant="outline" className="font-mono text-xs h-7 w-full"
              onClick={() => setShowPray(true)} disabled={!myChar}>
              <HandHeart className="w-3 h-3 mr-1" /> Cầu Nguyện
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea value={prayerText} onChange={e => setPrayerText(e.target.value)}
                placeholder="Lời cầu nguyện..." className="font-mono text-xs resize-none h-14" />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 font-mono text-xs h-7 bg-cyan-600/20 text-cyan-400 border border-cyan-600/30"
                  onClick={() => { onPray(event.id, prayerText); setShowPray(false); }}>
                  <HandHeart className="w-3 h-3 mr-1" /> Dâng Lời
                </Button>
                <Button size="sm" variant="ghost" className="font-mono text-xs h-7" onClick={() => setShowPray(false)}>Hủy</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function DisastersPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"global" | "my-world" | "history">("global");
  const [selectedWorld, setSelectedWorld] = useState("");
  const [triggerWorld, setTriggerWorld] = useState("");
  const [triggerType, setTriggerType] = useState<"disaster" | "blessing">("disaster");

  const { data: allActive = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/disasters/all/active"],
    queryFn: () => fetch("/api/disasters/all/active").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: worldEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/disasters", selectedWorld],
    queryFn: () => fetch(`/api/disasters/${selectedWorld}`).then(r => r.json()),
    enabled: !!selectedWorld,
    refetchInterval: 20000,
  });

  const { data: historyData = [] } = useQuery<any[]>({
    queryKey: ["/api/disasters/history", selectedWorld],
    queryFn: () => fetch(`/api/disasters/history/${selectedWorld}`).then(r => r.json()),
    enabled: !!selectedWorld && activeTab === "history",
  });

  const { data: mapData } = useQuery<any>({
    queryKey: ["/api/diplomacy/map"],
    queryFn: () => fetch("/api/diplomacy/map").then(r => r.json()),
  });
  const allWorlds = mapData?.worlds ?? [];

  const { data: myChar } = useQuery<any>({
    queryKey: ["/api/characters/my-character"],
    queryFn: () => fetch("/api/characters/my-character").then(r => r.json()),
    enabled: !!user,
  });

  const prayMut = useMutation({
    mutationFn: ({ disasterId, text }: any) => fetch(`/api/disasters/${disasterId}/pray`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: myChar?.id, prayerText: text }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(d.message);
      qc.invalidateQueries({ queryKey: ["/api/disasters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const triggerMut = useMutation({
    mutationFn: (body: any) => fetch(`/api/disasters/trigger/${body.worldSlug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceType: body.forceType }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      toast.success(`${d.event.eventType === "disaster" ? "⚠️ Thiên tai" : "✨ Phúc lành"}: ${d.event.eventName} xuất hiện!`);
      qc.invalidateQueries({ queryKey: ["/api/disasters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tabs = [
    { id: "global",   label: "TOÀN CẦU",   icon: Globe },
    { id: "my-world", label: "THẾ GIỚI CỦA TÔI", icon: Shield },
    { id: "history",  label: "LỊCH SỬ",    icon: History },
  ] as const;

  const disasters = allActive.filter(e => e.eventType === "disaster").length;
  const blessings = allActive.filter(e => e.eventType === "blessing").length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-orange-400">THIÊN TAI & PHÚC LỘC</h1>
            <p className="font-mono text-xs text-muted-foreground">Sự kiện toàn cầu ảnh hưởng EXP và tài nguyên — cầu nguyện tập thể đẩy lùi thiên tai</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Thiên Tai",    value: disasters, color: "#ef4444", icon: AlertTriangle },
            { label: "Phúc Lành",   value: blessings, color: "#eab308", icon: Sparkles },
            { label: "Thế Giới Ảnh Hưởng", value: new Set(allActive.map((e: any) => e.worldSlug)).size, color: "#a855f7", icon: Globe },
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

        {/* Trigger panel */}
        <div className="border border-orange-500/20 bg-card/20 p-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">Kích hoạt sự kiện:</span>
          <Select value={triggerWorld} onValueChange={setTriggerWorld}>
            <SelectTrigger className="font-mono text-xs w-44 h-8"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
            <SelectContent>
              {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={triggerType} onValueChange={(v: any) => setTriggerType(v)}>
            <SelectTrigger className="font-mono text-xs w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disaster" className="font-mono text-xs">⚠️ Thiên Tai</SelectItem>
              <SelectItem value="blessing" className="font-mono text-xs">✨ Phúc Lành</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="font-mono text-xs h-8 bg-orange-600/20 text-orange-400 border border-orange-600/30"
            onClick={() => triggerMut.mutate({ worldSlug: triggerWorld, forceType: triggerType })}
            disabled={!triggerWorld || triggerMut.isPending}>
            {triggerMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
            Kích Hoạt
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-orange-400 border-b-2 border-orange-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Tab: Toàn Cầu */}
          {activeTab === "global" && (
            <motion.div key="global" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
              ) : allActive.length === 0 ? (
                <div className="border border-border/30 bg-card/20 p-8 text-center">
                  <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-mono text-xs text-muted-foreground/50">Không có sự kiện nào đang diễn ra trên toàn cầu</p>
                </div>
              ) : (
                allActive.map((event: any) => (
                  <EventCard key={event.id} event={event} myChar={myChar}
                    onPray={(id, text) => prayMut.mutate({ disasterId: id, text })} />
                ))
              )}
            </motion.div>
          )}

          {/* Tab: Thế giới của tôi */}
          {activeTab === "my-world" && (
            <motion.div key="my-world" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <Select value={selectedWorld} onValueChange={setSelectedWorld}>
                <SelectTrigger className="font-mono text-xs max-w-xs"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
                <SelectContent>
                  {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedWorld && (
                worldEvents.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/50">Không có sự kiện nào đang diễn ra tại thế giới này</p>
                ) : (
                  worldEvents.map((event: any) => (
                    <EventCard key={event.id} event={event} myChar={myChar}
                      onPray={(id, text) => prayMut.mutate({ disasterId: id, text })} />
                  ))
                )
              )}
            </motion.div>
          )}

          {/* Tab: Lịch sử */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <Select value={selectedWorld} onValueChange={setSelectedWorld}>
                <SelectTrigger className="font-mono text-xs max-w-xs"><SelectValue placeholder="Chọn thế giới xem lịch sử..." /></SelectTrigger>
                <SelectContent>
                  {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedWorld && (
                historyData.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/50">Chưa có lịch sử sự kiện</p>
                ) : (
                  historyData.map((event: any) => {
                    const isDisaster = event.eventType === "disaster";
                    const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.minor;
                    return (
                      <div key={event.id} className="border border-border/30 bg-card/20 p-3 flex items-center gap-3">
                        {isDisaster ? <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: sev.color }} /> : <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-bold">{event.eventName}</p>
                          <p className="font-mono text-xs text-muted-foreground/60 line-clamp-1">{event.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-xs" style={{ color: event.status === "ended" && event.resolvedBy === "prayer" ? "#22c55e" : "#94a3b8" }}>
                            {event.resolvedBy === "prayer" ? "✓ Cầu nguyện" : event.resolvedBy === "expired" ? "Hết hạn" : event.status}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground/40">{new Date(event.startedAt).toLocaleDateString("vi-VN")}</p>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
