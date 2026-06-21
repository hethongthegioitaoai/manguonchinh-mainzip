import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Activity, Zap, Users, TrendingUp, TrendingDown,
  Heart, Shield, Globe, RefreshCw, Play, Cpu, BarChart3, Scroll,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const EVENT_COLORS: Record<string, string> = {
  tick:                "#94a3b8",
  economic_boom:       "#34d399",
  economic_recession:  "#f87171",
  political_crisis:    "#fb923c",
  rebellion:           "#ef4444",
  natural_wonder:      "#a78bfa",
  plague:              "#dc2626",
  harvest_festival:    "#fbbf24",
  mysterious_arrival:  "#22d3ee",
  ancient_discovery:   "#a78bfa",
  trade_boom:          "#34d399",
  inter_world_war:     "#ef4444",
  hero_born:           "#fbbf24",
  villain_rises:       "#f87171",
  peace_treaty:        "#34d399",
  migration_wave:      "#60a5fa",
};

function StatBar({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1 text-muted-foreground"><Icon className="w-3 h-3" />{label}</span>
        <span style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function DeltaBadge({ value, unit = "" }: { value: number; unit?: string }) {
  if (Math.abs(value) < 0.01) return <span className="text-muted-foreground font-mono text-xs">±0{unit}</span>;
  const color = value > 0 ? "#34d399" : "#f87171";
  return <span className="font-mono text-xs font-bold" style={{ color }}>{value > 0 ? "+" : ""}{typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}{unit}</span>;
}

function WorldCard({ worldSlug, worldName, color }: { worldSlug: string; worldName: string; color: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: state, isLoading: stateLoading } = useQuery<any>({
    queryKey: ["/api/simulation/state", worldSlug],
    queryFn: () => fetch(`/api/simulation/state/${worldSlug}`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 30_000,
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["/api/simulation/logs", worldSlug],
    queryFn: () => fetch(`/api/simulation/logs/${worldSlug}?limit=5`).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 30_000,
  });

  const tickMut = useMutation({
    mutationFn: () => fetch(`/api/simulation/tick/${worldSlug}`, { method: "POST" }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simulation/state", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/simulation/logs", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/simulation/feed"] });
      toast({ title: `⚡ Tick xong — ${worldName}` });
    },
  });

  const lastEvent = logs[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border bg-card/50 p-5 flex flex-col gap-4"
      style={{ borderColor: `${color}40` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color }} />
          <span className="font-orbitron text-sm font-bold" style={{ color }}>{worldName}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={tickMut.isPending}
          onClick={() => tickMut.mutate()}>
          <Play className={`w-3 h-3 mr-1 ${tickMut.isPending ? "animate-pulse" : ""}`} />
          Tick
        </Button>
      </div>

      {stateLoading ? (
        <div className="h-16 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : state ? (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-border/40 p-2 bg-background/30">
              <div className="font-orbitron text-xl font-black text-cyan-400">{state.population?.toLocaleString()}</div>
              <div className="font-mono text-xs text-muted-foreground flex items-center justify-center gap-1"><Users className="w-3 h-3" />Dân số</div>
            </div>
            <div className="border border-border/40 p-2 bg-background/30">
              <div className="font-orbitron text-xl font-black text-purple-400">#{state.totalTicks}</div>
              <div className="font-mono text-xs text-muted-foreground flex items-center justify-center gap-1"><Cpu className="w-3 h-3" />Ticks</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <StatBar label="Kinh Tế" value={state.economyScore} color="#fbbf24" icon={TrendingUp} />
            <StatBar label="Tâm Trạng" value={state.avgMood} color="#34d399" icon={Heart} />
            <StatBar label="Ổn Định" value={state.stability} color="#60a5fa" icon={Shield} />
          </div>
        </>
      ) : null}

      {lastEvent && (
        <div className="border-t border-border/40 pt-3 space-y-1">
          <div className="font-mono text-xs text-muted-foreground">SỰ KIỆN GẦN NHẤT</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono" style={{ color: EVENT_COLORS[lastEvent.eventType] ?? "#94a3b8" }}>
              {lastEvent.eventName}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Pop<DeltaBadge value={lastEvent.deltaPopulation} /> Eco<DeltaBadge value={lastEvent.deltaEconomy} />
            </span>
          </div>
          {lastEvent.aiNarrative && (
            <p className="font-mono text-xs text-muted-foreground/70 italic">{lastEvent.aiNarrative}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

const WORLD_CARDS = [
  { slug: "cultivation", name: "Tu Tiên Giới", color: "#22d3ee" },
  { slug: "cyberpunk",   name: "Cyberpunk City", color: "#a855f7" },
  { slug: "wasteland",   name: "Vùng Hoang Phế", color: "#f97316" },
];

export default function WorldSimulationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feed = [], isLoading: feedLoading } = useQuery<any[]>({
    queryKey: ["/api/simulation/feed"],
    queryFn: () => fetch("/api/simulation/feed").then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 20_000,
  });

  const tickAllMut = useMutation({
    mutationFn: () => fetch("/api/simulation/tick/all", { method: "POST" }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simulation"] });
      toast({ title: "⚡ Tick toàn bộ thế giới xong!" });
    },
  });

  const recentEvents = feed.filter(f => f.eventType !== "tick").slice(0, 20);
  const totalPop = feed.reduce((a: number, f: any) => {
    if (feed.findIndex((x: any) => x.worldSlug === f.worldSlug) === feed.indexOf(f)) return a;
    return a;
  }, 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/political-map")}
            className="text-cyan-500 hover:text-cyan-300 text-xs">
            🗺 Bản Đồ
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/simulation-analytics")}
            className="text-violet-400 hover:text-violet-200 text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-8 h-8 text-cyan-400" />
                <h1 className="font-orbitron text-3xl font-black text-cyan-400 tracking-wider">SIM ENGINE</h1>
              </div>
              <p className="text-muted-foreground text-sm">Thế giới tự vận hành mỗi 60 phút — dân số, kinh tế, tâm trạng biến động theo sự kiện ngẫu nhiên.</p>
            </div>
            <Button
              className="border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 font-orbitron text-xs"
              onClick={() => tickAllMut.mutate()}
              disabled={tickAllMut.isPending}
            >
              <Zap className={`w-4 h-4 mr-2 ${tickAllMut.isPending ? "animate-pulse" : ""}`} />
              TICK TẤT CẢ
            </Button>
          </div>
        </motion.div>

        {/* World cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {WORLD_CARDS.map((w, i) => (
            <motion.div key={w.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <WorldCard worldSlug={w.slug} worldName={w.name} color={w.color} />
            </motion.div>
          ))}
        </div>

        {/* Global event feed */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 mb-4">
            <Scroll className="w-4 h-4 text-cyan-400" />
            <span className="font-orbitron text-sm font-bold text-cyan-400">BIÊN NIÊN SỬ THẾ GIỚI</span>
            <span className="font-mono text-xs text-muted-foreground ml-auto">{feed.length} sự kiện ghi nhận</span>
          </div>

          <div className="border border-border/50 bg-card/30 divide-y divide-border/30 max-h-[520px] overflow-y-auto">
            {feedLoading ? (
              <div className="h-20 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : feed.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                Chưa có dữ liệu — nhấn "TICK TẤT CẢ" để khởi động simulation
              </div>
            ) : (
              <AnimatePresence>
                {feed.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="p-3 flex gap-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: EVENT_COLORS[log.eventType] ?? "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-orbitron text-xs font-bold" style={{ color: EVENT_COLORS[log.eventType] ?? "#94a3b8" }}>
                          {log.eventName}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{log.worldSlug}</span>
                        <span className="font-mono text-xs text-muted-foreground ml-auto">#tick {log.tickNumber}</span>
                      </div>
                      {log.aiNarrative && (
                        <p className="font-mono text-xs text-muted-foreground/70 mt-0.5 italic line-clamp-1">{log.aiNarrative}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs font-mono">
                        <span>Pop <DeltaBadge value={log.deltaPopulation} /></span>
                        <span>Eco <DeltaBadge value={log.deltaEconomy} /></span>
                        <span>Mood <DeltaBadge value={log.deltaMood} /></span>
                        <span>Stab <DeltaBadge value={log.deltaStability} /></span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 border border-border/40 p-4">
          <div className="font-orbitron text-xs text-muted-foreground mb-3">CƠ CHẾ SIMULATION</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono text-muted-foreground">
            <div>⏱ Tự động tick mỗi <span className="text-cyan-400">60 phút</span></div>
            <div>🎲 28% cơ hội sự kiện ngẫu nhiên mỗi tick</div>
            <div>🌪 Thiên tai & thời tiết ảnh hưởng delta</div>
            <div>📐 Mean reversion — chỉ số kéo về baseline</div>
            <div>🤖 AI (Gemini) sinh narrative mỗi sự kiện</div>
            <div>15 loại sự kiện từ thịnh vượng đến diệt vong</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
