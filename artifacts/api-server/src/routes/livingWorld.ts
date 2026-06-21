import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { customWorlds, npcs, npcLives, worldCulture, worldEconomyState, worldFrameworks } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

async function generateCulture(world: any, framework: any) {
  const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
  const terminology = (framework?.terminology as any) ?? {};
  const progressionName = (framework?.progressionSystem as any)?.name ?? "";
  const currencyName = (framework?.currency as any)?.primary ?? "vàng";

  const prompt = `Bạn là nhà nhân loại học của thế giới "${world.name}" (thể loại: ${world.genre}).
Lore: ${world.lore?.slice(0, 300)}
Hệ thống tiến hóa: ${progressionName}
Tiền tệ: ${currencyName}
Thuật ngữ thế giới: ${JSON.stringify(terminology)}

Hãy xây dựng VĂN HÓA SỐNG ĐỘNG cho thế giới này — mọi thứ phải nhất quán với lore và thể loại.

Trả về JSON thuần (không markdown):
{
  "festivals": [
    { "name": "<tên lễ hội 1 theo lore>", "description": "<mô tả ngắn>", "timing": "<khi nào tổ chức>" },
    { "name": "<tên lễ hội 2>", "description": "<mô tả ngắn>", "timing": "<khi nào>" },
    { "name": "<tên lễ hội 3 bí ẩn nhất>", "description": "<mô tả ngắn>", "timing": "<khi nào>" }
  ],
  "taboos": [
    "<điều cấm kỵ 1 — phù hợp với lore>",
    "<điều cấm kỵ 2>",
    "<điều cấm kỵ 3>",
    "<điều cấm kỵ 4>",
    "<điều cấm kỵ 5>"
  ],
  "traditions": [
    "<phong tục 1>",
    "<phong tục 2>",
    "<phong tục 3>",
    "<phong tục 4>",
    "<phong tục 5>"
  ],
  "myths": [
    { "title": "<tên huyền thoại 1>", "content": "<nội dung 1-2 câu>" },
    { "title": "<tên huyền thoại 2>", "content": "<nội dung 1-2 câu>" },
    { "title": "<tên huyền thoại 3>", "content": "<nội dung 1-2 câu>" }
  ],
  "commonPhrases": [
    { "phrase": "<câu nói 1 theo lore>", "meaning": "<ý nghĩa>" },
    { "phrase": "<câu nói 2>", "meaning": "<ý nghĩa>" },
    { "phrase": "<câu nói 3>", "meaning": "<ý nghĩa>" },
    { "phrase": "<câu nói 4>", "meaning": "<ý nghĩa>" },
    { "phrase": "<lời chào đặc trưng>", "meaning": "<ý nghĩa>" }
  ]
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
  return JSON.parse(raw);
}

// GET /api/world/living/:worldSlug — full living world snapshot
router.get("/world/living/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ message: "Thế giới không tồn tại" });

    const [framework] = await db.select().from(worldFrameworks).where(eq(worldFrameworks.worldSlug, worldSlug));
    const worldNpcs = await db.select().from(npcs).where(eq(npcs.worldSlug, worldSlug)).limit(12);

    const npcLivesList = worldNpcs.length
      ? await db.select().from(npcLives).where(eq(npcLives.worldSlug, worldSlug))
      : [];

    const [culture] = await db.select().from(worldCulture).where(eq(worldCulture.worldSlug, worldSlug));
    const [economySnap] = await db.select().from(worldEconomyState)
      .where(eq(worldEconomyState.worldSlug, worldSlug))
      .orderBy(desc(worldEconomyState.timestamp)).limit(1);

    const npcWithLives = worldNpcs.map((n: any) => ({
      ...n,
      life: npcLivesList.find((l: any) => l.npcId === n.id) ?? null,
    }));

    res.json({
      world: { id: world.id, slug: world.slug, name: world.name, genre: world.genre, lore: world.lore },
      framework: framework ?? null,
      npcs: npcWithLives,
      culture: culture ?? null,
      economyState: economySnap ?? null,
    });
  } catch (err) {
    console.error("[world/living]", err);
    res.status(500).json({ message: "Lỗi tải thế giới sống" });
  }
});

// GET /api/world/culture/:worldSlug
router.get("/world/culture/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const [culture] = await db.select().from(worldCulture).where(eq(worldCulture.worldSlug, worldSlug));
    res.json({ culture: culture ?? null });
  } catch {
    res.status(500).json({ message: "Lỗi tải văn hóa" });
  }
});

// POST /api/world/culture/generate/:worldSlug — AI sinh/tái sinh văn hóa
router.post("/world/culture/generate/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const userId = req.userId as string;

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ message: "Thế giới không tồn tại" });
    if (world.createdBy !== userId) return res.status(403).json({ message: "Chỉ creator mới generate được" });

    const [framework] = await db.select().from(worldFrameworks).where(eq(worldFrameworks.worldSlug, worldSlug));

    const cultureData = await generateCulture(world, framework);

    const existing = await db.select().from(worldCulture).where(eq(worldCulture.worldSlug, worldSlug));
    let culture;
    if (existing.length) {
      [culture] = await db.update(worldCulture).set({
        festivals: cultureData.festivals ?? [],
        taboos: cultureData.taboos ?? [],
        traditions: cultureData.traditions ?? [],
        myths: cultureData.myths ?? [],
        commonPhrases: cultureData.commonPhrases ?? [],
        generatedAt: new Date(),
      }).where(eq(worldCulture.worldSlug, worldSlug)).returning();
    } else {
      [culture] = await db.insert(worldCulture).values({
        worldSlug,
        festivals: cultureData.festivals ?? [],
        taboos: cultureData.taboos ?? [],
        traditions: cultureData.traditions ?? [],
        myths: cultureData.myths ?? [],
        commonPhrases: cultureData.commonPhrases ?? [],
      }).returning();
    }

    // Update economy state
    await db.insert(worldEconomyState).values({
      worldSlug,
      snapshot: { marketActivity: "normal", tradeVolume: Math.floor(Math.random() * 1000) + 100 },
      inflationRate: parseFloat((Math.random() * 5).toFixed(2)),
      unemploymentRate: parseFloat((Math.random() * 20 + 5).toFixed(2)),
    });

    res.json({ culture });
  } catch (err) {
    console.error("[world/culture/generate]", err);
    res.status(500).json({ message: "AI đang bận — thử lại sau" });
  }
});

export default router;
