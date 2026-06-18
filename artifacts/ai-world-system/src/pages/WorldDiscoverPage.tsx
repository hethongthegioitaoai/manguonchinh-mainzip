import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Sparkles, Globe, ChevronRight, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const GENRES: Record<string, { label: string; icon: string; color: string }> = {
  tu_tien: { label: "Tu Tiên", icon: "⚡", color: "#06b6d4" },
  cyberpunk: { label: "Cyberpunk", icon: "🔌", color: "#a855f7" },
  fantasy: { label: "Fantasy", icon: "🗡️", color: "#22c55e" },
  xianxia: { label: "Tiên Hiệp", icon: "☁️", color: "#06b6d4" },
  horror: { label: "Kinh Dị", icon: "💀", color: "#ef4444" },
  scifi: { label: "Khoa Học VT", icon: "🚀", color: "#3b82f6" },
  wasteland: { label: "Hoang Phế", icon: "☢️", color: "#f97316" },
  steampunk: { label: "Steampunk", icon: "⚙️", color: "#eab308" },
};

interface CustomWorld {
  id: string;
  name: string;
  genre: string;
  lore: string;
  description: string;
  rules: string;
  bossData: Array<{ name: string; level: number; description: string }>;
  factionData: Array<{ name: string; type: string; description: string }>;
  npcData: Array<{ name: string; role: string; personality: string }>;
  createdBy: string | null;
  createdAt: string;
}

export default function WorldDiscoverPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CustomWorld | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["custom-worlds"],
    queryFn: () => fetch("/api/custom-worlds", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch("/api/custom-worlds/generate-ai", { method: "POST", credentials: "include" }).then(r => r.json()),
    onMutate: () => setGenerating(true),
    onSuccess: (data) => {
      setGenerating(false);
      if (data.world) {
        qc.invalidateQueries({ queryKey: ["custom-worlds"] });
        setSelected(data.world);
        showToast(`✨ AI đã tạo thế giới "${data.world.name}"`);
      } else {
        showToast(data.message ?? "Lỗi tạo thế giới");
      }
    },
    onError: () => { setGenerating(false); showToast("Lỗi kết nối server"); },
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  const worlds: CustomWorld[] = data?.worlds ?? [];
  const aiWorlds = worlds.filter(w => !w.createdBy);
  const playerWorlds = worlds.filter(w => !!w.createdBy);

  const ACCENT = "#06b6d4";

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 60% -10%, #a855f720, transparent 65%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border whitespace-nowrap"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="sm"
          onClick={() => selected ? setSelected(null) : setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> {selected ? "KHÁM PHÁ" : "DASHBOARD"}
        </Button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: "#a855f7" }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: "#a855f7" }}>WORLD DISCOVERY</span>
        </div>
        <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generating}
          className="rounded-none font-orbitron text-xs border"
          style={{ borderColor: "#a855f7", color: "#a855f7", backgroundColor: "#a855f715" }}>
          {generating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> ĐANG TẠO...</> : <><Sparkles className="w-3 h-3 mr-1" /> AI SINH THẾ GIỚI</>}
        </Button>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">

          {!selected && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-orbitron text-2xl font-black tracking-widest">KHÁM PHÁ THẾ GIỚI</div>
                  <div className="font-mono text-xs text-muted-foreground/50 mt-1">
                    {worlds.length} thế giới đang chờ bạn — AI sinh tự động hoặc do cộng đồng tạo
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetch()}
                  className="rounded-none font-mono text-xs border border-border/30 text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3 h-3 mr-1" /> Làm mới
                </Button>
              </div>

              {isLoading && (
                <div className="flex justify-center py-32">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#a855f7" }} />
                </div>
              )}

              {!isLoading && (
                <>
                  {aiWorlds.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Sparkles className="w-4 h-4" style={{ color: "#a855f7" }} />
                        <span className="font-orbitron text-xs tracking-widest" style={{ color: "#a855f7" }}>
                          THẾ GIỚI DO AI TẠO — {aiWorlds.length} THẾ GIỚI
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {aiWorlds.map((w, i) => (
                          <WorldCard key={w.id} world={w} index={i} onClick={() => setSelected(w)} isAI />
                        ))}
                        <motion.div
                          whileHover={{ y: -2 }}
                          onClick={() => generateMutation.mutate()}
                          className="border border-dashed border-border/30 p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-purple-500/40 transition-all min-h-[160px]"
                          style={{ backgroundColor: generating ? "#a855f708" : "transparent" }}>
                          {generating ? (
                            <>
                              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#a855f7" }} />
                              <div className="font-mono text-xs text-muted-foreground/50 text-center">AI đang sáng tạo...</div>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-8 h-8 text-muted-foreground/20" />
                              <div className="font-orbitron text-xs text-muted-foreground/40 text-center">AI SINH THẾ GIỚI MỚI</div>
                              <div className="font-mono text-xs text-muted-foreground/25 text-center">Nhấn để tạo ngay</div>
                            </>
                          )}
                        </motion.div>
                      </div>
                    </div>
                  )}

                  {aiWorlds.length === 0 && (
                    <div className="border border-dashed border-border/30 rounded-none p-12 text-center space-y-4">
                      <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/15" />
                      <div className="font-orbitron text-lg text-muted-foreground/30">CHƯA CÓ THẾ GIỚI AI NÀO</div>
                      <div className="font-mono text-xs text-muted-foreground/25">Nhấn "AI SINH THẾ GIỚI" để AI tạo thế giới đầu tiên</div>
                      <Button onClick={() => generateMutation.mutate()} disabled={generating}
                        className="rounded-none font-orbitron text-xs border"
                        style={{ borderColor: "#a855f7", color: "#a855f7", backgroundColor: "#a855f710" }}>
                        {generating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> ĐANG SINH...</> : <><Sparkles className="w-3 h-3 mr-1" /> KHAI PHÁ VŨ TRỤ</>}
                      </Button>
                    </div>
                  )}

                  {playerWorlds.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <Globe className="w-4 h-4" style={{ color: ACCENT }} />
                        <span className="font-orbitron text-xs tracking-widest" style={{ color: ACCENT }}>
                          CỘNG ĐỒNG — {playerWorlds.length} THẾ GIỚI
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                        <button onClick={() => setLocation("/world-creator")}
                          className="font-mono text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center gap-1">
                          Tạo thế giới của bạn <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playerWorlds.map((w, i) => (
                          <WorldCard key={w.id} world={w} index={i} onClick={() => setSelected(w)} isAI={false} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {selected && (
            <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-6">
              <WorldDetail world={selected} onEnter={() => setLocation(`/create-character/${selected.id}`)} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

function WorldCard({ world, index, onClick, isAI }: { world: CustomWorld; index: number; onClick: () => void; isAI: boolean }) {
  const g = GENRES[world.genre];
  const color = g?.color ?? "#06b6d4";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group border border-border/50 bg-card/40 p-5 cursor-pointer hover:border-opacity-100 transition-all relative overflow-hidden"
      style={{ borderColor: `${color}40` }}>
      <div className="absolute top-0 left-0 w-full h-px" style={{ backgroundColor: color, opacity: 0.4 }} />
      {isAI && (
        <div className="absolute top-3 right-3">
          <span className="font-mono text-xs px-1.5 py-0.5" style={{ color: "#a855f7", backgroundColor: "#a855f715", border: "1px solid #a855f730" }}>AI</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{g?.icon ?? "🌍"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-orbitron text-sm font-bold truncate pr-6">{world.name}</div>
          <div className="font-mono text-xs mt-0.5" style={{ color }}>{g?.label ?? world.genre}</div>
          <div className="font-mono text-xs text-muted-foreground/50 mt-2 line-clamp-2 leading-relaxed">{world.lore}</div>
          <div className="flex items-center gap-3 mt-3 font-mono text-xs text-muted-foreground/30">
            <span>👹 {world.bossData?.length ?? 0}</span>
            <span>🏴 {world.factionData?.length ?? 0}</span>
            <span>👤 {world.npcData?.length ?? 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function WorldDetail({ world, onEnter }: { world: CustomWorld; onEnter: () => void }) {
  const g = GENRES[world.genre];
  const color = g?.color ?? "#06b6d4";

  return (
    <div className="space-y-5">
      <div className="border-2 p-8 text-center relative overflow-hidden"
        style={{ borderColor: color, backgroundColor: `${color}08` }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${color}, transparent 60%)` }} />
        <div className="relative z-10">
          <div className="text-4xl mb-3">{g?.icon ?? "🌍"}</div>
          <div className="font-mono text-xs tracking-widest mb-2" style={{ color }}>THẾ GIỚI {g?.label?.toUpperCase() ?? world.genre.toUpperCase()}</div>
          <div className="font-orbitron text-3xl font-black mb-1">{world.name}</div>
          {!world.createdBy && (
            <div className="font-mono text-xs mt-2 px-3 py-1 inline-block" style={{ color: "#a855f7", backgroundColor: "#a855f715", border: "1px solid #a855f730" }}>
              <Sparkles className="w-3 h-3 inline mr-1" />
              ĐƯỢC SINH BỞI AI
            </div>
          )}
        </div>
      </div>

      <div className="border border-border/50 bg-card/40 p-5">
        <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color }}>LỊCH SỬ THẾ GIỚI</div>
        <div className="font-mono text-sm text-muted-foreground/80 leading-relaxed">{world.lore}</div>
        {world.rules && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="font-orbitron text-xs tracking-widest mb-2 text-muted-foreground/50">LUẬT LỆ</div>
            <div className="font-mono text-xs text-muted-foreground/60">{world.rules}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border/50 bg-card/40 p-4">
          <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">👹 BOSS ({world.bossData?.length ?? 0})</div>
          {(world.bossData as any[]).map((b: any, i: number) => (
            <div key={i} className="font-mono text-xs mb-2">
              <div className="font-bold">{b.name} <span className="text-muted-foreground/40">Lv{b.level}</span></div>
              <div className="text-muted-foreground/50 text-xs mt-0.5">{b.description}</div>
            </div>
          ))}
        </div>

        <div className="border border-border/50 bg-card/40 p-4">
          <div className="font-orbitron text-xs tracking-widest mb-3 text-purple-400">🏴 PHE PHÁI ({world.factionData?.length ?? 0})</div>
          {(world.factionData as any[]).map((f: any, i: number) => (
            <div key={i} className="font-mono text-xs mb-2">
              <div className="font-bold">{f.name} <span className="text-muted-foreground/40">[{f.type}]</span></div>
              <div className="text-muted-foreground/50 text-xs mt-0.5">{f.description}</div>
            </div>
          ))}
        </div>

        <div className="border border-border/50 bg-card/40 p-4">
          <div className="font-orbitron text-xs tracking-widest mb-3 text-cyan-400">👤 NPC ({world.npcData?.length ?? 0})</div>
          {(world.npcData as any[]).map((n: any, i: number) => (
            <div key={i} className="font-mono text-xs mb-2">
              <div className="font-bold">{n.name} <span className="text-muted-foreground/40">[{n.role}]</span></div>
              <div className="text-muted-foreground/50 text-xs mt-0.5">{n.personality}</div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={onEnter}
        className="w-full rounded-none font-orbitron text-sm tracking-widest border h-14"
        style={{ borderColor: color, color, backgroundColor: `${color}15` }}>
        <Zap className="w-4 h-4 mr-2" />
        NHẬP THẾ GIỚI NÀY
      </Button>
    </div>
  );
}
