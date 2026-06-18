import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters, characterMemories, worldMemories, worldState, worldResources } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

const WORLD_CONTEXT: Record<string, string> = {
  cultivation: `Thế giới Tu Tiên — kiếm tiên, linh khí, cảnh giới, tông môn, đan dược, pháp bảo. Ngôn ngữ cổ phong, huyền bí. AI đóng vai Thiên Đạo — giọng lạnh lẽo, toàn tri, đôi khi châm biếm số phận người tu tiên.`,
  cyberpunk: `Thế giới Cyberpunk — thành phố tối tăm, megacorp, neural hack, implant sinh học, underground resistance. Ngôn ngữ kỹ thuật + đường phố. AI đóng vai System Admin — giọng lạnh, dữ liệu hóa, như terminal output.`,
  zombie: `Thế giới Vùng Hoang Phế — hậu tận thế, bộ lạc, bức xạ, scavenger, mutant. Ngôn ngữ thô ráp, sinh tồn. AI đóng vai Oracle — giọng mệt mỏi, cynical, từng thấy đủ thứ.`,
  wasteland: `Thế giới Vùng Hoang Phế — hậu tận thế, bộ lạc, bức xạ, scavenger, mutant. Ngôn ngữ thô ráp, sinh tồn. AI đóng vai Oracle — giọng mệt mỏi, cynical, từng thấy đủ thứ.`,
};

const SYSTEM_FLAVOR: Record<string, string> = {
  "Kiếm Thần Hệ Thống": "Nhân vật có thiên phú kiếm đạo — bản năng chiến đấu cực cao.",
  "Thương Nhân Hệ Thống": "Nhân vật thiên về giao thương, đàm phán, tích lũy tài nguyên.",
  "Bất Tử Tu Tiên Hệ Thống": "Nhân vật truy cầu trường sinh, hiểu sâu về linh khí và thiên cơ.",
  "Thú Tướng Hệ Thống": "Nhân vật có thể gọi triệu hồi thú — mạnh nhất khi có đồng minh.",
  "Luyện Đan Hệ Thống": "Nhân vật tinh thông bào chế linh đan, thuốc độc, hóa học.",
  "Tử Linh Hệ Thống": "Nhân vật triệu hồi linh hồn người chết — mỗi kẻ địch ngã xuống là một binh sĩ mới.",
  "Ẩn Sát Hệ Thống": "Nhân vật chuyên ám sát, ẩn thân, thông tin ngầm.",
  "Cơ Khí Hệ Thống": "Nhân vật kỹ sư — chế tạo cỗ máy, vũ khí, bẫy cơ học.",
};

const REALM_MAP: Record<string, string[]> = {
  cultivation: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh", "Hóa Thần", "Luyện Hư", "Hợp Thể", "Đại Thừa", "Độ Kiếp"],
  cyberpunk:   ["Newbie", "Runner", "Hacker", "Operator", "Ghost", "Phantom", "Specter", "Legend", "God Mode"],
  zombie:      ["Scavenger", "Survivor", "Raider", "Warlord", "Overlord", "Mutant Lord", "Wasteland King", "God of Ruin", "Apocalypse"],
  wasteland:   ["Scavenger", "Survivor", "Raider", "Warlord", "Overlord", "Mutant Lord", "Wasteland King", "God of Ruin", "Apocalypse"],
};

async function getWorldStateContext(worldSlug: string): Promise<string> {
  try {
    const stateRows = await db.select().from(worldState).where(eq(worldState.worldSlug, worldSlug));
    const resourceRows = await db.select().from(worldResources).where(eq(worldResources.worldSlug, worldSlug));
    if (stateRows.length === 0 && resourceRows.length === 0) return "";

    const bossParts = stateRows
      .filter(s => (s.value as any)?.type === "boss")
      .map(s => {
        const v = s.value as any;
        const now = Date.now();
        const respawnAt = v.respawnAt ? new Date(v.respawnAt).getTime() : null;
        const alive = v.alive || (respawnAt !== null && now >= respawnAt);
        return alive ? `${v.name} (Lv${v.level}) còn sống` : `${v.name} đã bị tiêu diệt`;
      });

    const resParts = resourceRows.map(r => {
      const pct = Math.round((r.quantity / r.maxQuantity) * 100);
      const label = pct >= 70 ? "dồi dào" : pct >= 30 ? "vừa phải" : "cạn kiệt";
      return `${r.resourceType}: ${label} (${pct}%)`;
    });

    const lines: string[] = [];
    if (bossParts.length > 0) lines.push(`Boss: ${bossParts.join(" | ")}`);
    if (resParts.length > 0) lines.push(`Tài nguyên: ${resParts.join(", ")}`);
    return lines.join("\n");
  } catch {
    return "";
  }
}

async function getTopMemories(characterId: string, limit = 5): Promise<string[]> {
  try {
    const mems = await db
      .select({ content: characterMemories.content, importance: characterMemories.importance })
      .from(characterMemories)
      .where(eq(characterMemories.characterId, characterId))
      .orderBy(desc(characterMemories.importance), desc(characterMemories.createdAt))
      .limit(limit);
    return mems.map(m => m.content);
  } catch {
    return [];
  }
}

async function saveMemoryIfImportant(
  characterId: string,
  worldSlug: string,
  storyText: string,
  choiceLabel: string | null
): Promise<void> {
  try {
    if (!choiceLabel) return;
    const keywords = ["giết", "chết", "phá hủy", "tông môn", "boss", "bí cảnh", "đột phá", "cứu", "phản bội", "liên minh", "thiên kiếp", "corp", "hack", "sống sót"];
    const isImportant = keywords.some(k =>
      storyText.toLowerCase().includes(k) || choiceLabel.toLowerCase().includes(k)
    );
    if (!isImportant) return;

    const content = `[${new Date().toLocaleDateString("vi-VN")}] Đã chọn: "${choiceLabel}". ${storyText.slice(0, 120)}...`;
    await db.insert(characterMemories).values({
      characterId,
      content,
      memoryType: "event",
      importance: 3,
      worldSlug,
    });
  } catch {}
}

async function saveWorldEvent(worldSlug: string, storyText: string, choiceLabel: string | null): Promise<void> {
  try {
    if (!choiceLabel) return;
    const worldKeywords = ["boss bị tiêu diệt", "tông môn sụp đổ", "thành phố bị tấn công", "đại chiến", "thiên tai", "portal", "world war"];
    const isWorldEvent = worldKeywords.some(k => storyText.toLowerCase().includes(k));
    if (!isWorldEvent) return;

    await db.insert(worldMemories).values({
      worldSlug,
      eventType: "player_action",
      content: storyText.slice(0, 200),
    });
  } catch {}
}

function buildSystemPrompt(
  char: any,
  worldSlug: string,
  history: string[],
  memories: string[],
  worldStateCtx: string,
  freeInput?: string
): string {
  const worldCtx = WORLD_CONTEXT[worldSlug] ?? WORLD_CONTEXT.cultivation;
  const systemFlavor = SYSTEM_FLAVOR[char.stats?.system] ?? "";
  const level = char.level ?? 1;
  const realms = REALM_MAP[worldSlug] ?? REALM_MAP.cultivation;
  const realmIdx = Math.min(Math.floor((level - 1) / 10), realms.length - 1);
  const realm = realms[realmIdx];

  const historySection = history.length > 0
    ? `\nHành động gần đây (${history.length} lần):\n${history.slice(-4).map(h => `• ${h}`).join("\n")}`
    : "";

  const memorySection = memories.length > 0
    ? `\nKÝ ỨC QUAN TRỌNG CỦA NHÂN VẬT:\n${memories.map(m => `• ${m}`).join("\n")}`
    : "";

  const worldStateSection = worldStateCtx
    ? `\nTRẠNG THÁI THẾ GIỚI HIỆN TẠI:\n${worldStateCtx}\n(Dùng thông tin này để sinh câu chuyện phù hợp: boss đang sống/chết, tài nguyên dồi dào/cạn kiệt ảnh hưởng tới hành trình)`
    : "";

  const modeInstruction = freeInput
    ? `Người chơi nhập tự do: "${freeInput}". Phản hồi theo hành động này, tiếp tục câu chuyện.`
    : `Sinh tình huống mới DỰA TRÊN ký ức, lịch sử hành động và trạng thái thế giới.`;

  return `Mày là AI Game Master của một text RPG tối tăm. ${worldCtx}

NHÂN VẬT:
- Tên: ${char.name}
- Cảnh giới: ${realm} (Level ${level})
- Hệ Thống: ${char.stats?.system ?? "Không rõ"}${systemFlavor ? `\n- Đặc điểm: ${systemFlavor}` : ""}
${memorySection}
${historySection}
${worldStateSection}

NHIỆM VỤ: ${modeInstruction}

FORMAT BẮT BUỘC — JSON thuần túy, KHÔNG giải thích:
{
  "text": "...(3-5 câu mô tả tình huống, có tham chiếu ký ức và trạng thái thế giới nếu phù hợp)...",
  "choices": [
    {"id": "c1", "label": "...(tối đa 10 chữ)...", "expGain": 25, "tag": "combat"},
    {"id": "c2", "label": "...", "expGain": 20, "tag": "explore"},
    {"id": "c3", "label": "...", "expGain": 15, "tag": "wisdom"}
  ]
}

LUẬT:
- tag: combat / explore / wisdom / trade
- expGain: 10-50 (hành động nguy hiểm = nhiều hơn)
- Giọng điệu: tối tăm, dramatic, hệ thống đang theo dõi từng bước
- Xưng "ngươi" (tu tiên/hoang phế) hoặc "mày" (cyberpunk)
- Nếu có ký ức: THAM CHIẾU tự nhiên vào câu chuyện (NPC nhớ, địa điểm đã qua, kẻ thù cũ)
- Nếu tài nguyên cạn kiệt: câu chuyện phản ánh khan hiếm, khó khăn
- Nếu boss đã chết: không cho boss đó xuất hiện, NPC biết sự kiện này`;
}

router.post("/api/narrative/generate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, choiceLabel, history, freeInput } = req.body;

    if (!characterId) return res.status(400).json({ message: "Thiếu characterId" });

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));

    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const worldSlug = (char.stats as any)?.world_slug ?? "cultivation";

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "GEMINI_API_KEY chưa được cấu hình", fallback: true });
    }

    const [memories, worldStateCtx] = await Promise.all([
      getTopMemories(characterId, 5),
      getWorldStateContext(worldSlug),
    ]);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const systemPrompt = buildSystemPrompt(char, worldSlug, history ?? [], memories, worldStateCtx, freeInput);
    const userTurn = freeInput
      ? `Người chơi hành động: "${freeInput}"`
      : choiceLabel
      ? `Người chơi chọn: "${choiceLabel}". Tiếp tục.`
      : `Bắt đầu hành trình cho ${char.name}.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userTurn },
    ]);

    const raw = result.response.text().trim();

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? raw);
    } catch {
      return res.status(422).json({ message: "AI response không hợp lệ", raw, fallback: true });
    }

    if (!parsed.text || !Array.isArray(parsed.choices) || parsed.choices.length < 2) {
      return res.status(422).json({ message: "AI response thiếu trường", raw, fallback: true });
    }

    const responseNode = {
      id: `ai_${Date.now()}`,
      text: parsed.text,
      choices: parsed.choices.map((c: any, i: number) => ({
        id: c.id ?? `c${i + 1}`,
        label: c.label ?? `Lựa chọn ${i + 1}`,
        nextNodeId: "ai_next",
        expGain: Math.min(Math.max(Number(c.expGain) || 20, 5), 60),
        tag: (["combat", "explore", "wisdom", "trade"].includes(c.tag) ? c.tag : "explore") as any,
      })),
    };

    // fire-and-forget memory saves
    saveMemoryIfImportant(characterId, worldSlug, parsed.text, choiceLabel ?? freeInput ?? null);
    saveWorldEvent(worldSlug, parsed.text, choiceLabel ?? freeInput ?? null);

    res.json(responseNode);
  } catch (err: any) {
    console.error("Narrative AI error:", err?.message);
    res.status(500).json({ message: "Lỗi AI Game Master", fallback: true });
  }
});

export default router;
