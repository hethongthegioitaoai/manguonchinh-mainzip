import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Trophy, Star, Zap, Search } from "lucide-react";

interface Achievement {
  id: string; key: string; title: string; description: string;
  icon: string; category: string; xpReward: number; condition: string;
  unlocked: boolean; unlockedAt: string | null;
}
interface AchievementsData {
  achievements: Achievement[];
  totalUnlocked: number; total: number; totalXp: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  battle:   { label: "Chiến Đấu", icon: "⚔️",  color: "#ef4444" },
  pvp:      { label: "PvP",       icon: "🥊",  color: "#f97316" },
  cultivate:{ label: "Tu Luyện",  icon: "✨",  color: "#a855f7" },
  explore:  { label: "Khám Phá",  icon: "🗺️",  color: "#06b6d4" },
  social:   { label: "Xã Hội",   icon: "🤝",  color: "#22c55e" },
  secret:   { label: "Bí Ẩn",    icon: "🔮",  color: "#6366f1" },
};

export default function AchievementsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: charData } = useQuery<{ id: string }[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      const r = await fetch("/api/characters", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const characterId = charData?.[0]?.id;

  const { data, isLoading } = useQuery<AchievementsData>({
    queryKey: ["/api/achievements", characterId],
    queryFn: async () => {
      if (!characterId) throw new Error("no char");
      const r = await fetch(`/api/achievements/${characterId}`, { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!characterId,
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      if (!characterId) throw new Error("no char");
      const r = await fetch(`/api/achievements/check/${characterId}`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/achievements", characterId] });
      if (result.newlyUnlocked?.length > 0) {
        result.newlyUnlocked.forEach((a: any) => {
          toast.success(`${a.icon} Mở khóa: ${a.title} (+${a.xpReward} EXP)`);
        });
      } else {
        toast("Không có thành tựu mới");
      }
    },
    onError: () => toast.error("Lỗi kiểm tra thành tựu"),
  });

  const categories = ["all", ...Object.keys(CATEGORY_META)];
  const filtered = data?.achievements.filter(a => {
    const catOk = activeCategory === "all" || a.category === activeCategory;
    const searchOk = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  }) ?? [];

  const unlocked = filtered.filter(a => a.unlocked);
  const locked = filtered.filter(a => !a.unlocked);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-950 to-black text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-purple-400 flex items-center gap-2">
            <Trophy className="w-5 h-5" /> THÀNH TỰU
          </h1>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending || !characterId}
            className="rounded-lg border border-purple-700/50 bg-purple-900/30 px-3 py-1 text-xs text-purple-300 hover:bg-purple-800/40 disabled:opacity-50 transition-colors"
          >
            {checkMutation.isPending ? "Đang check..." : "Cập nhật"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">

        {/* Stats summary */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Đã mở", value: `${data.totalUnlocked}/${data.total}`, icon: "🏅", color: "text-purple-400" },
              { label: "Hoàn thành", value: `${Math.round((data.totalUnlocked / data.total) * 100)}%`, icon: "📊", color: "text-cyan-400" },
              { label: "EXP nhận được", value: `${data.totalXp}`, icon: "✨", color: "text-yellow-400" },
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
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm thành tựu..."
            className="w-full rounded-xl border border-slate-700/40 bg-slate-900/30 pl-8 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-purple-600/50 transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => {
            const meta = cat === "all" ? { label: "Tất cả", icon: "🏆", color: "#a855f7" } : CATEGORY_META[cat];
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono border transition-all ${activeCategory === cat ? "border-opacity-100 text-slate-100" : "border-slate-700/40 text-slate-500 hover:text-slate-300"}`}
                style={activeCategory === cat ? { borderColor: meta.color, backgroundColor: `${meta.color}20`, color: meta.color } : {}}>
                <span>{meta.icon}</span> {meta.label}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!characterId && !isLoading && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-6 text-center text-slate-500">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Cần tạo nhân vật để xem thành tựu</p>
          </div>
        )}

        {data && (
          <>
            {/* Unlocked */}
            {unlocked.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <span>🏅</span> Đã Mở Khóa ({unlocked.length})
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  {unlocked.map((a, i) => {
                    const meta = CATEGORY_META[a.category] ?? CATEGORY_META.battle;
                    return (
                      <motion.div key={a.key}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="rounded-xl border p-3 flex items-center gap-3"
                        style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}08` }}>
                        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-2xl"
                          style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                          {a.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-100">{a.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                          {a.unlockedAt && (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {new Date(a.unlockedAt).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono text-yellow-400">+{a.xpReward} XP</p>
                          <p className="text-xs mt-1" style={{ color: meta.color }}>{meta.icon}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Locked */}
            {locked.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  <span>🔒</span> Chưa Mở ({locked.length})
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  {locked.map((a, i) => (
                    <motion.div key={a.key}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      className="rounded-xl border border-slate-800/40 bg-slate-900/20 p-3 flex items-center gap-3 opacity-60">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-2xl bg-slate-800/40 border border-slate-700/30 grayscale">
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-400">{a.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{a.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono text-slate-600">+{a.xpReward} XP</p>
                        <p className="text-xs mt-1 text-slate-700">🔒</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p>Không tìm thấy thành tựu nào</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
