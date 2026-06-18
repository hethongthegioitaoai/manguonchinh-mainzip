import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Loader2, RefreshCw, Sparkles, Globe, BookOpen, Coins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface NpcLife {
  occupation: string;
  currentGoal: string;
  mood: string;
  wealthLevel: string;
}

interface NpcWithLife {
  id: string; name: string; role: string; personality: string;
  active: boolean; life: NpcLife | null;
}

interface Festival { name: string; description: string; timing: string; }
interface Myth { title: string; content: string; }
interface Phrase { phrase: string; meaning: string; }

interface Culture {
  festivals: Festival[];
  taboos: string[];
  traditions: string[];
  myths: Myth[];
  commonPhrases: Phrase[];
  generatedAt: string;
}

interface Framework {
  progressionSystem?: { name: string; tiers: string[]; description: string };
  currency?: { primary: string; secondary: string; description: string };
  socialClasses?: Array<{ name: string; description: string }>;
  geography?: Array<{ name: string; type: string; description: string }>;
  terminology?: Record<string, string>;
  loreRules?: string;
  atmosphereColor?: string;
  tagline?: string;
}

interface WorldData {
  world: { id: string; slug: string; name: string; genre: string; lore: string };
  framework: Framework | null;
  npcs: NpcWithLife[];
  culture: Culture | null;
  economyState: { inflationRate: number; unemploymentRate: number; snapshot: Record<string, unknown> } | null;
}

const ROLE_ICONS: Record<string, string> = {
  merchant: "💹", guardian: "🛡️", raider: "🗡️", sage: "📿",
  assassin: "🗡️", healer: "💊", warlord: "⚔️",
};

const MOOD_COLORS: Record<string, string> = {
  happy: "#10b981", neutral: "#6b7280", anxious: "#f59e0b", angry: "#ef4444", fearful: "#8b5cf6",
};

export default function WorldProfilePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ worldSlug: string }>();
  const worldSlug = params.worldSlug;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "culture" | "npcs" | "economy">("overview");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  const { data, isLoading, refetch } = useQuery<WorldData>({
    queryKey: ["world-profile", worldSlug],
    queryFn: () => fetch(`/api/world/living/${worldSlug}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user && !!worldSlug,
  });

  const generateCultureMutation = useMutation({
    mutationFn: () => fetch(`/api/world/culture/generate/${worldSlug}`, {
      method: "POST", credentials: "include",
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.culture) {
        showToast("Đã sinh văn hóa thế giới");
        refetch();
      } else {
        showToast(d.message ?? "Lỗi sinh văn hóa");
      }
    },
    onError: () => showToast("Lỗi kết nối"),
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const ACCENT = data?.framework?.atmosphereColor ?? "#06b6d4";
  const world = data?.world;
  const framework = data?.framework;
  const culture = data?.culture;
  const npcs = data?.npcs ?? [];
  const economy = data?.economyState;
  const isOwner = world && (user as any).id === world.id;

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-56 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${ACCENT}20, transparent 60%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/world-creator")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> WORLD CREATOR
        </Button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>HỒ SƠ THẾ GIỚI</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}
          className="rounded-none font-mono text-xs text-muted-foreground border border-transparent hover:border-border/50">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </nav>

      {isLoading && (
        <div className="flex justify-center py-32 relative z-10">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
        </div>
      )}

      {!isLoading && world && (
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
          {/* Hero */}
          <div className="border-2 p-6 text-center"
            style={{ borderColor: ACCENT, backgroundColor: `${ACCENT}08` }}>
            <div className="font-mono text-xs tracking-widest mb-1" style={{ color: ACCENT }}>{world.genre.toUpperCase()}</div>
            <div className="font-orbitron text-3xl font-black mb-2">{world.name}</div>
            {framework?.tagline && <div className="font-mono text-sm text-muted-foreground/60 italic">"{framework.tagline}"</div>}
            <div className="font-mono text-xs text-muted-foreground/60 mt-3 leading-relaxed max-w-2xl mx-auto">{world.lore}</div>
            <div className="flex items-center justify-center gap-6 mt-4 font-mono text-xs text-muted-foreground/40">
              <span>👤 {npcs.filter(n => n.active).length} NPC</span>
              {framework?.currency && <span>🪙 {(framework.currency as any).primary}</span>}
              {framework?.progressionSystem && <span>⚡ {(framework.progressionSystem as any).name}</span>}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border border-border/50 overflow-x-auto">
            {([
              { id: "overview", label: "TỔNG QUAN" },
              { id: "culture", label: "VĂN HÓA" },
              { id: "npcs", label: `NPC (${npcs.filter(n => n.active).length})` },
              { id: "economy", label: "KINH TẾ" },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-3 font-orbitron text-xs tracking-widest transition-all min-w-[80px]"
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
            {/* Tab: Tổng Quan */}
            {tab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-5">
                {framework && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ACCENT }}>⚡ HỆ THỐNG TIẾN HÓA</div>
                        <div className="font-mono text-sm font-bold mb-1">{(framework.progressionSystem as any)?.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/60 mb-3">{(framework.progressionSystem as any)?.description}</div>
                        <div className="flex flex-wrap gap-1">
                          {((framework.progressionSystem as any)?.tiers ?? []).map((t: string, i: number) => (
                            <span key={i} className="font-mono text-xs px-2 py-0.5 border"
                              style={{ borderColor: `${ACCENT}40`, color: ACCENT, backgroundColor: `${ACCENT}10` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3 text-yellow-400">👑 TẦNG LỚP XÃ HỘI</div>
                        <div className="space-y-2">
                          {((framework.socialClasses as any[]) ?? []).map((c: any, i: number) => (
                            <div key={i} className="font-mono text-xs">
                              <span className="font-bold">{c.name}</span>
                              <span className="text-muted-foreground/50 ml-2">— {c.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3 text-green-400">🗺️ ĐỊA LÝ</div>
                        <div className="space-y-2">
                          {((framework.geography as any[]) ?? []).map((g: any, i: number) => (
                            <div key={i} className="font-mono text-xs">
                              <span className="font-bold">{g.name}</span>
                              <span className="text-muted-foreground/40 ml-1">[{g.type}]</span>
                              <div className="text-muted-foreground/50 mt-0.5">{g.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3 text-orange-400">📖 THUẬT NGỮ</div>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(framework.terminology ?? {}).map(([k, v]) => (
                            <div key={k} className="font-mono text-xs">
                              <div className="text-muted-foreground/40 text-xs uppercase">{k}</div>
                              <div className="font-bold" style={{ color: ACCENT }}>{v as string}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="border border-border/50 bg-card/40 p-5">
                      <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">⚖️ LUẬT LỆ THẾ GIỚI</div>
                      <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{framework.loreRules}</div>
                    </div>
                  </>
                )}

                {!framework && (
                  <div className="text-center py-12 font-mono text-xs text-muted-foreground/40">
                    Thế giới này chưa có framework đầy đủ — tạo thế giới qua chế độ SÁNG TẠO TỰ DO để có framework chi tiết
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Văn Hóa */}
            {tab === "culture" && (
              <motion.div key="culture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-5">
                {!culture ? (
                  <div className="text-center py-16 space-y-4">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20" />
                    <div className="font-mono text-sm text-muted-foreground/40">Thế giới chưa có văn hóa được sinh ra</div>
                    <Button onClick={() => generateCultureMutation.mutate()} disabled={generateCultureMutation.isPending}
                      className="rounded-none font-orbitron text-xs border"
                      style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                      {generateCultureMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />AI ĐANG SINH VĂN HÓA...</> : <><Sparkles className="w-3 h-3 mr-2" />SINH VĂN HÓA THẾ GIỚI</>}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="font-mono text-xs text-muted-foreground/40">
                        Sinh lúc: {new Date(culture.generatedAt).toLocaleDateString("vi-VN")}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => generateCultureMutation.mutate()}
                        disabled={generateCultureMutation.isPending}
                        className="rounded-none font-mono text-xs border border-border/30">
                        {generateCultureMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                        TÁI SINH
                      </Button>
                    </div>

                    <div className="border border-border/50 bg-card/40 p-5">
                      <div className="font-orbitron text-xs tracking-widest mb-4" style={{ color: ACCENT }}>🎉 LỄ HỘI ({culture.festivals?.length ?? 0})</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(culture.festivals as Festival[]).map((f, i) => (
                          <div key={i} className="border border-border/30 bg-background/40 p-4">
                            <div className="font-orbitron text-xs font-bold mb-1">{f.name}</div>
                            <div className="font-mono text-xs text-muted-foreground/60 mb-2">{f.description}</div>
                            <div className="font-mono text-xs text-muted-foreground/30">📅 {f.timing}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">⛔ ĐIỀU CẤM KỴ</div>
                        <ul className="space-y-2">
                          {(culture.taboos as string[]).map((t, i) => (
                            <li key={i} className="font-mono text-xs text-muted-foreground/70 flex gap-2">
                              <span className="text-red-400 flex-shrink-0">▸</span>{t}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border border-border/50 bg-card/40 p-5">
                        <div className="font-orbitron text-xs tracking-widest mb-3 text-green-400">🌿 PHONG TỤC</div>
                        <ul className="space-y-2">
                          {(culture.traditions as string[]).map((t, i) => (
                            <li key={i} className="font-mono text-xs text-muted-foreground/70 flex gap-2">
                              <span className="text-green-400 flex-shrink-0">▸</span>{t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="border border-border/50 bg-card/40 p-5">
                      <div className="font-orbitron text-xs tracking-widest mb-4 text-purple-400">📖 HUYỀN THOẠI</div>
                      <div className="space-y-3">
                        {(culture.myths as Myth[]).map((m, i) => (
                          <div key={i} className="border border-purple-500/20 bg-purple-500/5 p-4">
                            <div className="font-orbitron text-xs font-bold mb-1 text-purple-300">{m.title}</div>
                            <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{m.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-border/50 bg-card/40 p-5">
                      <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ACCENT }}>💬 CÂU NÓI ĐẶC TRƯNG</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(culture.commonPhrases as Phrase[]).map((p, i) => (
                          <div key={i} className="border border-border/30 bg-background/40 p-3">
                            <div className="font-mono text-sm font-bold italic" style={{ color: ACCENT }}>"{p.phrase}"</div>
                            <div className="font-mono text-xs text-muted-foreground/50 mt-1">→ {p.meaning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab: NPCs */}
            {tab === "npcs" && (
              <motion.div key="npcs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-3">
                {npcs.filter(n => n.active).length === 0 ? (
                  <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    Chưa có NPC trong thế giới này
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {npcs.filter(n => n.active).map(npc => (
                      <div key={npc.id} className="border border-border/50 bg-card/40 p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{ROLE_ICONS[npc.role] ?? "👤"}</span>
                          <div>
                            <div className="font-orbitron text-sm font-bold">{npc.name}</div>
                            <div className="font-mono text-xs text-muted-foreground/50">{npc.role}</div>
                          </div>
                          {npc.life && (
                            <div className="ml-auto flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MOOD_COLORS[npc.life.mood] ?? "#6b7280" }} />
                              <span className="font-mono text-xs" style={{ color: MOOD_COLORS[npc.life.mood] ?? "#6b7280" }}>{npc.life.mood}</span>
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60 line-clamp-2 mb-2">{npc.personality}</div>
                        {npc.life && (
                          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                            {npc.life.occupation && <div><span className="text-muted-foreground/40">Nghề: </span>{npc.life.occupation}</div>}
                            {npc.life.wealthLevel && <div><span className="text-muted-foreground/40">Tài sản: </span>{npc.life.wealthLevel}</div>}
                            {npc.life.currentGoal && (
                              <div className="col-span-2"><span className="text-muted-foreground/40">Mục tiêu: </span>
                                <span className="text-muted-foreground/70">{npc.life.currentGoal}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Kinh Tế */}
            {tab === "economy" && (
              <motion.div key="economy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-5">
                {framework?.currency && (
                  <div className="border border-border/50 bg-card/40 p-5">
                    <div className="font-orbitron text-xs tracking-widest mb-3 text-yellow-400">🪙 HỆ THỐNG TIỀN TỆ</div>
                    <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                      <div>
                        <div className="text-muted-foreground/40 text-xs mb-1">TIỀN TỆ CHÍNH</div>
                        <div className="font-bold text-yellow-400">{(framework.currency as any).primary}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground/40 text-xs mb-1">TIỀN TỆ QUÝ</div>
                        <div className="font-bold">{(framework.currency as any).secondary}</div>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/60 mt-3">{(framework.currency as any).description}</div>
                  </div>
                )}

                {economy ? (
                  <div className="border border-border/50 bg-card/40 p-5">
                    <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ACCENT }}>📊 TRẠNG THÁI KINH TẾ HIỆN TẠI</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground/40 mb-1">LẠM PHÁT</div>
                        <div className="font-orbitron text-lg font-bold"
                          style={{ color: economy.inflationRate > 3 ? "#ef4444" : "#10b981" }}>
                          {economy.inflationRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-xs text-muted-foreground/40 mb-1">THẤT NGHIỆP</div>
                        <div className="font-orbitron text-lg font-bold"
                          style={{ color: economy.unemploymentRate > 15 ? "#ef4444" : "#10b981" }}>
                          {economy.unemploymentRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-xs text-muted-foreground/40 mb-1">THƯƠNG MẠI</div>
                        <div className="font-orbitron text-lg font-bold" style={{ color: ACCENT }}>
                          {(economy.snapshot as any)?.marketActivity ?? "normal"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 font-mono text-xs text-muted-foreground/40">
                    <Coins className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    Kinh tế chưa được khởi tạo — nhấn "Sinh Văn Hóa" trong tab VĂN HÓA để cập nhật
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isLoading && !world && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Globe className="w-12 h-12 text-muted-foreground/20" />
          <div className="font-mono text-sm text-muted-foreground/50">Thế giới không tồn tại</div>
          <Button onClick={() => setLocation("/world-creator")} variant="outline"
            className="rounded-none font-orbitron text-xs">
            VỀ WORLD CREATOR
          </Button>
        </div>
      )}
    </div>
  );
}
