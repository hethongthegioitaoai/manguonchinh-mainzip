import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, Trophy, Star, Zap, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, WORLDS, SYSTEM_ICONS, getRealm, type SystemName } from "@/lib/worlds";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  level: number;
  exp: number;
  worldSlug: string;
  system: SystemName;
  userName: string;
}

const RANK_STYLES = [
  { border: "border-yellow-500/60", bg: "bg-yellow-500/10", text: "text-yellow-400", icon: "👑" },
  { border: "border-slate-400/60", bg: "bg-slate-400/10", text: "text-slate-300", icon: "🥈" },
  { border: "border-amber-600/60", bg: "bg-amber-600/10", text: "text-amber-500", icon: "🥉" },
];

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeWorld, setActiveWorld] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    loadLeaderboard();
  }, [user, activeWorld]);

  async function loadLeaderboard() {
    setFetching(true);
    try {
      const url = activeWorld === "all"
        ? "/api/leaderboard"
        : `/api/leaderboard?world=${activeWorld}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      setEntries(await res.json());
    } catch {
      setEntries([]);
    } finally {
      setFetching(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  const activeWorldData = activeWorld !== "all" ? getWorld(activeWorld) : null;
  const accentColor = activeWorldData?.color ?? "hsl(var(--primary))";

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-80 pointer-events-none z-0 transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at 50% -5%, ${accentColor}20, transparent 65%)` }}
      />
      <div
        className="absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(to right, ${accentColor} 1px, transparent 1px), linear-gradient(to bottom, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <button
          onClick={() => setLocation("/dashboard")}
          className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> BẢNG ĐIỀU KHIỂN
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: accentColor }} />
          <span className="font-orbitron text-xs tracking-widest" style={{ color: accentColor }}>
            BẢNG XẾP HẠNG
          </span>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="font-orbitron text-3xl md:text-4xl font-black tracking-widest">
            BẢNG XẾP HẠNG
          </h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest">
            TOP NHÂN VẬT TRONG ĐA VŨ TRỤ
          </p>
        </motion.div>

        <div className="flex gap-2 flex-wrap justify-center">
          {[{ id: "all", label: "TẤT CẢ", color: "hsl(var(--primary))" }, ...WORLDS.map(w => ({ id: w.id, label: w.name, color: w.color }))].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveWorld(tab.id)}
              className="font-orbitron text-xs tracking-widest px-4 py-2 border transition-all duration-200"
              style={{
                borderColor: activeWorld === tab.id ? tab.color : "hsl(var(--border))",
                color: activeWorld === tab.id ? tab.color : "hsl(var(--muted-foreground))",
                backgroundColor: activeWorld === tab.id ? `${tab.color}15` : "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {fetching ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-24"
            >
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
            </motion.div>
          ) : entries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-dashed border-border/30 py-20 text-center space-y-3"
            >
              <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto" />
              <p className="font-orbitron text-sm text-muted-foreground/50 tracking-widest">CHƯA CÓ DỮ LIỆU</p>
              <p className="font-mono text-xs text-muted-foreground/30">Hãy tạo nhân vật và chinh phục thế giới!</p>
            </motion.div>
          ) : (
            <motion.div
              key={`list-${activeWorld}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {entries.map((entry, i) => {
                const entryWorld = getWorld(entry.worldSlug);
                const entryColor = entryWorld?.color ?? "hsl(var(--primary))";
                const realm = getRealm(entry.worldSlug, entry.level);
                const systemIcon = SYSTEM_ICONS[entry.system] ?? "⚡";
                const rankStyle = RANK_STYLES[entry.rank - 1];
                const isTop3 = entry.rank <= 3;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`relative border bg-card/40 p-4 flex items-center gap-4 transition-all duration-200 overflow-hidden ${
                      isTop3 ? rankStyle.border : "border-border/50"
                    } ${isTop3 ? rankStyle.bg : ""}`}
                  >
                    {isTop3 && (
                      <div className="absolute top-0 left-0 w-full h-px" style={{ backgroundColor: entryColor, opacity: 0.4 }} />
                    )}

                    <div className="flex-shrink-0 w-10 text-center">
                      {isTop3 ? (
                        <span className="text-xl">{rankStyle.icon}</span>
                      ) : (
                        <span className="font-orbitron text-sm font-bold text-muted-foreground/50">
                          #{entry.rank}
                        </span>
                      )}
                    </div>

                    <div
                      className="w-10 h-10 flex items-center justify-center border text-lg flex-shrink-0"
                      style={{ borderColor: `${entryColor}50`, backgroundColor: `${entryColor}10` }}
                    >
                      {systemIcon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-orbitron text-sm font-bold truncate">
                          {entry.name}
                        </span>
                        {isTop3 && (
                          <Crown className="w-3 h-3 flex-shrink-0" style={{ color: entryColor }} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="font-mono text-xs" style={{ color: entryColor }}>
                          {realm}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground/50">
                          {entry.system}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground/40">
                          by {entry.userName}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right space-y-1">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3" style={{ color: entryColor }} />
                        <span className="font-orbitron text-sm font-bold" style={{ color: entryColor }}>
                          CẤP {entry.level}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <Zap className="w-3 h-3 text-muted-foreground/50" />
                        <span className="font-mono text-xs text-muted-foreground/50">
                          {entry.exp} EXP
                        </span>
                      </div>
                      {entryWorld && (
                        <div className="font-mono text-xs text-right" style={{ color: `${entryColor}80` }}>
                          {entryWorld.name}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
