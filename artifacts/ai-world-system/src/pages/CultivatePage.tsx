import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Plus, Zap, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, getRealm, SYSTEM_ICONS, type SystemName } from "@/lib/worlds";

type StatKey = "STR" | "INT" | "AGI" | "LCK" | "END" | "SPR";

const STAT_INFO: Record<StatKey, { label: string; desc: string; icon: string }> = {
  STR: { label: "STRENGTH", desc: "Tăng sát thương chiến đấu", icon: "⚔" },
  INT: { label: "INTEL", desc: "Tăng hiệu quả kỹ năng & bùa chú", icon: "🧠" },
  AGI: { label: "AGILITY", desc: "Tăng tốc độ & né tránh", icon: "💨" },
  LCK: { label: "LUCK", desc: "Tăng tỉ lệ item drop & chí mạng", icon: "🍀" },
  END: { label: "ENDURANCE", desc: "Tăng HP tối đa & phòng thủ", icon: "🛡" },
  SPR: { label: "SPIRIT", desc: "Tăng năng lượng tu luyện hồi phục", icon: "✨" },
};

const ENERGY_LABEL: Record<string, string> = {
  cultivation: "LINH KHÍ",
  cyberpunk: "NEURAL FLUX",
  zombie: "BIO-ENERGY",
};

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  stats: { system: SystemName; world_slug: string };
}

interface CultivateState {
  character: Character;
  baseStats: Record<StatKey, number>;
  cultivationEnergy: number;
  costs: Record<StatKey, number>;
  maxStat: number;
}

export default function CultivatePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [cultState, setCultState] = useState<CultivateState | null>(null);
  const [fetching, setFetching] = useState(true);
  const [investing, setInvesting] = useState<StatKey | null>(null);
  const [flashStat, setFlashStat] = useState<StatKey | null>(null);
  const [energyFlash, setEnergyFlash] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<StatKey | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.json())
      .then(data => setCharacters(data ?? []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const loadCultivation = useCallback(async (charId: string) => {
    try {
      const res = await fetch(`/api/cultivate/${charId}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCultState(data);
    } catch {}
  }, []);

  useEffect(() => {
    const char = characters[activeIdx];
    if (char) loadCultivation(char.id);
  }, [activeIdx, characters, loadCultivation]);

  async function handleInvest(stat: StatKey) {
    if (!cultState || investing) return;
    const cost = cultState.costs[stat];
    if (cost === -1 || cultState.cultivationEnergy < cost) return;

    setInvesting(stat);
    try {
      const res = await fetch(`/api/cultivate/${cultState.character.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stat }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCultState(prev => prev ? {
        ...prev,
        baseStats: data.baseStats,
        cultivationEnergy: data.cultivationEnergy,
        costs: data.costs,
      } : prev);
      setFlashStat(stat);
      setEnergyFlash(-data.spent);
      setTimeout(() => setFlashStat(null), 600);
      setTimeout(() => setEnergyFlash(null), 1200);
    } catch {
    } finally {
      setInvesting(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const char = characters[activeIdx] ?? null;
  const worldSlug = char?.stats?.world_slug ?? "cultivation";
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";
  const energyLabel = ENERGY_LABEL[worldSlug] ?? "LINH KHÍ";
  const realm = char ? getRealm(worldSlug, char.level) : "—";
  const systemIcon = char ? (SYSTEM_ICONS[char.stats.system] ?? "⚡") : "";

  const maxEnergy = 500;
  const energyPct = cultState ? Math.min((cultState.cultivationEnergy / maxEnergy) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-80 pointer-events-none z-0 transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${worldColor}20, transparent 65%)` }}
      />
      <div
        className="absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(to right, ${worldColor} 1px, transparent 1px), linear-gradient(to bottom, ${worldColor} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-primary border border-transparent hover:border-primary/30 transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> QUAY LẠI
        </Button>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: worldColor }} strokeWidth={1.5} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: worldColor }}>TU LUYỆN</span>
        </div>
        <div className="w-24" />
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {fetching ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-32 space-y-4">
            <div className="font-orbitron text-4xl text-muted-foreground/20">∅</div>
            <p className="font-mono text-sm text-muted-foreground/60">Chưa có nhân vật. Hãy tạo ngay!</p>
            <Button onClick={() => setLocation("/worlds")} className="rounded-none font-orbitron text-xs tracking-widest border border-primary text-primary bg-primary/10 hover:bg-primary/20">
              TẠO NHÂN VẬT
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs tracking-widest mb-1" style={{ color: worldColor }}>
                  {world?.name} — {realm}
                </p>
                <h1 className="font-orbitron text-3xl font-bold tracking-wider">{char?.name}</h1>
                <p className="font-mono text-sm text-muted-foreground mt-0.5">{systemIcon} {char?.stats.system}</p>
              </div>
              {characters.length > 1 && (
                <div className="flex gap-2">
                  {characters.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveIdx(i)}
                      className={`w-8 h-8 rounded-none border font-mono text-xs transition-all ${i === activeIdx ? "border-current" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                      style={i === activeIdx ? { borderColor: worldColor, color: worldColor } : {}}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <motion.div
              className="border border-border/60 bg-card/50 backdrop-blur-md p-6 relative overflow-hidden"
              style={{ boxShadow: `0 0 40px ${worldColor}10` }}
            >
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: worldColor }} />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: worldColor }} strokeWidth={1.5} />
                  <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: worldColor }}>
                    {energyLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {energyFlash !== null && (
                      <motion.span
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: -16 }}
                        exit={{}}
                        className="font-orbitron text-xs font-bold text-destructive"
                      >
                        {energyFlash}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="font-orbitron text-xl font-black" style={{ color: worldColor }}>
                    {cultState?.cultivationEnergy ?? "—"}
                  </span>
                </div>
              </div>
              <div className="w-full h-3 bg-border/30 relative overflow-hidden rounded-none">
                <motion.div
                  animate={{ width: `${energyPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full relative"
                  style={{ backgroundColor: worldColor }}
                >
                  <div className="absolute inset-0 opacity-40"
                    style={{ background: `linear-gradient(90deg, transparent, ${worldColor}, transparent)`, backgroundSize: "200% 100%", animation: "shimmer 2s infinite" }}
                  />
                </motion.div>
              </div>
              <p className="font-mono text-xs text-muted-foreground/60 mt-2">
                +20 từ chiến thắng · +10 từ hòa · +15 từ hoàn thành nhiệm vụ
              </p>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(STAT_INFO) as StatKey[]).map((stat, i) => {
                const info = STAT_INFO[stat];
                const value = cultState?.baseStats[stat] ?? 10;
                const cost = cultState?.costs[stat] ?? 10;
                const canAfford = cultState ? cultState.cultivationEnergy >= cost : false;
                const atMax = cost === -1;
                const isFlashing = flashStat === stat;
                const isInvesting = investing === stat;

                return (
                  <motion.div
                    key={stat}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border border-border/50 bg-card/40 p-4 relative overflow-hidden"
                    style={isFlashing ? { boxShadow: `0 0 20px ${worldColor}60`, borderColor: worldColor } : {}}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.06]"
                      style={{ background: `radial-gradient(circle, ${worldColor}, transparent 70%)` }}
                    />

                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xl mb-0.5">{info.icon}</div>
                        <div className="font-orbitron text-xs font-bold tracking-wider" style={{ color: worldColor }}>
                          {stat}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60">{info.label}</div>
                      </div>
                      <button
                        onClick={() => setTooltip(tooltip === stat ? null : stat)}
                        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-0.5"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {tooltip === stat && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="font-mono text-xs text-muted-foreground/70 mb-3 border-l-2 pl-2 overflow-hidden"
                          style={{ borderColor: `${worldColor}60` }}
                        >
                          {info.desc}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center gap-2 mb-3">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={value}
                          initial={{ scale: 1.5, color: worldColor }}
                          animate={{ scale: 1, color: "var(--foreground)" }}
                          className="font-orbitron text-2xl font-black"
                        >
                          {value}
                        </motion.span>
                      </AnimatePresence>
                      <span className="font-mono text-xs text-muted-foreground/40">/ 100</span>
                    </div>

                    <div className="w-full h-1 bg-border/30 mb-3 overflow-hidden">
                      <motion.div
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full"
                        style={{ backgroundColor: `${worldColor}80` }}
                      />
                    </div>

                    <Button
                      size="sm"
                      disabled={atMax || !canAfford || isInvesting || !cultState}
                      onClick={() => handleInvest(stat)}
                      className="w-full rounded-none font-orbitron text-xs tracking-wider h-8 transition-all"
                      style={
                        !atMax && canAfford
                          ? { borderColor: worldColor, background: `${worldColor}15`, color: worldColor, border: "1px solid" }
                          : {}
                      }
                      variant={atMax || !canAfford ? "outline" : "ghost"}
                    >
                      {isInvesting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : atMax ? (
                        <span className="text-muted-foreground/40">TỐI ĐA</span>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 mr-1" />
                          <Zap className="w-3 h-3 mr-0.5" />
                          <span>{cost}</span>
                        </>
                      )}
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            <div
              className="border border-border/40 bg-card/30 p-4 font-mono text-xs text-muted-foreground/60 space-y-1"
            >
              <div className="font-orbitron text-xs text-muted-foreground/80 mb-2 tracking-widest">CÔNG THỨC CHI PHÍ</div>
              <div>Mỗi điểm stat tốn: <span style={{ color: worldColor }}>⌊giá_trị / 10⌋ × 10 + 10</span> năng lượng</div>
              <div>Ví dụ: stat 10 → tốn 20 · stat 50 → tốn 60 · stat 90 → tốn 100</div>
              <div>Tối đa mỗi chỉ số: <span style={{ color: worldColor }}>100</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
