import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Hammer, Search, CheckCircle2, Lock } from "lucide-react";

interface Material { name: string; quantity: number; rarity: string; }
interface Recipe {
  id: string; name: string; worldSlug: string; description: string; icon: string;
  materials: Material[]; resultItem: string; resultRarity: string; resultIcon: string;
  requiredLevel: number; expReward: number; tier: string; category: string; canCraft: boolean;
}
interface Character { id: string; level: number; stats?: { world_slug?: string }; }

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7",
};
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  weapon: { label: "Vũ Khí", icon: "⚔️" },
  armor: { label: "Giáp", icon: "🛡️" },
  accessory: { label: "Phụ Kiện", icon: "💍" },
  consumable: { label: "Đan Dược", icon: "💊" },
  special: { label: "Đặc Biệt", icon: "🌟" },
};
const TIER_META: Record<string, { label: string; color: string }> = {
  basic: { label: "Cơ Bản", color: "#94a3b8" },
  mid: { label: "Trung Cấp", color: "#f97316" },
  high: { label: "Cao Cấp", color: "#a855f7" },
};

export default function CraftPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [craftingId, setCraftingId] = useState<string | null>(null);

  const { data: charData } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => { const r = await fetch("/api/characters", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });
  const char = charData?.[0];
  const worldSlug = (char?.stats as any)?.world_slug ?? "cultivation";

  const { data, isLoading } = useQuery<{ recipes: Recipe[] }>({
    queryKey: ["/api/craft/recipes", worldSlug],
    queryFn: async () => {
      const r = await fetch(`/api/craft/recipes/${worldSlug}`, { credentials: "include" });
      if (!r.ok) throw new Error("failed"); return r.json();
    },
    enabled: !!char,
  });

  const craftMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      setCraftingId(recipeId);
      const r = await fetch("/api/craft/make", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/craft/recipes", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast.success(`${result.resultIcon} ${result.message} (+${result.expGained} EXP)`);
    },
    onError: (err: any) => toast.error(err.message),
    onSettled: () => setCraftingId(null),
  });

  const allRecipes = data?.recipes ?? [];
  const filtered = allRecipes.filter(r => {
    const catOk = activeCategory === "all" || r.category === activeCategory;
    const searchOk = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  });

  const craftable = filtered.filter(r => r.canCraft && char && char.level >= r.requiredLevel);
  const locked = filtered.filter(r => !r.canCraft || !char || char.level < r.requiredLevel);

  const categories = ["all", ...Object.keys(CATEGORY_META)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-slate-950 to-black text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-orange-400 flex items-center gap-2">
            <Hammer className="w-5 h-5" /> CHẾ TẠO VẬT PHẨM
          </h1>
          <p className="text-xs text-slate-500">Cấp {char?.level ?? 0}</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Tổng công thức", value: allRecipes.length, icon: "📜", color: "text-slate-300" },
              { label: "Có thể làm", value: craftable.length, icon: "✅", color: "text-green-400" },
              { label: "Cần nguyên liệu", value: locked.length, icon: "🔒", color: "text-slate-500" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 text-center">
                <p className="text-xl">{s.icon}</p>
                <p className={`font-mono font-bold text-lg ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm công thức..."
            className="w-full rounded-xl border border-slate-700/40 bg-slate-900/30 pl-8 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orange-600/50 transition-colors" />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => {
            const meta = cat === "all" ? { label: "Tất cả", icon: "⚗️" } : CATEGORY_META[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono border transition-all ${activeCategory === cat ? "border-orange-500/60 bg-orange-950/30 text-orange-300" : "border-slate-700/40 text-slate-500 hover:text-slate-300"}`}>
                <span>{meta.icon}</span> {meta.label}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!char && !isLoading && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center text-slate-500">
            <Hammer className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Cần tạo nhân vật trước</p>
          </div>
        )}

        {data && (
          <>
            {/* Craftable */}
            {craftable.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Có Thể Chế Tạo ({craftable.length})
                </h2>
                <div className="space-y-2">
                  {craftable.map((r, i) => (
                    <RecipeCard key={r.id} recipe={r} onCraft={() => craftMutation.mutate(r.id)} isCrafting={craftingId === r.id} charLevel={char?.level ?? 0} />
                  ))}
                </div>
              </section>
            )}

            {/* Locked */}
            {locked.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Thiếu Nguyên Liệu / Cấp ({locked.length})
                </h2>
                <div className="space-y-2">
                  {locked.map((r, i) => (
                    <RecipeCard key={r.id} recipe={r} onCraft={() => {}} isCrafting={false} charLevel={char?.level ?? 0} disabled />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-500"><p>Không tìm thấy công thức</p></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onCraft, isCrafting, charLevel, disabled }: {
  recipe: Recipe; onCraft: () => void; isCrafting: boolean; charLevel: number; disabled?: boolean;
}) {
  const tier = TIER_META[recipe.tier] ?? TIER_META.basic;
  const rarityColor = RARITY_COLOR[recipe.resultRarity] ?? RARITY_COLOR.common;
  const levelLocked = charLevel < recipe.requiredLevel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all ${disabled ? "opacity-50 border-slate-800/30 bg-slate-900/10" : "border-orange-700/30 bg-orange-950/10"}`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-2xl bg-slate-900/40 border border-slate-700/30">
          {recipe.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-slate-100">{recipe.name}</p>
            <span className="text-xs rounded-full px-2 py-0.5 border" style={{ color: tier.color, borderColor: `${tier.color}40`, backgroundColor: `${tier.color}15` }}>
              {tier.label}
            </span>
            <span className="text-xs text-slate-500">{CATEGORY_META[recipe.category]?.icon} {CATEGORY_META[recipe.category]?.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{recipe.description}</p>

          {/* Materials */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {recipe.materials.map((mat, i) => (
              <span key={i} className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-2 py-0.5 text-xs" style={{ color: RARITY_COLOR[mat.rarity] }}>
                {mat.name} ×{mat.quantity}
              </span>
            ))}
          </div>
        </div>

        {/* Result + action */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-right">
            <p className="text-lg">{recipe.resultIcon}</p>
            <p className="text-xs font-bold" style={{ color: rarityColor }}>{recipe.resultRarity}</p>
            <p className="text-xs text-yellow-600">+{recipe.expReward} EXP</p>
          </div>
          {!disabled && !levelLocked && (
            <button onClick={onCraft} disabled={isCrafting}
              className="rounded-xl border border-orange-600/50 bg-orange-900/30 px-3 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-800/40 disabled:opacity-50 transition-all flex items-center gap-1">
              {isCrafting ? <div className="w-3 h-3 rounded-full border border-orange-400 border-t-transparent animate-spin" /> : <Hammer className="w-3 h-3" />}
              Chế Tạo
            </button>
          )}
          {levelLocked && <span className="text-xs text-red-500">🔒 Cấp {recipe.requiredLevel}</span>}
        </div>
      </div>
    </motion.div>
  );
}
