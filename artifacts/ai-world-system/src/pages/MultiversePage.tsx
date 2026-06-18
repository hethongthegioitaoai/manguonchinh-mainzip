import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Sparkles, Globe, Zap, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CrossWorldEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  affectedWorlds: string[];
  active: boolean;
  startAt: string;
  endAt: string | null;
}

interface TravelHistory {
  id: string;
  fromWorld: string;
  toWorld: string;
  traveledAt: string;
  reason: string;
}

interface WorldOption {
  id: string;
  slug: string;
  name: string;
  genre: string;
  lore: string;
}

const EVENT_ICONS: Record<string, string> = {
  portal: "🌀",
  war: "⚔️",
  merge: "🌐",
  invasion: "👾",
  alliance: "🤝",
};

const EVENT_COLORS: Record<string, string> = {
  portal: "#06b6d4",
  war: "#ef4444",
  merge: "#a855f7",
  invasion: "#f97316",
  alliance: "#22c55e",
};

const EVENT_LABELS: Record<string, string> = {
  portal: "Cổng Không Gian",
  war: "Chiến Tranh Vũ Trụ",
  merge: "Hợp Nhất Thế Giới",
  invasion: "Xâm Lược",
  alliance: "Liên Minh",
};

const GENRE_ICONS: Record<string, string> = {
  tu_tien: "⚡", cyberpunk: "🔌", fantasy: "🗡️", xianxia: "☁️",
  horror: "💀", scifi: "🚀", wasteland: "☢️", steampunk: "⚙️",
};

const BUILT_IN_ICONS: Record<string, string> = {
  cultivation: "⚡", cyberpunk: "🔌", zombie: "☢️",
};

export default function MultiversePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [travelTarget, setTravelTarget] = useState<WorldOption | null>(null);
  const [selectedChar, setSelectedChar] = useState<string>("");

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["multiverse-events"],
    queryFn: async () => { const r = await fetch("/api/multiverse/events", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: !!user,
  });

  const { data: worldsData, isLoading: worldsLoading } = useQuery({
    queryKey: ["multiverse-worlds"],
    queryFn: async () => { const r = await fetch("/api/multiverse/worlds", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: !!user,
  });

  const { data: charsData } = useQuery({
    queryKey: ["characters"],
    queryFn: async () => { const r = await fetch("/api/characters", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
    enabled: !!user,
  });

  const { data: travelData, refetch: refetchTravel } = useQuery({
    queryKey: ["multiverse-travel", selectedChar],
    queryFn: async () => selectedChar
      ? (async () => { const r = await fetch(`/api/multiverse/travel/${selectedChar}`, { credentials: "include" }); if (!r.ok) return { history: [] }; return r.json(); })()
      : Promise.resolve({ history: [] }),
    enabled: !!selectedChar,
  });

  const generateMutation = useMutation({
    mutationFn: async () => { const r = await fetch("/api/multiverse/events/generate", { method: "POST", credentials: "include" }); if (!r.ok) throw new Error("Lỗi sinh sự kiện"); return r.json(); },
    onSuccess: (data) => {
      if (data.event) {
        qc.invalidateQueries({ queryKey: ["multiverse-events"] });
        showToast(`⚡ Sự kiện mới: "${data.event.title}"`);
      } else {
        showToast(data.message ?? "Lỗi sinh sự kiện");
      }
    },
    onError: () => showToast("Lỗi kết nối server"),
  });

  const travelMutation = useMutation({
    mutationFn: async (body: { characterId: string; toWorld: string; reason: string }) => {
      const r = await fetch("/api/multiverse/travel", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Lỗi di chuyển");
      return r.json();
    },
    onSuccess: (data) => {
      if (data.travel) {
        qc.invalidateQueries({ queryKey: ["characters"] });
        refetchTravel();
        setTravelTarget(null);
        showToast(`✅ Đã di chuyển sang "${data.newWorldSlug}"`);
      } else {
        showToast(data.message ?? "Lỗi di chuyển");
      }
    },
    onError: () => showToast("Lỗi kết nối server"),
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  const events: CrossWorldEvent[] = eventsData?.events ?? [];
  const worlds: WorldOption[] = worldsData?.worlds ?? [];
  const characters = charsData ?? [];
  const travelHistory: TravelHistory[] = travelData?.history ?? [];
  const ACCENT = "#a855f7";

  const activeChar = characters.find((c: any) => c.id === selectedChar);

  useEffect(() => {
    if (characters.length > 0 && !selectedChar) {
      setSelectedChar(characters[0].id);
    }
  }, [characters, selectedChar]);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${ACCENT}20, transparent 65%)` }} />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: `radial-gradient(circle at 20% 50%, #06b6d4 1px, transparent 1px), radial-gradient(circle at 80% 20%, #a855f7 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border whitespace-nowrap"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="sm"
          onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>MULTIVERSE</span>
        </div>
        <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
          className="rounded-none font-orbitron text-xs border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
          {generateMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> ĐANG SINH...</> : <><Sparkles className="w-3 h-3 mr-1" /> SỰ KIỆN MỚI</>}
        </Button>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">

        <div>
          <div className="font-orbitron text-2xl font-black tracking-widest">ĐA VŨ TRỤ</div>
          <div className="font-mono text-xs text-muted-foreground/50 mt-1">
            Nhiều thế giới song song — du hành, chiến tranh vũ trụ, và hợp nhất thế giới
          </div>
        </div>

        {events.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="font-orbitron text-xs tracking-widest" style={{ color: ACCENT }}>SỰ KIỆN ĐANG DIỄN RA</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            <div className="space-y-3">
              {events.map((ev, i) => {
                const color = EVENT_COLORS[ev.type] ?? ACCENT;
                const endTime = ev.endAt ? new Date(ev.endAt) : null;
                const remaining = endTime ? Math.max(0, Math.round((endTime.getTime() - Date.now()) / 3_600_000)) : null;
                return (
                  <motion.div key={ev.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="border p-5 relative overflow-hidden"
                    style={{ borderColor: color, backgroundColor: `${color}08` }}>
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
                    <div className="flex items-start gap-4">
                      <div className="text-2xl flex-shrink-0">{EVENT_ICONS[ev.type] ?? "🌀"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-orbitron text-xs tracking-widest" style={{ color }}>{EVENT_LABELS[ev.type] ?? ev.type.toUpperCase()}</span>
                          {remaining !== null && (
                            <span className="font-mono text-xs text-muted-foreground/40">còn {remaining}h</span>
                          )}
                        </div>
                        <div className="font-orbitron text-sm font-bold mt-1">{ev.title}</div>
                        <div className="font-mono text-xs text-muted-foreground/60 mt-1 leading-relaxed">{ev.description}</div>
                        {ev.affectedWorlds?.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground/30">Ảnh hưởng:</span>
                            {(ev.affectedWorlds as string[]).map(w => (
                              <span key={w} className="font-mono text-xs px-2 py-0.5 border border-border/30 text-muted-foreground/50">{w}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {events.length === 0 && !eventsLoading && (
          <div className="border border-dashed border-border/30 p-8 text-center space-y-3">
            <Globe className="w-10 h-10 mx-auto text-muted-foreground/15" />
            <div className="font-orbitron text-sm text-muted-foreground/30">KHÔNG CÓ SỰ KIỆN VŨ TRỤ</div>
            <div className="font-mono text-xs text-muted-foreground/25">Nhấn "SỰ KIỆN MỚI" để AI sinh sự kiện xuyên thế giới</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          <div>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="font-orbitron text-xs tracking-widest text-cyan-400">DU HÀNH THẾ GIỚI</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            {characters.length === 0 ? (
              <div className="border border-border/30 p-6 text-center font-mono text-xs text-muted-foreground/40">
                Chưa có nhân vật. Tạo nhân vật trước khi du hành.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-muted-foreground/40 block mb-2">CHỌN NHÂN VẬT</label>
                  <div className="flex gap-2 flex-wrap">
                    {characters.map((c: any) => (
                      <button key={c.id} onClick={() => setSelectedChar(c.id)}
                        className="font-mono text-xs px-3 py-2 border transition-all"
                        style={{
                          borderColor: selectedChar === c.id ? "#06b6d4" : "hsl(var(--border))",
                          color: selectedChar === c.id ? "#06b6d4" : undefined,
                          backgroundColor: selectedChar === c.id ? "#06b6d410" : "transparent",
                        }}>
                        {c.name} <span className="text-muted-foreground/40">Lv{c.level}</span>
                      </button>
                    ))}
                  </div>
                  {activeChar && (
                    <div className="font-mono text-xs text-muted-foreground/30 mt-2">
                      Đang ở: <span className="text-cyan-400/60">{(activeChar as any).stats?.world_slug ?? "không rõ"}</span>
                    </div>
                  )}
                </div>

                {worldsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {worlds.map((w) => {
                      const currentSlug = (activeChar as any)?.stats?.world_slug;
                      const isCurrent = w.slug === currentSlug;
                      return (
                        <motion.div key={w.id} whileHover={!isCurrent ? { x: 2 } : {}}
                          className={`border p-3 flex items-center gap-3 transition-all ${isCurrent ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-cyan-400/40"}`}
                          style={{ borderColor: isCurrent ? "hsl(var(--border))" : "hsl(var(--border))" }}
                          onClick={() => !isCurrent && setTravelTarget(w)}>
                          <span className="text-lg flex-shrink-0">{BUILT_IN_ICONS[w.slug] ?? GENRE_ICONS[w.genre] ?? "🌍"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-orbitron text-xs font-bold truncate">{w.name}</div>
                            <div className="font-mono text-xs text-muted-foreground/40 truncate">{w.lore?.slice(0, 60)}...</div>
                          </div>
                          {isCurrent ? (
                            <span className="font-mono text-xs text-muted-foreground/30 flex-shrink-0">Đang ở</span>
                          ) : (
                            <Zap className="w-3 h-3 text-cyan-400/40 flex-shrink-0" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-4 h-4 text-yellow-400/70" />
              <span className="font-orbitron text-xs tracking-widest text-yellow-400/70">LỊCH SỬ DU HÀNH</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            {!selectedChar ? (
              <div className="border border-border/30 p-6 text-center font-mono text-xs text-muted-foreground/30">
                Chọn nhân vật để xem lịch sử
              </div>
            ) : travelHistory.length === 0 ? (
              <div className="border border-dashed border-border/30 p-8 text-center space-y-2">
                <Globe className="w-8 h-8 mx-auto text-muted-foreground/15" />
                <div className="font-mono text-xs text-muted-foreground/30">Chưa du hành thế giới nào</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {travelHistory.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border border-border/30 p-3 flex items-center gap-3">
                    <div className="font-mono text-xs text-muted-foreground/40 flex-shrink-0">
                      {new Date(t.traveledAt).toLocaleDateString("vi-VN")}
                    </div>
                    <div className="flex-1 font-mono text-xs">
                      <span className="text-cyan-400/60">{t.fromWorld}</span>
                      <span className="text-muted-foreground/30 mx-2">→</span>
                      <span className="text-purple-400/60">{t.toWorld}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="font-orbitron text-xs tracking-widest" style={{ color: ACCENT }}>
              TẤT CẢ THẾ GIỚI — {worlds.length} CÕI
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          {worldsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {worlds.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="border border-border/30 bg-card/30 p-4 text-center cursor-pointer hover:border-border/60 transition-all"
                  onClick={() => setTravelTarget(w)}>
                  <div className="text-2xl mb-2">{BUILT_IN_ICONS[w.slug] ?? GENRE_ICONS[w.genre] ?? "🌍"}</div>
                  <div className="font-orbitron text-xs font-bold truncate">{w.name}</div>
                  <div className="font-mono text-xs text-muted-foreground/30 mt-1 truncate">{w.genre}</div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {travelTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setTravelTarget(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="border-2 bg-background p-8 max-w-md w-full space-y-5"
              style={{ borderColor: ACCENT }}>
              <div className="text-center">
                <div className="text-4xl mb-3">{BUILT_IN_ICONS[travelTarget.slug] ?? GENRE_ICONS[travelTarget.genre] ?? "🌍"}</div>
                <div className="font-orbitron text-xl font-black">{travelTarget.name}</div>
                <div className="font-mono text-xs text-muted-foreground/50 mt-2 leading-relaxed">{travelTarget.lore?.slice(0, 100)}...</div>
              </div>

              <div className="flex items-start gap-3 border border-yellow-500/30 p-3 bg-yellow-500/5">
                <AlertTriangle className="w-4 h-4 text-yellow-500/70 flex-shrink-0 mt-0.5" />
                <div className="font-mono text-xs text-muted-foreground/60 leading-relaxed">
                  Du hành sẽ chuyển nhân vật <strong>{(activeChar as any)?.name}</strong> sang thế giới này. Lịch sử di chuyển sẽ được ghi lại.
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setTravelTarget(null)}
                  className="flex-1 rounded-none font-mono text-xs border border-border/30">HỦY</Button>
                <Button
                  onClick={() => selectedChar && travelMutation.mutate({ characterId: selectedChar, toWorld: travelTarget.slug, reason: `Du hành đến ${travelTarget.name}` })}
                  disabled={travelMutation.isPending || !selectedChar}
                  className="flex-1 rounded-none font-orbitron text-xs tracking-widest border"
                  style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
                  {travelMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> ĐANG DU HÀNH...</> : <><Zap className="w-3 h-3 mr-1" /> DU HÀNH</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
