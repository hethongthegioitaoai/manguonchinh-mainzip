import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Sparkles, Globe, ChevronRight, Trash2, Wand2, BookOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const GENRES = [
  { value: "tu_tien", label: "Tu Tiên", icon: "⚡", desc: "Linh khí, cảnh giới, tông môn" },
  { value: "cyberpunk", label: "Cyberpunk", icon: "🔌", desc: "Megacorp, hacker, neon city" },
  { value: "fantasy", label: "Fantasy", icon: "🗡️", desc: "Phép thuật, rồng, vương quốc" },
  { value: "xianxia", label: "Tiên Hiệp", icon: "☁️", desc: "Tu tiên tiên giới, thiên kiếp" },
  { value: "horror", label: "Kinh Dị", icon: "💀", desc: "Bóng tối, thực thể, sinh tồn" },
  { value: "scifi", label: "Khoa Học Viễn Tưởng", icon: "🚀", desc: "Không gian, AI, nền văn minh" },
  { value: "wasteland", label: "Hoang Phế", icon: "☢️", desc: "Hậu tận thế, mutant, scavenger" },
  { value: "steampunk", label: "Steampunk", icon: "⚙️", desc: "Hơi nước, máy móc, đế chế" },
] as const;

type Genre = typeof GENRES[number]["value"];

interface CustomWorld {
  id: string;
  slug: string;
  name: string;
  genre: Genre;
  lore: string;
  description: string;
  rules: string;
  bossData: Array<{ name: string; level: number; description: string }>;
  factionData: Array<{ name: string; type: string; description: string }>;
  npcData: Array<{ name: string; role: string; personality: string; goals: string[] }>;
  createdBy: string;
  createdAt: string;
}

interface Framework {
  progressionSystem: { name: string; tiers: string[]; description: string };
  currency: { primary: string; secondary: string; description: string };
  socialClasses: Array<{ name: string; description: string }>;
  geography: Array<{ name: string; type: string; description: string }>;
  terminology: Record<string, string>;
  loreRules: string;
  atmosphereColor: string;
  tagline: string;
}

interface LoreEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  aiGenerated: boolean;
}

const GENRE_LABELS: Record<string, string> = Object.fromEntries(GENRES.map(g => [g.value, g.label]));
const GENRE_ICONS: Record<string, string> = Object.fromEntries(GENRES.map(g => [g.value, g.icon]));

const LORE_CATEGORY_ICONS: Record<string, string> = {
  history: "📜", faction: "🏴", geography: "🗺️", creature: "🐉", item: "⚔️", law: "⚖️",
};
const LORE_CATEGORY_LABELS: Record<string, string> = {
  history: "Lịch Sử", faction: "Phe Phái", geography: "Địa Danh", creature: "Sinh Vật", item: "Vật Phẩm", law: "Luật Lệ",
};

export default function WorldCreatorPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"preset" | "free">("free");
  const [step, setStep] = useState<"list" | "form" | "result">("list");
  const [form, setForm] = useState({ name: "", genre: "fantasy" as Genre, rules: "", description: "" });
  const [freeForm, setFreeForm] = useState({ name: "", theme: "" });
  const [result, setResult] = useState<{ world: CustomWorld; tagline: string; atmosphereColor: string } | null>(null);
  const [freeResult, setFreeResult] = useState<{ world: CustomWorld; framework: Framework; loreEntries: LoreEntry[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewingFramework, setViewingFramework] = useState<{ world: CustomWorld; framework: Framework | null; loreEntries: LoreEntry[] } | null>(null);
  const [addLoreForm, setAddLoreForm] = useState({ category: "history", title: "", content: "", open: false });

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-worlds"],
    queryFn: () => fetch("/api/custom-worlds", { credentials: "include" }).then(r => r.json()),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/custom-worlds/create", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.world) {
        setResult(data);
        setStep("result");
        qc.invalidateQueries({ queryKey: ["custom-worlds"] });
      } else {
        showToast(data.message ?? "Lỗi tạo thế giới");
      }
    },
    onError: () => showToast("Lỗi kết nối server"),
  });

  const createFreeMutation = useMutation({
    mutationFn: (body: typeof freeForm) =>
      fetch("/api/world/create-free", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.world) {
        setFreeResult(data);
        setStep("result");
        qc.invalidateQueries({ queryKey: ["custom-worlds"] });
      } else {
        showToast(data.message ?? "Lỗi tạo thế giới");
      }
    },
    onError: () => showToast("Lỗi kết nối server"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/custom-worlds/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-worlds"] }); showToast("Đã xóa thế giới"); },
  });

  const addLoreMutation = useMutation({
    mutationFn: ({ worldSlug, data }: { worldSlug: string; data: { category: string; title: string; content: string } }) =>
      fetch(`/api/world/lore/${worldSlug}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.entry && viewingFramework) {
        setViewingFramework(prev => prev ? { ...prev, loreEntries: [data.entry, ...prev.loreEntries] } : prev);
        setAddLoreForm({ category: "history", title: "", content: "", open: false });
        showToast("Đã thêm lore entry");
      } else {
        showToast(data.message ?? "Lỗi thêm lore");
      }
    },
  });

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function handleCreate() {
    if (!form.name.trim()) { showToast("Vui lòng nhập tên thế giới"); return; }
    createMutation.mutate(form);
  }

  function handleCreateFree() {
    if (!freeForm.name.trim()) { showToast("Vui lòng nhập tên thế giới"); return; }
    if (freeForm.theme.trim().length < 10) { showToast("Mô tả tối thiểu 10 ký tự để AI hiểu ý tưởng của bạn"); return; }
    createFreeMutation.mutate(freeForm);
  }

  async function handleViewFramework(world: CustomWorld) {
    setViewingFramework({ world, framework: null, loreEntries: [] });
    try {
      const r = await fetch(`/api/world/framework/${world.slug}`, { credentials: "include" });
      const d = await r.json();
      setViewingFramework({ world, framework: d.framework, loreEntries: d.loreEntries ?? [] });
    } catch {
      showToast("Lỗi tải framework");
    }
  }

  const worlds: CustomWorld[] = data?.worlds ?? [];
  const ACCENT = "#06b6d4";
  const isPending = createMutation.isPending || createFreeMutation.isPending;

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
    </div>
  );

  if (viewingFramework) {
    const { world, framework, loreEntries } = viewingFramework;
    const ac = framework?.atmosphereColor ?? ACCENT;
    const isOwner = (user as any).id === world.createdBy;
    return (
      <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
          style={{ background: `radial-gradient(ellipse at 30% -10%, ${ac}15, transparent 65%)` }} />
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
            style={{ borderColor: ac, color: ac, backgroundColor: `${ac}15` }}>
            {toast}
          </motion.div>
        )}
        <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
          <Button variant="ghost" size="sm" onClick={() => setViewingFramework(null)}
            className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
            <ArrowLeft className="w-4 h-4 mr-1" /> DANH SÁCH
          </Button>
          <div className="font-orbitron text-sm tracking-widest" style={{ color: ac }}>FRAMEWORK THẾ GIỚI</div>
          <div className="w-24" />
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
          <div className="border-2 p-6" style={{ borderColor: ac, backgroundColor: `${ac}08` }}>
            <div className="font-mono text-xs tracking-widest mb-1" style={{ color: ac }}>THẾ GIỚI</div>
            <div className="font-orbitron text-2xl font-black mb-2">{world.name}</div>
            {framework?.tagline && <div className="font-mono text-sm text-muted-foreground/60 italic">"{framework.tagline}"</div>}
            <div className="font-mono text-xs text-muted-foreground/70 mt-3 leading-relaxed">{world.lore}</div>
          </div>

          {!framework && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: ac }} />
            </div>
          )}

          {framework && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border/50 bg-card/40 p-5">
                  <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ac }}>⚡ HỆ THỐNG TIẾN HÓA</div>
                  <div className="font-mono text-sm font-bold mb-1">{framework.progressionSystem?.name}</div>
                  <div className="font-mono text-xs text-muted-foreground/60 mb-3">{framework.progressionSystem?.description}</div>
                  <div className="flex flex-wrap gap-1">
                    {framework.progressionSystem?.tiers?.map((t, i) => (
                      <span key={i} className="font-mono text-xs px-2 py-0.5 border"
                        style={{ borderColor: `${ac}40`, color: ac, backgroundColor: `${ac}10` }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border border-border/50 bg-card/40 p-5">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-yellow-400">🪙 KINH TẾ</div>
                  <div className="font-mono text-sm font-bold">{framework.currency?.primary}</div>
                  <div className="font-mono text-xs text-muted-foreground/40">+ {framework.currency?.secondary}</div>
                  <div className="font-mono text-xs text-muted-foreground/60 mt-2">{framework.currency?.description}</div>
                </div>

                <div className="border border-border/50 bg-card/40 p-5">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-purple-400">👑 TẦNG LỚP XÃ HỘI</div>
                  <div className="space-y-2">
                    {framework.socialClasses?.map((c, i) => (
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
                    {framework.geography?.map((g, i) => (
                      <div key={i} className="font-mono text-xs">
                        <span className="font-bold">{g.name}</span>
                        <span className="text-muted-foreground/40 ml-1">[{g.type}]</span>
                        <div className="text-muted-foreground/50 mt-0.5">{g.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-border/50 bg-card/40 p-5">
                <div className="font-orbitron text-xs tracking-widest mb-3 text-orange-400">📖 THUẬT NGỮ THẾ GIỚI</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(framework.terminology ?? {}).map(([k, v]) => (
                    <div key={k} className="font-mono text-xs">
                      <div className="text-muted-foreground/40 uppercase text-xs">{k}</div>
                      <div className="font-bold mt-0.5" style={{ color: ac }}>{v as string}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border/50 bg-card/40 p-5">
                <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">⚖️ LUẬT LỆ THẾ GIỚI</div>
                <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{framework.loreRules}</div>
              </div>
            </>
          )}

          <div className="border border-border/50 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-orbitron text-xs tracking-widest" style={{ color: ac }}>📚 LORE ENTRIES ({loreEntries.length})</div>
              {isOwner && (
                <Button size="sm" onClick={() => setAddLoreForm(p => ({ ...p, open: !p.open }))}
                  className="rounded-none font-mono text-xs border"
                  style={{ borderColor: ac, color: ac, backgroundColor: `${ac}10` }}>
                  <Plus className="w-3 h-3 mr-1" /> THÊM LORE
                </Button>
              )}
            </div>

            {addLoreForm.open && (
              <div className="border border-border/30 bg-background/60 p-4 mb-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {["history", "faction", "geography", "creature", "item", "law"].map(cat => (
                    <button key={cat} onClick={() => setAddLoreForm(p => ({ ...p, category: cat }))}
                      className="font-mono text-xs px-2 py-1 border transition-all"
                      style={{
                        borderColor: addLoreForm.category === cat ? ac : "hsl(var(--border))",
                        color: addLoreForm.category === cat ? ac : "hsl(var(--muted-foreground))",
                        backgroundColor: addLoreForm.category === cat ? `${ac}15` : "transparent",
                      }}>
                      {LORE_CATEGORY_ICONS[cat]} {LORE_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
                <input value={addLoreForm.title} onChange={e => setAddLoreForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Tiêu đề lore entry..."
                  className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 outline-none focus:border-primary/50" />
                <textarea value={addLoreForm.content} onChange={e => setAddLoreForm(p => ({ ...p, content: e.target.value }))}
                  rows={3} placeholder="Nội dung lore..."
                  className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 outline-none focus:border-primary/50 resize-none" />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAddLoreForm(p => ({ ...p, open: false }))}
                    className="rounded-none font-mono text-xs">HỦY</Button>
                  <Button size="sm" onClick={() => {
                    if (!viewingFramework) return;
                    addLoreMutation.mutate({ worldSlug: viewingFramework.world.slug, data: { category: addLoreForm.category, title: addLoreForm.title, content: addLoreForm.content } });
                  }} disabled={addLoreMutation.isPending || !addLoreForm.title.trim() || !addLoreForm.content.trim()}
                    className="rounded-none font-mono text-xs border"
                    style={{ borderColor: ac, color: ac, backgroundColor: `${ac}10` }}>
                    {addLoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "LƯU"}
                  </Button>
                </div>
              </div>
            )}

            {loreEntries.length === 0 && (
              <div className="text-center py-8 font-mono text-xs text-muted-foreground/30">
                Chưa có lore entries — AI sẽ sinh tự động khi tạo thế giới qua chế độ Tự Do
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loreEntries.map((e) => (
                <div key={e.id} className="border border-border/30 bg-background/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{LORE_CATEGORY_ICONS[e.category] ?? "📄"}</span>
                    <span className="font-mono text-xs text-muted-foreground/40">{LORE_CATEGORY_LABELS[e.category]}</span>
                    {e.aiGenerated && <span className="font-mono text-xs px-1.5 py-0.5 border border-purple-500/30 text-purple-400/60">AI</span>}
                  </div>
                  <div className="font-orbitron text-xs font-bold mb-1">{e.title}</div>
                  <div className="font-mono text-xs text-muted-foreground/60 leading-relaxed">{e.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 30% -10%, ${ACCENT}15, transparent 65%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="sm"
          onClick={() => step === "list" ? setLocation("/dashboard") : setStep("list")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> {step === "list" ? "DASHBOARD" : "DANH SÁCH"}
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>WORLD CREATOR</span>
        </div>
        <Button size="sm" onClick={() => { setStep("form"); setResult(null); setFreeResult(null); }}
          className="rounded-none font-orbitron text-xs border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
          + TẠO MỚI
        </Button>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">
          {step === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="font-orbitron text-xs tracking-widest mb-6" style={{ color: ACCENT }}>
                THẾ GIỚI DO CỘNG ĐỒNG TẠO — {worlds.length} THẾ GIỚI
              </div>

              {isLoading && <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} /></div>}

              {!isLoading && worlds.length === 0 && (
                <div className="text-center py-32 space-y-4">
                  <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
                  <div className="font-orbitron text-xl text-muted-foreground/30">CHƯA CÓ THẾ GIỚI NÀO</div>
                  <div className="font-mono text-xs text-muted-foreground/30">Hãy là người đầu tiên tạo thế giới riêng của bạn</div>
                  <Button onClick={() => setStep("form")} className="rounded-none font-orbitron text-xs border mt-4"
                    style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                    TẠO THẾ GIỚI ĐẦU TIÊN
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {worlds.map((w) => (
                  <motion.div key={w.id} whileHover={{ y: -2 }}
                    className="border border-border/50 bg-card/40 p-5 cursor-pointer group transition-all hover:border-border"
                    onClick={() => setLocation(`/worlds/${w.id}`)}>
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{GENRE_ICONS[w.genre] ?? "🌍"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron text-sm font-bold">{w.name}</span>
                          <span className="font-mono text-xs text-muted-foreground/40">{GENRE_LABELS[w.genre] ?? w.genre}</span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60 mt-1 line-clamp-2 leading-relaxed">{w.lore}</div>
                        <div className="flex items-center gap-3 mt-3 font-mono text-xs text-muted-foreground/30">
                          <span>👹 {(w.bossData as any[])?.length ?? 0} boss</span>
                          <span>🏴 {(w.factionData as any[])?.length ?? 0} phe phái</span>
                          <span>👤 {(w.npcData as any[])?.length ?? 0} NPC</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); handleViewFramework(w); }}
                          className="p-1 rounded" title="Xem Framework">
                          <BookOpen className="w-3.5 h-3.5 text-cyan-400/60 hover:text-cyan-400" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setLocation(`/world-profile/${w.slug}`); }}
                          className="p-1 rounded" title="Hồ Sơ Thế Giới">
                          <Globe className="w-3.5 h-3.5 text-purple-400/60 hover:text-purple-400" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        {w.createdBy === (user as any).id && (
                          <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(w.id); }}
                            className="text-destructive/50 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-6">
              <div>
                <div className="font-orbitron text-xl font-bold mb-2">TẠO THẾ GIỚI MỚI</div>
                <div className="font-mono text-xs text-muted-foreground/40">AI sẽ kiến tạo toàn bộ thế giới từ ý tưởng của bạn</div>
              </div>

              <div className="flex gap-0 border border-border/50">
                <button onClick={() => setMode("free")}
                  className="flex-1 py-3 font-orbitron text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: mode === "free" ? `${ACCENT}15` : "transparent",
                    color: mode === "free" ? ACCENT : "hsl(var(--muted-foreground))",
                    borderRight: "1px solid hsl(var(--border))",
                  }}>
                  <Wand2 className="w-3.5 h-3.5" /> SÁNG TẠO TỰ DO
                </button>
                <button onClick={() => setMode("preset")}
                  className="flex-1 py-3 font-orbitron text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: mode === "preset" ? `${ACCENT}15` : "transparent",
                    color: mode === "preset" ? ACCENT : "hsl(var(--muted-foreground))",
                  }}>
                  <Globe className="w-3.5 h-3.5" /> CHỌN THỂ LOẠI
                </button>
              </div>

              {mode === "free" && (
                <div className="space-y-5">
                  <div className="border border-purple-500/20 bg-purple-500/5 p-4">
                    <div className="font-mono text-xs text-purple-300/70 leading-relaxed">
                      <span className="font-bold text-purple-300">✨ Chế độ Tự Do:</span> AI sẽ xây dựng toàn bộ framework — hệ thống tiến hóa, tiền tệ, tầng lớp xã hội, địa lý, thuật ngữ riêng — nhất quán hoàn toàn với ý tưởng của bạn. Không giới hạn thể loại.
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-2">TÊN THẾ GIỚI *</label>
                    <input value={freeForm.name} onChange={e => setFreeForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Đặt tên thế giới của bạn..."
                      className="w-full bg-background border border-border/50 font-mono text-sm px-4 py-3 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50" />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-2">MÔ TẢ Ý TƯỞNG * <span className="text-muted-foreground/30">(càng chi tiết AI càng hiểu sâu)</span></label>
                    <textarea value={freeForm.theme} onChange={e => setFreeForm(p => ({ ...p, theme: e.target.value }))}
                      rows={6}
                      placeholder={"Ví dụ: Một thế giới nơi con người có thể cấy chip vào não để hấp thụ năng lượng vũ trụ. Xã hội chia thành 4 tầng lớp dựa trên loại chip. Tiền tệ là 'Photon' — đơn vị năng lượng. Kẻ thù là các thực thể từ không gian đến để thu hoạch não người...\n\nHoặc đơn giản hơn: Thế giới tiên hiệp nhưng có ma thuật Norse kết hợp, tu luyện kết hợp với rune khắc vào xương..."}
                      className="w-full bg-background border border-border/50 font-mono text-xs px-4 py-3 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 resize-none leading-relaxed" />
                    <div className="font-mono text-xs text-muted-foreground/30 mt-1 text-right">{freeForm.theme.length}/1000</div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setStep("list")} className="rounded-none font-mono text-xs border border-border/30">HỦY</Button>
                    <Button onClick={handleCreateFree} disabled={isPending || !freeForm.name.trim() || freeForm.theme.trim().length < 10}
                      className="flex-1 rounded-none font-orbitron text-sm tracking-widest border"
                      style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                      {createFreeMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> AI ĐANG KIẾN TẠO THẾ GIỚI...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" /> KIẾN TẠO THẾ GIỚI TỰ DO</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {mode === "preset" && (
                <div className="space-y-5">
                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-2">TÊN THẾ GIỚI *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Tên thế giới của bạn..."
                      className="w-full bg-background border border-border/50 font-mono text-sm px-4 py-3 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50" />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-3">THỂ LOẠI</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {GENRES.map(g => (
                        <button key={g.value} onClick={() => setForm(p => ({ ...p, genre: g.value as Genre }))}
                          className="p-3 border text-left transition-all"
                          style={{
                            borderColor: form.genre === g.value ? ACCENT : "hsl(var(--border))",
                            backgroundColor: form.genre === g.value ? `${ACCENT}10` : "transparent",
                          }}>
                          <div className="text-xl mb-1">{g.icon}</div>
                          <div className="font-orbitron text-xs font-bold">{g.label}</div>
                          <div className="font-mono text-xs text-muted-foreground/40 mt-0.5">{g.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-2">MÔ TẢ (tùy chọn)</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      rows={3} placeholder="Mô tả sơ lược về thế giới của bạn..."
                      className="w-full bg-background border border-border/50 font-mono text-xs px-4 py-3 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 resize-none" />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted-foreground/50 block mb-2">LUẬT LỆ ĐẶC BIỆT (tùy chọn)</label>
                    <textarea value={form.rules} onChange={e => setForm(p => ({ ...p, rules: e.target.value }))}
                      rows={2} placeholder="Ví dụ: Không có phép thuật, chỉ có công nghệ. Người chơi chỉ có 3 mạng..."
                      className="w-full bg-background border border-border/50 font-mono text-xs px-4 py-3 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 resize-none" />
                  </div>

                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setStep("list")} className="rounded-none font-mono text-xs border border-border/30">HỦY</Button>
                    <Button onClick={handleCreate} disabled={isPending || !form.name.trim()}
                      className="flex-1 rounded-none font-orbitron text-sm tracking-widest border"
                      style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                      {createMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> AI ĐANG SINH THẾ GIỚI...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> TẠO THẾ GIỚI</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === "result" && freeResult && (
            <motion.div key="free-result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-5">
              <div className="border-2 p-8 text-center"
                style={{ borderColor: freeResult.framework.atmosphereColor ?? ACCENT, backgroundColor: `${freeResult.framework.atmosphereColor ?? ACCENT}08` }}>
                <div className="font-mono text-xs tracking-widest mb-2" style={{ color: freeResult.framework.atmosphereColor ?? ACCENT }}>
                  🌌 THẾ GIỚI ĐÃ ĐƯỢC KIẾN TẠO
                </div>
                <div className="font-orbitron text-3xl font-black mb-2">{freeResult.world.name}</div>
                <div className="font-mono text-sm text-muted-foreground/60 italic">"{freeResult.framework.tagline}"</div>
              </div>

              <div className="border border-border/50 bg-card/40 p-5">
                <div className="font-orbitron text-xs tracking-widest mb-2" style={{ color: ACCENT }}>LỊCH SỬ THẾ GIỚI</div>
                <div className="font-mono text-sm text-muted-foreground/80 leading-relaxed">{freeResult.world.lore}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-2" style={{ color: ACCENT }}>⚡ {freeResult.framework.progressionSystem?.name}</div>
                  <div className="flex flex-wrap gap-1">
                    {freeResult.framework.progressionSystem?.tiers?.map((t, i) => (
                      <span key={i} className="font-mono text-xs px-2 py-0.5 border"
                        style={{ borderColor: `${ACCENT}40`, color: ACCENT, backgroundColor: `${ACCENT}10` }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-2 text-yellow-400">🪙 KINH TẾ</div>
                  <div className="font-mono text-sm font-bold">{freeResult.framework.currency?.primary}</div>
                  <div className="font-mono text-xs text-muted-foreground/40">+ {freeResult.framework.currency?.secondary}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">👹 BOSS</div>
                  {(freeResult.world.bossData as any[]).map((b: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{b.name} <span className="text-muted-foreground/40">Lv{b.level}</span></div>
                      <div className="text-muted-foreground/50">{b.description}</div>
                    </div>
                  ))}
                </div>
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-purple-400">🏴 PHE PHÁI</div>
                  {(freeResult.world.factionData as any[]).map((f: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{f.name}</div>
                      <div className="text-muted-foreground/50">{f.description}</div>
                    </div>
                  ))}
                </div>
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-cyan-400">👤 NPC</div>
                  {(freeResult.world.npcData as any[]).map((n: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{n.name}</div>
                      <div className="text-muted-foreground/50">{n.personality}</div>
                    </div>
                  ))}
                </div>
              </div>

              {freeResult.loreEntries.length > 0 && (
                <div className="border border-border/50 bg-card/40 p-5">
                  <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ACCENT }}>📚 LORE ENTRIES ({freeResult.loreEntries.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {freeResult.loreEntries.map((e: any, i: number) => (
                      <div key={i} className="border border-border/30 bg-background/40 p-3">
                        <div className="font-mono text-xs text-muted-foreground/40 mb-1">{LORE_CATEGORY_ICONS[e.category] ?? "📄"} {LORE_CATEGORY_LABELS[e.category]}</div>
                        <div className="font-orbitron text-xs font-bold mb-1">{e.title}</div>
                        <div className="font-mono text-xs text-muted-foreground/60">{e.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setStep("list"); setFreeResult(null); }} className="rounded-none font-mono text-xs border border-border/30">
                  XEM DANH SÁCH
                </Button>
                <Button onClick={() => handleViewFramework(freeResult.world)}
                  className="rounded-none font-orbitron text-xs border"
                  style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                  <BookOpen className="w-3 h-3 mr-1" /> XEM FRAMEWORK ĐẦY ĐỦ
                </Button>
                <Button onClick={() => { setFreeForm({ name: "", theme: "" }); setFreeResult(null); setStep("form"); setMode("free"); }}
                  className="rounded-none font-orbitron text-xs border border-purple-500/50"
                  style={{ color: "#a855f7", backgroundColor: "#a855f715" }}>
                  <Wand2 className="w-3 h-3 mr-1" /> TẠO THẾ GIỚI KHÁC
                </Button>
              </div>
            </motion.div>
          )}

          {step === "result" && result && !freeResult && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-6">
              <div className="border-2 p-8 text-center"
                style={{ borderColor: result.atmosphereColor ?? ACCENT, backgroundColor: `${result.atmosphereColor ?? ACCENT}08` }}>
                <div className="font-mono text-xs tracking-widest mb-2" style={{ color: result.atmosphereColor ?? ACCENT }}>THẾ GIỚI MỚI ĐÃ ĐƯỢC TẠO</div>
                <div className="font-orbitron text-3xl font-black mb-2">{result.world.name}</div>
                <div className="font-mono text-sm text-muted-foreground/60 italic">"{result.tagline}"</div>
              </div>

              <div className="border border-border/50 bg-card/40 p-6">
                <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: ACCENT }}>LỊCH SỬ THẾ GIỚI</div>
                <div className="font-mono text-sm text-muted-foreground/80 leading-relaxed">{result.world.lore}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-red-400">👹 BOSS ({result.world.bossData?.length ?? 0})</div>
                  {(result.world.bossData as any[]).map((b: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{b.name} <span className="text-muted-foreground/40">Lv{b.level}</span></div>
                      <div className="text-muted-foreground/50">{b.description}</div>
                    </div>
                  ))}
                </div>
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-purple-400">🏴 PHE PHÁI ({result.world.factionData?.length ?? 0})</div>
                  {(result.world.factionData as any[]).map((f: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{f.name} <span className="text-muted-foreground/40">[{f.type}]</span></div>
                      <div className="text-muted-foreground/50">{f.description}</div>
                    </div>
                  ))}
                </div>
                <div className="border border-border/50 bg-card/40 p-4">
                  <div className="font-orbitron text-xs tracking-widest mb-3 text-cyan-400">👤 NPC ({result.world.npcData?.length ?? 0})</div>
                  {(result.world.npcData as any[]).map((n: any, i: number) => (
                    <div key={i} className="font-mono text-xs mb-2">
                      <div className="font-bold">{n.name} <span className="text-muted-foreground/40">[{n.role}]</span></div>
                      <div className="text-muted-foreground/50">{n.personality}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setStep("list"); setResult(null); }} className="rounded-none font-mono text-xs border border-border/30">
                  XEM DANH SÁCH
                </Button>
                <Button onClick={() => { setForm({ name: "", genre: "fantasy", rules: "", description: "" }); setResult(null); setStep("form"); }}
                  className="rounded-none font-orbitron text-xs border"
                  style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                  <Sparkles className="w-3 h-3 mr-1" /> TẠO THẾ GIỚI KHÁC
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
