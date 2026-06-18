import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Enemy } from "@/lib/enemies";

interface Props {
  enemy: Enemy;
  characterName: string;
  characterLevel: number;
  onFinish: (result: "win" | "lose" | "draw", hpLeft: number, log: string[]) => void;
}

interface Choice { text: string; outcome: "good" | "bad" | "neutral"; next: number }
interface Node { text: string; choices?: Choice[]; result?: "win" | "lose" | "draw" }

function buildStory(enemyName: string, enemyIcon: string, charName: string): Node[] {
  return [
    {
      text: `${charName} đối mặt với ${enemyIcon} **${enemyName}**. Hơi thở của kẻ thù phả ra khí lạnh lẽo. Đây là một trận chiến không thể tránh khỏi.`,
      choices: [
        { text: "⚔️ Tấn công trực diện ngay lập tức", outcome: "good", next: 1 },
        { text: "🔍 Quan sát và tìm điểm yếu", outcome: "neutral", next: 2 },
        { text: "💬 Thử đàm phán, trì hoãn thời gian", outcome: "bad", next: 3 },
      ],
    },
    {
      text: `${charName} lao vào tấn công với toàn bộ sức mạnh! ${enemyName} bị bất ngờ, hứng chịu đòn đầu tiên đầy uy lực.`,
      choices: [
        { text: "✨ Tiếp tục dồn dập không cho thở", outcome: "good", next: 4 },
        { text: "🛡 Lùi ra phòng thủ để lấy sức", outcome: "neutral", next: 5 },
      ],
    },
    {
      text: `${charName} quan sát kỹ lưỡng. Phát hiện ra ${enemyName} có điểm yếu ở bên sườn trái khi tấn công.`,
      choices: [
        { text: "🎯 Khai thác điểm yếu đó", outcome: "good", next: 4 },
        { text: "⚔️ Vẫn tấn công trực diện", outcome: "neutral", next: 5 },
      ],
    },
    {
      text: `${enemyName} không có chút hứng thú đàm phán. Kẻ thù lợi dụng sơ hở, tung đòn phủ đầu!`,
      choices: [
        { text: "💪 Cố gắng chống đỡ", outcome: "bad", next: 5 },
        { text: "🏃 Né tránh và phản công", outcome: "neutral", next: 1 },
      ],
    },
    {
      text: `Đòn tấn công cực kỳ hiệu quả! ${enemyName} loạng choạng. Đây là cơ hội kết thúc trận chiến!`,
      choices: [
        { text: "💥 Tung chiêu quyết định", outcome: "good", next: 6 },
        { text: "🤔 Giữ lại, chờ thêm cơ hội", outcome: "neutral", next: 5 },
      ],
    },
    {
      text: `Trận chiến kéo dài. Cả hai đều kiệt sức. ${enemyName} và ${charName} nhìn nhau, hơi thở nặng nề.`,
      choices: [
        { text: "🔥 Dốc toàn lực cho đòn cuối", outcome: "good", next: 6 },
        { text: "🕊 Đề nghị kết thúc hòa", outcome: "neutral", next: 7 },
      ],
    },
    { text: `${charName} tung đòn quyết định với tất cả tinh lực! ${enemyName} không thể kháng cự, ngã xuống. **CHIẾN THẮNG!** 🏆`, result: "win" },
    { text: `Sau một trận chiến dài, cả hai đồng ý dừng lại. Không ai thắng, không ai thua. **HÒA!** ⚖️`, result: "draw" },
    { text: `${charName} kiệt sức hoàn toàn. ${enemyName} đứng trên người anh, nhưng rời đi không kết liễu. **THẤT BẠI...** 💀`, result: "lose" },
  ];
}

export default function NarrativeBattle({ enemy, characterName, characterLevel, onFinish }: Props) {
  const charHpMax = 80 + characterLevel * 20;
  const story = buildStory(enemy.name, enemy.icon, characterName);
  const [nodeIdx, setNodeIdx] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [badCount, setBadCount] = useState(0);
  const [done, setDone] = useState(false);
  const node = story[nodeIdx] ?? story[0];

  function choose(choice: Choice) {
    if (done) return;
    setHistory(h => [...h, `${characterName}: "${choice.text}"`]);
    const isBad = choice.outcome === "bad";
    const newBad = badCount + (isBad ? 1 : 0);
    setBadCount(newBad);

    let targetIdx = choice.next;
    if (newBad >= 2 && !story[targetIdx].result) targetIdx = 8;

    const target = story[targetIdx];
    setNodeIdx(targetIdx);

    if (target.result) {
      setDone(true);
      setTimeout(() => onFinish(target.result!, Math.max(0, charHpMax - newBad * 20), [...history, target.text]), 1000);
    }
  }

  function renderText(text: string) {
    return text.split("**").map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-yellow-300">{part}</strong> : <span key={i}>{part}</span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 bg-black/30 border border-gray-700/50 rounded-xl p-3">
        <span className="text-3xl">{enemy.icon}</span>
        <div>
          <div className="text-red-400 font-bold text-sm">{enemy.name}</div>
          <div className="text-xs text-gray-400">Lv.{enemy.level} · {enemy.type}</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={nodeIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="bg-black/60 border border-cyan-500/20 rounded-xl p-5 min-h-[7rem]">
          <p className="text-gray-200 text-sm leading-relaxed">{renderText(node.text)}</p>
        </motion.div>
      </AnimatePresence>

      {node.choices && !done && (
        <div className="flex flex-col gap-2">
          {node.choices.map((c, i) => (
            <motion.button key={i} onClick={() => choose(c)} whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 text-left bg-gray-800/60 hover:bg-gray-700/70 border border-gray-600/40 hover:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-gray-200 transition-all">
              <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />{c.text}
            </motion.button>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-black/40 border border-gray-800 rounded-xl p-3 max-h-20 overflow-y-auto">
          {history.map((h, i) => <div key={i} className="text-xs text-gray-500">{h}</div>)}
        </div>
      )}
    </div>
  );
}
