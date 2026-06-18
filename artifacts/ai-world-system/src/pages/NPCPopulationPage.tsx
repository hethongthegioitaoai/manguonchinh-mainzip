import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Users, Baby, Star, RefreshCw, Loader2, TrendingUp, Calendar, Heart } from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN", color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;

type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

interface NpcRow {
  id: string; name: string; age: number; lifeStage: string;
  occupation: string; happiness: number; active: number;
}

interface BirthRecord {
  id: string; worldSlug: string; childId: string | null;
  fatherId: string | null; motherId: string | null;
  childName: string; createdAt: string;
  fatherName: string; motherName: string;
}

interface PopStats {
  totalPopulation: number;
  totalBirths: number;
  ageDist: { child: number; teenager: number; adult: number; elder: number };
  recentBirths: BirthRecord[];
  allNpcs: NpcRow[];
}

interface AgingResult {
  aged: number; promoted: number; births: string[]; message: string;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; icon: string; range: string }> = {
  child:    { label: "Trẻ Em",       color: "#22c55e", icon: "👶", range: "0–12 tuổi" },
  teenager: { label: "Thiếu Niên",   color: "#eab308", icon: "🧒", range: "13–17 tuổi" },
  adult:    { label: "Trưởng Thành", color: "#06b6d4", icon: "🧑", range: "18–59 tuổi" },
  elder:    { label: "Trưởng Lão",   color: "#a855f7", icon: "🧓", range: "60+ tuổi" },
};

export default function NPCPopulationPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [stats, setStats] = useState<PopStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [agingMsg, setAgingMsg] = useState<AgingResult | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/npc-population/${activeWorld}`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } finally { setLoading(false); }
  }, [activeWorld]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function runAging() {
    setAgingLoading(true);
    setAgingMsg(null);
    try {
      const r = await fetch(`/api/npc-population/run-aging/${activeWorld}`, { method: "POST", credentials: "include" });
      if (r.ok) { setAgingMsg(await r.json()); await loadStats(); }
    } finally { setAgingLoading(false); }
  }

  const total = stats?.totalPopulation ?? 0;
  const ageDist = stats?.ageDist ?? { child: 0, teenager: 0, adult: 0, elder: 0 };
  const stages = ["child", "teenager", "adult", "elder"] as const;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}40` }}>
          <Users size={14} style={{ color: worldColor }} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest" style={{ color: worldColor }}>DÂN SỐ NPC</div>
          <div className="text-xs text-gray-600">Sinh sản · già hóa · phân bổ độ tuổi</div>
        </div>
        <button onClick={loadStats} disabled={loading}
          className="ml-auto p-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-white transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* World tabs */}
      <div className="flex border-b border-gray-900">
        {WORLDS.map(w => (
          <button key={w.slug} onClick={() => setActiveWorld(w.slug)}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest transition-all relative"
            style={{ color: activeWorld === w.slug ? w.color : "#4b5563" }}>
            {w.label}
            {activeWorld === w.slug && (
              <motion.div layoutId="wt-pop" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: w.color }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Dân Số", value: total, icon: <Users size={16} />, color: worldColor },
            { label: "Trẻ Được Sinh", value: stats?.totalBirths ?? 0, icon: <Baby size={16} />, color: "#22c55e" },
            { label: "Sinh Gần Đây", value: stats?.recentBirths?.length ?? 0, icon: <Star size={16} />, color: "#eab308" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 text-center">
              <div className="flex items-center justify-center mb-1" style={{ color: card.color }}>{card.icon}</div>
              <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Age distribution */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: worldColor }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>PHÂN BỔ ĐỘ TUỔI</span>
          </div>
          <div className="space-y-3">
            {stages.map(stage => {
              const cfg = STAGE_CONFIG[stage];
              const count = ageDist[stage];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span>{cfg.icon}</span>
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-gray-700">{cfg.range}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: cfg.color }} className="font-bold">{count}</span>
                      <span className="text-gray-600">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: cfg.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: 0.1 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* NPC age list */}
        {stats && Array.isArray(stats.allNpcs) && stats.allNpcs.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: worldColor }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>DANH SÁCH DÂN CƯ</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {[...stats.allNpcs]
                .sort((a, b) => a.age - b.age)
                .map(npc => {
                  const cfg = STAGE_CONFIG[npc.lifeStage] ?? STAGE_CONFIG.adult;
                  return (
                    <div key={npc.id} className="flex items-center gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-base">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{npc.name}</div>
                        <div className="text-xs text-gray-600">{npc.occupation}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold" style={{ color: cfg.color }}>{npc.age} tuổi</div>
                        <div className="text-xs text-gray-700">{cfg.label}</div>
                      </div>
                      <div className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ color: npc.happiness > 60 ? "#22c55e" : npc.happiness > 30 ? "#eab308" : "#ef4444",
                                 background: `${npc.happiness > 60 ? "#22c55e" : npc.happiness > 30 ? "#eab308" : "#ef4444"}15` }}>
                        ♥{npc.happiness}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Run aging button */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: worldColor }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>ĐIỀU KHIỂN THỜI GIAN</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Mỗi lần chạy: NPC già đi theo thời gian (mỗi 5 tick +1 tuổi), đổi giai đoạn sống khi đủ tuổi.
            Các cặp đôi đủ điều kiện (trưởng thành · hạnh phúc &gt;60 · quan hệ &gt;75) có 15% cơ hội sinh con.
          </p>
          <button onClick={runAging} disabled={agingLoading}
            className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}60`, color: worldColor }}>
            {agingLoading ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</> : <><Calendar size={14} /> Chạy Già Hóa & Sinh Sản</>}
          </button>
          <AnimatePresence>
            {agingMsg && (
              <motion.div key="aging-result" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold" style={{ color: worldColor }}>
                  ✓ {agingMsg.message}
                </div>
                <div className="text-gray-500">Già hoá: {agingMsg.aged} · Đổi giai đoạn: {agingMsg.promoted}</div>
                {agingMsg.births.length > 0 && (
                  <div className="flex items-center gap-1 text-green-400">
                    <Baby size={12} />
                    <span>Trẻ mới sinh: {agingMsg.births.join(", ")}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent births */}
        {stats && stats.recentBirths.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Baby size={14} className="text-green-400" />
              <span className="text-xs font-bold tracking-widest text-green-400">KÝ ỨC CHÀO ĐỜI GẦN ĐÂY</span>
            </div>
            <div className="space-y-2">
              {stats.recentBirths.map(b => (
                <div key={b.id} className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-green-400/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Baby size={12} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{b.childName}</div>
                    <div className="text-xs text-gray-500">
                      Cha: <span className="text-gray-400">{b.fatherName}</span>
                      {" · "} Mẹ: <span className="text-gray-400">{b.motherName}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-700 shrink-0">
                    {new Date(b.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && stats.allNpcs.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-700">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">Chưa có NPC trong thế giới này</div>
            <div className="text-xs mt-1">Tạo NPC trong trang Mô Phỏng NPC trước</div>
          </div>
        )}
      </div>
    </div>
  );
}
