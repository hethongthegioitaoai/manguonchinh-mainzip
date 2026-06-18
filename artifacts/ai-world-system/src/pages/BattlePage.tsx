import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Swords, Zap, Bot, Puzzle, BookOpen, Dices,
  Shuffle, ArrowLeft, Trophy, Skull, Minus, Star, ChevronRight, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import TurnBased from "@/components/battle/TurnBased";
import RealTime from "@/components/battle/RealTime";
import AutoBattle from "@/components/battle/AutoBattle";
import PuzzleBattle from "@/components/battle/PuzzleBattle";
import NarrativeBattle from "@/components/battle/NarrativeBattle";
import DiceBattle from "@/components/battle/DiceBattle";
import type { Enemy } from "@/lib/enemies";

type BattleMode = "turn-based" | "real-time" | "auto" | "puzzle" | "narrative" | "dice";

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  stats: { system: string; world_slug: string };
}

interface DroppedItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  type: string;
  description: string;
  bonusStats: Record<string, number>;
}

interface BattleResult {
  result: "win" | "lose" | "draw";
  hpLeft: number;
  expGained: number;
  leveledUp: boolean;
  enemy: Enemy;
  mode: BattleMode;
  droppedItem?: DroppedItem | null;
}

const MODE_INFO: Record<BattleMode, { label: string; icon: React.ReactNode; desc: string; color: string; border: string; glow: string }> = {
  "turn-based": {
    label: "Lượt Chiến", icon: <Swords className="w-7 h-7" />,
    desc: "Đánh lần lượt, chọn chiêu: Tấn Công / Kỹ Năng / Phòng Thủ / Bỏ Chạy",
    color: "from-red-900/60 to-red-800/40", border: "border-red-500/50", glow: "shadow-red-900/40",
  },
  "real-time": {
    label: "Thời Gian Thực", icon: <Zap className="w-7 h-7" />,
    desc: "Nhấn nhanh trong 20 giây để gây đủ sát thương trước khi hết giờ",
    color: "from-yellow-900/60 to-yellow-800/40", border: "border-yellow-500/50", glow: "shadow-yellow-900/40",
  },
  "auto": {
    label: "Tự Động", icon: <Bot className="w-7 h-7" />,
    desc: "Trận chiến tự chạy, điều chỉnh tốc độ 1×/2×/3×, thư giãn xem",
    color: "from-green-900/60 to-green-800/40", border: "border-green-500/50", glow: "shadow-green-900/40",
  },
  "puzzle": {
    label: "Đố Trí Tuệ", icon: <Puzzle className="w-7 h-7" />,
    desc: "Ghi nhớ chuỗi màu rồi nhập lại — đúng thì tấn công, sai thì bị phản",
    color: "from-blue-900/60 to-blue-800/40", border: "border-blue-500/50", glow: "shadow-blue-900/40",
  },
  "narrative": {
    label: "Kể Chuyện", icon: <BookOpen className="w-7 h-7" />,
    desc: "Chọn hành động theo câu chuyện, quyết định tốt/xấu ảnh hưởng kết quả",
    color: "from-purple-900/60 to-purple-800/40", border: "border-purple-500/50", glow: "shadow-purple-900/40",
  },
  "dice": {
    label: "Xúc Xắc", icon: <Dices className="w-7 h-7" />,
    desc: "6 hiệp, mỗi hiệp lăn xúc xắc — may mắn quyết định sát thương",
    color: "from-indigo-900/60 to-indigo-800/40", border: "border-indigo-500/50", glow: "shadow-indigo-900/40",
  },
};

const ALL_MODES = Object.keys(MODE_INFO) as BattleMode[];

export default function BattlePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(true);

  const [phase, setPhase] = useState<"select-mode" | "battle" | "result">("select-mode");
  const [selectedMode, setSelectedMode] = useState<BattleMode | null>(null);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(data);
          setActiveChar(data[0]);
        }
      })
      .finally(() => setFetching(false));
  }, [user]);

  async function startBattle(mode: BattleMode) {
    if (!activeChar) return;
    setSelectedMode(mode);
    try {
      const res = await fetch("/api/battle/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: activeChar.id, mode }),
      });
      if (!res.ok) { alert("Không thể bắt đầu trận chiến. Thử lại sau."); return; }
      const data = await res.json();
      setEnemy(data.enemy as Enemy);
      setStartTime(Date.now());
      setPhase("battle");
    } catch {
      alert("Không thể bắt đầu trận chiến. Thử lại sau.");
    }
  }

  function pickRandom() {
    const mode = ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)];
    startBattle(mode);
  }

  async function handleBattleFinish(result: "win" | "lose" | "draw", hpLeft: number) {
    if (!activeChar || !enemy || !selectedMode) return;
    const duration = Math.round((Date.now() - startTime) / 1000);
    try {
      const res = await fetch("/api/battle/finish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: activeChar.id,
          enemyName: enemy.name,
          enemyLevel: enemy.level,
          battleMode: selectedMode,
          result,
          hpLeft,
          duration,
          metadata: { enemyType: enemy.type, worldSlug: activeChar.stats.world_slug },
        }),
      });
      if (!res.ok) { setBattleResult({ result, hpLeft, expGained: 0, leveledUp: false, enemy, mode: selectedMode, droppedItem: null }); setPhase("result"); return; }
      const data = await res.json();
      setBattleResult({ result, hpLeft, expGained: data.expGained, leveledUp: data.leveledUp, enemy, mode: selectedMode, droppedItem: data.droppedItem ?? null });
      if (data.character) setActiveChar(prev => prev ? { ...prev, exp: data.character.exp, level: data.character.level } : prev);
    } catch {
      setBattleResult({ result, hpLeft, expGained: 0, leveledUp: false, enemy, mode: selectedMode, droppedItem: null });
    }
    setPhase("result");
  }

  function resetBattle() {
    setPhase("select-mode");
    setSelectedMode(null);
    setEnemy(null);
    setBattleResult(null);
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeChar) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6">
        <Skull className="w-12 h-12 text-gray-600" />
        <p className="text-gray-400 text-center">Chưa có nhân vật. Hãy tạo nhân vật trước!</p>
        <Button onClick={() => setLocation("/worlds")} className="bg-cyan-700 hover:bg-cyan-600">Tạo Nhân Vật</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-black/80 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 backdrop-blur">
        <button onClick={() => phase === "select-mode" ? setLocation("/dashboard") : resetBattle()}
          className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Swords className="w-5 h-5 text-red-400" />
        <span className="font-bold text-sm tracking-wide">CHIẾN TRƯỜNG</span>
        <div className="ml-auto text-xs text-gray-500">
          {activeChar.name} · Lv.{activeChar.level}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {phase === "select-mode" && (
            <motion.div key="select" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Chọn Chế Độ Chiến</h1>
                <p className="text-gray-400 text-sm">Mỗi chế độ mang phong cách chiến đấu khác nhau</p>
              </div>

              {characters.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {characters.map(c => (
                    <button key={c.id} onClick={() => setActiveChar(c)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeChar?.id === c.id ? "bg-cyan-600 border-cyan-500 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                      {c.name} · Lv.{c.level}
                    </button>
                  ))}
                </div>
              )}

              <motion.button onClick={pickRandom} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="w-full mb-4 bg-gradient-to-r from-pink-800/60 to-orange-800/60 border border-pink-500/50 rounded-xl p-4 flex items-center gap-3 hover:from-pink-800/80 hover:to-orange-800/80 transition-all shadow-lg shadow-pink-900/30">
                <Shuffle className="w-7 h-7 text-pink-300 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold text-pink-200">Ngẫu Nhiên</div>
                  <div className="text-xs text-pink-300/70">Hệ thống tự chọn chế độ — thử vận may</div>
                </div>
                <ChevronRight className="w-4 h-4 text-pink-400 ml-auto" />
              </motion.button>

              <div className="grid grid-cols-1 gap-3">
                {ALL_MODES.map(mode => {
                  const info = MODE_INFO[mode];
                  return (
                    <motion.button key={mode} onClick={() => startBattle(mode)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                      className={`w-full bg-gradient-to-r ${info.color} border ${info.border} rounded-xl p-4 flex items-center gap-3 hover:opacity-90 transition-all shadow-lg ${info.glow}`}>
                      <span className="text-white/80 flex-shrink-0">{info.icon}</span>
                      <div className="text-left flex-1">
                        <div className="font-bold text-sm">{info.label}</div>
                        <div className="text-xs text-gray-300/70 mt-0.5">{info.desc}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {phase === "battle" && enemy && selectedMode && (
            <motion.div key="battle" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4 flex items-center gap-2">
                <span className={`text-white/80`}>{MODE_INFO[selectedMode].icon}</span>
                <span className="font-bold text-sm text-gray-300">{MODE_INFO[selectedMode].label}</span>
                <span className="ml-auto text-xs text-gray-500">{activeChar.name} Lv.{activeChar.level}</span>
              </div>

              {selectedMode === "turn-based" && (
                <TurnBased enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
              {selectedMode === "real-time" && (
                <RealTime enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
              {selectedMode === "auto" && (
                <AutoBattle enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
              {selectedMode === "puzzle" && (
                <PuzzleBattle enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
              {selectedMode === "narrative" && (
                <NarrativeBattle enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
              {selectedMode === "dice" && (
                <DiceBattle enemy={enemy} characterName={activeChar.name} characterLevel={activeChar.level}
                  onFinish={(r, hp) => handleBattleFinish(r, hp)} />
              )}
            </motion.div>
          )}

          {phase === "result" && battleResult && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-6 py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                {battleResult.result === "win" ? (
                  <div className="w-28 h-28 rounded-full bg-yellow-500/20 border-2 border-yellow-500/60 flex items-center justify-center">
                    <Trophy className="w-14 h-14 text-yellow-400" />
                  </div>
                ) : battleResult.result === "lose" ? (
                  <div className="w-28 h-28 rounded-full bg-red-900/30 border-2 border-red-700/50 flex items-center justify-center">
                    <Skull className="w-14 h-14 text-red-400" />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
                    <Minus className="w-14 h-14 text-gray-400" />
                  </div>
                )}
              </motion.div>

              <div>
                <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className={`text-3xl font-bold mb-1 ${battleResult.result === "win" ? "text-yellow-300" : battleResult.result === "lose" ? "text-red-400" : "text-gray-300"}`}>
                  {battleResult.result === "win" ? "CHIẾN THẮNG!" : battleResult.result === "lose" ? "THẤT BẠI" : "HÒA!"}
                </motion.h2>
                <p className="text-gray-400 text-sm">
                  {battleResult.enemy.icon} {battleResult.enemy.name} · Lv.{battleResult.enemy.level}
                </p>
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="w-full bg-black/40 border border-gray-700/50 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Chế độ</span>
                  <span className="text-white font-medium">{MODE_INFO[battleResult.mode].label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">HP còn lại</span>
                  <span className="text-green-400 font-medium">{battleResult.hpLeft}</span>
                </div>
                {battleResult.expGained > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">EXP nhận được</span>
                    <span className="text-yellow-400 font-bold">+{battleResult.expGained} EXP</span>
                  </div>
                )}
                {battleResult.leveledUp && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }}
                    className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/40 rounded-xl py-2 px-4">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-300 font-bold">LÊN CẤP! → Lv.{activeChar.level}</span>
                    <Star className="w-5 h-5 text-yellow-400" />
                  </motion.div>
                )}
                {battleResult.droppedItem && (
                  <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.65, type: "spring" }}
                    className="flex items-center gap-3 bg-cyan-900/20 border border-cyan-500/40 rounded-xl p-3">
                    <span className="text-3xl flex-shrink-0">{battleResult.droppedItem.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-cyan-400 font-bold mb-0.5">📦 VẬT PHẨM RƠI!</div>
                      <div className="text-sm font-semibold text-white truncate">{battleResult.droppedItem.name}</div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {Object.entries(battleResult.droppedItem.bonusStats).map(([s, v]) => (
                          <span key={s} className="text-xs text-cyan-300 font-bold">+{v}{s}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setLocation("/inventory")}
                      className="text-xs text-cyan-400 hover:text-cyan-200 flex-shrink-0 underline underline-offset-2">
                      Xem →
                    </button>
                  </motion.div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="flex flex-col gap-3 w-full">
                <Button onClick={resetBattle} className="w-full bg-red-700 hover:bg-red-600 gap-2 h-12">
                  <Swords className="w-4 h-4" /> Trận Chiến Tiếp Theo
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => setLocation("/battle/history")} variant="outline"
                    className="border-cyan-700/60 text-cyan-400 hover:bg-cyan-900/20 h-11 text-sm gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Lịch Sử
                  </Button>
                  <Button onClick={() => setLocation("/dashboard")} variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 h-11 text-sm">
                    Dashboard
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
