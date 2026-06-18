import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Lock, Unlock, Zap, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, SYSTEM_ICONS, type SystemName } from "@/lib/worlds";
import { getSkillTree, canUnlockSkill, type SkillDef, type StatBonus } from "@/lib/skills";

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { system: SystemName; world_slug: string };
}

interface SkillsData {
  characterId: string;
  system: string;
  level: number;
  unlockedSkills: { skillId: string }[];
  spentPoints: number;
  availablePoints: number;
}

function StatBonusBadges({ bonuses }: { bonuses: StatBonus; color: string }) {
  const entries = Object.entries(bonuses).filter(([, v]) => v && v > 0);
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {entries.map(([stat, val]) => (
        <span
          key={stat}
          className="font-mono text-xs px-1.5 py-0.5 border border-border/50 text-muted-foreground"
        >
          {stat}+{val}
        </span>
      ))}
    </div>
  );
}

function SkillCard({
  skill,
  unlocked,
  canUnlock,
  blockReason,
  worldColor,
  onUnlock,
  loading,
}: {
  skill: SkillDef;
  unlocked: boolean;
  canUnlock: boolean;
  blockReason?: string;
  worldColor: string;
  onUnlock: () => void;
  loading: boolean;
}) {
  const tierLabels = ["", "Sơ Cấp", "Trung Cấp", "Cao Cấp", "Tuyệt Đỉnh"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative border bg-card/50 p-4 transition-all duration-300 ${
        unlocked
          ? "border-opacity-100"
          : canUnlock
          ? "border-border hover:border-opacity-70 cursor-pointer"
          : "border-border/30 opacity-60"
      }`}
      style={unlocked ? { borderColor: worldColor, boxShadow: `0 0 20px ${worldColor}20` } : {}}
    >
      {unlocked && (
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: worldColor }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="font-mono text-xs px-1.5 py-0.5 border"
              style={
                unlocked
                  ? { borderColor: worldColor, color: worldColor }
                  : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {tierLabels[skill.tier]}
            </span>
            <span className="font-mono text-xs text-muted-foreground/50">
              Lv.{skill.requiredLevel} · {skill.cost} điểm
            </span>
          </div>

          <div className="font-orbitron text-sm font-bold tracking-wide mb-1">
            {skill.name}
          </div>
          <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
            {skill.description}
          </div>

          <StatBonusBadges bonuses={skill.bonuses} color={worldColor} />

          <div
            className="font-mono text-xs italic mt-2 opacity-50"
            style={unlocked ? { color: worldColor } : {}}
          >
            "{skill.flavor}"
          </div>
        </div>

        <div className="flex-shrink-0">
          {unlocked ? (
            <div
              className="w-9 h-9 flex items-center justify-center border-2"
              style={{ borderColor: worldColor, backgroundColor: `${worldColor}20` }}
            >
              <Unlock className="w-4 h-4" style={{ color: worldColor }} />
            </div>
          ) : canUnlock ? (
            <Button
              size="sm"
              disabled={loading}
              onClick={onUnlock}
              className="rounded-none font-orbitron text-xs tracking-wide border px-3"
              style={{ borderColor: worldColor, color: worldColor, backgroundColor: `${worldColor}15` }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "HỌC"}
            </Button>
          ) : (
            <div className="w-9 h-9 flex items-center justify-center border border-border/30">
              <Lock className="w-4 h-4 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </div>

      {!unlocked && !canUnlock && blockReason && (
        <div className="mt-2 font-mono text-xs text-destructive/60">{blockReason}</div>
      )}

      {skill.requires.length > 0 && (
        <div className="mt-2 flex items-center gap-1 font-mono text-xs text-muted-foreground/40">
          <ChevronRight className="w-3 h-3" />
          <span>Yêu cầu: {skill.requires.join(", ")}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function SkillsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [skillsData, setSkillsData] = useState<SkillsData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCharacters(data ?? []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const char = characters[activeIdx] ?? null;

  useEffect(() => {
    if (!char) return;
    setSkillsData(null);
    fetch(`/api/skills/${char.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setSkillsData)
      .catch(() => {});
  }, [char]);

  async function handleUnlock(skillId: string) {
    if (!char || unlockingId) return;
    setUnlockingId(skillId);
    try {
      const res = await fetch(`/api/skills/${char.id}/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.message ?? "Lỗi", type: "err" });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setSkillsData((prev) =>
        prev
          ? {
              ...prev,
              unlockedSkills: [...prev.unlockedSkills, { skillId }],
              spentPoints: data.spentPoints,
              availablePoints: data.availablePoints,
            }
          : prev
      );
      setToast({ msg: "Đã học kỹ năng!", type: "ok" });
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast({ msg: "Lỗi kết nối", type: "err" });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUnlockingId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  const worldSlug = char?.stats?.world_slug ?? "cultivation";
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";
  const systemName = char?.stats?.system as SystemName | undefined;
  const systemIcon = systemName ? (SYSTEM_ICONS[systemName] ?? "⚡") : "⚡";
  const tree = systemName ? getSkillTree(systemName) : [];
  const unlockedIds = skillsData?.unlockedSkills.map((s) => s.skillId) ?? [];
  const availablePoints = skillsData?.availablePoints ?? 0;

  const tier1 = tree.filter((s) => s.tier === 1);
  const tier2 = tree.filter((s) => s.tier === 2);
  const tier3 = tree.filter((s) => s.tier === 3);
  const tier4 = tree.filter((s) => s.tier === 4);

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-96 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 30% -10%, ${worldColor}20, transparent 65%)` }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
            style={
              toast.type === "ok"
                ? { borderColor: worldColor, color: worldColor, backgroundColor: `${worldColor}15` }
                : { borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))", backgroundColor: "hsl(var(--destructive) / 0.1)" }
            }
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: worldColor }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: worldColor }}>
            KỸ NĂNG HỆ THỐNG
          </span>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {fetching && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!fetching && characters.length === 0 && (
          <div className="text-center py-32 font-orbitron text-muted-foreground">
            Chưa có nhân vật. Hãy tạo nhân vật trước.
          </div>
        )}

        {!fetching && char && (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs tracking-widest mb-1" style={{ color: worldColor }}>
                  {world?.name ?? worldSlug.toUpperCase()}
                </p>
                <h1 className="font-orbitron text-2xl md:text-4xl font-bold tracking-wider">
                  {systemIcon} {systemName}
                </h1>
                <p className="font-mono text-sm text-muted-foreground mt-1">
                  {char.name} · Cấp {char.level}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {characters.length > 1 && (
                  <div className="flex gap-2">
                    {characters.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveIdx(i)}
                        className={`w-8 h-8 border font-mono text-xs transition-all ${
                          i === activeIdx ? "border-current" : "border-border text-muted-foreground"
                        }`}
                        style={i === activeIdx ? { borderColor: worldColor, color: worldColor } : {}}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className="flex items-center gap-2 border px-4 py-2"
                  style={{ borderColor: worldColor, backgroundColor: `${worldColor}10` }}
                >
                  <Zap className="w-4 h-4" style={{ color: worldColor }} />
                  <div>
                    <div className="font-orbitron text-lg font-black" style={{ color: worldColor }}>
                      {availablePoints}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">điểm kỹ năng</div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground/70"
            >
              <span style={{ color: worldColor }}>●</span> Mỗi cấp độ cho 1 điểm kỹ năng. Dùng điểm để học các kỹ năng trong cây hệ thống của ngươi.
              {skillsData && (
                <span className="ml-2">
                  Đã dùng: <span className="text-foreground">{skillsData.spentPoints}</span> / Tổng: <span className="text-foreground">{char.level}</span>
                </span>
              )}
            </div>

            {!skillsData && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {skillsData && (
              <div className="space-y-6">
                {[
                  { label: "TẦNG 1 — SƠ CẤP", skills: tier1 },
                  { label: "TẦNG 2 — TRUNG CẤP", skills: tier2 },
                  { label: "TẦNG 3 — CAO CẤP", skills: tier3 },
                  { label: "TẦNG 4 — TUYỆT ĐỈNH", skills: tier4 },
                ].map(({ label, skills }) =>
                  skills.length > 0 ? (
                    <div key={label}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="font-mono text-xs tracking-widest text-muted-foreground/50">
                          {label}
                        </div>
                        <div className="flex-1 h-px bg-border/30" />
                        <div className="flex items-center gap-1">
                          {skills.map((s) => (
                            <div
                              key={s.id}
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: unlockedIds.includes(s.id)
                                  ? worldColor
                                  : "hsl(var(--border))",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className={`grid gap-3 ${skills.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-md"}`}>
                        {skills.map((skill) => {
                          const check = canUnlockSkill(skill, char.level, unlockedIds, availablePoints);
                          return (
                            <SkillCard
                              key={skill.id}
                              skill={skill}
                              unlocked={unlockedIds.includes(skill.id)}
                              canUnlock={check.ok}
                              blockReason={check.reason}
                              worldColor={worldColor}
                              onUnlock={() => handleUnlock(skill.id)}
                              loading={unlockingId === skill.id}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {skillsData && unlockedIds.length > 0 && (
              <div className="border border-border/40 bg-card/30 p-5">
                <div className="font-orbitron text-sm font-bold tracking-widest mb-3" style={{ color: worldColor }}>
                  <Star className="w-4 h-4 inline mr-2" />
                  KỸ NĂNG ĐÃ HỌC ({unlockedIds.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {unlockedIds.map((id) => {
                    const def = tree.find((s) => s.id === id);
                    return def ? (
                      <span
                        key={id}
                        className="font-mono text-xs px-3 py-1 border"
                        style={{ borderColor: worldColor, color: worldColor, backgroundColor: `${worldColor}10` }}
                      >
                        {def.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
