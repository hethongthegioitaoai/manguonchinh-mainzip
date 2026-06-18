import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Users, Star, Shield, LogOut as LeaveIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, SYSTEM_ICONS, type SystemName } from "@/lib/worlds";
import { ALIGNMENT_LABELS, ALIGNMENT_COLORS, getRepRank } from "@/lib/factions";

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { system: SystemName; world_slug: string };
}

interface FactionRow {
  id: string;
  name: string;
  description: string;
  alignment: string;
  icon: string;
  color: string;
  bonusStats: Record<string, number>;
  lore?: string;
}

interface Membership {
  id: string;
  factionId: string;
  reputation: number;
  joinedAt: string;
  factionName: string;
  factionIcon: string;
  factionColor: string;
  factionAlignment: string;
  factionBonusStats: Record<string, number>;
  factionDescription: string;
}

export default function FactionsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [factionList, setFactionList] = useState<FactionRow[]>([]);
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined);
  const [fetching, setFetching] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
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
  const worldSlug = char?.stats?.world_slug ?? "";
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";

  useEffect(() => {
    if (!char) return;
    setFactionList([]);
    setMembership(undefined);

    Promise.all([
      fetch(`/api/factions/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/factions/character/${char.id}`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([fList, mem]) => {
      setFactionList(fList ?? []);
      setMembership(mem);
    }).catch(() => {
      setFactionList([]);
      setMembership(null);
    });
  }, [char, worldSlug]);

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleJoin(factionId: string) {
    if (!char || actionId) return;
    setActionId(factionId);
    try {
      const res = await fetch(`/api/factions/character/${char.id}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factionId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message ?? "Lỗi", "err"); return; }
      setMembership({
        id: data.membership.id,
        factionId: data.membership.factionId,
        reputation: data.membership.reputation,
        joinedAt: data.membership.joinedAt,
        factionName: data.faction.name,
        factionIcon: data.faction.icon,
        factionColor: data.faction.color,
        factionAlignment: data.faction.alignment,
        factionBonusStats: data.faction.bonusStats,
        factionDescription: data.faction.description,
      });
      showToast(`Đã gia nhập ${data.faction.name}!`, "ok");
    } finally {
      setActionId(null);
    }
  }

  async function handleLeave() {
    if (!char || actionId) return;
    setActionId("leave");
    try {
      const res = await fetch(`/api/factions/character/${char.id}/leave`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message ?? "Lỗi", "err"); return; }
      setMembership(null);
      showToast("Đã rời phe phái", "ok");
    } finally {
      setActionId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  const repRank = membership ? getRepRank(membership.reputation) : null;

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: worldColor }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: worldColor }}>
            PHE PHÁI
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
                  {SYSTEM_ICONS[char.stats.system] ?? "⚡"} {char.name}
                </h1>
                <p className="font-mono text-sm text-muted-foreground mt-1">Cấp {char.level}</p>
              </div>

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
            </div>

            {membership === undefined && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {membership !== undefined && (
              <>
                {membership && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border p-5 relative overflow-hidden"
                    style={{ borderColor: membership.factionColor, boxShadow: `0 0 40px ${membership.factionColor}15` }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: membership.factionColor }} />
                    <div className="absolute top-0 right-0 font-mono text-[80px] opacity-5 leading-none select-none pointer-events-none">
                      {membership.factionIcon}
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-mono text-xs tracking-widest mb-1" style={{ color: membership.factionColor }}>
                          PHE PHÁI HIỆN TẠI
                        </div>
                        <div className="font-orbitron text-xl font-bold mb-1">
                          {membership.factionIcon} {membership.factionName}
                        </div>
                        <div
                          className="inline-block font-mono text-xs px-2 py-0.5 border mb-2"
                          style={{ borderColor: ALIGNMENT_COLORS[membership.factionAlignment], color: ALIGNMENT_COLORS[membership.factionAlignment] }}
                        >
                          {ALIGNMENT_LABELS[membership.factionAlignment] ?? membership.factionAlignment}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed mb-3">
                          {membership.factionDescription}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-mono text-xs text-muted-foreground/50 mb-1">UY TÍN</div>
                            <div className="font-orbitron text-2xl font-black" style={{ color: membership.factionColor }}>
                              {membership.reputation.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: repRank?.stars ?? 1 }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-current" style={{ color: membership.factionColor }} />
                              ))}
                              <span className="font-mono text-xs text-muted-foreground ml-1">{repRank?.rank}</span>
                            </div>
                          </div>

                          <div>
                            <div className="font-mono text-xs text-muted-foreground/50 mb-2">STAT BONUS</div>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(membership.factionBonusStats ?? {}).map(([stat, val]) => (
                                <span
                                  key={stat}
                                  className="font-mono text-xs px-2 py-0.5 border"
                                  style={{ borderColor: membership.factionColor, color: membership.factionColor, backgroundColor: `${membership.factionColor}10` }}
                                >
                                  {stat}+{val as number}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionId === "leave"}
                        onClick={handleLeave}
                        className="rounded-none font-mono text-xs text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/50 transition-all flex-shrink-0"
                      >
                        {actionId === "leave" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LeaveIcon className="w-3 h-3 mr-1" />}
                        RỜI BỎ
                      </Button>
                    </div>
                  </motion.div>
                )}

                {!membership && (
                  <div
                    className="border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground/70"
                  >
                    <span style={{ color: worldColor }}>●</span> Ngươi chưa gia nhập phe phái nào. Mỗi nhân vật chỉ gia nhập được <span className="text-foreground">1 phe phái</span>. Gia nhập sẽ nhận ngay stat bonus và bắt đầu tích lũy uy tín.
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="font-mono text-xs tracking-widest text-muted-foreground/50">
                      CÁC PHE PHÁI — {world?.name ?? worldSlug.toUpperCase()}
                    </div>
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="font-mono text-xs text-muted-foreground/40">{factionList.length} phe phái</span>
                  </div>

                  {factionList.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {factionList.map((faction) => {
                        const isMember = membership?.factionId === faction.id;
                        const canJoin = !membership;
                        return (
                          <motion.div
                            key={faction.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`relative border bg-card/50 p-5 transition-all duration-300 ${
                              isMember ? "" : canJoin ? "hover:border-opacity-80 cursor-default" : "opacity-50"
                            }`}
                            style={
                              isMember
                                ? { borderColor: faction.color, boxShadow: `0 0 20px ${faction.color}20` }
                                : { borderColor: `${faction.color}40` }
                            }
                          >
                            {isMember && (
                              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: faction.color }} />
                            )}
                            <div className="absolute top-3 right-4 font-mono text-[40px] opacity-10 select-none pointer-events-none leading-none">
                              {faction.icon}
                            </div>

                            <div className="flex items-start gap-3 mb-3">
                              <div
                                className="w-10 h-10 flex items-center justify-center border text-xl flex-shrink-0"
                                style={{ borderColor: `${faction.color}60`, backgroundColor: `${faction.color}15` }}
                              >
                                {faction.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-orbitron text-sm font-bold truncate">{faction.name}</div>
                                <span
                                  className="font-mono text-xs px-1.5 py-0.5 border inline-block mt-0.5"
                                  style={{ borderColor: ALIGNMENT_COLORS[faction.alignment], color: ALIGNMENT_COLORS[faction.alignment] }}
                                >
                                  {ALIGNMENT_LABELS[faction.alignment] ?? faction.alignment}
                                </span>
                              </div>
                            </div>

                            <div className="font-mono text-xs text-muted-foreground/70 leading-relaxed mb-3 line-clamp-2">
                              {faction.description}
                            </div>

                            <div className="flex flex-wrap gap-1 mb-4">
                              {Object.entries(faction.bonusStats ?? {}).map(([stat, val]) => (
                                <span
                                  key={stat}
                                  className="font-mono text-xs px-1.5 py-0.5 border"
                                  style={{ borderColor: `${faction.color}60`, color: faction.color }}
                                >
                                  {stat}+{val as number}
                                </span>
                              ))}
                            </div>

                            {isMember ? (
                              <div
                                className="font-mono text-xs flex items-center gap-1"
                                style={{ color: faction.color }}
                              >
                                <Shield className="w-3 h-3" /> Thành viên — uy tín {membership!.reputation.toLocaleString()}
                              </div>
                            ) : canJoin ? (
                              <Button
                                size="sm"
                                disabled={!!actionId}
                                onClick={() => handleJoin(faction.id)}
                                className="w-full rounded-none font-orbitron text-xs tracking-wide border"
                                style={{ borderColor: faction.color, color: faction.color, backgroundColor: `${faction.color}10` }}
                              >
                                {actionId === faction.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>GIA NHẬP <ChevronRight className="w-3 h-3 ml-1" /></>
                                )}
                              </Button>
                            ) : (
                              <div className="font-mono text-xs text-muted-foreground/40">
                                Rời phe phái hiện tại để gia nhập
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
