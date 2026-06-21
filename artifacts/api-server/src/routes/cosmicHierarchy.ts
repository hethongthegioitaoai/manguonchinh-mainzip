import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { cosmicEntities, cosmicEvents, cosmicRankings, starDomains, customWorlds } from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";

const COSMIC_TIER_NAMES: Record<number, string> = { 1: "THẾ GIỚI", 2: "TINH VỰC", 3: "NGÂN HÀ", 4: "THIÊN HÀ", 5: "VŨ TRỤ" };
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

async function ensureCosmicEntity(userId: string) {
  const existing = await db.select().from(cosmicEntities).where(eq(cosmicEntities.ownerUserId, userId));
  if (existing.length) return existing;

  const worlds = await db.select().from(customWorlds).where(eq(customWorlds.createdBy, userId));
  const [domain] = await db.select().from(starDomains).where(eq(starDomains.ownerUserId, userId));

  const created: any[] = [];
  for (const w of worlds) {
    const [e] = await db.insert(cosmicEntities).values({
      ownerUserId: userId,
      entityType: "world",
      entityName: w.name,
      tier: 1,
      powerScore: Math.floor(Math.random() * 500) + 100,
      population: Math.floor(Math.random() * 200),
      wealth: Math.floor(Math.random() * 5000),
    }).returning();
    created.push(e);
  }

  if (domain) {
    const [de] = await db.insert(cosmicEntities).values({
      ownerUserId: userId,
      entityType: "star_domain",
      entityName: domain.domainName,
      tier: 2,
      powerScore: created.reduce((s: number, e: any) => s + e.powerScore, 0),
      population: created.reduce((s: number, e: any) => s + e.population, 0),
      wealth: created.reduce((s: number, e: any) => s + e.wealth, 0),
    }).returning();
    created.push(de);
  }

  return created;
}

// GET /api/cosmos/map
router.get("/cosmos/map", isAuthenticated, async (_req: any, res) => {
  try {
    const entities = await db.select().from(cosmicEntities).orderBy(desc(cosmicEntities.powerScore)).limit(50);
    res.json({ entities });
  } catch {
    res.status(500).json({ message: "Lỗi tải bản đồ vũ trụ" });
  }
});

// GET /api/cosmos/my
router.get("/cosmos/my", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const entities = await ensureCosmicEntity(userId);
    const events = await db.select().from(cosmicEvents)
      .where(eq(cosmicEvents.entityId, entities[0]?.id))
      .orderBy(desc(cosmicEvents.occurredAt)).limit(10);

    res.json({ entities, events });
  } catch (err) {
    console.error("[cosmos/my]", err);
    res.status(500).json({ message: "Lỗi tải hành trình vũ trụ" });
  }
});

// POST /api/cosmos/ascend/:entityId
router.post("/cosmos/ascend/:entityId", isAuthenticated, async (req: any, res) => {
  try {
    const { entityId } = req.params;
    const userId = req.userId as string;

    const [entity] = await db.select().from(cosmicEntities).where(eq(cosmicEntities.id, entityId));
    if (!entity) return res.status(404).json({ message: "Thực thể không tồn tại" });
    if (entity.ownerUserId !== userId) return res.status(403).json({ message: "Không phải chủ nhân" });
    if (entity.tier >= 5) return res.status(400).json({ message: "Đã đạt đỉnh VŨ TRỤ — không thể thăng cấp hơn" });

    const ASCEND_REQ: Record<number, { pop: number; wealth: number; score: number }> = {
      1: { pop: 50, wealth: 1000, score: 200 },
      2: { pop: 200, wealth: 5000, score: 800 },
      3: { pop: 500, wealth: 20000, score: 2500 },
      4: { pop: 1000, wealth: 50000, score: 8000 },
    };

    const req2 = ASCEND_REQ[entity.tier];
    const lacks: string[] = [];
    if (entity.population < req2.pop) lacks.push(`Dân số cần ≥${req2.pop} (hiện ${entity.population})`);
    if (entity.wealth < req2.wealth) lacks.push(`Tài sản cần ≥${req2.wealth} (hiện ${entity.wealth})`);
    if (entity.powerScore < req2.score) lacks.push(`Điểm mạnh cần ≥${req2.score} (hiện ${entity.powerScore})`);

    if (lacks.length) {
      return res.status(400).json({ message: "Chưa đủ điều kiện thăng cấp", lacks });
    }

    const newTier = entity.tier + 1;
    const newType = ["", "world", "star_domain", "galaxy", "universe", "cosmos"][newTier];
    const tierName = COSMIC_TIER_NAMES[newTier] ?? "THIÊN ĐẾ";

    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const r = await model.generateContent(
      `Viết 3-4 câu narrative sử thi hào hùng bằng tiếng Việt về sự kiện "${entity.entityName}" thăng cấp từ ${COSMIC_TIER_NAMES[entity.tier]} lên ${tierName} trong vũ trụ tu tiên cyber. Văn phong cực kỳ hoành tráng, rung chuyển cả vũ trụ. Chỉ trả về đoạn văn.`
    );
    const narrative = r.response.text().trim();

    const [updated] = await db.update(cosmicEntities).set({
      tier: newTier,
      entityType: newType ?? entity.entityType,
      ascendedAt: new Date(),
      lastActivityAt: new Date(),
    }).where(eq(cosmicEntities.id, entityId)).returning();

    const [event] = await db.insert(cosmicEvents).values({
      entityId,
      eventType: "ascension",
      title: `${entity.entityName} Thăng Cấp ${tierName}`,
      description: `${entity.entityName} đã hoàn thành hành trình từ ${COSMIC_TIER_NAMES[entity.tier]} lên ${tierName}`,
      aiNarrative: narrative,
      participants: [{ userId, entityId, name: entity.entityName }],
      outcome: { newTier, tierName },
    }).returning();

    res.json({ entity: updated, event, narrative });
  } catch (err) {
    console.error("[cosmos/ascend]", err);
    res.status(500).json({ message: "Lỗi thăng cấp" });
  }
});

// GET /api/cosmos/rankings
router.get("/cosmos/rankings", isAuthenticated, async (_req: any, res) => {
  try {
    const entities = await db.select().from(cosmicEntities)
      .orderBy(desc(cosmicEntities.tier), desc(cosmicEntities.powerScore))
      .limit(50);

    const grouped: Record<number, any[]> = {};
    for (const e of entities) {
      if (!grouped[e.tier]) grouped[e.tier] = [];
      grouped[e.tier].push(e);
    }

    res.json({ rankings: grouped });
  } catch {
    res.status(500).json({ message: "Lỗi tải bảng xếp hạng vũ trụ" });
  }
});

// POST /api/cosmos/event/trigger
router.post("/cosmos/event/trigger", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const entities = await db.select().from(cosmicEntities).where(eq(cosmicEntities.ownerUserId, userId));
    if (!entities.length) return res.status(400).json({ message: "Không có thực thể nào" });

    const target = entities[Math.floor(Math.random() * entities.length)];
    const EVENT_TYPES = ["invasion", "alliance", "wonder", "collapse"];
    const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];

    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const r = await model.generateContent(
      `Sinh một sự kiện vũ trụ ngẫu nhiên loại "${eventType}" ảnh hưởng đến "${target.entityName}" (tier ${target.tier}: ${COSMIC_TIER_NAMES[target.tier]}).
      Trả về JSON: { "title": "...", "description": "...", "narrative": "..." }`
    );
    const raw = r.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(raw);

    const [event] = await db.insert(cosmicEvents).values({
      entityId: target.id,
      eventType: eventType!,
      title: parsed.title ?? `Sự Kiện ${eventType}`,
      description: parsed.description ?? "",
      aiNarrative: parsed.narrative ?? "",
      participants: [],
      outcome: {},
    }).returning();

    res.json({ event });
  } catch (err) {
    console.error("[cosmos/event/trigger]", err);
    res.status(500).json({ message: "Lỗi sinh sự kiện" });
  }
});

export default router;
