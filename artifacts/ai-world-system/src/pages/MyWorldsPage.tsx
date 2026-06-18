import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Plus, Globe, Users, Coins, GitBranch, Sparkles, Link2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";

interface WorldStats {
  id: string; slug: string; name: string; genre: string; lore: string;
  npcCount: number; playerCount: number; portalCount: number;
  createdBy: string;
}

interface Portal {
  id: string; fromWorldSlug: string; toWorldSlug: string;
  portalName: string; portalType: string; travelCost: number;
  aiNarrative: string;
}

interface StarDomain {
  id: string; domainName: string; worldSlugs: string[];
  domainLevel: number; totalPopulation: number; totalWealth: number;
}

interface MyWorldsData {
  slot: { maxWorlds: number; currentWorlds: number };
  worlds: WorldStats[];
  portals: Portal[];
  starDomain: StarDomain | null;
}

const ACCENT = "#a78bfa";
const GENRE_ICONS: Record<string, string> = {
  cultivation: "⚔️", cyberpunk: "🤖", fantasy: "🧙", horror: "💀",
  scifi: "🚀", apocalypse: "☢️", historical: "🏛️", romance: "💎",
};

export default function MyWorldsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [toast, setToast] = useState<string | null>(null);
  const [showPortalForm, setShowPortalForm] = useState(false);
  const [portalFrom, setPortalFrom] = useState("");
  const [portalTo, setPortalTo] = useState("");
  const [portalName, setPortalName] = useState("");

  const { data, isLoading, refetch } = useQuery<MyWorldsData>({
    queryKey: ["my-worlds"],
    queryFn: () => fetch("/api/multiworld/my-worlds", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const createPortalMutation = useMutation({
    mutationFn: () => fetch("/api/multiworld/portal/create", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWorldSlug: portalFrom, toWorldSlug: portalTo, portalName, portalType: "owner_only" }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.portal) { showToast("Đã tạo cổng truyền tống"); setShowPortalForm(false); refetch(); }
      else showToast(d.message ?? "Lỗi tạo cổng");
    },
    onError: () => showToast("Lỗi kết nối"),
  });

  const createDomainMutation = useMutation({
    mutationFn: () => fetch("/api/multiworld/domain/create", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName: `Tinh Vực ${(user as any)?.username ?? ""}` }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.domain) { showToast("Tinh Vực đã hình thành!"); refetch(); }
      else showToast(d.message ?? "Chưa đủ điều kiện");
    },
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!user) { setLocation("/login"); return null; }

  const worlds = data?.worlds ?? [];
  const portals = data?.portals ?? [];
  const slot = data?.slot;
  const domain = data?.starDomain;
  const canCreateDomain = worlds.length >= 3 && !domain;

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-48 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${ACCENT}18, transparent 60%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center gap-4 border-b border-border/40">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>CÁC THẾ GIỚI CỦA TÔI</span>
        </div>
        {slot && (
          <span className="ml-auto font-mono text-xs text-muted-foreground/40">
            {slot.currentWorlds}/{slot.maxWorlds} thế giới
          </span>
        )}
      </nav>

      {isLoading && <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} /></div>}

      {!isLoading && (
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">

          {/* Star Domain Banner */}
          {domain ? (
            <div className="border-2 p-6 text-center cursor-pointer" style={{ borderColor: ACCENT, backgroundColor: `${ACCENT}08` }}
              onClick={() => setLocation("/star-domain")}>
              <div className="font-mono text-xs tracking-widest mb-1 text-yellow-400">⭐ TINH VỰC CỦA BẠN</div>
              <div className="font-orbitron text-2xl font-black mb-1" style={{ color: ACCENT }}>{domain.domainName}</div>
              <div className="font-mono text-xs text-muted-foreground/50">
                {(domain.worldSlugs as string[]).length} thế giới • {domain.totalPopulation} dân • Level {domain.domainLevel}
              </div>
              <div className="font-mono text-xs mt-2" style={{ color: ACCENT }}>→ XEM TINH VỰC</div>
            </div>
          ) : canCreateDomain ? (
            <div className="border border-yellow-500/40 bg-yellow-500/5 p-5 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="font-orbitron text-sm font-bold mb-1 text-yellow-400">ĐỦ ĐIỀU KIỆN THÀNH LẬP TINH VỰC</div>
              <div className="font-mono text-xs text-muted-foreground/50 mb-3">Bạn có ≥3 thế giới — kết hợp chúng thành một Tinh Vực hùng mạnh</div>
              <Button onClick={() => createDomainMutation.mutate()} disabled={createDomainMutation.isPending}
                className="rounded-none font-orbitron text-xs border"
                style={{ borderColor: "#facc15", color: "#facc15", backgroundColor: "#facc1510" }}>
                {createDomainMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                THÀNH LẬP TINH VỰC
              </Button>
            </div>
          ) : null}

          {/* Worlds Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>THẾ GIỚI ({worlds.length})</div>
              <Button size="sm" onClick={() => setLocation("/world-creator")}
                className="rounded-none font-orbitron text-xs border"
                style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                <Plus className="w-3 h-3 mr-1" /> TẠO MỚI
              </Button>
            </div>
            {worlds.length === 0 ? (
              <div className="text-center py-16 font-mono text-xs text-muted-foreground/30">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
                Bạn chưa tạo thế giới nào
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {worlds.map(w => (
                  <div key={w.id} className="border border-border/50 bg-card/40 p-5 group">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">{GENRE_ICONS[w.genre] ?? "🌍"}</span>
                      <div className="flex-1">
                        <div className="font-orbitron text-sm font-bold">{w.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/40">{w.genre}</div>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/60 line-clamp-2 mb-3">{w.lore}</div>
                    <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground/30 mb-3">
                      <span><Users className="inline w-3 h-3 mr-1" />{w.npcCount} NPC</span>
                      <span><Users className="inline w-3 h-3 mr-1" />{w.playerCount} player</span>
                      <span><Link2 className="inline w-3 h-3 mr-1" />{w.portalCount} cổng</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/world-profile/${w.slug}`)}
                        className="flex-1 rounded-none font-mono text-xs border border-border/40">
                        HỒ SƠ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/god/${w.slug}`)}
                        className="flex-1 rounded-none font-mono text-xs border"
                        style={{ borderColor: `${ACCENT}50`, color: ACCENT }}>
                        GOD MODE
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portals */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="font-orbitron text-sm tracking-widest text-cyan-400">CỔNG TRUYỀN TỐNG ({portals.length})</div>
              {worlds.length >= 2 && (
                <Button size="sm" onClick={() => setShowPortalForm(!showPortalForm)}
                  className="rounded-none font-orbitron text-xs border border-cyan-500/50 text-cyan-400 bg-cyan-500/5">
                  <Plus className="w-3 h-3 mr-1" /> TẠO CỔNG
                </Button>
              )}
            </div>

            <AnimatePresence>
              {showPortalForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="border border-cyan-500/30 bg-cyan-500/5 p-5 mb-4 space-y-3">
                  <div className="font-orbitron text-xs tracking-widest text-cyan-400">🌀 TẠO CỔNG MỚI</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground/40 mb-1">THẾ GIỚI NGUỒN</div>
                      <select value={portalFrom} onChange={e => setPortalFrom(e.target.value)}
                        className="w-full bg-background border border-border/50 rounded-none p-2 font-mono text-xs">
                        <option value="">-- Chọn --</option>
                        {worlds.map(w => <option key={w.slug} value={w.slug}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="font-mono text-xs text-muted-foreground/40 mb-1">THẾ GIỚI ĐÍCH</div>
                      <select value={portalTo} onChange={e => setPortalTo(e.target.value)}
                        className="w-full bg-background border border-border/50 rounded-none p-2 font-mono text-xs">
                        <option value="">-- Chọn --</option>
                        {worlds.filter(w => w.slug !== portalFrom).map(w => <option key={w.slug} value={w.slug}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <input value={portalName} onChange={e => setPortalName(e.target.value)}
                    placeholder="Tên cổng (VD: Cổng Hư Không, Thiên Địa Chi Môn...)"
                    className="w-full bg-background border border-border/50 rounded-none p-2 font-mono text-xs" />
                  <Button onClick={() => createPortalMutation.mutate()} disabled={createPortalMutation.isPending || !portalFrom || !portalTo}
                    className="w-full rounded-none font-orbitron text-xs border border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
                    {createPortalMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />AI ĐANG KIẾN TẠO CỔNG...</> : "✨ TẠO CỔNG TRUYỀN TỐNG"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {portals.length === 0 ? (
              <div className="text-center py-8 font-mono text-xs text-muted-foreground/30">Chưa có cổng nào — cần ≥2 thế giới để tạo cổng</div>
            ) : (
              <div className="space-y-3">
                {portals.map(p => (
                  <div key={p.id} className="border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-orbitron text-xs font-bold text-cyan-300">{p.portalName}</span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/50">
                      {p.fromWorldSlug} → {p.toWorldSlug} • {p.portalType}
                    </div>
                    {p.aiNarrative && (
                      <div className="font-mono text-xs text-muted-foreground/40 mt-2 italic leading-relaxed line-clamp-2">{p.aiNarrative}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
