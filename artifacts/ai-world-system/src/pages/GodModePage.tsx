import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import {
  ChevronLeft, Loader2, Zap, Flame, Shield, MessageCircle,
  Globe, Sparkles, Skull, Crown, RefreshCw, Send, Eye,
  Activity, Users, Coins, TrendingUp, Swords, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface NPC {
  id: string;
  name: string;
  role: string;
  personality: string;
  goals: string[];
  currentState: Record<string, unknown>;
  active: boolean;
}

interface Prayer {
  id: string;
  npcId: string;
  worldSlug: string;
  prayerContent: string;
  answered: boolean;
  createdAt: string;
}

interface DivineAction {
  id: string;
  actionType: string;
  targetNpcId: string | null;
  content: string;
  aiEffect: string;
  createdAt: string;
}

interface WorldData {
  world: { id: string; slug: string; name: string; genre: string; lore: string };
  npcs: NPC[];
  prayers: Prayer[];
  recentActions: DivineAction[];
}

interface NpcMood {
  id: string; name: string; role: string; mood: string;
  blessed: boolean; smited: boolean; wealthLevel: string;
}

interface AutoEvent {
  id: string; eventType: string; title: string; description: string;
  triggeredBy: string; startedAt: string; endsAt?: string;
}

interface ObserveSnapshot {
  world: { id: string; slug: string; name: string; genre: string; lore: string };
  framework: { progressionSystem?: { name: string }; currency?: { primary: string }; tagline?: string } | null;
  npcCount: number;
  playerCount: number;
  totalGold: number;
  avgLevel: string;
  activeEventCount: number;
  karmaScore: number;
  npcMoodMap: NpcMood[];
  activeEvents: Array<{ id: string; title: string; description: string; eventType: string }>;
  recentDivineActions: DivineAction[];
  autoEvents: AutoEvent[];
}

const ROLE_ICONS: Record<string, string> = {
  merchant: "💹", guardian: "🛡️", raider: "🗡️", sage: "📿",
  assassin: "🗡️", healer: "💊", warlord: "⚔️",
};

const ROLE_LABELS: Record<string, string> = {
  merchant: "Thương Nhân", guardian: "Hộ Vệ", raider: "Thổ Phỉ",
  sage: "Hiền Giả", assassin: "Sát Thủ", healer: "Thầy Thuốc", warlord: "Lãnh Chúa",
};

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  intervene:     { icon: "✨", color: "#a78bfa", label: "Thần Khải" },
  bless:         { icon: "💛", color: "#facc15", label: "Ban Phước" },
  smite:         { icon: "🔥", color: "#f87171", label: "Trừng Phạt" },
  answer_prayer: { icon: "🙏", color: "#34d399", label: "Đáp Lời" },
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  return `${Math.floor(m / 60)} giờ trước`;
}

export default function GodModePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ worldSlug: string }>();
  const worldSlug = params.worldSlug;

  const [data, setData] = useState<WorldData | null>(null);
  const [myWorlds, setMyWorlds] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [fetching, setFetching] = useState(true);
  const [command, setCommand] = useState("");
  const [intervening, setIntervening] = useState(false);
  const [interventionResult, setInterventionResult] = useState<string | null>(null);
  const [blessing, setBlessing] = useState<string | null>(null);
  const [smiting, setSmiting] = useState<string | null>(null);
  const [generatingPrayers, setGeneratingPrayers] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"observe" | "npcs" | "prayers" | "log">("observe");
  const [observeSnap, setObserveSnap] = useState<ObserveSnapshot | null>(null);
  const [observeLoading, setObserveLoading] = useState(false);
  const [macroType, setMacroType] = useState("bless_all");
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroResult, setMacroResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    if (!worldSlug) {
      fetch("/api/god/my-worlds").then(r => r.ok ? r.json() : []).then(d => setMyWorlds(Array.isArray(d) ? d : [])).finally(() => setFetching(false));
    }
  }, [user, worldSlug]);

  const loadWorld = useCallback(async () => {
    if (!worldSlug) return;
    setFetching(true);
    try {
      const r = await fetch(`/api/god/world/${worldSlug}`);
      if (!r.ok) { setData(null); return; }
      setData(await r.json());
    } finally { setFetching(false); }
  }, [worldSlug]);

  useEffect(() => { if (user && worldSlug) loadWorld(); }, [user, worldSlug]);

  const loadObserve = useCallback(async () => {
    if (!worldSlug) return;
    setObserveLoading(true);
    try {
      const r = await fetch(`/api/god/observe/${worldSlug}`);
      if (r.ok) setObserveSnap(await r.json());
    } finally { setObserveLoading(false); }
  }, [worldSlug]);

  useEffect(() => { if (user && worldSlug && activeTab === "observe") loadObserve(); }, [user, worldSlug, activeTab]);

  const handleMacroIntervene = async () => {
    if (!worldSlug) return;
    setMacroLoading(true);
    setMacroResult(null);
    try {
      const r = await fetch(`/api/god/macro-intervene/${worldSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionType: macroType }),
      });
      const d = await r.json();
      setMacroResult(d.aiNarrative ?? d.error);
      await loadObserve();
    } finally { setMacroLoading(false); }
  };

  const handleIntervene = async () => {
    if (!command.trim() || !worldSlug) return;
    setIntervening(true);
    setInterventionResult(null);
    try {
      const r = await fetch(`/api/god/intervene/${worldSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const d = await r.json();
      setInterventionResult(d.aiEffect ?? d.error);
      setCommand("");
      await loadWorld();
    } finally { setIntervening(false); }
  };

  const handleBless = async (npcId: string) => {
    if (!worldSlug) return;
    setBlessing(npcId);
    try {
      await fetch(`/api/god/bless/${npcId}`, { method: "POST" });
      await loadWorld();
    } finally { setBlessing(null); }
  };

  const handleSmite = async (npcId: string, permanent = false) => {
    if (!worldSlug) return;
    setSmiting(npcId);
    try {
      await fetch(`/api/god/smite/${npcId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permanent }),
      });
      await loadWorld();
    } finally { setSmiting(null); }
  };

  const handleGeneratePrayers = async () => {
    if (!worldSlug) return;
    setGeneratingPrayers(true);
    try {
      await fetch(`/api/god/prayers/generate/${worldSlug}`, { method: "POST" });
      await loadWorld();
    } finally { setGeneratingPrayers(false); }
  };

  const handleAnswerPrayer = async (prayerId: string) => {
    if (!answerDraft.trim()) return;
    setAnsweringId(prayerId);
    try {
      await fetch(`/api/god/answer-prayer/${prayerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerDraft }),
      });
      setAnswerDraft("");
      setAnsweringId(null);
      await loadWorld();
    } finally { setAnsweringId(null); }
  };

  const GOD_COLOR = "#a78bfa";

  // — World selector khi chưa chọn thế giới
  if (!worldSlug) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Crown className="w-5 h-5" style={{ color: GOD_COLOR }} strokeWidth={1.5} />
            <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: GOD_COLOR }}>CHẾ ĐỘ THẦN</span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-10">
          {fetching ? <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          : myWorlds.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <Crown className="w-12 h-12 mx-auto opacity-20" strokeWidth={1} />
              <p className="font-mono text-sm text-muted-foreground/50">Bạn chưa tạo thế giới nào.</p>
              <Button onClick={() => setLocation("/world-creator")} variant="outline"
                className="rounded-none font-orbitron text-xs tracking-widest border-border hover:border-purple-500/50">
                TẠO THẾ GIỚI
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-mono text-xs text-muted-foreground/60 tracking-widest">CHỌN THẾ GIỚI CỦA BẠN</p>
              {myWorlds.map(w => (
                <motion.div key={w.id} whileHover={{ scale: 1.01 }}
                  onClick={() => setLocation(`/god/${w.slug}`)}
                  className="border border-border/50 bg-card/40 p-5 cursor-pointer hover:border-purple-500/40 transition-all flex items-center gap-4"
                  style={{ boxShadow: `inset 0 0 30px ${GOD_COLOR}05` }}>
                  <Crown className="w-6 h-6 flex-shrink-0" style={{ color: GOD_COLOR }} strokeWidth={1.5} />
                  <div>
                    <div className="font-orbitron text-sm font-bold" style={{ color: GOD_COLOR }}>{w.name}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{w.slug}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fetching) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="font-mono text-sm text-muted-foreground">Bạn không phải Thần của thế giới này.</p>
      <Button onClick={() => setLocation("/god")} variant="outline" className="rounded-none font-orbitron text-xs">
        QUAY LẠI
      </Button>
    </div>
  );

  const { world, npcs: worldNpcs, prayers, recentActions } = data;
  const unansweredPrayers = prayers.filter(p => !p.answered);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/god")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Crown className="w-5 h-5 flex-shrink-0" style={{ color: GOD_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest truncate" style={{ color: GOD_COLOR }}>
              THẾ GIỚI: {world.name.toUpperCase()}
            </div>
            <div className="font-mono text-xs text-muted-foreground/60">{world.genre} · {worldNpcs.filter(n => n.active).length} NPC · {unansweredPrayers.length} lời cầu nguyện</div>
          </div>
          <button onClick={loadWorld} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* World lore */}
        <div className="border border-purple-500/20 bg-purple-500/5 p-4"
          style={{ boxShadow: "inset 0 0 40px rgba(167,139,250,0.04)" }}>
          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: GOD_COLOR }} strokeWidth={1.5} />
            <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">{world.lore?.slice(0, 250) || "Thế giới đang hình thành..."}</p>
          </div>
        </div>

        {/* Divine intervention panel */}
        <div className="border border-purple-500/30 bg-card/40 p-5 space-y-4"
          style={{ boxShadow: "inset 0 0 60px rgba(167,139,250,0.05)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: GOD_COLOR }} strokeWidth={1.5} />
            <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: GOD_COLOR }}>THẦN KHẢI — CAN THIỆP THẾ GIỚI</span>
          </div>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleIntervene(); }}
            placeholder="Ra lệnh cho thế giới của bạn... (VD: 'Mưa máu đổ xuống kinh đô', 'Một ngôi sao rơi, mang theo cổ khí', 'Đại ôn dịch bùng phát ở vùng rìa')"
            maxLength={300}
            rows={3}
            className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/30 resize-none outline-none border-b border-border/30 pb-2 leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground/40">{command.length}/300</span>
            <Button size="sm" disabled={!command.trim() || intervening} onClick={handleIntervene}
              className="rounded-none font-orbitron text-xs tracking-widest border h-8 px-4"
              style={{ borderColor: GOD_COLOR, background: `${GOD_COLOR}20`, color: GOD_COLOR }}>
              {intervening ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3 mr-1.5" />GIÁNG THẦN KHẢI</>}
            </Button>
          </div>
          <AnimatePresence>
            {interventionResult && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="border border-purple-500/30 bg-purple-500/10 p-3 font-mono text-xs text-purple-200/90 leading-relaxed">
                <span className="text-purple-400/60 mr-2">✨ HIỆU ỨNG:</span>{interventionResult}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/40 overflow-x-auto">
          {([
            { id: "observe" as const, label: "QUAN SÁT", icon: Activity, count: 0 },
            { id: "npcs" as const, label: "NPC", icon: Eye, count: worldNpcs.filter(n => n.active).length },
            { id: "prayers" as const, label: "CẦU NGUYỆN", icon: MessageCircle, count: unansweredPrayers.length },
            { id: "log" as const, label: "THẦN SỬ", icon: Flame, count: recentActions.length },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 font-orbitron text-xs font-bold tracking-widest transition-all border-b-2"
              style={{
                borderColor: activeTab === tab.id ? GOD_COLOR : "transparent",
                color: activeTab === tab.id ? GOD_COLOR : "rgba(255,255,255,0.35)",
              }}>
              <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
              {tab.count > 0 && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: `${GOD_COLOR}25`, color: GOD_COLOR }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: QUAN SÁT */}
        {activeTab === "observe" && (
          <div className="space-y-4">
            {observeLoading && !observeSnap && (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: GOD_COLOR }} /></div>
            )}

            {observeSnap && (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { icon: Users, label: "NPC ĐANG SỐNG", value: observeSnap.npcCount, color: "#06b6d4" },
                    { icon: Users, label: "NGƯỜI CHƠI", value: observeSnap.playerCount, color: "#a855f7" },
                    { icon: Coins, label: "TỔNG GOLD", value: observeSnap.totalGold.toLocaleString(), color: "#f59e0b" },
                    { icon: TrendingUp, label: "LEVEL TRUNG BÌNH", value: observeSnap.avgLevel, color: "#10b981" },
                    { icon: Swords, label: "SỰ KIỆN ACTIVE", value: observeSnap.activeEventCount, color: "#ef4444" },
                    { icon: Star, label: "KARMA THẾ GIỚI", value: `${observeSnap.karmaScore}/100`, color: observeSnap.karmaScore >= 60 ? "#10b981" : observeSnap.karmaScore >= 40 ? "#f59e0b" : "#ef4444" },
                  ].map(s => (
                    <div key={s.label} className="border border-border/40 bg-card/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} strokeWidth={1.5} />
                        <span className="font-mono text-xs text-muted-foreground/40">{s.label}</span>
                      </div>
                      <div className="font-orbitron text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* NPC Mood Map */}
                {observeSnap.npcMoodMap.length > 0 && (
                  <div className="border border-border/40 bg-card/30 p-4">
                    <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: GOD_COLOR }}>
                      👁️ BẢN ĐỒ TÂM TRẠNG NPC
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {observeSnap.npcMoodMap.map(n => {
                        const MOOD_COLOR: Record<string, string> = {
                          happy: "#10b981", neutral: "#6b7280", anxious: "#f59e0b",
                          angry: "#ef4444", fearful: "#8b5cf6",
                        };
                        const moodColor = MOOD_COLOR[n.mood] ?? "#6b7280";
                        return (
                          <div key={n.id} className="border border-border/30 bg-background/40 p-3"
                            style={{ borderColor: n.blessed ? "#facc1540" : n.smited ? "#f8717140" : undefined }}>
                            <div className="flex items-center gap-1 mb-1">
                              <span className="font-mono text-xs font-bold truncate">{n.name}</span>
                              {n.blessed && <span className="text-yellow-400 text-xs">💛</span>}
                              {n.smited && <span className="text-red-400 text-xs">🔥</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: moodColor }} />
                              <span className="font-mono text-xs" style={{ color: moodColor }}>{n.mood}</span>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground/30 mt-0.5">{ROLE_LABELS[n.role] ?? n.role}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Macro Intervene */}
                <div className="border border-purple-500/30 bg-card/30 p-4 space-y-3">
                  <div className="font-orbitron text-xs tracking-widest" style={{ color: GOD_COLOR }}>
                    🪐 CAN THIỆP VĨ MÔ — TÁC ĐỘNG TOÀN THẾ GIỚI
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {[
                      { id: "bless_all", label: "🌟 THIÊN PHÚC", desc: "Ban phúc toàn thế giới" },
                      { id: "golden_age", label: "👑 HOÀNG KIM", desc: "Thời đại phồn thịnh" },
                      { id: "mystery", label: "🌀 HUYỀN BÍ", desc: "Thiên cơ bất định" },
                      { id: "curse_all", label: "⚡ THIÊN TRÁCH", desc: "Giáng trừng cả thế giới" },
                      { id: "catastrophe", label: "🌑 ĐẠI KIẾP", desc: "Thiên tai thảm khốc" },
                    ].map(m => (
                      <button key={m.id} onClick={() => setMacroType(m.id)}
                        className="p-3 border text-left transition-all"
                        style={{
                          borderColor: macroType === m.id ? GOD_COLOR : "hsl(var(--border))",
                          backgroundColor: macroType === m.id ? `${GOD_COLOR}15` : "transparent",
                        }}>
                        <div className="font-orbitron text-xs font-bold">{m.label}</div>
                        <div className="font-mono text-xs text-muted-foreground/40 mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                  <Button disabled={macroLoading} onClick={handleMacroIntervene}
                    className="w-full rounded-none font-orbitron text-xs tracking-widest border"
                    style={{ borderColor: GOD_COLOR, color: GOD_COLOR, backgroundColor: `${GOD_COLOR}10` }}>
                    {macroLoading ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />ĐANG GIÁNG THẦN LỰC...</> : <><Zap className="w-3 h-3 mr-2" />GIÁNG XUỐNG TOÀN THẾ GIỚI</>}
                  </Button>
                  <AnimatePresence>
                    {macroResult && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="border border-purple-500/30 bg-purple-500/10 p-3 font-mono text-xs text-purple-200/90 leading-relaxed">
                        <span className="text-purple-400/60 mr-2">🪐 HIỆU ỨNG VĨ MÔ:</span>{macroResult}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Auto Events Feed */}
                {observeSnap.autoEvents.length > 0 && (
                  <div className="border border-border/40 bg-card/30 p-4">
                    <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: GOD_COLOR }}>
                      📡 SỰ KIỆN TỰ PHÁT SINH ({observeSnap.autoEvents.length})
                    </div>
                    <div className="space-y-3">
                      {observeSnap.autoEvents.slice(0, 5).map(e => (
                        <div key={e.id} className="border border-border/30 bg-background/30 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-orbitron text-xs font-bold">{e.title}</span>
                            <span className="font-mono text-xs text-muted-foreground/30 ml-auto">
                              {timeAgo(e.startedAt)}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground/60 leading-relaxed">{e.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refresh button */}
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" disabled={observeLoading} onClick={loadObserve}
                    className="rounded-none font-mono text-xs border border-border/30">
                    {observeLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" strokeWidth={1.5} />}
                    CẬP NHẬT QUAN SÁT
                  </Button>
                </div>
              </>
            )}

            {!observeLoading && !observeSnap && (
              <div className="text-center py-12">
                <Button onClick={loadObserve} className="rounded-none font-orbitron text-xs border"
                  style={{ borderColor: GOD_COLOR, color: GOD_COLOR, backgroundColor: `${GOD_COLOR}10` }}>
                  <Eye className="w-3.5 h-3.5 mr-2" /> BẮT ĐẦU QUAN SÁT THẾ GIỚI
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: NPCs */}
        {activeTab === "npcs" && (
          <div className="space-y-3">
            {worldNpcs.filter(n => n.active).length === 0 ? (
              <div className="text-center py-10 font-mono text-xs text-muted-foreground/40">
                Không có NPC nào. Thế giới đang trống vắng.
              </div>
            ) : worldNpcs.filter(n => n.active).map(npc => {
              const state = npc.currentState as any;
              const isBlessed = state?.blessed && new Date(state.blessedUntil) > new Date();
              const isSmited = state?.smited && new Date(state.smitedUntil) > new Date();
              const npcPrayer = prayers.find(p => p.npcId === npc.id);

              return (
                <motion.div key={npc.id} layout
                  className="border border-border/50 bg-card/30 p-4 space-y-3"
                  style={{ borderColor: isBlessed ? "rgba(250,204,21,0.3)" : isSmited ? "rgba(248,113,113,0.3)" : undefined }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{ROLE_ICONS[npc.role] ?? "👤"}</span>
                      <div>
                        <div className="font-orbitron text-sm font-bold">{npc.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/60 flex items-center gap-2">
                          <span>{ROLE_LABELS[npc.role] ?? npc.role}</span>
                          {isBlessed && <span className="text-yellow-400">💛 Được Phước</span>}
                          {isSmited && <span className="text-red-400">🔥 Bị Phạt</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleBless(npc.id)} disabled={!!blessing}
                        title="Ban phước — buff stats 24h"
                        className="border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all px-2 py-1.5 font-mono text-xs flex items-center gap-1">
                        {blessing === npc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" strokeWidth={1.5} />}
                        PHƯỚC
                      </button>
                      <button onClick={() => handleSmite(npc.id, false)} disabled={!!smiting}
                        title="Trừng phạt — debuff 12h"
                        className="border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all px-2 py-1.5 font-mono text-xs flex items-center gap-1">
                        {smiting === npc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3" strokeWidth={1.5} />}
                        PHẠT
                      </button>
                      <button onClick={() => { if (confirm(`Khai trừ vĩnh viễn ${npc.name}?`)) handleSmite(npc.id, true); }}
                        disabled={!!smiting} title="Khai trừ vĩnh viễn"
                        className="border border-red-700/40 bg-red-900/10 text-red-600 hover:bg-red-900/20 transition-all px-2 py-1.5 font-mono text-xs">
                        <Skull className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground/60 line-clamp-2">{npc.personality}</p>
                  {npcPrayer && (
                    <div className="border border-purple-500/20 bg-purple-500/5 p-3 font-mono text-xs text-purple-200/80 leading-relaxed">
                      <span className="text-purple-400/60 mr-1.5">🙏</span>{npcPrayer.prayerContent}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Tab: Prayers */}
        {activeTab === "prayers" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground/50">{unansweredPrayers.length} lời cầu nguyện chưa được đáp</span>
              <Button size="sm" variant="ghost" disabled={generatingPrayers} onClick={handleGeneratePrayers}
                className="rounded-none font-orbitron text-xs border border-border/40 h-7 px-3 text-muted-foreground hover:text-foreground">
                {generatingPrayers ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" strokeWidth={1.5} />}
                TRIỆU NGUYỆN
              </Button>
            </div>
            {unansweredPrayers.length === 0 ? (
              <div className="text-center py-12 space-y-3 font-mono text-xs text-muted-foreground/40">
                <MessageCircle className="w-10 h-10 mx-auto opacity-20" strokeWidth={1} />
                <p>Chưa có lời cầu nguyện nào.</p>
                <p>Nhấn "TRIỆU NGUYỆN" để AI sinh prayers từ NPC.</p>
              </div>
            ) : unansweredPrayers.map(prayer => {
              const npc = worldNpcs.find(n => n.id === prayer.npcId);
              return (
                <motion.div key={prayer.id} layout
                  className="border border-purple-500/20 bg-card/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{ROLE_ICONS[npc?.role ?? ""] ?? "👤"}</span>
                    <span className="font-orbitron text-xs font-bold" style={{ color: GOD_COLOR }}>{npc?.name ?? "NPC"}</span>
                    <span className="font-mono text-xs text-muted-foreground/40 ml-auto">{timeAgo(prayer.createdAt)}</span>
                  </div>
                  <p className="font-mono text-sm text-purple-200/90 leading-relaxed italic">"{prayer.prayerContent}"</p>
                  {answeringId === prayer.id ? (
                    <div className="flex gap-2">
                      <input value={answerDraft} onChange={e => setAnswerDraft(e.target.value)}
                        placeholder="Lời đáp của Thần..."
                        className="flex-1 bg-transparent border-b border-border/40 font-mono text-xs outline-none pb-1 text-foreground placeholder:text-muted-foreground/30" />
                      <button onClick={() => handleAnswerPrayer(prayer.id)}
                        className="font-mono text-xs text-purple-400 hover:text-purple-300 transition-colors">
                        <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button onClick={() => setAnsweringId(null)}
                        className="font-mono text-xs text-muted-foreground/40 hover:text-muted-foreground">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setAnsweringId(prayer.id)}
                      className="font-mono text-xs border border-purple-500/25 text-purple-400/70 hover:text-purple-300 hover:border-purple-400/40 transition-all px-3 py-1.5 flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" strokeWidth={1.5} /> ĐÁP LỜI NGUYỆN
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Tab: Divine Log */}
        {activeTab === "log" && (
          <div className="space-y-3">
            {recentActions.length === 0 ? (
              <div className="text-center py-12 font-mono text-xs text-muted-foreground/40 space-y-2">
                <Flame className="w-10 h-10 mx-auto opacity-20" strokeWidth={1} />
                <p>Chưa có thần sử nào được ghi lại.</p>
              </div>
            ) : recentActions.map(action => {
              const meta = ACTION_META[action.actionType] ?? ACTION_META.intervene;
              const targetNpc = action.targetNpcId ? worldNpcs.find(n => n.id === action.targetNpcId) : null;
              return (
                <div key={action.id} className="border border-border/40 bg-card/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span>{meta.icon}</span>
                    <span className="font-orbitron text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                    {targetNpc && <span className="font-mono text-xs text-muted-foreground/50">→ {targetNpc.name}</span>}
                    <span className="font-mono text-xs text-muted-foreground/30 ml-auto">{timeAgo(action.createdAt)}</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground/60 italic">"{action.content}"</p>
                  {action.aiEffect && (
                    <p className="font-mono text-xs leading-relaxed" style={{ color: meta.color, opacity: 0.8 }}>
                      {action.aiEffect}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
