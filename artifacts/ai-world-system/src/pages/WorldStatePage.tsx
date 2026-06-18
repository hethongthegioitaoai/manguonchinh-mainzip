import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Boss {
  key: string;
  name: string;
  level: number;
  alive: boolean;
  diedAt: string | null;
  respawnAt: string | null;
  secondsUntilRespawn: number | null;
}

interface Resource {
  resourceType: string;
  name: string;
  icon: string;
  quantity: number;
  maxQuantity: number;
  regenRatePerHour: number;
  percent: number;
}

interface WorldStateData {
  worldSlug: string;
  bosses: Boss[];
  resources: Resource[];
}

const WORLD_NAMES: Record<string, { name: string; bg: string; accent: string }> = {
  cultivation: { name: "Tu Tiên", bg: "from-purple-950 via-slate-950 to-black", accent: "text-purple-400" },
  cyberpunk:   { name: "Cyberpunk", bg: "from-cyan-950 via-slate-950 to-black", accent: "text-cyan-400" },
  zombie:      { name: "Hoang Phế", bg: "from-red-950 via-slate-950 to-black", accent: "text-red-400" },
  wasteland:   { name: "Hoang Phế", bg: "from-red-950 via-slate-950 to-black", accent: "text-red-400" },
};

function useCountdown(secondsUntilRespawn: number | null) {
  const [remaining, setRemaining] = useState(secondsUntilRespawn ?? 0);
  useEffect(() => {
    if (!secondsUntilRespawn) return;
    setRemaining(secondsUntilRespawn);
    const id = setInterval(() => setRemaining(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsUntilRespawn]);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function BossCard({ boss }: { boss: Boss }) {
  const countdown = useCountdown(boss.secondsUntilRespawn);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border p-4 ${boss.alive
        ? "border-red-800/60 bg-red-950/20"
        : "border-slate-700/40 bg-slate-900/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{boss.alive ? "💀" : "⚰️"}</span>
          <div>
            <p className={`font-bold ${boss.alive ? "text-red-300" : "text-slate-500"}`}>
              {boss.name}
            </p>
            <p className="text-xs text-slate-500">Level {boss.level}</p>
          </div>
        </div>
        <div className="text-right">
          {boss.alive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-900/60 px-2 py-0.5 text-xs text-red-300 border border-red-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              ĐANG SỐNG
            </span>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400 border border-slate-600/50">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                ĐÃ CHẾT
              </span>
              {boss.secondsUntilRespawn !== null && boss.secondsUntilRespawn > 0 && (
                <p className="mt-1 text-xs text-yellow-500/80 font-mono">
                  Hồi sinh: {countdown}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ResourceBar({ resource, worldSlug, onHarvest }: {
  resource: Resource;
  worldSlug: string;
  onHarvest: (resourceType: string) => void;
}) {
  const color = resource.percent >= 70
    ? "bg-emerald-500"
    : resource.percent >= 30
    ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{resource.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-200">{resource.name}</p>
            <p className="text-xs text-slate-500">+{resource.regenRatePerHour}/giờ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-slate-300">
            {resource.quantity}/{resource.maxQuantity}
          </span>
          <button
            onClick={() => onHarvest(resource.resourceType)}
            disabled={resource.quantity === 0}
            className="rounded-lg border border-cyan-700/60 bg-cyan-900/30 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-800/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Thu thập
          </button>
        </div>
      </div>
      <div className="w-full rounded-full bg-slate-800 h-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${resource.percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-600">
        <span>Cạn kiệt</span>
        <span className={resource.percent >= 70 ? "text-emerald-500" : resource.percent >= 30 ? "text-yellow-500" : "text-red-500"}>
          {resource.percent >= 70 ? "Dồi dào" : resource.percent >= 30 ? "Vừa phải" : "Cạn kiệt"}
        </span>
        <span>Đầy</span>
      </div>
    </motion.div>
  );
}

export default function WorldStatePage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [worldSlug, setWorldSlug] = useState<string>("cultivation");

  // Get character's world from localStorage or default
  useEffect(() => {
    const saved = localStorage.getItem("activeWorldSlug");
    if (saved) setWorldSlug(saved);
  }, []);

  const { data, isLoading, error } = useQuery<WorldStateData>({
    queryKey: ["/api/world/state", worldSlug],
    queryFn: async () => {
      const r = await fetch(`/api/world/state/${worldSlug}`, { credentials: "include" });
      if (!r.ok) throw new Error("Không thể tải trạng thái thế giới");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const harvestMutation = useMutation({
    mutationFn: async (resourceType: string) => {
      const r = await fetch(`/api/world/resources/${worldSlug}/harvest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceType, amount: 10 }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message ?? "Lỗi thu thập");
      }
      return r.json();
    },
    onSuccess: (result) => {
      toast.success(`${result.icon} ${result.message}`);
      queryClient.invalidateQueries({ queryKey: ["/api/world/state", worldSlug] });
    },
    onError: (err: any) => {
      toast.error(err.message ?? "Lỗi thu thập tài nguyên");
    },
  });

  const worldInfo = WORLD_NAMES[worldSlug] ?? WORLD_NAMES.cultivation;
  const aliveBosses = data?.bosses.filter(b => b.alive).length ?? 0;
  const totalResources = data?.resources.reduce((s, r) => s + r.quantity, 0) ?? 0;
  const maxResources = data?.resources.reduce((s, r) => s + r.maxQuantity, 0) ?? 1;
  const resourcePct = Math.round((totalResources / maxResources) * 100);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${worldInfo.bg} text-slate-100`}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="text-slate-400 hover:text-slate-200 transition-colors">
            ← Dashboard
          </button>
          <h1 className={`font-bold text-lg ${worldInfo.accent}`}>
            🌐 Thế Giới {worldInfo.name}
          </h1>
          <div className="flex gap-1">
            {["cultivation", "cyberpunk", "zombie"].map(s => (
              <button
                key={s}
                onClick={() => { setWorldSlug(s); localStorage.setItem("activeWorldSlug", s); }}
                className={`rounded px-2 py-1 text-xs transition-colors ${worldSlug === s ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              >
                {s === "cultivation" ? "Tu Tiên" : s === "cyberpunk" ? "Cyber" : "Hoang Phế"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Boss còn sống", value: `${aliveBosses}/${data?.bosses.length ?? 0}`, icon: "💀", color: "text-red-400" },
            { label: "Tài nguyên", value: `${resourcePct}%`, icon: "📦", color: "text-yellow-400" },
            { label: "Sự kiện", value: "Tự động", icon: "⚡", color: "text-cyan-400" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 text-center">
              <p className="text-xl">{stat.icon}</p>
              <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4 text-center text-red-400">
            Không thể tải dữ liệu thế giới
          </div>
        )}

        {data && (
          <>
            {/* Bosses */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                <span>⚔️</span> Boss Thế Giới
              </h2>
              <div className="space-y-3">
                <AnimatePresence>
                  {data.bosses.map(boss => (
                    <BossCard key={boss.key} boss={boss} />
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* Resources */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                <span>🪨</span> Tài Nguyên Thế Giới
              </h2>
              <div className="space-y-3">
                {data.resources.map(resource => (
                  <ResourceBar
                    key={resource.resourceType}
                    resource={resource}
                    worldSlug={worldSlug}
                    onHarvest={(rt) => harvestMutation.mutate(rt)}
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-600">
                Tài nguyên tự hồi phục theo thời gian thực. Cập nhật mỗi 30 giây.
              </p>
            </section>

            {/* World info */}
            <section className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                📜 Cơ Chế Thế Giới
              </h2>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>• Boss chết → hồi sinh sau <span className="text-yellow-400">24 giờ</span></li>
                <li>• Tài nguyên bị khai thác → giảm dần, tự hồi theo giờ</li>
                <li>• AI Game Master phản hồi dựa trên trạng thái thế giới hiện tại</li>
                <li>• Khi boss đã chết, câu chuyện sẽ tham chiếu sự kiện này</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
