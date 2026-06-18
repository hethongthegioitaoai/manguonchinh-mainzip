import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldRelations, diplomacyEvents, worldEmbassies, characters } from "@workspace/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return "";
  }
}

/* ─── Helper: lấy hoặc tạo quan hệ giữa 2 thế giới ─── */
async function getOrCreateRelation(slugA: string, slugB: string) {
  const [a, b] = [slugA, slugB].sort();
  const [existing] = await db.select().from(worldRelations)
    .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));
  if (existing) return existing;
  const [created] = await db.insert(worldRelations).values({
    worldSlugA: a, worldSlugB: b, status: "neutral", treatiesDetails: {},
  }).returning();
  return created;
}

/* ─── Helper: lấy world name từ custom_worlds hoặc builtin ─── */
async function getWorldName(slug: string): Promise<string> {
  const builtins: Record<string, string> = {
    "tu-tien": "Thiên Ngoại Cổ Giới", cyberpunk: "Neo Thành Phố 2077", wasteland: "Vùng Hoang Phế"
  };
  if (builtins[slug]) return builtins[slug];
  const result = await db.execute(sql`SELECT name FROM custom_worlds WHERE slug = ${slug} LIMIT 1`);
  return (result.rows[0] as any)?.name ?? slug;
}

/* ─────────────────────────────────────────────────────
   GET /api/diplomacy/world/:worldSlug — quan hệ của thế giới này
───────────────────────────────────────────────────── */
router.get("/api/diplomacy/world/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const relations = await db.select().from(worldRelations).where(
      or(eq(worldRelations.worldSlugA, worldSlug), eq(worldRelations.worldSlugB, worldSlug))
    );
    const events = await db.select().from(diplomacyEvents).where(
      or(eq(diplomacyEvents.fromWorldSlug, worldSlug), eq(diplomacyEvents.toWorldSlug, worldSlug))
    ).orderBy(desc(diplomacyEvents.createdAt)).limit(20);
    const embassies = await db.select().from(worldEmbassies).where(
      or(eq(worldEmbassies.homeWorldSlug, worldSlug), eq(worldEmbassies.hostWorldSlug, worldSlug))
    );
    res.json({ relations, events, embassies });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/diplomacy/map — bản đồ quan hệ toàn bộ (nodes + edges)
───────────────────────────────────────────────────── */
router.get("/api/diplomacy/map", isAuthenticated, async (_req, res) => {
  try {
    const allRelations = await db.select().from(worldRelations);
    const builtinWorlds = [
      { slug: "tu-tien", name: "Thiên Ngoại Cổ Giới", theme: "Tu Tiên" },
      { slug: "cyberpunk", name: "Neo Thành Phố 2077", theme: "Cyberpunk" },
      { slug: "wasteland", name: "Vùng Hoang Phế", theme: "Hoang Phế" },
    ];
    const customResult = await db.execute(
      sql`SELECT slug, name, theme FROM custom_worlds WHERE is_public = true ORDER BY created_at DESC LIMIT 20`
    );
    const customWorlds = (customResult.rows as any[]).map(r => ({
      slug: r.slug, name: r.name, theme: r.theme ?? "Custom"
    }));
    const worlds = [...builtinWorlds, ...customWorlds];
    res.json({ worlds, relations: allRelations });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/diplomacy/my-worlds — thế giới user sở hữu
───────────────────────────────────────────────────── */
router.get("/api/diplomacy/my-worlds", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = await db.execute(
      sql`SELECT slug, name, theme FROM custom_worlds WHERE creator_user_id = ${userId} ORDER BY created_at DESC`
    );
    res.json(result.rows ?? []);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/diplomacy/propose — đề xuất hiệp ước
───────────────────────────────────────────────────── */
router.post("/api/diplomacy/propose", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { fromWorldSlug, toWorldSlug, treatyType, message } = z.object({
      fromWorldSlug: z.string().min(1),
      toWorldSlug:   z.string().min(1),
      treatyType:    z.enum(["trade", "alliance", "non_aggression"]),
      message:       z.string().default(""),
    }).parse(req.body);

    if (fromWorldSlug === toWorldSlug) return res.status(400).json({ message: "Không thể ký hiệp ước với chính mình" });

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${fromWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(fromWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const relation = await getOrCreateRelation(fromWorldSlug, toWorldSlug);
    if (relation.status === "enemy") {
      return res.status(400).json({ message: "Không thể đề xuất hiệp ước với thế giới thù địch. Hãy ký hòa bình trước." });
    }

    const treatyLabels: Record<string, string> = {
      trade: "Hiệp Định Thương Mại",
      alliance: "Liên Minh Phòng Thủ",
      non_aggression: "Hiệp Ước Bất Xâm Phạm",
    };

    const fromName = await getWorldName(fromWorldSlug);
    const toName = await getWorldName(toWorldSlug);

    const aiContent = await geminiText(
      `Bạn là sứ giả ngoại giao trong thế giới viễn tưởng. Thế giới "${fromName}" đang gửi đề xuất ${treatyLabels[treatyType]} tới thế giới "${toName}".
      Lời nhắn của sứ giả: "${message || 'Không có'}".
      Viết 2 câu công văn ngoại giao ngắn gọn, trang trọng, phù hợp với lore viễn tưởng/kiếm hiệp. Chỉ trả về đoạn công văn.`
    );

    const [event] = await db.insert(diplomacyEvents).values({
      fromWorldSlug,
      toWorldSlug,
      eventType: "proposal",
      content: aiContent || `${fromName} đề xuất ${treatyLabels[treatyType]} với ${toName}. ${message}`,
      proposedByUserId: userId,
    }).returning();

    res.status(201).json({ event, relation, treatyType, label: treatyLabels[treatyType] });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/diplomacy/respond/:eventId — chấp nhận / từ chối
───────────────────────────────────────────────────── */
router.post("/api/diplomacy/respond/:eventId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body);

    const [event] = await db.select().from(diplomacyEvents).where(eq(diplomacyEvents.id, eventId));
    if (!event) return res.status(404).json({ message: "Không tìm thấy đề xuất" });
    if (event.eventType !== "proposal") return res.status(400).json({ message: "Không phải đề xuất hiệp ước" });

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${event.toWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(event.toWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới nhận đề xuất" });
    }

    const [relation] = await db.select().from(worldRelations).where(
      or(
        and(eq(worldRelations.worldSlugA, event.fromWorldSlug), eq(worldRelations.worldSlugB, event.toWorldSlug)),
        and(eq(worldRelations.worldSlugA, event.toWorldSlug), eq(worldRelations.worldSlugB, event.fromWorldSlug))
      )
    );

    const responseEventType = accept ? "accept" : "reject";
    let newStatus = relation?.status ?? "neutral";

    if (accept) {
      if (event.content.includes("Liên Minh") || event.content.includes("alliance")) newStatus = "ally";
      else if (event.content.includes("Thương Mại") || event.content.includes("trade")) newStatus = "trade_partner";
      else newStatus = "trade_partner";
    }

    const fromName = await getWorldName(event.fromWorldSlug);
    const toName = await getWorldName(event.toWorldSlug);

    const [responseEvent] = await db.insert(diplomacyEvents).values({
      fromWorldSlug: event.toWorldSlug,
      toWorldSlug: event.fromWorldSlug,
      eventType: responseEventType,
      content: accept
        ? `${toName} chấp nhận đề xuất từ ${fromName}. Hiệp ước chính thức có hiệu lực.`
        : `${toName} từ chối đề xuất từ ${fromName}.`,
      proposedByUserId: userId,
    }).returning();

    if (accept && relation) {
      const [a, b] = [event.fromWorldSlug, event.toWorldSlug].sort();
      await db.update(worldRelations)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));
    }

    res.json({ responseEvent, accepted: accept, newStatus });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/diplomacy/establish-embassy — lập đại sứ quán
───────────────────────────────────────────────────── */
router.post("/api/diplomacy/establish-embassy", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { homeWorldSlug, hostWorldSlug, ambassadorCharId } = z.object({
      homeWorldSlug:    z.string().min(1),
      hostWorldSlug:    z.string().min(1),
      ambassadorCharId: z.string().uuid(),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${homeWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(homeWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, ambassadorCharId), eq(characters.userId, userId)));
    if (!char) return res.status(400).json({ message: "Không tìm thấy nhân vật" });

    const relation = await getOrCreateRelation(homeWorldSlug, hostWorldSlug);
    if (relation.status === "enemy") {
      return res.status(400).json({ message: "Không thể lập đại sứ quán ở thế giới thù địch" });
    }

    const existing = await db.select().from(worldEmbassies).where(
      and(eq(worldEmbassies.homeWorldSlug, homeWorldSlug), eq(worldEmbassies.hostWorldSlug, hostWorldSlug))
    );
    if (existing.length) {
      const [updated] = await db.update(worldEmbassies)
        .set({ ambassadorCharId: char.id, ambassadorName: char.name, status: "active" })
        .where(eq(worldEmbassies.id, existing[0].id))
        .returning();
      return res.json({ embassy: updated, isNew: false });
    }

    const [embassy] = await db.insert(worldEmbassies).values({
      homeWorldSlug,
      hostWorldSlug,
      ambassadorCharId: char.id,
      ambassadorName: char.name,
      status: "active",
    }).returning();

    const fromName = await getWorldName(homeWorldSlug);
    const toName = await getWorldName(hostWorldSlug);
    await db.insert(diplomacyEvents).values({
      fromWorldSlug: homeWorldSlug,
      toWorldSlug: hostWorldSlug,
      eventType: "embassy",
      content: `${fromName} chính thức lập đại sứ quán tại ${toName}. Đại sứ: ${char.name}.`,
      proposedByUserId: userId,
    });

    res.status(201).json({ embassy, isNew: true });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/diplomacy/sanction/:targetWorldSlug — cấm vận
───────────────────────────────────────────────────── */
router.post("/api/diplomacy/sanction/:targetWorldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { targetWorldSlug } = req.params;
    const { fromWorldSlug, reason } = z.object({
      fromWorldSlug: z.string().min(1),
      reason: z.string().default(""),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${fromWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(fromWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const [a, b] = [fromWorldSlug, targetWorldSlug].sort();
    await getOrCreateRelation(fromWorldSlug, targetWorldSlug);
    const [updated] = await db.update(worldRelations)
      .set({ status: "enemy", updatedAt: new Date() })
      .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)))
      .returning();

    const fromName = await getWorldName(fromWorldSlug);
    const toName = await getWorldName(targetWorldSlug);
    await db.insert(diplomacyEvents).values({
      fromWorldSlug,
      toWorldSlug: targetWorldSlug,
      eventType: "sanction",
      content: `${fromName} ban hành cấm vận kinh tế chống lại ${toName}. ${reason}`,
      proposedByUserId: userId,
    });

    res.json({ relation: updated, message: "Đã ban hành cấm vận" });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/diplomacy/peace/:targetWorldSlug — ký hòa ước
───────────────────────────────────────────────────── */
router.post("/api/diplomacy/peace/:targetWorldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { targetWorldSlug } = req.params;
    const { fromWorldSlug } = z.object({ fromWorldSlug: z.string().min(1) }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${fromWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(fromWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const [a, b] = [fromWorldSlug, targetWorldSlug].sort();
    await getOrCreateRelation(fromWorldSlug, targetWorldSlug);
    const [updated] = await db.update(worldRelations)
      .set({ status: "neutral", updatedAt: new Date() })
      .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)))
      .returning();

    const fromName = await getWorldName(fromWorldSlug);
    const toName = await getWorldName(targetWorldSlug);
    await db.insert(diplomacyEvents).values({
      fromWorldSlug,
      toWorldSlug: targetWorldSlug,
      eventType: "peace",
      content: `${fromName} và ${toName} ký kết hiệp ước hòa bình. Căng thẳng được xoa dịu.`,
      proposedByUserId: userId,
    });

    res.json({ relation: updated, message: "Hòa ước đã được ký kết" });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
