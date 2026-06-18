import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldEvents, worldState, worldResources, characters, users } from "@workspace/db/schema";
import { eq, desc, and, lte, gte } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const router = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const WORLD_CONTEXT: Record<string, string> = {
  cultivation: "Tu Tiên — kiếm tiên, linh khí, tông môn, thiên kiếp, ma đạo. Sự kiện mang tính epic và ảnh hưởng toàn cõi.",
  cyberpunk:   "Cyberpunk — megacorp, hacker, thành phố neon, AI nổi loạn, underground resistance. Sự kiện cyber-thriller.",
  zombie:      "Vùng Hoang Phế — hậu tận thế, mutant, radiation, bộ lạc sinh tồn. Sự kiện horror-survival.",
};

const EVENT_TYPES = ["calamity", "boss_spawn", "dungeon_open", "festival", "war", "treasure", "plague"] as const;
type EventType = typeof EVENT_TYPES[number];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  calamity:    "Thiên Tai",
  boss_spawn:  "Đại Ma Xuất Hiện",
  dungeon_open:"Bí Cảnh Khai Mở",
  festival:    "Lễ Hội",
  war:         "Đại Chiến",
  treasure:    "Kho Báu",
  plague:      "Dịch Bệnh",
};

const EVENT_KARMA: Record<EventType, number> = {
  calamity: -15, boss_spawn: -10, dungeon_open: 5,
  festival: 10, war: -20, treasure: 5, plague: -12,
};

async function getKarma(worldSlug: string): Promise<number> {
  const [row] = await db.select().from(worldState)
    .where(and(eq(worldState.worldSlug, worldSlug), eq(worldState.key, "karma")));
  return typeof (row?.value as any)?.score === "number" ? (row.value as any).score : 0;
}

async function setKarma(worldSlug: string, newKarma: number) {
  const clamped = Math.max(-100, Math.min(100, newKarma));
  const [existing] = await db.select().from(worldState)
    .where(and(eq(worldState.worldSlug, worldSlug), eq(worldState.key, "karma")));
  if (existing) {
    await db.update(worldState).set({ value: { score: clamped }, updatedAt: new Date() })
      .where(eq(worldState.id, existing.id));
  } else {
    await db.insert(worldState).values({ worldSlug, key: "karma", value: { score: clamped } });
  }
  return clamped;
}

async function buildWorldContext(worldSlug: string): Promise<string> {
  const [resourceRows, stateRows] = await Promise.all([
    db.select().from(worldResources).where(eq(worldResources.worldSlug, worldSlug)),
    db.select().from(worldState).where(eq(worldState.worldSlug, worldSlug)),
  ]);
  const karma = await getKarma(worldSlug);
  const resCtx = resourceRows.map(r => `${r.resourceType}: ${Math.round(r.quantity/r.maxQuantity*100)}%`).join(", ");
  const bossCtx = stateRows
    .filter(s => (s.value as any)?.type === "boss")
    .map(s => {
      const v = s.value as any;
      const alive = v.alive || (v.respawnAt && Date.now() >= new Date(v.respawnAt).getTime());
      return `${v.name}: ${alive ? "còn sống" : "đã chết"}`;
    }).join(" | ");
  return `Karma thế giới: ${karma} | Tài nguyên: ${resCtx || "không rõ"} | Boss: ${bossCtx || "không rõ"}`;
}

async function generateEventWithAI(worldSlug: string): Promise<{ type: EventType; title: string; description: string; karmaEffect: number }> {
  const worldCtx = WORLD_CONTEXT[worldSlug] ?? WORLD_CONTEXT.cultivation;
  const stateCtx = await buildWorldContext(worldSlug);
  const karma = await getKarma(worldSlug);
  const favoredTypes = karma < -30 ? ["calamity", "boss_spawn", "war", "plague"] : karma > 30 ? ["festival", "dungeon_open", "treasure"] : EVENT_TYPES;
  const typeHint = favoredTypes.join(", ");

  const prompt = `Bạn là AI Game Master của thế giới: ${worldCtx}
Trạng thái hiện tại: ${stateCtx}
Karma hiện tại: ${karma} (âm = tối tăm, dương = tươi sáng)

Sinh 1 SỰ KIỆN thế giới có tác động lớn. Ưu tiên loại: ${typeHint}

Trả về JSON (không markdown, không giải thích):
{
  "type": "<một trong: ${EVENT_TYPES.join("|")}>",
  "title": "<tên sự kiện ngắn gọn, ấn tượng, tối đa 12 từ>",
  "description": "<mô tả 2-3 câu, giọng văn epic, bí ẩn, phù hợp thế giới>${worldSlug === "cultivation" ? " Dùng văn phong cổ phong." : worldSlug === "cyberpunk" ? " Dùng thuật ngữ kỹ thuật." : " Dùng ngôn ngữ sống sót."}",
  "karmaEffect": <số nguyên từ -30 đến +30>
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(text);
    const type = EVENT_TYPES.includes(parsed.type) ? parsed.type as EventType : "calamity";
    return {
      type,
      title: String(parsed.title ?? "Sự Kiện Bí Ẩn").slice(0, 128),
      description: String(parsed.description ?? "Một sự kiện bí ẩn đang xảy ra..."),
      karmaEffect: typeof parsed.karmaEffect === "number" ? Math.max(-30, Math.min(30, parsed.karmaEffect)) : EVENT_KARMA[type],
    };
  } catch {
    const fallbackType: EventType = karma < 0 ? "calamity" : "festival";
    return {
      type: fallbackType,
      title: fallbackType === "calamity" ? "Thiên Kiếp Giáng Xuống" : "Đại Lễ Hội Khai Mạc",
      description: fallbackType === "calamity"
        ? "Bầu trời nứt toác, linh khí điên cuồng. Thiên kiếp không phân biệt chính tà — mọi tu sĩ đều run sợ."
        : "Cả cõi rực sáng. Linh khí tụ hội — đây là thời khắc hiếm có để đột phá cảnh giới.",
      karmaEffect: EVENT_KARMA[fallbackType],
    };
  }
}

async function isAdmin(userId: string): Promise<boolean> {
  const [first] = await db.select({ id: users.id }).from(users).orderBy(users.createdAt).limit(1);
  return first?.id === userId;
}

router.get("/world-events/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const now = new Date();
    const events = await db.select().from(worldEvents)
      .where(and(eq(worldEvents.worldSlug, worldSlug), eq(worldEvents.active, true)))
      .orderBy(desc(worldEvents.createdAt))
      .limit(10);
    const karma = await getKarma(worldSlug);
    res.json({ events, karma });
  } catch {
    res.status(500).json({ message: "Failed to fetch world events" });
  }
});

router.post("/world-events/:worldSlug/generate", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const eventData = await generateEventWithAI(worldSlug);
    const durationHours = eventData.type === "war" ? 48 : eventData.type === "festival" ? 24 : eventData.type === "calamity" ? 6 : 12;
    const endAt = new Date(Date.now() + durationHours * 3_600_000);

    await db.update(worldEvents)
      .set({ active: false })
      .where(and(eq(worldEvents.worldSlug, worldSlug), eq(worldEvents.active, true)));

    const [event] = await db.insert(worldEvents).values({
      worldSlug, ...eventData, endAt, triggeredBy: "ai",
    }).returning();

    const currentKarma = await getKarma(worldSlug);
    const newKarma = await setKarma(worldSlug, currentKarma + eventData.karmaEffect);

    res.json({ event, karma: newKarma });
  } catch {
    res.status(500).json({ message: "Failed to generate event" });
  }
});

const triggerSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().min(1).max(128),
  description: z.string().min(1),
  durationHours: z.number().int().min(1).max(168).default(12),
  karmaEffect: z.number().int().min(-50).max(50).default(0),
});

router.post("/admin/event/trigger", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    if (!(await isAdmin(userId))) return res.status(403).json({ message: "Chỉ admin mới có quyền này" });

    const parsed = triggerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid event data" });
    const { type, title, description, durationHours, karmaEffect } = parsed.data;
    const worldSlug = req.body.worldSlug as string;
    if (!worldSlug) return res.status(400).json({ message: "worldSlug required" });

    const endAt = new Date(Date.now() + durationHours * 3_600_000);
    const [event] = await db.insert(worldEvents).values({
      worldSlug, type, title, description, endAt, karmaEffect, triggeredBy: "admin",
    }).returning();

    const currentKarma = await getKarma(worldSlug);
    const newKarma = await setKarma(worldSlug, currentKarma + karmaEffect);
    res.json({ event, karma: newKarma });
  } catch {
    res.status(500).json({ message: "Failed to trigger event" });
  }
});

router.get("/admin/stats", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    if (!(await isAdmin(userId))) return res.status(403).json({ message: "Chỉ admin mới có quyền này" });

    const allChars = await db.select({
      id: characters.id, worldId: characters.worldId, level: characters.level,
      stats: characters.stats,
    }).from(characters);

    const worldPop: Record<string, number> = {};
    const worldAvgLevel: Record<string, number[]> = {};
    for (const c of allChars) {
      const slug = (c.stats as any)?.world_slug ?? "unknown";
      worldPop[slug] = (worldPop[slug] ?? 0) + 1;
      if (!worldAvgLevel[slug]) worldAvgLevel[slug] = [];
      worldAvgLevel[slug].push(c.level);
    }

    const worldStats = Object.entries(worldPop).map(([slug, pop]) => ({
      worldSlug: slug,
      population: pop,
      avgLevel: worldAvgLevel[slug]
        ? Math.round(worldAvgLevel[slug].reduce((a, b) => a + b, 0) / worldAvgLevel[slug].length)
        : 1,
    }));

    const activeEvents = await db.select().from(worldEvents)
      .where(eq(worldEvents.active, true))
      .orderBy(desc(worldEvents.createdAt));

    const karmas: Record<string, number> = {};
    for (const slug of Object.keys(worldPop)) {
      karmas[slug] = await getKarma(slug);
    }

    res.json({ worldStats, activeEvents, karmas, totalPlayers: allChars.length });
  } catch {
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

router.post("/world-events/:id/deactivate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    if (!(await isAdmin(userId))) return res.status(403).json({ message: "Chỉ admin mới có quyền này" });
    const { id } = req.params;
    await db.update(worldEvents).set({ active: false }).where(eq(worldEvents.id, id));
    res.json({ message: "Event deactivated" });
  } catch {
    res.status(500).json({ message: "Failed to deactivate event" });
  }
});

export default router;
export { getKarma, EVENT_TYPE_LABELS };
