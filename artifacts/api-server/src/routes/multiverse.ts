import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { crossWorldEvents, characterWorldTravel, characters, customWorlds } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

const CROSS_EVENT_TYPES = ["portal", "war", "merge", "invasion", "alliance"] as const;
type CrossEventType = typeof CROSS_EVENT_TYPES[number];

const KNOWN_WORLDS = ["cultivation", "cyberpunk", "zombie"];

async function getAllWorldSlugs(): Promise<string[]> {
  const aiWorlds = await db.select({ slug: customWorlds.slug }).from(customWorlds).where(eq(customWorlds.isPublic, true)).limit(10);
  return [...KNOWN_WORLDS, ...aiWorlds.map(w => w.slug)];
}

async function generateCrossWorldEvent(worlds: string[]): Promise<{ type: CrossEventType; title: string; description: string }> {
  const worldList = worlds.slice(0, 4).join(", ");
  const prompt = `Tạo một SỰ KIỆN XUYÊN THẾ GIỚI trong game nhập vai ảnh hưởng đến các thế giới: ${worldList}.

Đây là sự kiện multiverse — các thế giới va chạm, portal mở, hoặc chiến tranh vũ trụ nổ ra.

Trả về JSON (không markdown):
{
  "type": "<một trong: portal|war|merge|invasion|alliance>",
  "title": "<tên sự kiện ấn tượng, tối đa 12 từ>",
  "description": "<mô tả 2-3 câu về sự kiện xuyên thế giới, epic và kỳ ảo>"
}`;

  try {
    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(raw);
    const type = CROSS_EVENT_TYPES.includes(parsed.type) ? parsed.type as CrossEventType : "portal";
    return {
      type,
      title: String(parsed.title ?? "Đại Chiến Vũ Trụ").slice(0, 128),
      description: String(parsed.description ?? "Các thế giới đang rung chuyển — một thế lực vô danh đang kéo chúng lại gần nhau."),
    };
  } catch {
    return {
      type: "portal",
      title: "Cổng Không Gian Xuất Hiện",
      description: "Các thế giới song song đột nhiên kết nối. Những khe nứt không gian xuất hiện khắp nơi — ai dũng cảm bước qua sẽ đặt chân vào vùng đất chưa ai biết đến.",
    };
  }
}

router.get("/multiverse/events", isAuthenticated, async (_req: any, res) => {
  try {
    const events = await db.select().from(crossWorldEvents)
      .where(eq(crossWorldEvents.active, true))
      .orderBy(desc(crossWorldEvents.createdAt))
      .limit(10);
    res.json({ events });
  } catch {
    res.status(500).json({ message: "Failed to fetch cross-world events" });
  }
});

router.post("/multiverse/events/generate", isAuthenticated, async (_req: any, res) => {
  try {
    const worlds = await getAllWorldSlugs();
    const selectedWorlds = worlds.sort(() => 0.5 - Math.random()).slice(0, 3);
    const eventData = await generateCrossWorldEvent(selectedWorlds);

    await db.update(crossWorldEvents)
      .set({ active: false })
      .where(eq(crossWorldEvents.active, true));

    const durationHours = eventData.type === "war" ? 72 : eventData.type === "merge" ? 168 : 24;
    const endAt = new Date(Date.now() + durationHours * 3_600_000);

    const [event] = await db.insert(crossWorldEvents).values({
      ...eventData,
      affectedWorlds: selectedWorlds,
      endAt,
    }).returning();

    res.json({ event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate cross-world event" });
  }
});

router.get("/multiverse/travel/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const history = await db.select().from(characterWorldTravel)
      .where(eq(characterWorldTravel.characterId, req.params.characterId))
      .orderBy(desc(characterWorldTravel.traveledAt))
      .limit(20);
    res.json({ history });
  } catch {
    res.status(500).json({ message: "Failed to fetch travel history" });
  }
});

router.post("/multiverse/travel", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, toWorld, reason } = req.body;
    if (!characterId || !toWorld) return res.status(400).json({ message: "characterId và toWorld là bắt buộc" });

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(403).json({ message: "Nhân vật không tồn tại hoặc không phải của bạn" });

    const fromWorld = (char.stats as any)?.world_slug ?? "unknown";

    const [travel] = await db.insert(characterWorldTravel).values({
      characterId, userId, fromWorld, toWorld, reason: reason ?? "Khám phá vũ trụ mới",
    }).returning();

    await db.update(characters)
      .set({ stats: { ...(char.stats as object), world_slug: toWorld } })
      .where(eq(characters.id, characterId));

    res.json({ travel, newWorldSlug: toWorld });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to travel to world" });
  }
});

router.get("/multiverse/worlds", isAuthenticated, async (_req: any, res) => {
  try {
    const aiWorlds = await db.select({
      id: customWorlds.id,
      slug: customWorlds.slug,
      name: customWorlds.name,
      genre: customWorlds.genre,
      lore: customWorlds.lore,
    }).from(customWorlds).where(eq(customWorlds.isPublic, true)).orderBy(desc(customWorlds.createdAt)).limit(20);

    const builtIn = [
      { id: "builtin-cultivation", slug: "cultivation", name: "Cõi Tu Tiên", genre: "tu_tien", lore: "Vùng đất nơi linh khí tụ tập, tu sĩ tu luyện hướng đến cảnh giới tối thượng." },
      { id: "builtin-cyberpunk", slug: "cyberpunk", name: "Neon City", genre: "cyberpunk", lore: "Megacity nơi tập đoàn kiểm soát mọi thứ và hacker là chiến binh cuối cùng." },
      { id: "builtin-zombie", slug: "zombie", name: "Vùng Hoang Phế", genre: "wasteland", lore: "Đất chết sau thế chiến — kẻ sống sót tranh đấu từng ngày trong bóng tối." },
    ];

    res.json({ worlds: [...builtIn, ...aiWorlds] });
  } catch {
    res.status(500).json({ message: "Failed to fetch worlds" });
  }
});

export default router;
