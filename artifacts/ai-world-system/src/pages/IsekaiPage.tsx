import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Loader2, Zap, RefreshCw, ArrowRight,
  Sparkles, Clock, BookOpen, Star, Portal, CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface CharInfo { id: string; name: string; level: number; stats: Record<string, unknown> }
interface IsekaiRecord {
  id: string; fromWorldSlug: string; toWorldSlug: string;
  isekaiName: string; isekaiClass: string; openingNarrative: string;
  systemGrant: string; systemAbility: string; worldReaction: string;
  createdAt: string;
  metadata: { fromCharName?: string; fromCharLevel?: number; toWorldName?: string; toWorldGenre?: string };
}

const WORLD_LABELS: Record<string, string> = {
  cultivation: "Đại Lục Tu Tiên", cyberpunk: "Neon Megacity", zombie: "Vùng Hoang Phế",
  tu_tien: "Tu Tiên", fantasy: "Fantasy", horror: "Kinh Dị",
  scifi: "Sci-Fi", wasteland: "Hoang Phế", steampunk: "Steampunk", xianxia: "Tiên Hiệp",
};
const WORLD_COLORS: Record<string, string> = {
  cultivation: "#34d399", cyberpunk: "#a78bfa", zombie: "#f87171",
  tu_tien: "#34d399", fantasy: "#60a5fa", horror: "#f87171",
  scifi: "#38bdf8", wasteland: "#fb923c", steampunk: "#d4a574", xianxia: "#c084fc",
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}p trước`;
  if (m < 1440) return `${Math.floor(m / 60)}h trước`;
  return `${Math.floor(m / 1440)}d trước`;
}

const PORTAL_COLOR = "#818cf8";

export default function IsekaiPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [chars, setChars] = useState<CharInfo[]>([]);
  const [history, setHistory] = useState<IsekaiRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedChar, setSelectedChar] = useState<CharInfo | null>(null);
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<IsekaiRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  const loadAll = useCallback(async () => {
    setFetching(true);
    try {
      const [cRes, hRes] = await Promise.all([
        fetch("/api/isekai/worlds"),
        fetch("/api/isekai/my"),
      ]);
      const [cData, hData] = await Promise.all([cRes.json(), hRes.json()]);
      const charsArr: CharInfo[] = Array.isArray(cData) ? cData : [];
      setChars(charsArr);
      setHistory(Array.isArray(hData) ? hData : []);
      if (charsArr.length && !selectedChar) setSelectedChar(charsArr[0]);
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const handleEnter = async () => {
    if (!selectedChar) return;
    setActivating(true);
    setResult(null);
    try {
      const r = await fetch("/api/isekai/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedChar.id }),
      });
      const d = await r.json();
      if (r.ok) {
        setResult(d.record);
        await loadAll();
      } else {
        alert(d.error);
      }
    } finally { setActivating(false); }
  };

  const worldColor = (slug: string) => WORLD_COLORS[slug] ?? PORTAL_COLOR;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: PORTAL_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest" style={{ color: PORTAL_COLOR }}>
              CỔNG XUYÊN KHÔNG — ISEKAI
            </div>
            <div className="font-mono text-xs text-muted-foreground/60">{history.length} lần xuyên không · ngẫu nhiên · không thể đoán trước</div>
          </div>
          <button onClick={loadAll} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {fetching ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Portal activation panel */}
            <div className="border border-indigo-500/30 bg-card/30 p-6 space-y-6"
              style={{ boxShadow: "inset 0 0 80px rgba(129,140,248,0.06)" }}>
              {/* Portal visual */}
              <div className="flex justify-center py-4">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 rounded-full border-2 border-dashed"
                    style={{ borderColor: `${PORTAL_COLOR}40` }}
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-3 rounded-full border-2 border-dashed"
                    style={{ borderColor: `${PORTAL_COLOR}60` }}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: `radial-gradient(circle, ${PORTAL_COLOR}30, transparent)` }}>
                      <Zap className="w-8 h-8" style={{ color: PORTAL_COLOR }} strokeWidth={1} />
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Lore text */}
              <div className="border border-indigo-500/15 bg-indigo-500/5 p-4">
                <p className="font-mono text-xs text-indigo-200/70 leading-relaxed text-center">
                  Mỗi tu sĩ, hacker, hay kẻ sinh tồn đều có thể bị cuốn vào cổng xuyên không bất kỳ lúc nào.
                  Thế giới mới. Tên mới. Thân phận mới. Nhưng ký ức và sức mạnh cũ vẫn còn đó — ẩn sâu bên trong.
                </p>
              </div>

              {/* Character select */}
              {chars.length === 0 ? (
                <div className="text-center py-6">
                  <p className="font-mono text-xs text-muted-foreground/40">Bạn chưa có nhân vật nào.</p>
                  <Button onClick={() => setLocation("/character")} variant="outline"
                    className="mt-3 rounded-none font-orbitron text-xs">TẠO NHÂN VẬT</Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground/50 mb-3 tracking-widest">CHỌN NHÂN VẬT KÍCH HOẠT</p>
                    <div className="grid grid-cols-2 gap-2">
                      {chars.map(c => {
                        const ws = (c.stats as any)?.worldSlug ?? "cultivation";
                        return (
                          <button key={c.id} onClick={() => setSelectedChar(c)}
                            className="p-3 border text-left transition-all"
                            style={{
                              borderColor: selectedChar?.id === c.id ? PORTAL_COLOR : "rgba(255,255,255,0.08)",
                              background: selectedChar?.id === c.id ? `${PORTAL_COLOR}10` : "transparent",
                            }}>
                            <div className="font-orbitron text-xs font-bold">{c.name}</div>
                            <div className="font-mono text-xs mt-0.5" style={{ color: worldColor(ws), opacity: 0.7 }}>
                              Lv.{c.level} · {WORLD_LABELS[ws] ?? ws}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    onClick={handleEnter}
                    disabled={!selectedChar || activating}
                    className="w-full rounded-none font-orbitron text-sm tracking-widest border h-12"
                    style={{ borderColor: PORTAL_COLOR, background: `${PORTAL_COLOR}20`, color: PORTAL_COLOR }}>
                    {activating ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>ĐANG MỞ CỔNG...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4" strokeWidth={1.5} />
                        <span>KÍCH HOẠT CỔNG XUYÊN KHÔNG</span>
                      </div>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Isekai result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border-2 bg-card/40 p-6 space-y-5"
                  style={{
                    borderColor: worldColor(result.toWorldSlug),
                    boxShadow: `0 0 60px ${worldColor(result.toWorldSlug)}15, inset 0 0 80px ${worldColor(result.toWorldSlug)}05`,
                  }}>
                  {/* World arrival header */}
                  <div className="text-center space-y-2">
                    <div className="font-mono text-xs tracking-widest" style={{ color: worldColor(result.toWorldSlug), opacity: 0.6 }}>
                      ⚡ XUYÊN KHÔNG THÀNH CÔNG
                    </div>
                    <div className="font-orbitron text-xl font-bold" style={{ color: worldColor(result.toWorldSlug) }}>
                      {result.metadata.toWorldName ?? WORLD_LABELS[result.toWorldSlug] ?? result.toWorldSlug}
                    </div>
                    <div className="flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground/60">
                      <span>{WORLD_LABELS[result.fromWorldSlug] ?? result.fromWorldSlug}</span>
                      <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                      <span style={{ color: worldColor(result.toWorldSlug) }}>{result.metadata.toWorldName ?? result.toWorldSlug}</span>
                    </div>
                  </div>

                  {/* Identity card */}
                  <div className="border border-white/10 bg-black/30 p-4 space-y-2">
                    <div className="font-mono text-xs text-muted-foreground/40 tracking-widest mb-2">DANH TÍNH MỚI</div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border flex items-center justify-center font-orbitron text-sm font-bold"
                        style={{ borderColor: worldColor(result.toWorldSlug), color: worldColor(result.toWorldSlug) }}>
                        {result.isekaiName[0]}
                      </div>
                      <div>
                        <div className="font-orbitron text-base font-bold" style={{ color: worldColor(result.toWorldSlug) }}>
                          {result.isekaiName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60">{result.isekaiClass}</div>
                      </div>
                    </div>
                  </div>

                  {/* Opening narrative */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" style={{ color: worldColor(result.toWorldSlug), opacity: 0.7 }} strokeWidth={1.5} />
                      <span className="font-mono text-xs text-muted-foreground/40 tracking-widest">CẢNH MỞ ĐẦU</span>
                    </div>
                    <p className="font-mono text-sm leading-relaxed text-foreground/90">{result.openingNarrative}</p>
                  </div>

                  {/* System grant */}
                  <div className="border bg-black/40 p-4 space-y-2"
                    style={{ borderColor: `${worldColor(result.toWorldSlug)}30` }}>
                    <div className="font-orbitron text-xs font-bold" style={{ color: worldColor(result.toWorldSlug) }}>
                      ⚙ THÔNG BÁO HỆ THỐNG
                    </div>
                    <p className="font-mono text-xs leading-relaxed" style={{ color: worldColor(result.toWorldSlug), opacity: 0.85 }}>
                      {result.systemGrant}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} strokeWidth={1.5} />
                      <span className="font-orbitron text-xs font-bold" style={{ color: "#f59e0b" }}>
                        THIÊN PHÚ: {result.systemAbility}
                      </span>
                    </div>
                  </div>

                  {/* World reaction */}
                  <div className="border border-white/8 bg-white/3 p-3">
                    <div className="font-mono text-xs text-muted-foreground/50 mb-1.5">PHẢN ỨNG THẾ GIỚI</div>
                    <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed italic">{result.worldReaction}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-3">
                <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">LỊCH SỬ XUYÊN KHÔNG ({history.length})</p>
                {history.map(r => (
                  <motion.div key={r.id} layout>
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="w-full text-left border border-border/30 bg-card/20 p-4 hover:border-border/50 transition-all"
                      style={{ borderLeftColor: worldColor(r.toWorldSlug), borderLeftWidth: 2 }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-orbitron text-xs font-bold">{r.isekaiName}</span>
                            <span className="font-mono text-xs text-muted-foreground/40">—</span>
                            <span className="font-mono text-xs" style={{ color: worldColor(r.toWorldSlug) }}>
                              {r.metadata.toWorldName ?? WORLD_LABELS[r.toWorldSlug] ?? r.toWorldSlug}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground/40">
                            <span>{r.metadata.fromCharName} Lv.{r.metadata.fromCharLevel}</span>
                            <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                            <span>{r.isekaiClass}</span>
                            <span className="ml-auto">{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedId === r.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border border-t-0 border-border/30 bg-card/10 p-4 space-y-3"
                          style={{ borderLeftColor: worldColor(r.toWorldSlug), borderLeftWidth: 2 }}>
                          <p className="font-mono text-xs text-muted-foreground/75 leading-relaxed italic">{r.openingNarrative}</p>
                          <div className="border border-white/8 p-3 font-mono text-xs leading-relaxed"
                            style={{ color: worldColor(r.toWorldSlug), opacity: 0.8 }}>
                            {r.systemGrant}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs" style={{ color: "#f59e0b" }}>
                            <Star className="w-3 h-3" strokeWidth={1.5} />
                            <span>THIÊN PHÚ: {r.systemAbility}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
