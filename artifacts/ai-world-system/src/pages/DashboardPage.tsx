import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  LogOut, Globe, Zap, User, Shield, Swords, Users,
  TrendingUp, ChevronRight, Plus, Loader2, CheckCircle2, Scroll, Star, ExternalLink, Trophy, Settings, Brain, Sparkles, Skull, Hammer, Newspaper, Crown, ShoppingBag, Map, ScrollText, Infinity, Orbit, Mail, X, Gavel, Award, Handshake, Palette, Scale, AlertTriangle, Landmark, Target, Sword, Leaf, Compass, BookOpen, CloudLightning, Activity, Vote, Truck, PartyPopper, ListChecks, Smile, BarChart3,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, WORLDS, SYSTEM_ICONS, getRealm, type SystemName } from "@/lib/worlds";

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
}

interface Quest {
  id: string;
  title: string;
  description: string;
  status: string;
  expReward: number;
  questType: string;
}

const STAT_BLOCKS = [
  { key: "STR", label: "STRENGTH" },
  { key: "INT", label: "INTEL" },
  { key: "AGI", label: "AGILITY" },
  { key: "LCK", label: "LUCK" },
];

function randomStat(base: number) {
  return Math.floor(base + Math.random() * 20);
}

const QUEST_TYPE_ICONS: Record<string, string> = {
  daily: "📋",
  combat: "⚔",
  wisdom: "☯",
  explore: "🗺",
  trade: "💹",
};

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [expFlash, setExpFlash] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<{ title: string; description: string; type: string; karmaEffect: number } | null>(null);
  const [worldKarma, setWorldKarma] = useState<number>(0);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const showVerifyBanner = !user?.emailVerified && !verifyBannerDismissed;

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    loadCharacters();
  }, [user]);

  useEffect(() => {
    if (!characters.length) return;
    const slug = characters[activeIdx]?.stats?.world_slug;
    if (!slug) return;
    fetch(`/api/world-events/${slug}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.events?.length > 0) setActiveEvent(data.events[0]);
        if (typeof data.karma === "number") setWorldKarma(data.karma);
      }).catch(() => {});
  }, [characters, activeIdx]);

  async function loadCharacters() {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/characters", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load characters: ${res.status}`);
      const data = await res.json();
      setCharacters(data ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load characters");
    } finally {
      setFetching(false);
    }
  }

  const loadQuests = useCallback(async (characterId: string) => {
    setQuestsLoading(true);
    try {
      const genRes = await fetch(`/api/quests/generate/${characterId}`, {
        method: "POST",
        credentials: "include",
      });
      if (genRes.ok) {
        const data = await genRes.json();
        setQuests(data.filter((q: Quest) => q.status === "active"));
      }
    } catch {
    } finally {
      setQuestsLoading(false);
    }
  }, []);

  useEffect(() => {
    const char = characters[activeIdx];
    if (char) loadQuests(char.id);
  }, [activeIdx, characters, loadQuests]);

  async function handleCompleteQuest(questId: string) {
    if (completingId) return;
    setCompletingId(questId);
    try {
      const res = await fetch(`/api/quests/${questId}/complete`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      setExpFlash(data.expGained);
      setTimeout(() => setExpFlash(null), 2000);

      if (data.leveledUp) {
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 3000);
      }

      setQuests(prev => prev.filter(q => q.id !== questId));
      setCharacters(prev => prev.map((c, i) =>
        i === activeIdx ? { ...c, level: data.character.level, exp: data.character.exp } : c
      ));
    } catch {
    } finally {
      setCompletingId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  const char = characters[activeIdx] ?? null;
  const worldSlug = char?.stats?.world_slug ?? "";
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";
  const level = char?.level ?? 1;
  const exp = char?.exp ?? 0;
  const expPerLevel = 100;
  const expNeeded = level * expPerLevel;
  const expPercent = Math.min(((exp % expPerLevel) / expPerLevel) * 100, 100);
  const realm = world ? getRealm(worldSlug, level) : "—";
  const systemIcon = char ? (SYSTEM_ICONS[char.stats.system] ?? "⚡") : "";

  const seed = char ? char.id.charCodeAt(0) + char.id.charCodeAt(1) : 42;
  const stats = STAT_BLOCKS.map((s, i) => ({ ...s, val: randomStat(40 + seed % (10 + i * 5)) }));

  const displayName = user.email ?? user.firstName ?? "OPERATIVE";


  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-96 pointer-events-none z-0 transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at 30% -10%, ${worldColor}25, transparent 65%)` }}
      />
      <div
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, ${worldColor} 1px, transparent 1px), linear-gradient(to bottom, ${worldColor} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      <AnimatePresence>
        {levelUpFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div
              className="border-2 px-12 py-8 text-center backdrop-blur-sm"
              style={{ borderColor: worldColor, background: `${worldColor}20` }}
            >
              <div className="font-orbitron text-3xl font-black tracking-widest mb-2" style={{ color: worldColor }}>
                ⬆ THĂNG CẤP!
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                Ngươi đã đạt {getRealm(worldSlug, level)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: worldColor }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: worldColor }}>
            AI WORLD SYSTEM
          </span>
        </div>
        <div className="flex items-center gap-4">
          {expFlash !== null && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -20 }}
              transition={{ duration: 1.5 }}
              className="font-orbitron text-xs font-bold"
              style={{ color: worldColor }}
            >
              +{expFlash} EXP
            </motion.div>
          )}
          <span className="font-mono text-xs text-muted-foreground hidden md:block">
            {displayName}
          </span>
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/leaderboard")}
            className="font-mono text-xs text-muted-foreground hover:text-primary rounded-none border border-transparent hover:border-primary/30 transition-all"
          >
            <Trophy className="w-4 h-4 mr-1" /> XẾP HẠNG
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin")}
            className="font-mono text-xs text-muted-foreground hover:text-primary rounded-none border border-transparent hover:border-primary/30 transition-all"
          >
            <Settings className="w-4 h-4 mr-1" /> ADMIN
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/settings")}
            className="font-mono text-xs text-muted-foreground hover:text-primary rounded-none border border-transparent hover:border-primary/30 transition-all"
          >
            <Settings className="w-4 h-4 mr-1" /> CÀI ĐẶT
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="font-mono text-xs text-muted-foreground hover:text-primary rounded-none border border-transparent hover:border-primary/30 transition-all"
          >
            <LogOut className="w-4 h-4 mr-1" /> DISCONNECT
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {showVerifyBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex items-center gap-3 px-5 py-2.5 border-b"
            style={{
              background: "linear-gradient(90deg, rgba(234,179,8,0.08), rgba(234,179,8,0.04))",
              borderColor: "rgba(234,179,8,0.25)",
            }}
          >
            <Mail className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" strokeWidth={1.5} />
            <p className="font-mono text-xs text-yellow-300/80 flex-1 leading-relaxed tracking-wide">
              Email chưa được xác thực.{" "}
              <button
                onClick={() => setLocation("/settings")}
                className="underline underline-offset-2 text-yellow-300 hover:text-yellow-100 transition-colors"
              >
                Vào Cài đặt để gửi lại email xác nhận →
              </button>
            </p>
            <button
              onClick={() => setVerifyBannerDismissed(true)}
              className="ml-2 text-yellow-400/50 hover:text-yellow-300 transition-colors flex-shrink-0"
              aria-label="Đóng"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">

        {activeEvent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 border px-5 py-3 flex items-start gap-4 relative overflow-hidden"
            style={{ borderColor: worldColor, backgroundColor: `${worldColor}08` }}
          >
            <div className="text-xl flex-shrink-0">
              {activeEvent.type === "calamity" ? "⚡" : activeEvent.type === "boss_spawn" ? "👹" : activeEvent.type === "dungeon_open" ? "🚪" : activeEvent.type === "festival" ? "🎉" : activeEvent.type === "war" ? "⚔" : activeEvent.type === "treasure" ? "💰" : "☣"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: worldColor }}>SỰ KIỆN THẾ GIỚI</span>
                <span className="font-mono text-xs text-muted-foreground/40">
                  KARMA: {worldKarma > 0 ? "+" : ""}{worldKarma}
                </span>
              </div>
              <div className="font-orbitron text-sm font-bold mt-0.5">{activeEvent.title}</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">{activeEvent.description}</div>
            </div>
            <button onClick={() => setActiveEvent(null)} className="font-mono text-xs text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0 self-center">✕</button>
          </motion.div>
        )}

        {fetching && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!fetching && fetchError && (
          <div className="font-mono text-xs text-destructive border border-destructive/30 bg-destructive/10 px-4 py-3 max-w-lg mx-auto">
            {fetchError}
          </div>
        )}

        {!fetching && !fetchError && characters.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-32 space-y-6"
          >
            <div className="font-orbitron text-5xl text-muted-foreground/20">∅</div>
            <h2 className="font-orbitron text-2xl tracking-widest text-muted-foreground">NO IDENTITY FOUND</h2>
            <p className="font-mono text-sm text-muted-foreground/60">You have not created a character yet.</p>
            <Button
              onClick={() => setLocation("/worlds")}
              className="rounded-none font-orbitron tracking-widest border border-primary text-primary bg-primary/10 hover:bg-primary/20"
            >
              <Plus className="w-4 h-4 mr-2" /> CREATE CHARACTER
            </Button>
          </motion.div>
        )}

        {!fetching && !fetchError && characters.length > 0 && char && (
          <AnimatePresence mode="wait">
            <motion.div
              key={char.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs tracking-widest mb-1" style={{ color: worldColor }}>
                    {world?.name ?? worldSlug.toUpperCase()} — {world?.title ?? ""}
                  </p>
                  <h1 className="font-orbitron text-3xl md:text-5xl font-bold tracking-wider">
                    {char.name}
                  </h1>
                  <p className="font-mono text-sm text-muted-foreground mt-1">
                    {systemIcon} {char.stats.system}
                  </p>
                </div>

                <div className="flex gap-3">
                  {characters.length > 1 && characters.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveIdx(i)}
                      className={`w-8 h-8 rounded-none border font-mono text-xs transition-all ${
                        i === activeIdx
                          ? "border-current text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                      style={i === activeIdx ? { borderColor: worldColor, color: worldColor } : {}}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation("/worlds")}
                    className="rounded-none font-orbitron text-xs tracking-widest border-border hover:border-primary/50 transition-all"
                  >
                    <Plus className="w-3 h-3 mr-1" /> NEW
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                <div
                  className="md:col-span-1 bg-card/60 backdrop-blur-md border border-border relative overflow-hidden"
                  style={{ boxShadow: `0 0 40px ${worldColor}10` }}
                >
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: worldColor }} />

                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-center">
                      <div
                        className="w-20 h-20 flex items-center justify-center border-2 text-4xl"
                        style={{ borderColor: worldColor, backgroundColor: `${worldColor}15` }}
                      >
                        {systemIcon}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="font-mono text-xs text-muted-foreground tracking-widest mb-1">CẢNH GIỚI</div>
                      <div className="font-orbitron text-lg font-bold" style={{ color: worldColor }}>{realm}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Star className="w-3 h-3" style={{ color: worldColor }} />
                        <span className="font-mono text-xs text-muted-foreground">CẤP {level}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-xs text-muted-foreground mb-1">
                        <span>EXP</span>
                        <span>{exp % expPerLevel} / {expPerLevel}</span>
                      </div>
                      <div className="w-full h-1.5 bg-border/50 relative overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${expPercent}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full"
                          style={{ backgroundColor: worldColor }}
                        />
                      </div>
                      <div className="font-mono text-xs text-muted-foreground/50 mt-1 text-right">
                        Tổng: {exp} EXP
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {stats.map((s) => (
                        <div key={s.key} className="border border-border/50 p-2 text-center">
                          <div className="font-mono text-xs text-muted-foreground">{s.key}</div>
                          <div className="font-orbitron text-sm font-bold" style={{ color: worldColor }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 border border-border/40 px-3 py-2">
                      {world && <world.icon className="w-4 h-4 flex-shrink-0" style={{ color: worldColor }} strokeWidth={1.5} />}
                      <div>
                        <div className="font-orbitron text-xs font-bold">{world?.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/70">{world?.title}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-5">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        icon: Swords,
                        label: "CHIẾN ĐẤU",
                        sub: "Giao chiến kẻ thù, nhận EXP",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/battle"),
                      },
                      {
                        icon: Globe,
                        label: "KHÁM PHÁ",
                        sub: "Nhập hành trình AI của ngươi",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/play"),
                      },
                      {
                        icon: TrendingUp,
                        label: "TU LUYỆN",
                        sub: "Đầu tư linh khí vào chỉ số",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/cultivate"),
                      },
                      {
                        icon: Shield,
                        label: "TÚI ĐỒ",
                        sub: "Quản lý vật phẩm & trang bị",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/inventory"),
                      },
                      {
                        icon: Users,
                        label: "BANG HỘI",
                        sub: "Lập bang, chinh chiến cùng đồng minh",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/guilds"),
                      },
                      {
                        icon: Brain,
                        label: "KÝ ỨC",
                        sub: "Xem lịch sử hành trình đã ghi lại",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/memories"),
                      },
                      {
                        icon: Sparkles,
                        label: "KỸ NĂNG",
                        sub: "Học kỹ năng đặc biệt của hệ thống",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/skills"),
                      },
                      {
                        icon: Shield,
                        label: "PHE PHÁI",
                        sub: "Gia nhập phe phái, nhận stat bonus",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/factions"),
                      },
                      {
                        icon: Zap,
                        label: "CHỢ ĐEN",
                        sub: "Mua bán vật phẩm — giá dao động theo thị trường",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/market"),
                      },
                      {
                        icon: Users,
                        label: "NPC AGENTS",
                        sub: "Hội thoại với NPC — mua bán, liên minh, thông tin",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/npcs"),
                      },
                      {
                        icon: Brain,
                        label: "MÔ PHỎNG NPC",
                        sub: "Vòng đời tự động — mục tiêu, bộ nhớ, tính cách",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/npc-simulation"),
                      },
                      {
                        icon: Users,
                        label: "DÂN SỐ NPC",
                        sub: "Sinh sản, già hóa, phân bổ độ tuổi dân số",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/npc-population"),
                      },
                      {
                        icon: Shield,
                        label: "HỘI NHÓM NPC",
                        sub: "Thành lập hội nhóm, thủ lĩnh, quỹ hội",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/npc-factions"),
                      },
                      {
                        icon: Map,
                        label: "LÃNH THỔ",
                        sub: "Sở hữu đất đai, thu hoạch tài nguyên",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/territories"),
                      },
                      {
                        icon: Landmark,
                        label: "CHÍNH PHỦ NPC",
                        sub: "Hội đồng, thu thuế, tỷ lệ ủng hộ",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-government"),
                      },
                      {
                        icon: Vote,
                        label: "BẦU CỬ NPC",
                        sub: "Bỏ phiếu, ứng cử, kết quả bầu cử",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-elections"),
                      },
                      {
                        icon: Truck,
                        label: "CARAVAN LIÊN THẾ GIỚI",
                        sub: "Đoàn thương nhân, tuyến đường, cướp bóc",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/caravan"),
                      },
                      {
                        icon: BookOpen,
                        label: "THƯ VIỆN CỔ ĐẠI",
                        sub: "Lore, kỹ năng, yêu quái, cõi giới",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/library"),
                      },
                      {
                        icon: PartyPopper,
                        label: "LỄ HỘI THEO MÙA",
                        sub: "Xuân Hạ Thu Đông — quest, phần thưởng độc quyền",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/festival"),
                      },
                      {
                        icon: Swords,
                        label: "VŨ ĐÀI THẦN LỰC",
                        sub: "Đấu trường liên thế giới — bảng xếp hạng thần lực",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/divine-arena"),
                      },
                      {
                        icon: Handshake,
                        label: "NGOẠI GIAO NPC",
                        sub: "Liên minh, hiệp ước, tuyên chiến — quan hệ chính phủ",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-diplomacy"),
                      },
                      {
                        icon: Sword,
                        label: "QUÂN ĐỘI NPC",
                        sub: "Tuyển quân, huấn luyện, tiếp tế — sức mạnh chiến đấu",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/military"),
                      },
                      {
                        icon: Target,
                        label: "MỤC TIÊU DÀI HẠN NPC",
                        sub: "Mơ ước, tham vọng và hành trình của từng NPC",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-goals"),
                      },
                      {
                        icon: ListChecks,
                        label: "KẾ HOẠCH NPC",
                        sub: "Kế hoạch từng bước, điều chỉnh khi thất bại",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-plans"),
                      },
                      {
                        icon: Smile,
                        label: "CẢM XÚC NPC",
                        sub: "Hạnh phúc, tức giận, sợ hãi — ảnh hưởng hành vi",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/npc-emotions"),
                      },
                      {
                        icon: BarChart3,
                        label: "WORLD ANALYTICS",
                        sub: "Dân số, gia tộc, GDP, biên niên sử — đo lường văn minh NPC",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/world-analytics"),
                      },
                      {
                        icon: Globe,
                        label: "THẾ GIỚI",
                        sub: "Boss, tài nguyên & trạng thái thế giới",
                        tag: null,
                        disabled: false,
                        onClick: () => {
                          const slug = (characters[activeIdx]?.stats as any)?.world_slug ?? "cultivation";
                          localStorage.setItem("activeWorldSlug", slug);
                          setLocation(`/world/${slug}/state`);
                        },
                      },
                      {
                        icon: Sparkles,
                        label: "WORLD CREATOR",
                        sub: "Tạo thế giới riêng — AI sinh lore, boss, phe phái",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-creator"),
                      },
                      {
                        icon: Globe,
                        label: "CÁC THẾ GIỚI CỦA TÔI",
                        sub: "Quản lý thế giới, cổng truyền tống, Tinh Vực",
                        tag: "MỚI",
                        disabled: false,
                        onClick: () => setLocation("/my-worlds"),
                      },
                      {
                        icon: Globe,
                        label: "VŨ TRỤ PHÂN TẦNG",
                        sub: "Thăng cấp Thế Giới → Tinh Vực → Ngân Hà → Vũ Trụ",
                        tag: "MỚI",
                        disabled: false,
                        onClick: () => setLocation("/cosmos"),
                      },
                      {
                        icon: Globe,
                        label: "KHÁM PHÁ VŨ TRỤ",
                        sub: "Browse thế giới AI sinh + cộng đồng tạo",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-discover"),
                      },
                      {
                        icon: Globe,
                        label: "ĐA VŨ TRỤ",
                        sub: "Du hành thế giới — chiến tranh vũ trụ, hợp nhất",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/multiverse"),
                      },
                      {
                        icon: Swords,
                        label: "PvP THÁCH ĐẤU",
                        sub: "Thách đấu người chơi khác — tranh tài chiến lực",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/pvp"),
                      },
                      {
                        icon: Hammer,
                        label: "CHẾ TẠO",
                        sub: "Kết hợp vật phẩm — tạo trang bị mạnh hơn",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/craft"),
                      },
                      {
                        icon: Skull,
                        label: "NGỤC TỐI",
                        sub: "Chinh phục 5–10 tầng liên tiếp — loot item hiếm",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/dungeon"),
                      },
                      {
                        icon: Trophy,
                        label: "THÀNH TỰU",
                        sub: "Mở khóa thành tựu — 30 mốc theo 5 danh mục",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/achievements"),
                      },
                      {
                        icon: Swords,
                        label: "CHIẾN TRANH BANG",
                        sub: "Thủ lĩnh tuyên chiến — PvP thành viên tích điểm 24h",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/guild-war"),
                      },
                      {
                        icon: Star,
                        label: "ĐIỂM DANH",
                        sub: "Nhận thưởng hằng ngày — streak 7 ngày item epic",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/daily"),
                      },
                      {
                        icon: Newspaper,
                        label: "DÒNG THỜI GIAN",
                        sub: "Chia sẻ hành trình — xem khoảnh khắc của toàn server",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/feed"),
                      },
                      {
                        icon: Crown,
                        label: "CHẾ ĐỘ THẦN",
                        sub: "Kiểm soát thế giới bạn tạo — ban phước, trừng phạt, thần khải",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/god"),
                      },
                      {
                        icon: ShoppingBag,
                        label: "GIAO THƯƠNG LIÊN THẾ GIỚI",
                        sub: "Mua bán item xuyên thế giới — AI rename khi vượt Rào Cản",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-trade"),
                      },
                      {
                        icon: Map,
                        label: "HỘ CHIẾU DU HÀNH",
                        sub: "Du hành thế giới khác — xin nhập cảnh, creator kiểm soát",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/passport"),
                      },
                      {
                        icon: ScrollText,
                        label: "THẦN KHẢI & TIÊN TRI",
                        sub: "AI sinh lời tiên tri bí ẩn — giải mã để nhận reward legendary",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/prophecy"),
                      },
                      {
                        icon: Infinity,
                        label: "CỔNG XUYÊN KHÔNG",
                        sub: "Bị cuốn ngẫu nhiên vào thế giới lạ — tên mới, System mới, thiên phú mới",
                        tag: "ISEKAI",
                        disabled: false,
                        onClick: () => setLocation("/isekai"),
                      },
                      {
                        icon: Orbit,
                        label: "MỆNH SỐ & VẬN MỆNH",
                        sub: "AI tính Mệnh Số, kích hoạt Mệnh Cục Cát/Hung, giải quẻ Thiên Cơ Tiên",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/fate"),
                      },
                      {
                        icon: Gavel,
                        label: "NHÀ ĐẤU GIÁ",
                        sub: "Đấu giá vật phẩm hiếm, đặt giá tranh giành, mua ngay nếu muốn",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/auction"),
                      },
                      {
                        icon: Award,
                        label: "DANH HIỆU",
                        sub: "Danh hiệu mở khóa qua thành tựu — trang bị để flex cùng cộng đồng",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/titles"),
                      },
                      {
                        icon: Sparkles,
                        label: "ĐỒNG HÀNH",
                        sub: "Triệu hồi linh thú/robot đồng hành — passive buff EXP, vàng, crit khi chiến đấu",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/pets"),
                      },
                      {
                        icon: Globe,
                        label: "KINH TẾ THẾ GIỚI",
                        sub: "Sàn tỷ giá liên thế giới — đổi tiền, quản lý kho bạc, đặt thuế quan cho thế giới của bạn",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-economy"),
                      },
                      {
                        icon: Handshake,
                        label: "NGOẠI GIAO",
                        sub: "Ký kết hiệp ước liên thế giới — liên minh, thương mại, đại sứ quán, cấm vận",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/diplomacy"),
                      },
                      {
                        icon: Swords,
                        label: "CHIẾN TRANH THẾ GIỚI",
                        sub: "Tuyên chiến — PvP tích điểm 72h — thế giới thắng chiếm 20% kho bạc đối phương",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-war"),
                      },
                      {
                        icon: Palette,
                        label: "THEME THẾ GIỚI",
                        sub: "15 preset + custom AI — sinh framework hoàn chỉnh: lore, kinh tế, quân sự, vật phẩm, quest",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/world-theme"),
                      },
                      {
                        icon: Scale,
                        label: "QUẢN TRỊ THẾ GIỚI",
                        sub: "Hiến pháp — Hội đồng — Bỏ phiếu — Sắc lệnh AI — Chỉ số ổn định 0-100",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/governance"),
                      },
                      {
                        icon: AlertTriangle,
                        label: "THIÊN TAI & PHÚC LỘC",
                        sub: "Sự kiện AI ngẫu nhiên — EXP ×0.4 đến ×5.0 — cầu nguyện tập thể đẩy lùi thiên tai",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/disasters"),
                      },
                      {
                        icon: Landmark,
                        label: "NGÂN HÀNG",
                        sub: "Gửi tiết kiệm lãi 2%/ngày — vay vốn — chuyển khoản cross-world — tỷ giá ngoại giao",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/bank"),
                      },
                      {
                        icon: Target,
                        label: "BẢNG TRUY NÃ",
                        sub: "Đặt tiền truy nã nhân vật khác — thợ săn tiền thưởng — danh sách kẻ thù thiên hạ",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/bounties"),
                      },
                      {
                        icon: Sword,
                        label: "ĐẠI HỘI VÕ LÂM",
                        sub: "Giải đấu PvP toàn server — AI commentary — vô địch nhận danh hiệu Thiên Hạ Đệ Nhất",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/tournament"),
                      },
                      {
                        icon: Leaf,
                        label: "BẤT ĐỘNG SẢN",
                        sub: "Mua đất — nông điền/khoáng mỏ/cửa hàng/cư sở — thu nhập thụ động — nâng cấp bán lại",
                        tag: null,
                        disabled: false,
                        onClick: () => setLocation("/realestate"),
                      },
                      {
                        icon: Compass,
                        label: "THÁM HIỂM NHÓM",
                        sub: "Lập đội 2-4 người — AI sinh bản đồ — sự kiện ngẫu nhiên — loot chia đều — EXP nhân đôi",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/expedition"),
                      },
                      {
                        icon: Globe,
                        label: "DI DÂN & QUỐC TỊCH",
                        sub: "Định cư thế giới khác — quyền lợi công dân — giảm thuế giao dịch — bầu cử thế giới",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/citizenship"),
                      },
                      {
                        icon: Sparkles,
                        label: "HỘI CHỢ THẾ GIỚI",
                        sub: "Tham quan gian hàng các thế giới — bình chọn thế giới xuất sắc — nhận EXP — đăng ký gian hàng",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/fair"),
                      },
                      {
                        icon: BookOpen,
                        label: "KỸ NĂNG QUỐC GIA",
                        sub: "Kỹ năng độc quyền từng thế giới — passive buff EXP/gold/crit — cần quốc tịch để học",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/world-skills"),
                      },
                      {
                        icon: Crown,
                        label: "ĐIỆN TRUYỀN THUYẾT",
                        sub: "Phong huyền thoại nếu đủ điều kiện — AI sinh câu chuyện sử thi — cộng đồng tôn vinh",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/legends"),
                      },
                      {
                        icon: CloudLightning,
                        label: "THỜI TIẾT THẾ GIỚI",
                        sub: "Thời tiết thay đổi mỗi 8h — AI sinh narrative — ảnh hưởng EXP/vàng/harvest/chiến đấu",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/weather"),
                      },
                      {
                        icon: Activity,
                        label: "SIM ENGINE — THẾ GIỚI TỰ SỐNG",
                        sub: "Dân số / kinh tế / tâm trạng tự biến động mỗi 60 phút — AI sinh biên niên sử — 15 loại sự kiện",
                        tag: "NEW",
                        disabled: false,
                        onClick: () => setLocation("/simulation"),
                      },
                    ].map((action) => (
                      <motion.div
                        key={action.label}
                        whileHover={!action.disabled ? { scale: 1.01 } : {}}
                        onClick={action.onClick}
                        className={`group relative border border-border bg-card/50 p-5 flex items-center gap-4 transition-all duration-300 ${
                          action.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-opacity-100"
                        }`}
                        style={!action.disabled ? { borderColor: `${worldColor}60` } : {}}
                      >
                        <div
                          className="w-10 h-10 flex items-center justify-center border flex-shrink-0"
                          style={{ borderColor: `${worldColor}40`, backgroundColor: `${worldColor}10` }}
                        >
                          <action.icon className="w-5 h-5" style={{ color: worldColor }} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-orbitron text-sm font-bold tracking-wide">{action.label}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-0.5">{action.sub}</div>
                        </div>
                        {action.tag && (
                          <span className="font-mono text-xs border border-border/50 text-muted-foreground/50 px-2 py-0.5 flex-shrink-0">
                            {action.tag}
                          </span>
                        )}
                        {!action.disabled && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <div
                    className="border border-border/60 bg-card/40 relative overflow-hidden"
                    style={{ boxShadow: `inset 0 0 40px ${worldColor}05` }}
                  >
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <Scroll className="w-4 h-4" style={{ color: worldColor }} strokeWidth={1.5} />
                        <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: worldColor }}>
                          NHIỆM VỤ
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {quests.length} đang hoạt động
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      {questsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : quests.length === 0 ? (
                        <div className="text-center py-6 font-mono text-xs text-muted-foreground/50">
                          Không có nhiệm vụ. Hãy khám phá thế giới!
                        </div>
                      ) : (
                        quests.map((quest) => (
                          <motion.div
                            key={quest.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            layout
                            className="border border-border/50 bg-card/30 p-4 flex items-start gap-3"
                          >
                            <span className="text-lg flex-shrink-0 mt-0.5">
                              {QUEST_TYPE_ICONS[quest.questType] ?? "📋"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-orbitron text-xs font-bold truncate">{quest.title}</div>
                              <div className="font-mono text-xs text-muted-foreground/70 mt-1 leading-relaxed line-clamp-2">
                                {quest.description}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Zap className="w-3 h-3" style={{ color: worldColor }} />
                                <span className="font-mono text-xs" style={{ color: worldColor }}>
                                  +{quest.expReward} EXP
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={completingId === quest.id}
                              onClick={() => handleCompleteQuest(quest.id)}
                              className="rounded-none font-orbitron text-xs tracking-widest border flex-shrink-0 h-8 px-3"
                              style={{ borderColor: worldColor, background: `${worldColor}15`, color: worldColor }}
                            >
                              {completingId === quest.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />
                              }
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>

                  <div
                    className="border border-border/50 bg-card/40 p-6 relative overflow-hidden"
                    style={{ boxShadow: `inset 0 0 60px ${worldColor}05` }}
                  >
                    <div
                      className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-[0.06]"
                      style={{ background: `radial-gradient(circle, ${worldColor}, transparent 70%)` }}
                    />
                    <div className="flex items-start gap-4 relative z-10">
                      {world && (
                        <world.icon
                          className="w-8 h-8 flex-shrink-0 mt-1"
                          style={{ color: worldColor }}
                          strokeWidth={1}
                        />
                      )}
                      <div>
                        <h3 className="font-orbitron text-sm font-bold tracking-widest mb-2" style={{ color: worldColor }}>
                          {world?.title ?? "WORLD LORE"}
                        </h3>
                        <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                          {world?.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: User, label: "OPERATIVE", val: char.name },
                      { icon: Zap, label: "SYSTEM", val: char.stats.system.replace(" System", "").replace(" Hệ Thống", "") },
                      { icon: Shield, label: "STATUS", val: "ACTIVE" },
                    ].map((item) => (
                      <div key={item.label} className="border border-border/50 bg-card/30 px-4 py-3 flex items-center gap-3">
                        <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-muted-foreground">{item.label}</div>
                          <div className="font-orbitron text-xs font-bold truncate">{item.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.005 }}
                    onClick={() => setLocation(`/character/${char.id}`)}
                    className="group cursor-pointer border border-border/50 bg-card/30 hover:bg-card/60 px-5 py-3 flex items-center justify-between transition-all duration-200"
                    style={{ borderColor: `${worldColor}40` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center border"
                        style={{ borderColor: `${worldColor}40`, backgroundColor: `${worldColor}10` }}
                      >
                        <ExternalLink className="w-4 h-4" style={{ color: worldColor }} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="font-orbitron text-xs font-bold tracking-wide">XEM HỒ SƠ ĐẦY ĐỦ</div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">Stats, biểu đồ & lịch sử nhiệm vụ</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </motion.div>

                  <div className="border border-dashed border-border/30 p-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground tracking-widest">MULTIVERSE ACCESS</div>
                      <div className="font-orbitron text-sm mt-1">
                        {WORLDS.filter(w => w.id !== worldSlug).map(w => w.name).join(" · ")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation("/worlds")}
                      className="rounded-none font-orbitron text-xs tracking-widest border-border hover:border-primary/50 flex-shrink-0"
                    >
                      SWITCH WORLD <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
