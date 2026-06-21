import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { npcs, characters, users } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

const NPC_ROLES = ["merchant", "guardian", "raider", "sage", "assassin", "healer", "warlord"] as const;
type NpcRole = typeof NPC_ROLES[number];

const ROLE_LABELS: Record<NpcRole, string> = {
  merchant: "Thương Nhân", guardian: "Hộ Vệ", raider: "Thổ Phỉ",
  sage: "Hiền Giả", assassin: "Sát Thủ", healer: "Thầy Thuốc", warlord: "Lãnh Chúa",
};

const ROLE_ICONS: Record<NpcRole, string> = {
  merchant: "💹", guardian: "🛡", raider: "🗡", sage: "📿",
  assassin: "🗡️", healer: "💊", warlord: "⚔️",
};

const WORLD_CONTEXT: Record<string, string> = {
  cultivation: "Tu Tiên — kiếm tiên, linh khí, tông môn. NPC dùng văn phong cổ phong, bí ẩn.",
  cyberpunk:   "Cyberpunk — megacorp, hacker, neon. NPC dùng thuật ngữ kỹ thuật, lạnh lùng.",
  zombie:      "Vùng Hoang Phế — sinh tồn, mutant. NPC cộc lốc, thực tế, không quan tâm đạo đức.",
};

const SEED_NPCS: Record<string, Array<{ name: string; role: NpcRole; goals: string[]; personality: string }>> = {
  cultivation: [
    { name: "Hư Vô Lão Nhân", role: "sage", goals: ["tìm kiếm đệ tử kế thừa", "thu thập linh thảo quý"], personality: "Thâm trầm, bí ẩn, nói chuyện vòng vo nhưng luôn có ẩn ý" },
    { name: "Hắc Thị Chủ Tiêu", role: "merchant", goals: ["tích lũy linh thạch", "mở rộng giao dịch chợ đen"], personality: "Hoạt bát, lươn lẹo, thấy lợi là làm" },
    { name: "Huyết Kiếm Dạ La", role: "raider", goals: ["cướp đoạt pháp bảo", "trả thù tông môn"], personality: "Hung bạo, tàn nhẫn, nhưng tuân theo một chuẩn tắc kỳ lạ" },
  ],
  cyberpunk: [
    { name: "VIPER-7", role: "assassin", goals: ["hoàn thành hợp đồng", "thoát khỏi sự kiểm soát corp"], personality: "Lạnh lùng, chính xác, không bao giờ đặt câu hỏi về mục tiêu" },
    { name: "Nexus Kira", role: "merchant", goals: ["bán hardware chợ đen", "thu thập data về corp"], personality: "Sắc sảo, luôn tính toán, cười nhiều nhưng không tin ai" },
    { name: "IRON-TITAN-03", role: "warlord", goals: ["kiểm soát khu D-7", "tuyển quân đánh Corp"], personality: "Mạnh mẽ, bảo vệ người yếu, ghét megacorp đến xương tủy" },
  ],
  zombie: [
    { name: "Gravel Jack", role: "guardian", goals: ["bảo vệ khu tạm cư", "tìm thuốc cho người bệnh"], personality: "Khắc khổ, mệt mỏi, nhưng không bao giờ bỏ rơi đồng đội" },
    { name: "Rust Mara", role: "merchant", goals: ["đổi hàng lấy thức ăn", "tìm đường đến vùng an toàn"], personality: "Thực tế, không sentimental, sẽ làm bất cứ thứ gì để sống sót" },
    { name: "Bone Crusher", role: "raider", goals: ["cướp đoàn convoy", "xây dựng lãnh thổ"], personality: "Tàn bạo, kiêu ngạo, nhưng tôn trọng sức mạnh thực sự" },
  ],
};

async function isAdmin(userId: string): Promise<boolean> {
  const [first] = await db.select({ id: users.id }).from(users).orderBy(users.createdAt).limit(1);
  return first?.id === userId;
}

async function seedNPCsIfEmpty(worldSlug: string) {
  const existing = await db.select({ id: npcs.id }).from(npcs).where(eq(npcs.worldSlug, worldSlug)).limit(1);
  if (existing.length > 0) return;

  const templates = SEED_NPCS[worldSlug] ?? SEED_NPCS.cultivation;
  await db.insert(npcs).values(templates.map(t => ({
    worldSlug,
    name: t.name,
    role: t.role,
    goals: t.goals,
    personality: t.personality,
    currentState: { mood: "neutral", location: "thị trấn chính", action: "tuần tra", gold: 200, hp: 100 },
  })));
}

router.get("/npcs/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    await seedNPCsIfEmpty(worldSlug);
    const list = await db.select().from(npcs).where(and(eq(npcs.worldSlug, worldSlug), eq(npcs.active, true)));
    res.json({ npcs: list, roleLabels: ROLE_LABELS, roleIcons: ROLE_ICONS });
  } catch {
    res.status(500).json({ message: "Failed to fetch NPCs" });
  }
});

router.post("/npcs/:worldSlug/tick", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    if (!(await isAdmin(userId))) return res.status(403).json({ message: "Chỉ admin mới có quyền này" });
    const { worldSlug } = req.params;
    await seedNPCsIfEmpty(worldSlug);
    const allNPCs = await db.select().from(npcs).where(and(eq(npcs.worldSlug, worldSlug), eq(npcs.active, true)));
    if (allNPCs.length === 0) return res.json({ ticked: 0 });

    const worldCtx = WORLD_CONTEXT[worldSlug] ?? WORLD_CONTEXT.cultivation;
    const npcSummary = allNPCs.map(n => {
      const s = n.currentState as any;
      return `- ${n.name} (${ROLE_LABELS[n.role as NpcRole] ?? n.role}): mood=${s?.mood}, location=${s?.location}, action=${s?.action}, gold=${s?.gold}`;
    }).join("\n");

    const prompt = `Thế giới: ${worldCtx}

Các NPC hiện tại:
${npcSummary}

Mỗi NPC cần hành động 1 lần (1 "tick"). Trả về JSON array:
[
  {
    "id": "<id NPC>",
    "mood": "<neutral|happy|angry|scared|greedy|determined>",
    "location": "<địa điểm trong thế giới>",
    "action": "<mô tả hành động 5-10 từ>",
    "goldDelta": <số nguyên từ -50 đến +50, thay đổi gold>,
    "log": "<câu mô tả hành động 1 câu, giọng văn phù hợp thế giới>"
  }
]

Chỉ trả JSON array, không markdown.`;

    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
    const updates = JSON.parse(raw) as Array<{ id: string; mood: string; location: string; action: string; goldDelta: number; log: string }>;

    const npcMap = new Map(allNPCs.map(n => [n.id, n]));
    const logs: string[] = [];
    for (const u of updates) {
      const npc = npcMap.get(u.id);
      if (!npc) continue;
      const prev = npc.currentState as any;
      const newGold = Math.max(0, (prev?.gold ?? 200) + (u.goldDelta ?? 0));
      await db.update(npcs).set({
        currentState: { mood: u.mood, location: u.location, action: u.action, gold: newGold, hp: prev?.hp ?? 100 },
        lastTickAt: new Date(),
      }).where(eq(npcs.id, u.id));
      logs.push(`${npc.name}: ${u.log}`);
    }
    res.json({ ticked: updates.length, logs });
  } catch {
    res.status(500).json({ message: "Failed to tick NPCs" });
  }
});

const interactSchema = z.object({ message: z.string().min(1).max(300) });

router.post("/npcs/:npcId/interact", isAuthenticated, async (req: any, res) => {
  try {
    const { npcId } = req.params;
    const parsed = interactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid request" });
    const { message } = parsed.data;

    const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId));
    if (!npc) return res.status(404).json({ message: "NPC not found" });

    const userId = (req as any).userId;
    const charList = await db.select().from(characters).where(eq(characters.userId, userId));
    const char = charList.find(c => (c.stats as any)?.world_slug === npc.worldSlug) ?? charList[0];
    const charCtx = char ? `Nhân vật: ${char.name}, cấp ${char.level}, hệ thống ${(char.stats as any)?.system}` : "Nhân vật vô danh";

    const worldCtx = WORLD_CONTEXT[npc.worldSlug] ?? WORLD_CONTEXT.cultivation;
    const npcState = npc.currentState as any;
    const roleLabel = ROLE_LABELS[npc.role as NpcRole] ?? npc.role;

    const prompt = `Thế giới: ${worldCtx}
${charCtx}

Nhân vật NPC: ${npc.name} (${roleLabel})
Tính cách: ${npc.personality}
Mục tiêu: ${(npc.goals as string[]).join(", ")}
Trạng thái hiện tại: mood=${npcState?.mood}, đang ở ${npcState?.location}, hành động: ${npcState?.action}

Người chơi nói với NPC: "${message}"

Trả về JSON:
{
  "response": "<NPC trả lời — 2-4 câu, hoàn toàn theo nhân vật, dùng văn phong phù hợp thế giới>",
  "moodChange": "<neutral|happy|angry|scared|greedy|determined>",
  "action": "<hành động NPC thực hiện sau cuộc trò chuyện — 5-10 từ>",
  "tradeOffer": null hoặc { "item": "tên vật phẩm", "price": số nguyên } nếu NPC muốn đề nghị giao dịch
}

Chỉ JSON, không markdown.`;

    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
    const reply = JSON.parse(raw);

    await db.update(npcs).set({
      currentState: { ...npcState, mood: reply.moodChange ?? npcState?.mood, action: reply.action ?? npcState?.action },
      lastTickAt: new Date(),
    }).where(eq(npcs.id, npcId));

    res.json({
      npcName: npc.name,
      response: String(reply.response ?? "..."),
      moodChange: reply.moodChange,
      action: reply.action,
      tradeOffer: reply.tradeOffer ?? null,
    });
  } catch {
    res.status(500).json({ message: "Failed to interact with NPC" });
  }
});

export default router;
export { ROLE_LABELS, ROLE_ICONS };
