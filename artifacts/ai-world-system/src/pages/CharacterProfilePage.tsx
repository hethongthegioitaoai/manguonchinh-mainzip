import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Loader2, Star, Zap, Shield, CheckCircle2,
  ScrollText, User, Globe, Calendar,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, SYSTEM_ICONS, getRealm, REALM_TITLES, type SystemName } from "@/lib/worlds";

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  stats: {
    system: SystemName;
    world_slug: string;
    created_at?: string;
  };
  worldId: string;
  createdAt: string;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  status: string;
  expReward: number;
  questType: string;
  completedAt: string | null;
  createdAt: string;
}

const QUEST_TYPE_ICONS: Record<string, string> = {
  daily: "📋",
  combat: "⚔",
  wisdom: "☯",
  explore: "🗺",
  trade: "💹",
};

const QUEST_TYPE_LABEL: Record<string, string> = {
  daily: "Hàng ngày",
  combat: "Chiến đấu",
  wisdom: "Trí tuệ",
  explore: "Khám phá",
  trade: "Giao dịch",
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function getStats(charId: string, baseStats?: Record<string, number> | null) {
  if (baseStats && typeof baseStats === "object") {
    return [
      { stat: "STRENGTH", value: baseStats.STR ?? 10, fullMark: 100 },
      { stat: "INTEL", value: baseStats.INT ?? 10, fullMark: 100 },
      { stat: "AGILITY", value: baseStats.AGI ?? 10, fullMark: 100 },
      { stat: "LUCK", value: baseStats.LCK ?? 10, fullMark: 100 },
      { stat: "ENDURANCE", value: baseStats.END ?? 10, fullMark: 100 },
      { stat: "SPIRIT", value: baseStats.SPR ?? 10, fullMark: 100 },
    ];
  }
  const rng = seededRandom(charId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  return [
    { stat: "STRENGTH", value: Math.floor(40 + rng() * 55), fullMark: 100 },
    { stat: "INTEL", value: Math.floor(40 + rng() * 55), fullMark: 100 },
    { stat: "AGILITY", value: Math.floor(40 + rng() * 55), fullMark: 100 },
    { stat: "LUCK", value: Math.floor(40 + rng() * 55), fullMark: 100 },
    { stat: "ENDURANCE", value: Math.floor(40 + rng() * 55), fullMark: 100 },
    { stat: "SPIRIT", value: Math.floor(40 + rng() * 55), fullMark: 100 },
  ];
}

export default function CharacterProfilePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();

  const [character, setCharacter] = useState<Character | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "quests">("stats");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user || !id) return;
    loadData();
  }, [user, id]);

  async function loadData() {
    setFetching(true);
    try {
      const [charsRes, questsRes] = await Promise.all([
        fetch("/api/characters", { credentials: "include" }),
        fetch(`/api/quests/${id}`, { credentials: "include" }),
      ]);

      if (charsRes.ok) {
        const chars: Character[] = await charsRes.json();
        const found = chars.find(c => c.id === id);
        if (found) setCharacter(found);
      }

      if (questsRes.ok) {
        const data: Quest[] = await questsRes.json();
        setQuests(data);
      }
    } catch {
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

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p className="font-mono text-muted-foreground">Không tìm thấy nhân vật.</p>
        <Button onClick={() => setLocation("/dashboard")} className="rounded-none font-orbitron">
          VỀ BẢNG ĐIỀU KHIỂN
        </Button>
      </div>
    );
  }

  const worldSlug = character.stats.world_slug;
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";
  const level = character.level ?? 1;
  const exp = character.exp ?? 0;
  const expPerLevel = 100;
  const expInLevel = exp % expPerLevel;
  const expPercent = Math.min((expInLevel / expPerLevel) * 100, 100);
  const realm = getRealm(worldSlug, level);
  const systemIcon = SYSTEM_ICONS[character.stats.system] ?? "⚡";
  const statData = getStats(character.id, (character.stats as any)?.baseStats ?? null);
  const completedQuests = quests.filter(q => q.status === "completed");
  const totalExpFromQuests = completedQuests.reduce((sum, q) => sum + q.expReward, 0);
  const realmTitles = REALM_TITLES[worldSlug] ?? REALM_TITLES["cultivation"];
  const joinDate = character.createdAt
    ? new Date(character.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

  const questTypeData = Object.entries(
    completedQuests.reduce<Record<string, number>>((acc, q) => {
      const label = QUEST_TYPE_LABEL[q.questType] ?? q.questType;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-96 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${worldColor}20, transparent 65%)` }}
      />
      <div
        className="absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(to right, ${worldColor} 1px, transparent 1px), linear-gradient(to bottom, ${worldColor} 1px, transparent 1px)`,
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
        <span className="font-orbitron text-xs tracking-widest" style={{ color: worldColor }}>
          HỒ SƠ NHÂN VẬT
        </span>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          <div
            className="md:col-span-1 bg-card/60 backdrop-blur-md border border-border relative overflow-hidden"
            style={{ boxShadow: `0 0 50px ${worldColor}12` }}
          >
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: worldColor }} />
            <div className="absolute top-0 right-0 w-12 h-px" style={{ backgroundColor: worldColor }} />
            <div className="absolute bottom-0 left-0 w-12 h-px" style={{ backgroundColor: worldColor }} />

            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ boxShadow: [`0 0 20px ${worldColor}40`, `0 0 40px ${worldColor}80`, `0 0 20px ${worldColor}40`] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-24 h-24 flex items-center justify-center border-2 text-5xl"
                  style={{ borderColor: worldColor, backgroundColor: `${worldColor}15` }}
                >
                  {systemIcon}
                </motion.div>
                <div className="text-center">
                  <h1 className="font-orbitron text-xl font-bold tracking-wider">{character.name}</h1>
                  <p className="font-mono text-xs text-muted-foreground mt-1">{character.stats.system}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1 border-r border-border/40">
                    <div className="font-mono text-xs text-muted-foreground">CẤP</div>
                    <div className="font-orbitron text-2xl font-black" style={{ color: worldColor }}>{level}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-mono text-xs text-muted-foreground">TỔNG EXP</div>
                    <div className="font-orbitron text-2xl font-black" style={{ color: worldColor }}>{exp}</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono text-xs text-muted-foreground mb-1.5">
                    <span style={{ color: worldColor }}>{realm}</span>
                    <span>{expInLevel}/{expPerLevel} EXP</span>
                  </div>
                  <div className="w-full h-2 bg-border/40 relative overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${expPercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full"
                      style={{ backgroundColor: worldColor }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {[
                    { icon: Globe, label: "THẾ GIỚI", val: world?.name ?? worldSlug },
                    { icon: Star, label: "CẢNH GIỚI", val: realm },
                    { icon: CheckCircle2, label: "QUEST XONG", val: `${completedQuests.length}` },
                    { icon: Zap, label: "EXP TỪ QUEST", val: `+${totalExpFromQuests}` },
                    { icon: Calendar, label: "THAM GIA", val: joinDate },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                      <item.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                      <span className="font-mono text-xs text-muted-foreground flex-1">{item.label}</span>
                      <span className="font-orbitron text-xs font-bold truncate" style={{ color: worldColor }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-5">
            <div className="flex gap-1 border-b border-border/40">
              {(["stats", "quests"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative font-orbitron text-xs tracking-widest px-5 py-3 transition-colors"
                  style={{ color: activeTab === tab ? worldColor : "hsl(var(--muted-foreground))" }}
                >
                  {tab === "stats" ? "THỐNG KÊ" : "LỊCH SỬ QUEST"}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ backgroundColor: worldColor }}
                    />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "stats" && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="border border-border/50 bg-card/40 p-4">
                    <div className="font-mono text-xs text-muted-foreground tracking-widest mb-4">BIỂU ĐỒ CHỈ SỐ</div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={statData}>
                          <PolarGrid stroke={`${worldColor}30`} />
                          <PolarAngleAxis
                            dataKey="stat"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                          />
                          <Radar
                            name="Stats"
                            dataKey="value"
                            stroke={worldColor}
                            fill={worldColor}
                            fillOpacity={0.25}
                            strokeWidth={1.5}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {statData.map((s) => (
                      <div key={s.stat} className="border border-border/50 bg-card/30 p-3">
                        <div className="font-mono text-xs text-muted-foreground">{s.stat}</div>
                        <div className="font-orbitron text-xl font-bold mt-1" style={{ color: worldColor }}>{s.value}</div>
                        <div className="w-full h-1 bg-border/30 mt-2 overflow-hidden">
                          <div className="h-full" style={{ width: `${s.value}%`, backgroundColor: worldColor }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border/50 bg-card/40 p-4">
                    <div className="font-mono text-xs text-muted-foreground tracking-widest mb-3">LỘ TRÌNH CẢNH GIỚI</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {realmTitles.map((r, i) => {
                        const isCurrent = i === Math.min(level - 1, realmTitles.length - 1);
                        const isPast = i < Math.min(level - 1, realmTitles.length - 1);
                        return (
                          <div key={r} className="flex items-center gap-1">
                            <div
                              className="font-mono text-xs px-2 py-1 border transition-all"
                              style={{
                                borderColor: isCurrent ? worldColor : isPast ? `${worldColor}50` : "hsl(var(--border))",
                                color: isCurrent ? worldColor : isPast ? `${worldColor}80` : "hsl(var(--muted-foreground))",
                                backgroundColor: isCurrent ? `${worldColor}15` : "transparent",
                                fontWeight: isCurrent ? "bold" : "normal",
                              }}
                            >
                              {isCurrent && "★ "}{r}
                            </div>
                            {i < realmTitles.length - 1 && (
                              <ChevronLeft
                                className="w-3 h-3 rotate-180 flex-shrink-0"
                                style={{ color: isPast ? `${worldColor}50` : "hsl(var(--border))" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {questTypeData.length > 0 && (
                    <div className="border border-border/50 bg-card/40 p-4">
                      <div className="font-mono text-xs text-muted-foreground tracking-widest mb-4">QUEST THEO LOẠI</div>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={questTypeData} barSize={28}>
                            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: `1px solid ${worldColor}50`, borderRadius: 0, fontFamily: "monospace", fontSize: 11 }}
                              cursor={{ fill: `${worldColor}10` }}
                            />
                            <Bar dataKey="value" name="Số lượng" radius={0}>
                              {questTypeData.map((_, index) => (
                                <Cell key={index} fill={worldColor} fillOpacity={0.7 + index * 0.05} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "quests" && (
                <motion.div
                  key="quests"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {quests.length === 0 ? (
                    <div className="border border-dashed border-border/30 p-10 text-center">
                      <ScrollText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-mono text-xs text-muted-foreground/50">Chưa có nhiệm vụ nào.</p>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-xs text-muted-foreground/60 tracking-widest">
                        {completedQuests.length} HOÀN THÀNH · {quests.filter(q => q.status === "active").length} ĐANG HOẠT ĐỘNG
                      </div>
                      {[...quests].sort((a, b) => {
                        if (a.status === "completed" && b.status !== "completed") return -1;
                        if (b.status === "completed" && a.status !== "completed") return 1;
                        return 0;
                      }).map((quest, i) => (
                        <motion.div
                          key={quest.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`border bg-card/30 p-4 flex items-start gap-3 transition-all ${
                            quest.status === "completed" ? "border-border/30 opacity-70" : "border-border/60"
                          }`}
                          style={quest.status === "completed" ? {} : { borderColor: `${worldColor}40` }}
                        >
                          <span className="text-xl flex-shrink-0">{QUEST_TYPE_ICONS[quest.questType] ?? "📋"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-orbitron text-xs font-bold">{quest.title}</span>
                              <span className={`font-mono text-xs border px-1.5 py-px ${
                                quest.status === "completed"
                                  ? "border-green-500/40 text-green-500/70"
                                  : "border-border/50 text-muted-foreground/50"
                              }`}>
                                {quest.status === "completed" ? "✓ XONG" : "ĐANG CHẠY"}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                              {quest.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                <Zap className="w-3 h-3" style={{ color: worldColor }} />
                                <span className="font-mono text-xs" style={{ color: worldColor }}>+{quest.expReward} EXP</span>
                              </div>
                              <span className="font-mono text-xs text-muted-foreground/40">
                                {QUEST_TYPE_LABEL[quest.questType] ?? quest.questType}
                              </span>
                              {quest.completedAt && (
                                <span className="font-mono text-xs text-muted-foreground/40">
                                  {new Date(quest.completedAt).toLocaleDateString("vi-VN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="flex gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            variant="outline"
            className="rounded-none font-orbitron text-xs tracking-widest border-border hover:border-primary/50"
          >
            <User className="w-3 h-3 mr-2" /> BẢNG ĐIỀU KHIỂN
          </Button>
          <Button
            onClick={() => setLocation("/play")}
            className="rounded-none font-orbitron text-xs tracking-widest border"
            style={{ borderColor: worldColor, background: `${worldColor}15`, color: worldColor }}
          >
            <Globe className="w-3 h-3 mr-2" /> KHÁM PHÁ
          </Button>
        </div>
      </div>
    </div>
  );
}
