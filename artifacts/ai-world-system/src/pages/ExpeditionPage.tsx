import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Compass, Users, Play, ChevronRight, Trophy, Swords, Gift, Skull, Coffee, User, Clock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ExpMember { userId: string; name: string; level: number; }
interface MapStep { step: number; type: string; revealed: boolean; }
interface Expedition {
  id: string; worldSlug: string; worldName: string; title: string; difficulty: string;
  status: string; leaderId: string; leaderName: string;
  members: ExpMember[]; maxMembers: number; mapData: MapStep[];
  currentStep: number; totalSteps: number; nextStepAt: string | null;
  goldReward: number; expReward: number; createdAt: string; endedAt: string | null;
}
interface ExpEvent {
  id: string; step: number; eventType: string; title: string; description: string;
  goldChange: number; expChange: number; hpChange: number; success: boolean; resolvedAt: string;
}

const EVENT_ICONS: Record<string, typeof Swords> = {
  combat: Swords, treasure: Gift, trap: Skull, npc: User, rest: Coffee,
};
const EVENT_COLORS: Record<string, string> = {
  combat: "#ef4444", treasure: "#f59e0b", trap: "#ff6600", npc: "#a855f7", rest: "#22c55e",
};
const DIFF_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: "DỄ", color: "#22c55e" },
  normal: { label: "THƯỜNG", color: "#f59e0b" },
  hard: { label: "KHÓ", color: "#ef4444" },
};
const WORLDS = [
  { slug: "cultivation", name: "Tu Tiên Giới" },
  { slug: "cyberpunk", name: "Cyberpunk" },
  { slug: "wasteland", name: "Hoang Phế" },
];

export default function ExpeditionPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"active" | "open" | "history">("active");
  const [myExpeditions, setMyExpeditions] = useState<Expedition[]>([]);
  const [openExpeditions, setOpenExpeditions] = useState<Expedition[]>([]);
  const [historyList, setHistoryList] = useState<Expedition[]>([]);
  const [selectedExp, setSelectedExp] = useState<Expedition | null>(null);
  const [events, setEvents] = useState<ExpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  const [createForm, setCreateForm] = useState({ worldSlug: "cultivation", difficulty: "normal" as "easy" | "normal" | "hard" });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadData();
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const tl: Record<string, string> = {};
      for (const e of [...myExpeditions, ...openExpeditions]) {
        if (e.nextStepAt) {
          const diff = new Date(e.nextStepAt).getTime() - now;
          tl[e.id] = diff <= 0 ? "Sẵn sàng!" : `${Math.floor(diff / 60000)}p ${Math.floor((diff % 60000) / 1000)}s`;
        }
      }
      setTimeLeft(tl);
    }, 1000);
    return () => clearInterval(interval);
  }, [myExpeditions, openExpeditions]);

  async function loadData() {
    setLoading(true);
    try {
      const [activeRes, openRes, histRes] = await Promise.all([
        fetch("/api/expedition/active"),
        fetch("/api/expedition/open"),
        fetch("/api/expedition/history"),
      ]);
      const [aData, oData, hData] = await Promise.all([activeRes.json(), openRes.json(), histRes.json()]);
      setMyExpeditions(Array.isArray(aData) ? aData : []);
      setOpenExpeditions(Array.isArray(oData) ? oData : []);
      setHistoryList(Array.isArray(hData) ? hData : []);
    } finally { setLoading(false); }
  }

  async function loadEvents(expId: string) {
    const res = await fetch(`/api/expedition/events/${expId}`);
    const data = await res.json();
    setEvents(Array.isArray(data) ? data : []);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/expedition/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "🧭 Đã tạo đội!", description: data.message });
      setShowCreate(false); loadData();
    } finally { setCreating(false); }
  }

  async function handleJoin(expId: string) {
    setJoining(expId);
    try {
      const res = await fetch(`/api/expedition/join/${expId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "✅ Đã gia nhập!", description: data.message });
      loadData();
    } finally { setJoining(null); }
  }

  async function handleStart(expId: string) {
    setStarting(expId);
    try {
      const res = await fetch(`/api/expedition/start/${expId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "🚀 Khởi hành!", description: data.message });
      loadData();
    } finally { setStarting(null); }
  }

  async function handleAdvance(expId: string) {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/expedition/advance/${expId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: data.isLastStep ? "🏆 Hoàn thành!" : "⚔️ " + data.message, description: data.event?.description?.slice(0, 80) });
      loadData();
      if (selectedExp) {
        const updated = [...myExpeditions];
        const idx = updated.findIndex(e => e.id === expId);
        if (idx >= 0) { setSelectedExp(data.expedition); loadEvents(expId); }
      }
    } finally { setAdvancing(false); }
  }

  const isMyMember = (exp: Expedition) => exp.leaderId === user?.id || (exp.members as ExpMember[]).some(m => m.userId === user?.id);
  const canAdvance = (exp: Expedition) => exp.status === "active" && (!exp.nextStepAt || new Date() >= new Date(exp.nextStepAt));

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-cyan-400 animate-pulse">Đang tải thám hiểm...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-cyan-400 tracking-widest">THÁM HIỂM NHÓM</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Lập đội · Khám phá bản đồ · Chia loot · Nhận EXP nhân đôi</p>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setShowCreate(!showCreate)} className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30">
              + Tạo Đội
            </Button>
          </div>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="border border-cyan-400/30 bg-cyan-400/5 p-5 mb-6 overflow-hidden"
            >
              <div className="font-orbitron text-sm font-bold text-cyan-400 mb-4">TẠO ĐỘI THÁM HIỂM</div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">Thế giới</div>
                  <select value={createForm.worldSlug} onChange={e => setCreateForm(f => ({ ...f, worldSlug: e.target.value }))}
                    className="w-full bg-background border border-border text-xs font-mono px-3 py-2 text-foreground">
                    {WORLDS.map(w => <option key={w.slug} value={w.slug}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">Độ khó</div>
                  <select value={createForm.difficulty} onChange={e => setCreateForm(f => ({ ...f, difficulty: e.target.value as any }))}
                    className="w-full bg-background border border-border text-xs font-mono px-3 py-2 text-foreground">
                    <option value="easy">Dễ (5 bước · 200 gold)</option>
                    <option value="normal">Thường (8 bước · 400 gold)</option>
                    <option value="hard">Khó (12 bước · 800 gold)</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30">
                {creating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Đang tạo...</> : "🧭 Tạo đội"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "active", label: `⚔️ CỦA TÔI (${myExpeditions.length})` },
            { key: "open", label: `🔍 TÌM ĐỘI (${openExpeditions.length})` },
            { key: "history", label: "📜 LỊCH SỬ" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`font-orbitron text-xs px-4 py-2 border transition-all ${activeTab === tab.key ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-border text-muted-foreground hover:border-cyan-400/50"}`}
            >{tab.label}</button>
          ))}
        </div>

        {/* MY EXPEDITIONS */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {myExpeditions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">Bạn chưa có cuộc thám hiểm nào. Hãy tạo đội hoặc tìm đội!</div>
            )}
            {myExpeditions.map((exp, i) => {
              const diffInfo = DIFF_LABELS[exp.difficulty] ?? DIFF_LABELS.normal;
              const isSelected = selectedExp?.id === exp.id;
              return (
                <motion.div key={exp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="border border-border bg-card/50 overflow-hidden"
                >
                  <div className="p-5 cursor-pointer" onClick={async () => {
                    if (isSelected) { setSelectedExp(null); setEvents([]); }
                    else { setSelectedExp(exp); await loadEvents(exp.id); }
                  }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10 flex-shrink-0">
                          <Compass className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <div className="font-orbitron text-sm font-bold text-cyan-400">{exp.title}</div>
                          <div className="font-mono text-xs text-muted-foreground">{exp.worldName}</div>
                          <div className="flex gap-3 mt-1 font-mono text-xs">
                            <span className="font-bold" style={{ color: diffInfo.color }}>{diffInfo.label}</span>
                            <span className="text-muted-foreground">{exp.currentStep}/{exp.totalSteps} bước</span>
                            <span className={exp.status === "active" ? "text-green-400" : "text-yellow-400"}>
                              {exp.status === "active" ? "ĐANG ĐI" : "CHIÊU MỘ"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="font-mono text-xs text-muted-foreground">
                          <Users className="w-3 h-3 inline mr-1" />{(exp.members as any[]).length}/{exp.maxMembers}
                        </div>
                        {exp.status === "recruiting" && exp.leaderId === user?.id && (
                          <Button size="sm" onClick={e => { e.stopPropagation(); handleStart(exp.id); }} disabled={starting === exp.id}
                            className="font-orbitron text-xs bg-green-400/20 border border-green-400/50 text-green-400 hover:bg-green-400/30">
                            {starting === exp.id ? "..." : "▶ Khởi hành"}
                          </Button>
                        )}
                        {exp.status === "active" && isMyMember(exp) && (
                          canAdvance(exp) ? (
                            <Button size="sm" onClick={e => { e.stopPropagation(); handleAdvance(exp.id); }} disabled={advancing}
                              className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30">
                              {advancing ? <Loader2 className="w-3 h-3 animate-spin" /> : "⚔️ Tiến lên"}
                            </Button>
                          ) : (
                            <div className="font-mono text-xs text-yellow-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{timeLeft[exp.id] ?? "..."}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Map Progress */}
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {(exp.mapData as MapStep[]).map((step) => {
                        const color = EVENT_COLORS[step.type] ?? "#888";
                        const isCurrent = step.step === exp.currentStep + 1;
                        const isDone = step.step <= exp.currentStep;
                        return (
                          <div key={step.step} className={`w-6 h-6 flex items-center justify-center text-xs border transition-all ${isDone ? "opacity-40" : isCurrent ? "animate-pulse" : "opacity-20"}`}
                            style={{ borderColor: step.revealed ? `${color}80` : "#444", backgroundColor: isDone ? `${color}20` : isCurrent ? `${color}30` : "transparent" }}
                            title={step.revealed ? step.type : "?"}>
                            {step.revealed ? (step.step <= exp.currentStep ? "✓" : "?") : step.step}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Events Panel */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/50 overflow-hidden"
                      >
                        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                          <div className="font-orbitron text-xs text-muted-foreground mb-2">NHẬT KÝ SỰ KIỆN</div>
                          {events.length === 0 && <div className="font-mono text-xs text-muted-foreground">Chưa có sự kiện nào. Tiến lên để khám phá!</div>}
                          {events.map((ev) => {
                            const color = EVENT_COLORS[ev.eventType] ?? "#888";
                            const Icon = EVENT_ICONS[ev.eventType] ?? Swords;
                            return (
                              <div key={ev.id} className="flex gap-3 p-2 border-b border-border/30 last:border-0">
                                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ color }}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-orbitron text-xs font-bold" style={{ color }}>{ev.title}</div>
                                  <div className="font-mono text-xs text-muted-foreground">{ev.description}</div>
                                  <div className="flex gap-3 font-mono text-xs mt-1">
                                    {ev.goldChange !== 0 && <span className={ev.goldChange > 0 ? "text-yellow-400" : "text-red-400"}>{ev.goldChange > 0 ? "+" : ""}{ev.goldChange} gold</span>}
                                    {ev.expChange > 0 && <span className="text-blue-400">+{ev.expChange} exp</span>}
                                    {ev.hpChange !== 0 && <span className={ev.hpChange > 0 ? "text-green-400" : "text-red-400"}>{ev.hpChange > 0 ? "+" : ""}{ev.hpChange} HP</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* FIND PARTY */}
        {activeTab === "open" && (
          <div className="space-y-4">
            {openExpeditions.filter(e => !isMyMember(e)).length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">Không có đội nào đang chiêu mộ.</div>
            )}
            {openExpeditions.filter(e => !isMyMember(e)).map((exp, i) => {
              const diffInfo = DIFF_LABELS[exp.difficulty] ?? DIFF_LABELS.normal;
              return (
                <motion.div key={exp.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="border border-border bg-card/50 p-5 flex items-center gap-4"
                >
                  <div className="w-10 h-10 flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10 flex-shrink-0">
                    <Compass className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron text-sm font-bold text-cyan-400">{exp.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{exp.worldName} · Leader: {exp.leaderName}</div>
                    <div className="flex gap-3 mt-1 font-mono text-xs">
                      <span style={{ color: diffInfo.color }}>{diffInfo.label}</span>
                      <span className="text-muted-foreground"><Users className="w-3 h-3 inline" /> {(exp.members as any[]).length}/{exp.maxMembers}</span>
                      <span className="text-yellow-400">🏆 {exp.goldReward}g + {exp.expReward}exp</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleJoin(exp.id)} disabled={joining === exp.id}
                    className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30 flex-shrink-0">
                    {joining === exp.id ? "Đang vào..." : "Gia nhập"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {historyList.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">Chưa có cuộc thám hiểm nào kết thúc.</div>
            )}
            {historyList.map((exp, i) => {
              const diffInfo = DIFF_LABELS[exp.difficulty] ?? DIFF_LABELS.normal;
              return (
                <motion.div key={exp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border border-border bg-card/30 p-4 flex items-center gap-4 opacity-80"
                >
                  <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-orbitron text-sm">{exp.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {exp.worldName} · {exp.totalSteps} bước · {new Date(exp.endedAt!).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <div className="font-mono text-xs" style={{ color: diffInfo.color }}>{diffInfo.label}</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
