import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldPassports, worldEntryLog, characters, customWorlds, npcs, worldEvents } from "@workspace/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// GET /api/passport/worlds — danh sách custom worlds public để xin nhập cảnh
router.get("/api/passport/worlds", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const worlds = await db.select().from(customWorlds)
      .where(eq(customWorlds.isPublic, true))
      .orderBy(desc(customWorlds.createdAt))
      .limit(50);
    // Lọc bỏ thế giới của chính user
    const others = worlds.filter(w => w.createdBy !== userId);
    res.json(others);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải danh sách thế giới" });
  }
});

// GET /api/passport/my — hộ chiếu của user (tất cả nhân vật)
router.get("/api/passport/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const myChars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!myChars.length) return res.json([]);

    const charIds = myChars.map(c => c.id);
    const passports: typeof worldPassports.$inferSelect[] = [];
    for (const cid of charIds) {
      const rows = await db.select().from(worldPassports)
        .where(eq(worldPassports.characterId, cid))
        .orderBy(desc(worldPassports.createdAt));
      passports.push(...rows);
    }

    // Enrich với world info + char info
    const enriched = await Promise.all(passports.map(async p => {
      const [world] = await db.select({ name: customWorlds.name, genre: customWorlds.genre, slug: customWorlds.slug, createdBy: customWorlds.createdBy })
        .from(customWorlds).where(eq(customWorlds.slug, p.worldSlug));
      const char = myChars.find(c => c.id === p.characterId);
      return { passport: p, world, char };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải hộ chiếu" });
  }
});

// GET /api/passport/visitors/:worldSlug — creator xem khách trong thế giới của mình
router.get("/api/passport/visitors/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, worldSlug), eq(customWorlds.createdBy, userId)));
    if (!world) return res.status(403).json({ error: "Bạn không phải creator của thế giới này" });

    const passports = await db.select({
      passport: worldPassports,
      char: { id: characters.id, name: characters.name, level: characters.level, userId: characters.userId },
    }).from(worldPassports)
      .innerJoin(characters, eq(worldPassports.characterId, characters.id))
      .where(eq(worldPassports.worldSlug, worldSlug))
      .orderBy(desc(worldPassports.createdAt));

    res.json({ world, passports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải danh sách khách" });
  }
});

// POST /api/passport/request/:worldSlug — xin nhập cảnh
router.post("/api/passport/request/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { characterId, note } = req.body;
    if (!characterId) return res.status(400).json({ error: "Thiếu characterId" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ error: "Thế giới không tồn tại" });
    if (world.createdBy === userId) return res.status(400).json({ error: "Bạn không cần hộ chiếu vào thế giới của mình" });

    // Kiểm tra đã xin chưa
    const [existing] = await db.select().from(worldPassports)
      .where(and(eq(worldPassports.characterId, characterId), eq(worldPassports.worldSlug, worldSlug)));
    if (existing) return res.status(400).json({
      error: existing.status === "banned"
        ? "Nhân vật của bạn đã bị cấm khỏi thế giới này"
        : `Bạn đã có hộ chiếu (trạng thái: ${existing.status})`,
    });

    const [passport] = await db.insert(worldPassports).values({
      characterId,
      worldSlug,
      requestNote: (note ?? "").slice(0, 200),
    }).returning();

    res.json({ passport, message: `Đã gửi đơn xin nhập cảnh vào "${world.name}"` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi xin nhập cảnh" });
  }
});

// POST /api/passport/approve/:passportId — creator approve
router.post("/api/passport/approve/:passportId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { passportId } = req.params;
    const { note } = req.body;

    const [passport] = await db.select().from(worldPassports).where(eq(worldPassports.id, passportId));
    if (!passport) return res.status(404).json({ error: "Hộ chiếu không tồn tại" });

    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, passport.worldSlug), eq(customWorlds.createdBy, userId)));
    if (!world) return res.status(403).json({ error: "Không có quyền" });

    await db.update(worldPassports).set({
      status: "approved",
      approvedAt: new Date(),
      creatorNote: (note ?? "Chào mừng đến với thế giới của ta!").slice(0, 200),
    }).where(eq(worldPassports.id, passportId));

    res.json({ success: true, message: "Đã phê duyệt hộ chiếu" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi phê duyệt" });
  }
});

// POST /api/passport/ban/:passportId — creator ban/kick
router.post("/api/passport/ban/:passportId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { passportId } = req.params;
    const { reason } = req.body;

    const [passport] = await db.select().from(worldPassports).where(eq(worldPassports.id, passportId));
    if (!passport) return res.status(404).json({ error: "Hộ chiếu không tồn tại" });

    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, passport.worldSlug), eq(customWorlds.createdBy, userId)));
    if (!world) return res.status(403).json({ error: "Không có quyền" });

    await db.update(worldPassports).set({
      status: "banned",
      bannedAt: new Date(),
      creatorNote: (reason ?? "Bị trục xuất bởi Thần Chủ.").slice(0, 200),
    }).where(eq(worldPassports.id, passportId));

    res.json({ success: true, message: "Đã ban/kick khách khỏi thế giới" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi ban/kick" });
  }
});

// GET /api/passport/visit/:worldSlug — xem thế giới qua "mắt khách" (readonly + AI narrate)
router.get("/api/passport/visit/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { characterId } = req.query as { characterId?: string };

    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, worldSlug), eq(customWorlds.isPublic, true)));
    if (!world) return res.status(404).json({ error: "Thế giới không tồn tại" });

    // Kiểm tra passport
    let hasAccess = world.createdBy === userId;
    if (!hasAccess && characterId) {
      const [passport] = await db.select().from(worldPassports)
        .where(and(eq(worldPassports.characterId, characterId), eq(worldPassports.worldSlug, worldSlug)));
      hasAccess = passport?.status === "approved";
      if (passport?.status === "banned") return res.status(403).json({ error: "Bạn đã bị cấm khỏi thế giới này" });
    }
    if (!hasAccess) return res.status(403).json({ error: "Cần hộ chiếu được phê duyệt để vào thế giới này" });

    // Ghi entry log
    if (characterId) {
      await db.insert(worldEntryLog).values({ characterId, worldSlug }).onConflictDoNothing();
      await db.update(worldPassports).set({
        entryCount: db.select({ count: worldPassports.entryCount }).from(worldPassports)
          .where(and(eq(worldPassports.characterId, characterId), eq(worldPassports.worldSlug, worldSlug))) as any,
      });
    }

    const worldNpcs = await db.select().from(npcs)
      .where(and(eq(npcs.worldSlug, worldSlug), eq(npcs.active, true))).limit(10);
    const events = await db.select().from(worldEvents)
      .where(eq(worldEvents.worldSlug, worldSlug))
      .orderBy(desc(worldEvents.createdAt)).limit(5);

    // AI sinh lời chào của thế giới
    let welcomeNarrative = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const prompt = `Một khách du hành vừa bước vào thế giới "${world.name}" (${world.genre}).
Lore: ${world.lore?.slice(0, 200)}
Hãy viết lời chào mừng ngắn gọn theo góc nhìn người quan sát (2 câu, phong cách của thế giới, bí ẩn, hấp dẫn). Tiếng Việt.`;
      const result = await model.generateContent(prompt);
      welcomeNarrative = result.response.text().trim();
    } catch (_) {}

    res.json({ world, npcs: worldNpcs, events, welcomeNarrative, isReadOnly: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi truy cập thế giới" });
  }
});

export default router;
