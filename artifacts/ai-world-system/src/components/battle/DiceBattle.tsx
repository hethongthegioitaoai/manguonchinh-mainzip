import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const MAX_ROUNDS = 6;

function rollDice() { return Math.floor(Math.random() * 6) + 1; }

function getDiceBonus(roll: number) {
  if (roll === 6) return { label: "Cực phẩm!", mult: 2.0, color: "text-yellow-300" };
  if (roll >= 5) return { label: "Tốt!", mult: 1.4, color: "text-green-400" };
  if (roll >= 3) return { label: "Bình thường", mult: 1.0, color: "text-gray-400" };
  return { label: "Xui!", mult: 0.5, color: "text-red-400" };
}

export default function DiceBattle({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = 80 + characterLevel * 20;
  const charAtk = 12 + characterLevel * 3;
  const charDef = 6 + characterLevel * 2;

  const [charHp, setCharHp] = useState(charHpMax);
  const [enemyHp, setEnemyHp] = useState(enemy.hpMax);
  const [round, setRound] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<{ player: number; enemy: number } | null>(null);
  const [log, setLog] = useState<string[]>([`🎲 Chiến Tướng Xúc Xắc! ${MAX_ROUNDS} hiệp đấu.`]);
  const [done, setDone] = useState(false);
  const [animDice, setAnimDice] = useState<string | null>(null);

  function rollRound() {
    if (rolling || done) return;
    setRolling(true);
    setAnimDice("rolling");

    let count = 0;
    const anim = setInterval(() => {
      setAnimDice(DICE_FACES[Math.floor(Math.random() * 6)]);
      count++;
      if (count >= 8) {
        clearInterval(anim);
        setAnimDice(null);

        const pRoll = rollDice();
        const eRoll = rollDice();
        setLastRoll({ player: pRoll, enemy: eRoll });

        const pBonus = getDiceBonus(pRoll);
        const eBonus = getDiceBonus(eRoll);

        const pDmg = Math.max(1, Math.round(charAtk * pBonus.mult - enemy.def * 0.4));
        const eDmg = Math.max(1, Math.round(enemy.atk * eBonus.mult - charDef * 0.4));

        const newEnemyHp = Math.max(0, enemyHp - pDmg);
        const newCharHp = Math.max(0, charHp - eDmg);

        setEnemyHp(newEnemyHp);
        setCharHp(newCharHp);
        setLog(prev => [...prev.slice(-8),
          `Hiệp ${round}: Bạn tung ${DICE_FACES[pRoll - 1]} (${pBonus.label}) -${pDmg} HP | ${enemy.icon} tung ${DICE_FACES[eRoll - 1]} (${eBonus.label}) -${eDmg} HP`
        ]);

        const nextRound = round + 1;
        const isOver = newEnemyHp <= 0 || newCharHp <= 0 || nextRound > MAX_ROUNDS;

        if (isOver) {
          setDone(true);
          const result = newEnemyHp <= 0 && newCharHp <= 0 ? "draw" : newEnemyHp <= 0 ? "win" : newCharHp <= 0 ? "lose" : newEnemyHp < newCharHp / charHpMax * enemy.hpMax ? "win" : "lose";
          setLog(prev => [...prev, result === "win" ? "🏆 Chiến thắng!" : result === "lose" ? "💀 Thất bại!" : "⚖️ Hòa!"]);
          setTimeout(() => onFinish(result, Math.max(0, newCharHp), []), 800);
        } else {
          setRound(nextRound);
        }
        setRolling(false);
      }
    }, 80);
  }

  const charPct = Math.max(0, (charHp / charHpMax) * 100);
  const enemyPct = Math.max(0, (enemyHp / enemy.hpMax) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">Hiệp {round}/{MAX_ROUNDS}</span>
        {lastRoll && (
          <div className="flex gap-3 text-sm">
            <span className="text-cyan-400">{DICE_FACES[lastRoll.player - 1]} {lastRoll.player}</span>
            <span className="text-gray-500">vs</span>
            <span className="text-red-400">{DICE_FACES[lastRoll.enemy - 1]} {lastRoll.enemy}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-3">
          <div className="text-cyan-400 font-bold text-sm mb-2">{characterName}</div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-red-500" animate={{ width: `${charPct}%` }} />
            </div>
            <span className="text-xs">{charHp}</span>
          </div>
        </div>
        <div className="bg-black/40 border border-red-500/30 rounded-xl p-3">
          <div className="text-red-400 font-bold text-sm mb-2">{enemy.icon} {enemy.name}</div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-orange-500" animate={{ width: `${enemyPct}%` }} />
            </div>
            <span className="text-xs">{enemyHp}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {animDice && (
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1, rotate: [0, 15, -15, 10, -10, 0] }}
            className="text-center text-7xl py-2">{animDice}</motion.div>
        )}
      </AnimatePresence>

      <div className="bg-black/60 border border-gray-700/50 rounded-xl p-3 h-28 overflow-y-auto">
        {log.map((m, i) => <div key={i} className="text-xs text-gray-300 mb-0.5">{m}</div>)}
      </div>

      <Button onClick={rollRound} disabled={rolling || done}
        className="w-full h-14 text-lg bg-indigo-700 hover:bg-indigo-600 gap-3 font-bold">
        <Dices className="w-6 h-6" />
        {rolling ? "Đang lăn..." : "Lăn Xúc Xắc!"}
      </Button>
    </div>
  );
}
