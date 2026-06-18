import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Zap, Star, TrendingUp, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";

interface CosmicEntity {
  id: string; ownerUserId: string; entityType: string; entityName: string;
  tier: number; powerScore: number; population: number; wealth: number;
  influenceRadius: number; ascendedAt: string | null; lastActivityAt: string;
}

interface CosmicEvent {
  id: string; entityId: string; eventType: string; title: string;
  description: string; aiNarrative: string; occurredAt: string;
}

interface MyCosmosData { entities: CosmicEntity[]; events: CosmicEvent[]; }
interface RankingsData { rankings: Record<string, CosmicEntity[]>; }
interface MapData { entities: CosmicEntity[]; }

const ACCENT = "#c084fc";

const TIER_NAMES: Record<number, string> = { 1: "THẾ GIỚI", 2: "TINH VỰC", 3: "NGÂN HÀ", 4: "THIÊN HÀ", 5: "VŨ TRỤ" };
const TIER_COLORS: Record<number, string> = {
  1: "#06b6d4", 2: "#a78bfa", 3: "#10b981", 4: "#f59e0b", 5: "#f43f5e",
};
const TIER_ICONS: Record<number, string> = { 1: "🌍", 2: "⭐", 3: "🌌", 4: "🌠", 5: "🌀" };

const ASCEND_REQ: Record<number, { pop: number; wealth: number; score: number }> = {
  1: { pop: 50, wealth: 1000, score: 200 },
  2: { pop: 200, wealth: 5000, score: 800 },
  3: { pop: 500, wealth: 20000, score: 2500 },
  4: { pop: 1000, wealth: 50000, score: 8000 },
};

function AscendProgress({ entity }: { entity: CosmicEntity }) {
  const req = ASCEND_REQ[entity.tier];
  if (!req || entity.tier >= 5) return null;
  const popP = Math.min(100, Math.floor((entity.population / req.pop) * 100));
  const wealthP = Math.min(100, Math.floor((entity.wealth / req.wealth) * 100));
  const scoreP = Math.min(100, Math.floor((entity.powerScore / req.score) * 100));
  const color = TIER_COLORS[entity.tier + 1] ?? ACCENT;
  return (
    <div className="mt-3 space-y-1.5">
      {[
        { label: "DÂN SỐ", current: entity.population, needed: req.pop, p: popP },
        { label: "TÀI SẢN", current: entity.wealth, needed: req.wealth, p: wealthP },
        { label: "ĐIỂM MẠNH", current: entity.powerScore, needed: req.score, p: scoreP },
      ].map(s => (
        <div key={s.label}>
          <div className="flex justify-between font-mono text-xs text-muted-foreground/40 mb-0.5">
            <span>{s.label}</span><span>{s.current}/{s.needed}</span>
          </div>
          <div className="h-1 bg-muted/20">
            <div className="h-full transition-all" style={{ width: `${s.p}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CosmosPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"my" | "map" | "rankings">("my");
  const [toast, setToast] = useState<{ msg: string; narrative?: string } | null>(null);
  const [ascendingId, setAscendingId] = useState<string | null>(null);

  const { data: myData, isLoading: myLoading, refetch: refetchMy } = useQuery<MyCosmosData>({
    queryKey: ["cosmos-my"],
    queryFn: () => fetch("/api/cosmos/my", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const { data: rankData, isLoading: rankLoading } = useQuery<RankingsData>({
    queryKey: ["cosmos-rankings"],
    queryFn: () => fetch("/api/cosmos/rankings", { credentials: "include" }).then(r => r.json()),
    enabled: !!user && tab === "rankings",
  });

  const { data: mapData, isLoading: mapLoading } = useQuery<MapData>({
    queryKey: ["cosmos-map"],
    queryFn: () => fetch("/api/cosmos/map", { credentials: "include" }).then(r => r.json()),
    enabled: !!user && tab === "map",
  });

  const ascendMutation = useMutation({
    mutationFn: (entityId: string) => fetch(`/api/cosmos/ascend/${entityId}`, {
      method: "POST", credentials: "include",
    }).then(r => r.json()),
    onSuccess: (d) => {
      setAscendingId(null);
      if (d.entity) {
        showToast(`Thăng cấp thành công — ${TIER_NAMES[d.entity.tier]}!`, d.narrative);
        refetchMy();
      } else {
        showToast(d.message ?? "Lỗi thăng cấp");
      }
    },
    onError: () => { setAscendingId(null); showToast("Lỗi kết nối"); },
  });

  const triggerEventMutation = useMutation({
    mutationFn: () => fetch("/api/cosmos/event/trigger", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.event) { showToast(`Sự kiện vũ trụ: ${d.event.title}`); refetchMy(); }
      else showToast(d.message ?? "Lỗi");
    },
  });

  function showToast(msg: string, narrative?: string) {
    setToast({ msg, narrative });
    setTimeout(() => setToast(null), 6000);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!user) { setLocation("/login"); return null; }

  const myEntities = myData?.entities ?? [];
  const myEvents = myData?.events ?? [];

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% -5%, ${ACCENT}12, transparent 60%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 space-y-1">
          <div className="font-mono text-xs px-4 py-2 border text-center"
            style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
            {toast.msg}
          </div>
          {toast.narrative && (
            <div className="font-mono text-xs px-4 py-3 border border-purple-500/30 bg-purple-500/10 text-purple-200/90 leading-relaxed">
              {toast.narrative}
            </div>
          )}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center gap-4 border-b border-border/40">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🌀</span>
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>VŨ TRỤ PHÂN TẦNG</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-0 border border-border/50">
          {([
            { id: "my", label: "🌍 CỦA TÔI" },
            { id: "map", label: "🌌 BẢN ĐỒ VŨ TRỤ" },
            { id: "rankings", label: "👑 BẢNG XẾP HẠNG" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-3 font-orbitron text-xs tracking-widest transition-all"
              style={{
                backgroundColor: tab === t.id ? `${ACCENT}15` : "transparent",
                color: tab === t.id ? ACCENT : "hsl(var(--muted-foreground))",
                borderRight: "1px solid hsl(var(--border))",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Tab: CỦA TÔI */}
          {tab === "my" && (
            <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="font-orbitron text-xs tracking-widest" style={{ color: ACCENT }}>THỰC THỂ VŨ TRỤ CỦA BẠN</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={triggerEventMutation.isPending} onClick={() => triggerEventMutation.mutate()}
                    className="rounded-none font-mono text-xs border border-border/30">
                    {triggerEventMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                    KÍCH SỰ KIỆN
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => refetchMy()}
                    className="rounded-none font-mono text-xs border border-border/30">
                    <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>

              {myLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} /></div>}

              {!myLoading && myEntities.length === 0 && (
                <div className="text-center py-16 space-y-3">
                  <Globe className="w-16 h-16 mx-auto text-muted-foreground/20" />
                  <div className="font-mono text-xs text-muted-foreground/40">Hãy tạo thế giới đầu tiên để bắt đầu hành trình vũ trụ</div>
                  <Button onClick={() => setLocation("/world-creator")} variant="outline"
                    className="rounded-none font-orbitron text-xs">TẠO THẾ GIỚI</Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myEntities.map(e => {
                  const color = TIER_COLORS[e.tier] ?? ACCENT;
                  const canAscend = e.tier < 5;
                  const req = ASCEND_REQ[e.tier];
                  const meetsReq = req && e.population >= req.pop && e.wealth >= req.wealth && e.powerScore >= req.score;
                  return (
                    <div key={e.id} className="border p-5" style={{ borderColor: `${color}50` }}>
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl">{TIER_ICONS[e.tier]}</span>
                        <div className="flex-1">
                          <div className="font-orbitron text-sm font-bold">{e.entityName}</div>
                          <div className="font-mono text-xs mt-0.5" style={{ color }}>
                            {TIER_NAMES[e.tier]} • Điểm mạnh {e.powerScore}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {[
                          { label: "DÂN SỐ", value: e.population },
                          { label: "TÀI SẢN", value: e.wealth },
                          { label: "TIER", value: `${e.tier}/5` },
                        ].map(s => (
                          <div key={s.label} className="text-center border border-border/30 py-2">
                            <div className="font-orbitron text-sm font-bold" style={{ color }}>{s.value}</div>
                            <div className="font-mono text-xs text-muted-foreground/30">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {e.tier < 5 && <AscendProgress entity={e} />}
                      {canAscend && (
                        <Button size="sm" className="w-full mt-3 rounded-none font-orbitron text-xs border"
                          style={{ borderColor: meetsReq ? color : "hsl(var(--border))", color: meetsReq ? color : "hsl(var(--muted-foreground))", backgroundColor: meetsReq ? `${color}10` : "transparent" }}
                          disabled={!meetsReq || ascendMutation.isPending}
                          onClick={() => { setAscendingId(e.id); ascendMutation.mutate(e.id); }}>
                          {ascendingId === e.id && ascendMutation.isPending
                            ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />AI ĐANG THIÊN THĂNG...</>
                            : meetsReq
                              ? <><Zap className="w-3 h-3 mr-2" />THĂNG CẤP → {TIER_NAMES[e.tier + 1]}</>
                              : `CHƯA ĐỦ ĐIỀU KIỆN`}
                        </Button>
                      )}
                      {e.tier >= 5 && (
                        <div className="text-center py-2 font-orbitron text-xs" style={{ color }}>⚡ ĐÃ ĐẠT ĐỈNH VŨ TRỤ</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recent Events */}
              {myEvents.length > 0 && (
                <div className="border border-border/40 bg-card/30 p-5">
                  <div className="font-orbitron text-xs tracking-widest mb-4" style={{ color: ACCENT }}>📜 SỰ KIỆN VŨ TRỤ GẦN ĐÂY</div>
                  <div className="space-y-3">
                    {myEvents.slice(0, 5).map(ev => (
                      <div key={ev.id} className="border border-border/30 bg-background/30 p-3">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-orbitron text-xs font-bold">{ev.title}</div>
                          <span className="font-mono text-xs text-muted-foreground/30">{new Date(ev.occurredAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                        {ev.aiNarrative && (
                          <div className="font-mono text-xs text-muted-foreground/60 leading-relaxed line-clamp-3">{ev.aiNarrative}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Tab: BẢN ĐỒ */}
          {tab === "map" && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4">
              {mapLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} /></div>}
              {!mapLoading && (
                <>
                  <div className="font-mono text-xs text-muted-foreground/40 text-center">
                    {mapData?.entities.length ?? 0} thực thể trong vũ trụ hiện tại
                  </div>
                  {[5, 4, 3, 2, 1].map(tier => {
                    const tierEntities = (mapData?.entities ?? []).filter(e => e.tier === tier);
                    if (!tierEntities.length) return null;
                    const color = TIER_COLORS[tier] ?? ACCENT;
                    return (
                      <div key={tier}>
                        <div className="font-orbitron text-xs tracking-widest mb-2 flex items-center gap-2">
                          <span>{TIER_ICONS[tier]}</span>
                          <span style={{ color }}>{TIER_NAMES[tier]} ({tierEntities.length})</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {tierEntities.slice(0, 8).map(e => (
                            <div key={e.id} className="border p-3 text-center"
                              style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}>
                              <div className="font-mono text-xs font-bold truncate" style={{ color }}>{e.entityName}</div>
                              <div className="font-mono text-xs text-muted-foreground/30 mt-0.5">⚡ {e.powerScore}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}

          {/* Tab: BẢNG XẾP HẠNG */}
          {tab === "rankings" && (
            <motion.div key="rankings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">
              {rankLoading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} /></div>}
              {!rankLoading && Object.entries(rankData?.rankings ?? {}).sort(([a], [b]) => Number(b) - Number(a)).map(([tier, entities]) => {
                const color = TIER_COLORS[Number(tier)] ?? ACCENT;
                return (
                  <div key={tier}>
                    <div className="font-orbitron text-xs tracking-widest mb-3 flex items-center gap-2">
                      {TIER_ICONS[Number(tier)]} <span style={{ color }}>{TIER_NAMES[Number(tier)]}</span>
                    </div>
                    <div className="space-y-2">
                      {(entities as CosmicEntity[]).slice(0, 10).map((e, i) => (
                        <div key={e.id} className="flex items-center gap-3 border border-border/30 bg-card/20 px-4 py-3">
                          <span className="font-orbitron text-sm font-black w-6 text-center"
                            style={{ color: i < 3 ? color : "hsl(var(--muted-foreground))" }}>
                            {i + 1}
                          </span>
                          <span className="text-lg">{TIER_ICONS[e.tier]}</span>
                          <div className="flex-1">
                            <div className="font-mono text-xs font-bold">{e.entityName}</div>
                          </div>
                          <div className="font-orbitron text-sm font-bold" style={{ color }}>⚡ {e.powerScore}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
