import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

const DURATION = 20;

export default function RealTime({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = 80 + characterLevel * 20;
  const charAtk = 12 + characterLevel * 3;
  const charDef = 6 + characterLevel * 2;

  const [charHp, setCharHp] = useState(charHpMax);
  const [enemyHp, setEnemyHp] = useState(enemy.hpMax);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [log, setLog] = useState<string[]>([`⚡ Thời gian thực! ${DURATION}s để hạ ${enemy.name}!`]);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const doneRef = useRef(false);
  const charHpRef = useRef(charHpMax);
  const enemyHpRef = useRef(enemy.hpMax);

  useEffect(() => {
    const interval = setInterval(() => {
      if (doneRef.current) return;
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          if (!doneRef.current) {
            doneRef.current = true;
            setDone(true);
            const result = enemyHpRef.current <= 0 ? "win" : charHpRef.current <= 0 ? "lose" : "draw";
            setTimeout(() => onFinish(result, Math.max(0, charHpRef.current), [`Hết giờ! ${result === "win" ? "Chiến thắng!" : result === "lose" ? "Thất bại!" : "Hòa!"}`]), 400);
          }
          return 0;
        }
        return t - 1;
      });

      if (!doneRef.current) {
        const eDmg = Math.max(1, Math.round((enemy.atk - charDef * 0.3) * (0.8 + Math.random() * 0.4)));
        charHpRef.current = Math.max(0, charHpRef.current - eDmg);
        setCharHp(charHpRef.current);
        if (charHpRef.current <= 0 && !doneRef.current) {
          doneRef.current = true;
          setDone(true);
          setTimeout(() => onFinish("lose", 0, [`💀 ${characterName} ngã xuống!`]), 400);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function attack() {
    if (doneRef.current || cooldown > 0) return;
    const dmg = Math.max(1, Math.round(charAtk * (0.8 + Math.random() * 0.5)));
    enemyHpRef.current = Math.max(0, enemyHpRef.current - dmg);
    setEnemyHp(enemyHpRef.current);
    setLog(prev => [...prev.slice(-6), `💥 Bạn tấn công! -${dmg} HP`]);
    setCooldown(1);
    setTimeout(() => setCooldown(0), 800);
    if (enemyHpRef.current <= 0 && !doneRef.current) {
      doneRef.current = true;
      setDone(true);
      setTimeout(() => onFinish("win", charHpRef.current, [`🏆 ${enemy.name} bại trận!`]), 400);
    }
  }

  const charPct = Math.max(0, (charHp / charHpMax) * 100);
  const enemyPct = Math.max(0, (enemyHp / enemy.hpMax) * 100);
  const timePct = (timeLeft / DURATION) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Thời gian còn lại</span>
        <span className={`font-bold text-lg ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>{timeLeft}s</span>
      </div>
      <div className="bg-gray-800 rounded-full h-2">
        <motion.div className="h-2 rounded-full bg-yellow-400" animate={{ width: `${timePct}%` }} transition={{ duration: 0.5 }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-3">
          <div className="text-cyan-400 font-bold text-sm mb-2">{characterName}</div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-red-500" animate={{ width: `${charPct}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="text-xs">{charHp}</span>
          </div>
        </div>
        <div className="bg-black/40 border border-red-500/30 rounded-xl p-3">
          <div className="text-red-400 font-bold text-sm mb-2">{enemy.icon} {enemy.name}</div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <motion.div className="h-2 rounded-full bg-orange-500" animate={{ width: `${enemyPct}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="text-xs">{enemyHp}</span>
          </div>
        </div>
      </div>

      <div className="bg-black/60 border border-gray-700/50 rounded-xl p-3 h-20 overflow-y-auto">
        {log.map((m, i) => <div key={i} className="text-xs text-gray-300">{m}</div>)}
      </div>

      <motion.div whileTap={{ scale: 0.92 }}>
        <Button onClick={attack} disabled={done || cooldown > 0}
          className="w-full h-16 text-xl bg-red-600 hover:bg-red-500 active:scale-95 gap-2 font-bold">
          <Zap className="w-6 h-6" /> ĐÁNH!
        </Button>
      </motion.div>
      <p className="text-center text-xs text-gray-500">Nhấn nhanh để hạ kẻ thù trước khi hết giờ</p>
    </div>
  );
}
