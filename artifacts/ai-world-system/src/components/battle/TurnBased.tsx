import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Shield, Zap, Heart, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

const CHAR_HP_BASE = 80;
const CHAR_ATK_BASE = 12;
const CHAR_DEF_BASE = 6;

export default function TurnBased({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = CHAR_HP_BASE + characterLevel * 20;
  const charAtk = CHAR_ATK_BASE + characterLevel * 3;
  const charDef = CHAR_DEF_BASE + characterLevel * 2;

  const [charHp, setCharHp] = useState(charHpMax);
  const [enemyHp, setEnemyHp] = useState(enemy.hpMax);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [log, setLog] = useState<string[]>([`⚔️ Trận chiến bắt đầu! ${characterName} vs ${enemy.name}`]);
  const [animating, setAnimating] = useState(false);
  const [shake, setShake] = useState<"char" | "enemy" | null>(null);
  const [done, setDone] = useState(false);

  function addLog(msg: string) {
    setLog(prev => [...prev.slice(-8), msg]);
  }

  function calcDmg(atk: number, def: number, variance = 0.2) {
    const raw = atk - def * 0.5;
    const v = raw * variance;
    return Math.max(1, Math.round(raw + (Math.random() * v * 2 - v)));
  }

  function finish(ch: number, eh: number) {
    if (done) return;
    setDone(true);
    const result = ch <= 0 ? "lose" : eh <= 0 ? "win" : "draw";
    setTimeout(() => onFinish(result, Math.max(0, ch), log), 800);
  }

  async function doAction(action: "attack" | "skill" | "defend" | "flee") {
    if (animating || done || turn !== "player") return;
    setAnimating(true);

    let newEnemyHp = enemyHp;
    let newCharHp = charHp;

    if (action === "attack") {
      const dmg = calcDmg(charAtk, enemy.def);
      newEnemyHp = Math.max(0, enemyHp - dmg);
      setEnemyHp(newEnemyHp);
      setShake("enemy");
      addLog(`💥 ${characterName} tấn công! Gây ${dmg} sát thương.`);
    } else if (action === "skill") {
      const dmg = calcDmg(charAtk * 1.8, enemy.def * 0.5);
      newEnemyHp = Math.max(0, enemyHp - dmg);
      setEnemyHp(newEnemyHp);
      setShake("enemy");
      addLog(`✨ ${characterName} dùng kỹ năng! Gây ${dmg} sát thương mạnh.`);
    } else if (action === "defend") {
      const heal = Math.floor(charHpMax * 0.08);
      newCharHp = Math.min(charHpMax, charHp + heal);
      setCharHp(newCharHp);
      addLog(`🛡 ${characterName} phòng thủ, hồi ${heal} HP.`);
    } else if (action === "flee") {
      addLog(`🏃 ${characterName} đã bỏ chạy!`);
      setDone(true);
      setTimeout(() => onFinish("lose", charHp, [...log, `🏃 ${characterName} đã bỏ chạy!`]), 600);
      setAnimating(false);
      return;
    }

    setTimeout(() => setShake(null), 400);

    if (newEnemyHp <= 0) {
      addLog(`🏆 ${enemy.name} đã bị đánh bại!`);
      setAnimating(false);
      finish(newCharHp, 0);
      return;
    }

    setTurn("enemy");
    setTimeout(() => {
      const eDmg = Math.max(1, calcDmg(enemy.atk, charDef) - (action === "defend" ? Math.floor(charDef * 0.5) : 0));
      newCharHp = Math.max(0, newCharHp - eDmg);
      setCharHp(newCharHp);
      setShake("char");
      addLog(`💢 ${enemy.name} phản công! Gây ${eDmg} sát thương.`);
      setTimeout(() => {
        setShake(null);
        if (newCharHp <= 0) {
          addLog(`💀 ${characterName} đã ngã xuống...`);
          finish(0, newEnemyHp);
        } else {
          setTurn("player");
        }
        setAnimating(false);
      }, 400);
    }, 700);
  }

  const charPct = Math.max(0, (charHp / charHpMax) * 100);
  const enemyPct = Math.max(0, (enemyHp / enemy.hpMax) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <motion.div animate={shake === "char" ? { x: [-6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.3 }}
          className="bg-black/40 border border-cyan-500/30 rounded-xl p-4">
          <div className="text-cyan-400 font-bold text-sm mb-1">{characterName}</div>
          <div className="text-xs text-gray-400 mb-2">Lv.{characterLevel}</div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-red-500" animate={{ width: `${charPct}%` }} transition={{ duration: 0.4 }} />
            </div>
            <span className="text-xs text-gray-300">{charHp}/{charHpMax}</span>
          </div>
        </motion.div>

        <motion.div animate={shake === "enemy" ? { x: [6, -6, 4, -4, 0] } : {}} transition={{ duration: 0.3 }}
          className="bg-black/40 border border-red-500/30 rounded-xl p-4">
          <div className="text-red-400 font-bold text-sm mb-1">{enemy.icon} {enemy.name}</div>
          <div className="text-xs text-gray-400 mb-2">Lv.{enemy.level} · {enemy.type}</div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-orange-500" animate={{ width: `${enemyPct}%` }} transition={{ duration: 0.4 }} />
            </div>
            <span className="text-xs text-gray-300">{enemyHp}/{enemy.hpMax}</span>
          </div>
        </motion.div>
      </div>

      <div className="bg-black/60 border border-gray-700/50 rounded-xl p-3 h-28 overflow-y-auto">
        <AnimatePresence>
          {log.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs text-gray-300 mb-0.5">{msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!done && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => doAction("attack")} disabled={animating || turn !== "player"}
            className="bg-red-600 hover:bg-red-500 text-white gap-1"><Swords className="w-4 h-4" /> Tấn Công</Button>
          <Button onClick={() => doAction("skill")} disabled={animating || turn !== "player"}
            className="bg-purple-700 hover:bg-purple-600 text-white gap-1"><Zap className="w-4 h-4" /> Kỹ Năng</Button>
          <Button onClick={() => doAction("defend")} disabled={animating || turn !== "player"}
            variant="outline" className="border-cyan-600 text-cyan-400 gap-1"><Shield className="w-4 h-4" /> Phòng Thủ</Button>
          <Button onClick={() => doAction("flee")} disabled={animating || turn !== "player"}
            variant="outline" className="border-gray-600 text-gray-400 gap-1"><SkipForward className="w-4 h-4" /> Bỏ Chạy</Button>
        </div>
      )}
      {turn === "enemy" && !done && (
        <p className="text-center text-xs text-yellow-400 animate-pulse">Kẻ thù đang hành động...</p>
      )}
    </div>
  );
}
