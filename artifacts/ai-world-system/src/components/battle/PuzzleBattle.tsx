import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Timer } from "lucide-react";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

const COLORS = ["🔴", "🔵", "🟡", "🟢", "🟣"];
const SEQ_LEN = 4;
const ROUNDS = 5;
const TIME_PER_ROUND = 8;

function genSequence() {
  return Array.from({ length: SEQ_LEN }, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
}

export default function PuzzleBattle({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = 80 + characterLevel * 20;
  const [charHp, setCharHp] = useState(charHpMax);
  const [enemyHp, setEnemyHp] = useState(enemy.hpMax);
  const [sequence, setSequence] = useState<string[]>(genSequence());
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<string[]>(["🧩 Ghi nhớ chuỗi màu và nhập lại!"]);

  useEffect(() => {
    setShowing(true);
    const t = setTimeout(() => setShowing(false), 2200);
    return () => clearTimeout(t);
  }, [sequence]);

  useEffect(() => {
    if (showing || done) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          handleWrong();
          return TIME_PER_ROUND;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showing, done, round]);

  function handleWrong() {
    const dmg = Math.max(5, Math.round(enemy.atk * 1.2));
    setCharHp(prev => {
      const next = Math.max(0, prev - dmg);
      setLog(l => [...l, `❌ Sai! ${enemy.name} phản công -${dmg} HP`]);
      if (next <= 0) endBattle(0, enemyHp);
      return next;
    });
    nextRound();
  }

  function handleCorrect() {
    const dmg = Math.max(8, Math.round((12 + characterLevel * 3) * 1.5));
    setEnemyHp(prev => {
      const next = Math.max(0, prev - dmg);
      setLog(l => [...l, `✅ Đúng! Gây ${dmg} sát thương cho ${enemy.name}`]);
      if (next <= 0) endBattle(charHp, 0);
      return next;
    });
    setFeedback("correct");
    setTimeout(() => { setFeedback(null); nextRound(); }, 600);
  }

  function nextRound() {
    if (round >= ROUNDS) {
      setDone(true);
      setTimeout(() => {
        const r = charHp <= 0 ? "lose" : enemyHp <= 0 ? "win" : charHp > enemyHp / enemy.hpMax * charHpMax ? "win" : "lose";
        onFinish(r, Math.max(0, charHp), log);
      }, 500);
      return;
    }
    setRound(r => r + 1);
    setInput([]);
    setTimeLeft(TIME_PER_ROUND);
    setSequence(genSequence());
  }

  function endBattle(ch: number, eh: number) {
    setDone(true);
    const result = ch <= 0 ? "lose" : eh <= 0 ? "win" : "draw";
    setTimeout(() => onFinish(result, Math.max(0, ch), log), 600);
  }

  function addInput(color: string) {
    if (showing || done) return;
    const next = [...input, color];
    setInput(next);
    if (next.length === SEQ_LEN) {
      const correct = next.every((c, i) => c === sequence[i]);
      if (correct) handleCorrect();
      else { setFeedback("wrong"); setTimeout(() => { setFeedback(null); handleWrong(); }, 500); }
    }
  }

  const charPct = Math.max(0, (charHp / charHpMax) * 100);
  const enemyPct = Math.max(0, (enemyHp / enemy.hpMax) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Vòng {round}/{ROUNDS}</span>
        <span className={`flex items-center gap-1 ${timeLeft <= 3 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>
          <Timer className="w-3 h-3" />{timeLeft}s
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-3">
          <div className="text-cyan-400 text-xs font-bold mb-1">{characterName}</div>
          <div className="bg-gray-800 rounded-full h-2">
            <motion.div className="h-2 rounded-full bg-red-500" animate={{ width: `${charPct}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">{charHp}/{charHpMax}</div>
        </div>
        <div className="bg-black/40 border border-red-500/30 rounded-xl p-3">
          <div className="text-red-400 text-xs font-bold mb-1">{enemy.icon} {enemy.name}</div>
          <div className="bg-gray-800 rounded-full h-2">
            <motion.div className="h-2 rounded-full bg-orange-500" animate={{ width: `${enemyPct}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">{enemyHp}/{enemy.hpMax}</div>
        </div>
      </div>

      <AnimatePresence>
        {showing ? (
          <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-black/60 border border-yellow-500/40 rounded-xl p-4 text-center">
            <div className="text-yellow-400 text-xs mb-3 font-bold">GHI NHỚ CHUỖI:</div>
            <div className="flex justify-center gap-3 text-3xl">
              {sequence.map((c, i) => (
                <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.15 }}>{c}</motion.span>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`bg-black/60 border rounded-xl p-4 text-center transition-colors ${feedback === "correct" ? "border-green-500" : feedback === "wrong" ? "border-red-500" : "border-gray-600"}`}>
            <div className="text-gray-400 text-xs mb-2">NHẬP LẠI CHUỖI:</div>
            <div className="flex justify-center gap-2 text-2xl mb-3 min-h-[2.5rem]">
              {Array.from({ length: SEQ_LEN }).map((_, i) => (
                <span key={i} className={input[i] ? "" : "opacity-20"}>{input[i] ?? "⬜"}</span>
              ))}
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => addInput(c)}
                  className="text-2xl hover:scale-110 active:scale-95 transition-transform">{c}</button>
              ))}
            </div>
            {input.length > 0 && (
              <button onClick={() => setInput([])} className="mt-2 text-xs text-gray-500 hover:text-gray-300">Xóa</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-black/60 border border-gray-700/50 rounded-xl p-2 h-16 overflow-y-auto">
        {log.map((m, i) => <div key={i} className="text-xs text-gray-400">{m}</div>)}
      </div>
    </div>
  );
}
