import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Zap, Coins, TrendingUp, Shield, Heart, Sword, Star, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface WorldSkill {
  id: string; worldSlug: string; skillName: string; skillDesc: string;
  buffType: string; buffValue: number; requiredLevel: number; learnCost: number; learners: number;
}
interface CharacterSkill {
  id: string; skillId: string; skillName: string; buffType: string; buffValue: number;
  worldSlug: string; learnedAt: string;
}

const WORLDS = [
  { slug: "cultivation", name: "Tu Tiên Giới", color: "#00ffff" },
  { slug: "cyberpunk", name: "Cyberpunk", color: "#ff00ff" },
  { slug: "wasteland", name: "Hoang Phế", color: "#ff6600" },
];

const BUFF_ICONS: Record<string, typeof Zap> = {
  exp_bonus: Star, gold_find: Coins, crit_chance: Zap, defense_bonus: Shield,
  hp_regen: Heart, attack_bonus: Sword,
};
const BUFF_LABELS: Record<string, string> = {
  exp_bonus: "EXP +", gold_find: "Gold tìm +", crit_chance: "Tỉ lệ crit +",
  defense_bonus: "Phòng thủ +", hp_regen: "Hồi HP +", attack_bonus: "Tấn công +",
};

export default function WorldSkillsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedWorld, setSelectedWorld] = useState("cultivation");
  const [skills, setSkills] = useState<WorldSkill[]>([]);
  const [learnedSkills, setLearnedSkills] = useState<CharacterSkill[]>([]);
  const [allMySkills, setAllMySkills] = useState<CharacterSkill[]>([]);
  const [hasCitizenship, setHasCitizenship] = useState(true);
  const [worldName, setWorldName] = useState("Tu Tiên Giới");
  const [loading, setLoading] = useState(true);
  const [learningId, setLearningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"learn" | "myskills">("learn");

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadMySkills();
  }, [user]);

  useEffect(() => {
    loadWorldSkills(selectedWorld);
  }, [selectedWorld]);

  async function loadMySkills() {
    try {
      const res = await fetch("/api/world-skills/my");
      const data = await res.json();
      setAllMySkills(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function loadWorldSkills(worldSlug: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/world-skills/${worldSlug}`);
      const data = await res.json();
      setSkills(data.skills ?? []);
      setLearnedSkills(data.mySkills ?? []);
      setHasCitizenship(data.hasCitizenship ?? false);
      setWorldName(data.worldName ?? worldSlug);
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải kỹ năng", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLearn(skillId: string) {
    setLearningId(skillId);
    try {
      const res = await fetch("/api/world-skills/learn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "✨ Đã học kỹ năng!", description: data.message });
      loadWorldSkills(selectedWorld);
      loadMySkills();
    } finally { setLearningId(null); }
  }

  const isLearned = (skillId: string) => learnedSkills.some(s => s.skillId === skillId);

  if (loading && skills.length === 0) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-cyan-400 animate-pulse">Đang tải kỹ năng...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-cyan-400 tracking-widest">KỸ NĂNG QUỐC GIA</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Mỗi thế giới có 3 kỹ năng độc quyền · Passive buff · Cần quốc tịch</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "learn", label: "📚 HỌC KỸ NĂNG" },
            { key: "myskills", label: `⚡ KỸ NĂNG CỦA TÔI (${allMySkills.length})` },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`font-orbitron text-xs px-4 py-2 border transition-all ${activeTab === tab.key ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-border text-muted-foreground hover:border-cyan-400/50"}`}
            >{tab.label}</button>
          ))}
        </div>

        {activeTab === "learn" && (
          <div className="space-y-6">
            {/* World Selector */}
            <div className="flex gap-2 flex-wrap">
              {WORLDS.map(w => (
                <button key={w.slug} onClick={() => setSelectedWorld(w.slug)}
                  className={`font-orbitron text-xs px-4 py-2 border transition-all ${selectedWorld === w.slug ? "text-black font-bold" : "text-muted-foreground"}`}
                  style={{
                    borderColor: w.color,
                    backgroundColor: selectedWorld === w.slug ? w.color : "transparent",
                  }}
                >{w.name}</button>
              ))}
            </div>

            {/* Citizenship warning */}
            {!hasCitizenship && (
              <div className="border border-yellow-400/40 bg-yellow-400/5 p-3 font-mono text-xs text-yellow-400">
                ⚠ Cần quốc tịch {worldName} để học các kỹ năng này.{" "}
                <button onClick={() => setLocation("/citizenship")} className="underline hover:text-yellow-300">Xin quốc tịch →</button>
              </div>
            )}

            {/* Skills */}
            {loading ? (
              <div className="font-mono text-xs text-muted-foreground animate-pulse">Đang tải...</div>
            ) : (
              <div className="grid gap-4">
                {skills.map((skill, i) => {
                  const learned = isLearned(skill.id);
                  const worldInfo = WORLDS.find(w => w.slug === skill.worldSlug);
                  const color = worldInfo?.color ?? "#00ffff";
                  const Icon = BUFF_ICONS[skill.buffType] ?? Zap;
                  const canLearn = hasCitizenship && !learned;
                  return (
                    <motion.div key={skill.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="border bg-card/50 p-5 flex items-start gap-4" style={{ borderColor: `${color}${learned ? "60" : "30"}` }}
                    >
                      <div className="w-12 h-12 flex items-center justify-center border flex-shrink-0" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                        <Icon className="w-6 h-6" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-orbitron text-sm font-bold" style={{ color }}>{skill.skillName}</div>
                          {learned && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          <div className="font-mono text-xs border px-2 py-0.5" style={{ borderColor: `${color}40`, color }}>
                            {BUFF_LABELS[skill.buffType] ?? skill.buffType}{skill.buffValue}%
                          </div>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">{skill.skillDesc}</div>
                        <div className="flex gap-4 mt-2 font-mono text-xs text-muted-foreground">
                          <span><TrendingUp className="w-3 h-3 inline mr-1" />Cấp {skill.requiredLevel}+</span>
                          <span><Coins className="w-3 h-3 inline mr-1" />{skill.learnCost} gold</span>
                          <span><Star className="w-3 h-3 inline mr-1" />{skill.learners} người học</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {learned ? (
                          <span className="font-mono text-xs text-green-400">✅ Đã học</span>
                        ) : !hasCitizenship ? (
                          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            <Lock className="w-3 h-3" /> Cần quốc tịch
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => handleLearn(skill.id)} disabled={learningId === skill.id}
                            className="font-orbitron text-xs"
                            style={{ backgroundColor: `${color}20`, border: `1px solid ${color}50`, color }}
                          >
                            {learningId === skill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `Học (-${skill.learnCost}g)`}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "myskills" && (
          <div className="space-y-4">
            {allMySkills.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                Bạn chưa học kỹ năng nào. Hãy xin quốc tịch và học ngay!
              </div>
            )}
            {/* Group by world */}
            {Object.entries(allMySkills.reduce((acc, s) => {
              if (!acc[s.worldSlug]) acc[s.worldSlug] = [];
              acc[s.worldSlug].push(s);
              return acc;
            }, {} as Record<string, CharacterSkill[]>)).map(([worldSlug, wSkills]) => {
              const worldInfo = WORLDS.find(w => w.slug === worldSlug);
              const color = worldInfo?.color ?? "#00ffff";
              return (
                <div key={worldSlug}>
                  <div className="font-orbitron text-xs font-bold mb-2" style={{ color }}>{worldInfo?.name ?? worldSlug}</div>
                  <div className="grid gap-3">
                    {wSkills.map((s, i) => {
                      const Icon = BUFF_ICONS[s.buffType] ?? Zap;
                      return (
                        <motion.div key={s.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                          className="border bg-card/50 p-4 flex items-center gap-3" style={{ borderColor: `${color}30` }}
                        >
                          <div className="w-8 h-8 flex items-center justify-center border flex-shrink-0" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-orbitron text-sm font-bold" style={{ color }}>{s.skillName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {BUFF_LABELS[s.buffType] ?? s.buffType}{s.buffValue}% · Học: {new Date(s.learnedAt).toLocaleDateString("vi-VN")}
                            </div>
                          </div>
                          <div className="font-mono text-xs border px-2 py-1" style={{ borderColor: `${color}40`, color }}>
                            +{s.buffValue}%
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
