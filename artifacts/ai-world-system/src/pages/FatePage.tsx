import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Loader2, RefreshCw, Zap, Star,
  Clock, TrendingUp, TrendingDown, Minus, BookOpen, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface CharInfo { id: string; name: string; level: number; stats: Record<string, unknown>; createdAt: string }
interface Hexagram { symbol: string; name: string; element: string }
interface FateEvent {
  id: string; eventType: string; title: string; description: string;
  effect: Record<string, number>; duration: number; active: boolean;
  expiresAt: string | null; createdAt: string;
}
interface FateReading {
  id: string; hexagram: string; hexagramName: string; fateNumber: number;
  reading: string; advice: string; luckyElement: string; createdAt: string;
}
interface FateData {
  fateNumber: number; hexagram: Hexagram;
  activeEvents: FateEvent[]; lastReading: FateReading | null; history: FateEvent[];
}

const FATE_NAMES: Record<number, string> = {
  1: "Nhất — Thủy Tinh Mệnh", 2: "Nhị — Thổ Âm Mệnh", 3: "Tam — Mộc Dương Mệnh",
  4: "Tứ — Mộc Âm Mệnh",     5: "Ngũ — Thổ Hoàng Mệnh", 6: "Lục — Kim Dương Mệnh",
  7: "Thất — Kim Âm Mệnh",   8: "Bát — Thổ Dương Mệnh", 9: "Cửu — Hỏa Mệnh",
};
const FATE_COLOR: Record<number, string> = {
  1: "#38bdf8", 2: "#a3a3a3", 3: "#4ade80", 4: "#86efac",
  5: "#d97706", 6: "#f59e0b", 7: "#c0c0c0", 8: "#ca8a04", 9: "#f87171",
};
const EVENT_ICON = {
  cat:       { icon: TrendingUp,   color: "#4ade80", label: "CÁT" },
  hung:      { icon: TrendingDown, color: "#f87171", label: "HUNG" },
  trung_binh:{ icon: Minus,        color: "#94a3b8", label: "BÌNH" },
};
const FATE_PAGE_COLOR = "#a78bfa";

function effectLabel(eff: Record<string, number>): string {
  return Object.entries(eff).map(([k, v]) => {
    const map: Record<string, string> = {
      expBonus: `+${v} EXP`, expPenalty: `-${v} EXP`, goldBonus: `+${v} vàng`,
      goldPenalty: `-${v} vàng`, critBoostPct: `+${v}% Crit`, critReducePct: `-${v}% Crit`,
      dropBoostPct: `+${v}% Drop`, dropReducePct: `-${v}% Drop`, expMultiplier: `x${v} EXP`,
    };
    return map[k] ?? `${k}: ${v}`;
  }).join(" · ");
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const m = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000);
  if (m <= 0) return "Đã hết";
  if (m < 60) return `${m}p còn lại`;
  return `${Math.floor(m / 60)}h ${m % 60}p còn lại`;
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}p trước`;
  if (m < 1440) return `${Math.floor(m / 60)}h trước`;
  return `${Math.floor(m / 1440)}d trước`;
}

export default function FatePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [chars, setChars] = useState<CharInfo[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharInfo | null>(null);
  const [fateData, setFateData] = useState<FateData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [consultResult, setConsultResult] = useState<FateReading | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  const loadChars = useCallback(async () => {
    setFetching(true);
    try {
      const r = await fetch("/api/fate/my-chars");
      const data = await r.json();
      const arr: CharInfo[] = Array.isArray(data) ? data : [];
      setChars(arr);
      if (arr.length && !selectedChar) setSelectedChar(arr[0]);
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) loadChars(); }, [user]);

  const loadFate = useCallback(async (charId: string) => {
    const r = await fetch(`/api/fate/char/${charId}`);
    if (r.ok) setFateData(await r.json());
  }, []);

  useEffect(() => {
    if (selectedChar) { setFateData(null); setTriggerResult(null); setConsultResult(null); loadFate(selectedChar.id); }
  }, [selectedChar]);

  const handleTrigger = async () => {
    if (!selectedChar) return;
    setTriggering(true); setTriggerResult(null);
    try {
      const r = await fetch(`/api/fate/trigger/${selectedChar.id}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) { setTriggerResult(d); await loadFate(selectedChar.id); }
      else alert(d.error);
    } finally { setTriggering(false); }
  };

  const handleConsult = async () => {
    if (!selectedChar) return;
    setConsulting(true); setConsultResult(null);
    try {
      const r = await fetch(`/api/fate/consult/${selectedChar.id}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) { setConsultResult(d.reading); await loadFate(selectedChar.id); }
      else alert(d.error);
    } finally { setConsulting(false); }
  };

  const fc = fateData ? FATE_COLOR[fateData.fateNumber] ?? FATE_PAGE_COLOR : FATE_PAGE_COLOR;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Star className="w-5 h-5 flex-shrink-0" style={{ color: FATE_PAGE_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest" style={{ color: FATE_PAGE_COLOR }}>
              MỆNH SỐ & VẬN MỆNH
            </div>
            <div className="font-mono text-xs text-muted-foreground/60">Sự kiện Cát/Hung ngẫu nhiên — buff/debuff thực sự ảnh hưởng nhân vật</div>
          </div>
          <button onClick={() => selectedChar && loadFate(selectedChar.id)} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {fetching ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : chars.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="font-mono text-sm text-muted-foreground/40">Bạn chưa có nhân vật.</p>
            <Button onClick={() => setLocation("/character")} variant="outline" className="rounded-none font-orbitron text-xs">TẠO NHÂN VẬT</Button>
          </div>
        ) : (
          <>
            {/* Char select */}
            <div className="grid grid-cols-2 gap-2">
              {chars.map(c => (
                <button key={c.id} onClick={() => setSelectedChar(c)}
                  className="p-3 border text-left transition-all"
                  style={{
                    borderColor: selectedChar?.id === c.id ? FATE_PAGE_COLOR : "rgba(255,255,255,0.08)",
                    background: selectedChar?.id === c.id ? `${FATE_PAGE_COLOR}10` : "transparent",
                  }}>
                  <div className="font-orbitron text-xs font-bold">{c.name}</div>
                  <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">Lv.{c.level}</div>
                </button>
              ))}
            </div>

            {!fateData ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* Mệnh Số card */}
                <motion.div
                  className="border-2 bg-card/30 p-6"
                  style={{ borderColor: `${fc}50`, boxShadow: `inset 0 0 100px ${fc}08` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}>
                  <div className="flex items-center gap-6">
                    {/* Hexagram visual */}
                    <motion.div
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-20 h-20 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: `${fc}60`, background: `radial-gradient(circle, ${fc}15, transparent)` }}>
                      <span className="text-4xl" style={{ color: fc, filter: `drop-shadow(0 0 8px ${fc})` }}>
                        {fateData.hexagram.symbol}
                      </span>
                    </motion.div>
                    <div className="flex-1 space-y-1.5">
                      <div className="font-orbitron text-xs text-muted-foreground/40 tracking-widest">MỆNH SỐ</div>
                      <div className="font-orbitron text-lg font-bold" style={{ color: fc }}>
                        {FATE_NAMES[fateData.fateNumber] ?? `Mệnh ${fateData.fateNumber}`}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground/60">
                        Quẻ {fateData.hexagram.name} · Ngũ Hành {fateData.hexagram.element}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleTrigger} disabled={triggering}
                    className="rounded-none font-orbitron text-xs border h-11 tracking-widest"
                    style={{ borderColor: fc, background: `${fc}15`, color: fc }}>
                    {triggering
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />ĐANG XOAY QUẺ</>
                      : <><Zap className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />KÍCH HOẠT MỆNH CỤC</>
                    }
                  </Button>
                  <Button onClick={handleConsult} disabled={consulting}
                    className="rounded-none font-orbitron text-xs border h-11 tracking-widest"
                    style={{ borderColor: `${FATE_PAGE_COLOR}60`, background: `${FATE_PAGE_COLOR}10`, color: FATE_PAGE_COLOR }}>
                    {consulting
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />ĐANG GIẢI QUẺ</>
                      : <><BookOpen className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />XIN GIẢI QUẺ AI</>
                    }
                  </Button>
                </div>
                <p className="font-mono text-xs text-muted-foreground/30 text-center -mt-2">
                  Mệnh Cục: cooldown 1h · Giải quẻ: cooldown 2h
                </p>

                {/* Trigger result */}
                <AnimatePresence>
                  {triggerResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="border p-5 space-y-3"
                      style={{
                        borderColor: triggerResult.event?.eventType === "cat" ? "#4ade8060"
                          : triggerResult.event?.eventType === "hung" ? "#f8717160" : "#94a3b840",
                      }}>
                      <div className="flex items-center gap-3">
                        {(() => {
                          const et = triggerResult.event?.eventType ?? "trung_binh";
                          const cfg = EVENT_ICON[et as keyof typeof EVENT_ICON] ?? EVENT_ICON.trung_binh;
                          const Ico = cfg.icon;
                          return <>
                            <Ico className="w-5 h-5 flex-shrink-0" style={{ color: cfg.color }} strokeWidth={1.5} />
                            <div>
                              <div className="font-orbitron text-sm font-bold" style={{ color: cfg.color }}>
                                {triggerResult.event?.title}
                              </div>
                              <div className="font-mono text-xs" style={{ color: cfg.color, opacity: 0.6 }}>
                                [{cfg.label}] · {triggerResult.event?.duration}h
                              </div>
                            </div>
                          </>;
                        })()}
                      </div>
                      <p className="font-mono text-sm leading-relaxed text-foreground/85">{triggerResult.event?.description}</p>
                      <div className="font-mono text-xs text-muted-foreground/60">
                        Effect: <span className="text-foreground/70">{effectLabel(triggerResult.event?.effect ?? {})}</span>
                      </div>
                      {triggerResult.immediateEffect?.expDelta !== 0 && (
                        <div className="font-mono text-xs" style={{ color: (triggerResult.immediateEffect?.expDelta ?? 0) > 0 ? "#4ade80" : "#f87171" }}>
                          Ngay lập tức: {(triggerResult.immediateEffect?.expDelta ?? 0) > 0 ? "+" : ""}{triggerResult.immediateEffect?.expDelta} EXP
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Consult result */}
                <AnimatePresence>
                  {consultResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="border bg-card/20 p-5 space-y-4"
                      style={{ borderColor: `${FATE_PAGE_COLOR}30`, boxShadow: `inset 0 0 60px ${FATE_PAGE_COLOR}05` }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" style={{ color: FATE_PAGE_COLOR }}>{consultResult.hexagram}</span>
                        <div>
                          <div className="font-orbitron text-xs font-bold" style={{ color: FATE_PAGE_COLOR }}>
                            {consultResult.hexagramName} — THIÊN CƠ TIÊN PHÁN
                          </div>
                          <div className="font-mono text-xs text-muted-foreground/40">{timeAgo(consultResult.createdAt)}</div>
                        </div>
                      </div>
                      <p className="font-mono text-sm italic leading-relaxed text-foreground/85 whitespace-pre-line">{consultResult.reading}</p>
                      <div className="border border-violet-500/20 bg-violet-500/5 p-3 space-y-1">
                        <div className="font-orbitron text-xs text-violet-400/60">LỜI KHUYÊN</div>
                        <p className="font-mono text-sm text-violet-200/80">{consultResult.advice}</p>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs text-amber-400/70">
                        <Star className="w-3 h-3" strokeWidth={1.5} />
                        <span>Yếu tố may mắn: <span className="font-bold">{consultResult.luckyElement}</span></span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active events */}
                {fateData.activeEvents.length > 0 && (
                  <div className="space-y-3">
                    <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">MỆNH CỤC ĐANG ACTIVE ({fateData.activeEvents.length})</p>
                    {fateData.activeEvents.map(e => {
                      const et = e.eventType as keyof typeof EVENT_ICON;
                      const cfg = EVENT_ICON[et] ?? EVENT_ICON.trung_binh;
                      const Ico = cfg.icon;
                      return (
                        <div key={e.id} className="border border-border/30 bg-card/15 p-4 flex items-start gap-3">
                          <Ico className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} strokeWidth={1.5} />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-orbitron text-xs font-bold" style={{ color: cfg.color }}>{e.title}</span>
                              <span className="font-mono text-xs text-muted-foreground/40 flex-shrink-0">
                                <Clock className="inline w-3 h-3 mr-1" strokeWidth={1.5} />
                                {timeLeft(e.expiresAt)}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground/60">{effectLabel(e.effect as Record<string, number>)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Last reading */}
                {!consultResult && fateData.lastReading && (
                  <div className="space-y-3">
                    <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">GIẢI QUẺ GẦN NHẤT</p>
                    <div className="border border-border/25 bg-card/15 p-4 space-y-3 opacity-75">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" style={{ color: FATE_PAGE_COLOR }}>{fateData.lastReading.hexagram}</span>
                        <span className="font-mono text-xs text-muted-foreground/50">{fateData.lastReading.hexagramName} · {timeAgo(fateData.lastReading.createdAt)}</span>
                      </div>
                      <p className="font-mono text-xs italic text-muted-foreground/70 leading-relaxed line-clamp-3">{fateData.lastReading.reading}</p>
                      <div className="font-mono text-xs text-amber-400/60">✦ {fateData.lastReading.luckyElement}</div>
                    </div>
                  </div>
                )}

                {/* History */}
                {fateData.history.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">LỊCH SỬ MỆNH CỤC</p>
                    <div className="space-y-1">
                      {fateData.history.map(e => {
                        const et = e.eventType as keyof typeof EVENT_ICON;
                        const cfg = EVENT_ICON[et] ?? EVENT_ICON.trung_binh;
                        return (
                          <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border/15">
                            <span className="font-mono text-xs w-12 text-right flex-shrink-0" style={{ color: cfg.color }}>[{cfg.label}]</span>
                            <span className="font-orbitron text-xs truncate">{e.title}</span>
                            <span className="font-mono text-xs text-muted-foreground/30 ml-auto flex-shrink-0">{timeAgo(e.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
