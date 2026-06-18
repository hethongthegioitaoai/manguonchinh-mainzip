import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

export default function AutoBattle({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = 80 + characterLevel * 20;
  const charAtk = 12 + characterLevel * 3;
  const charDef = 6 + characterLevel * 2;

  const [charHp, setCharHp] = useState(charHpMax);
  const [enemyHp, setEnemyHp] = useState(enemy.hpMax);
  const [log, setLog] = useState<string[]>([`🤖 Tự động chiến đấu bắt đầu!`]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState(1);
  const doneRef = useRef(false);
  const charHpRef = useRef(charHpMax);
  const enemyHpRef = useRef(enemy.hpMax);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function tick() {
    if (doneRef.current) return;
    const turn = Math.random() > 0.45 ? "player" : "enemy";
    if (turn === "player") {
      const isCrit = Math.random() < 0.15;
      const dmg = Math.max(1, Math.round(charAtk * (isCrit ? 1.8 : 1) * (0.85 + Math.random() * 0.3)));
      enemyHpRef.current = Math.max(0, enemyHpRef.current - dmg);
      setEnemyHp(enemyHpRef.current);
      setLog(prev => [...prev.slice(-10), isCrit ? `💥 CHÍ MẠNG! -${dmg} HP` : `⚔️ Tấn công -${dmg} HP`]);
    } else {
      const dmg = Math.max(1, Math.round((enemy.atk - charDef * 0.4) * (0.85 + Math.random() * 0.3)));
      charHpRef.current = Math.max(0, charHpRef.current - dmg);
      setCharHp(charHpRef.current);
      setLog(prev => [...prev.slice(-10), `💢 ${enemy.name} tấn công -${dmg} HP`]);
    }

    if (enemyHpRef.current <= 0 || charHpRef.current <= 0) {
      doneRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
      setDone(true);
      const result = enemyHpRef.current <= 0 ? "win" : "lose";
      setLog(prev => [...prev, result === "win" ? `🏆 ${enemy.name} bại trận!` : `💀 ${characterName} ngã xuống...`]);
      setTimeout(() => onFinish(result, Math.max(0, charHpRef.current), []), 800);
    }
  }

  function toggleRun() {
    if (done) return;
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      intervalRef.current = setInterval(tick, 1200 / speed);
      setRunning(true);
    }
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (running && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, 1200 / speed);
    }
  }, [speed]);

  const charPct = Math.max(0, (charHp / charHpMax) * 100);
  const enemyPct = Math.max(0, (enemyHp / enemy.hpMax) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-4">
          <div className="text-cyan-400 font-bold text-sm mb-2">{characterName} <span className="text-xs text-gray-500">Lv.{characterLevel}</span></div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-red-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-3">
              <motion.div className="h-3 rounded-full bg-gradient-to-r from-red-600 to-red-400" animate={{ width: `${charPct}%` }} />
            </div>
            <span className="text-xs">{charHp}/{charHpMax}</span>
          </div>
        </div>
        <div className="bg-black/40 border border-red-500/30 rounded-xl p-4">
          <div className="text-red-400 font-bold text-sm mb-2">{enemy.icon} {enemy.name} <span className="text-xs text-gray-500">Lv.{enemy.level}</span></div>
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3 text-orange-400" />
            <div className="flex-1 bg-gray-800 rounded-full h-3">
              <motion.div className="h-3 rounded-full bg-gradient-to-r from-orange-600 to-orange-400" animate={{ width: `${enemyPct}%` }} />
            </div>
            <span className="text-xs">{enemyHp}/{enemy.hpMax}</span>
          </div>
        </div>
      </div>

      <div className="bg-black/60 border border-gray-700/50 rounded-xl p-3 h-32 overflow-y-auto flex flex-col-reverse">
        <div>
          {log.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-300 mb-0.5">{m}</motion.div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={toggleRun} disabled={done} className={`flex-1 gap-2 ${running ? "bg-yellow-600 hover:bg-yellow-500" : "bg-green-700 hover:bg-green-600"}`}>
          {running ? <><Pause className="w-4 h-4" /> Tạm Dừng</> : <><Play className="w-4 h-4" /> Bắt Đầu</>}
        </Button>
        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${speed === s ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
