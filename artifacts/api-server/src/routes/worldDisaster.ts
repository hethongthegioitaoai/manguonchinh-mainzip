import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldDisasters, disasterPrayers, characters } from "@workspace/db/schema";
import { eq, and, or, sql, desc, lt } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

/* ─── Định nghĩa event templates ─── */
const DISASTER_TEMPLATES = [
  { name: "Thiên Thạch Hỏa Vũ", type: "disaster", severity: "catastrophic", desc: "Trận mưa thiên thạch từ trên trời đổ xuống, thiêu đốt đất đai", effect: { expMult: 0.5, resourceMult: 0.2 }, durationH: 12 },
  { name: "Đại Ôn Dịch", type: "disaster", severity: "major", desc: "Dịch bệnh bí ẩn lan khắp thế giới, sức lực người tu hành suy giảm", effect: { expMult: 0.7, resourceMult: 0.5 }, durationH: 24 },
  { name: "Hạn Hán Thiên Niên", type: "disaster", severity: "major", desc: "Bầu trời khô hạn, nguồn tài nguyên cạn kiệt nhanh chóng", effect: { expMult: 0.8, resourceMult: 0.3 }, durationH: 18 },
  { name: "Ma Sương Độc", type: "disaster", severity: "minor", desc: "Làn sương mù độc phủ khắp nơi, linh khí tản mát", effect: { expMult: 0.8, resourceMult: 0.7 }, durationH: 8 },
  { name: "Thiên Địa Đại Chấn", type: "disaster", severity: "catastrophic", desc: "Đại địa chấn xé toạc mặt đất, cả thế giới rung chuyển", effect: { expMult: 0.4, resourceMult: 0.1 }, durationH: 6 },
  { name: "Hắc Ám Xâm Thực", type: "disaster", severity: "major", desc: "Bóng tối từ cõi âm lan rộng, ma vật tràn về dương gian", effect: { expMult: 0.6, resourceMult: 0.4, enemyBuff: 2.0 }, durationH: 16 },
  { name: "Thiên Thủy Chi Nguyên", type: "disaster", severity: "minor", desc: "Nguồn nước linh thiêng cạn kiệt, các cao thủ mất phương hướng", effect: { expMult: 0.9, resourceMult: 0.8 }, durationH: 6 },
];

const BLESSING_TEMPLATES = [
  { name: "Linh Khí Triều", type: "blessing", severity: "major", desc: "Làn sóng linh khí dồi dào từ trời cao tràn xuống, người tu hành thăng tiến nhanh chóng", effect: { expMult: 2.0, resourceMult: 1.5 }, durationH: 6 },
  { name: "Mưa Bảo Vật", type: "blessing", severity: "major", desc: "Kho báu từ cõi tiên rơi xuống, đất đai tràn ngập vật phẩm quý hiếm", effect: { expMult: 1.3, resourceMult: 3.0, bonusDrop: true }, durationH: 4 },
  { name: "Cảm Ngộ Đại Đạo", type: "blessing", severity: "catastrophic", desc: "Thiên Đạo hiển linh, toàn bộ người tu hành trên thế giới đột phá cùng lúc", effect: { expMult: 5.0, resourceMult: 1.0 }, durationH: 2 },
  { name: "Thần Vật Giáng Thế", type: "blessing", severity: "minor", desc: "Linh thú thần thánh xuất hiện, ban phúc cho dân chúng", effect: { expMult: 1.5, resourceMult: 2.0 }, durationH: 8 },
  { name: "Tiên Nhân Hạ Phàm", type: "blessing", severity: "major", desc: "Tiên nhân từ cõi Bồng Lai hạ trần, ban phát thiên cơ cho người hữu duyên", effect: { expMult: 2.5, resourceMult: 1.5 }, durationH: 4 },
];

const ALL_TEMPLATES = [...DISASTER_TEMPLATES, ...BLESSING_TEMPLATES];

/* ─── Auto-expire disasters ─── */
async function settleExpiredDisasters() {
  const expired = await db.select().from(worldDisasters)
    .where(and(eq(worldDisasters.status, "active"), lt(worldDisasters.endsAt, new Date())));
  for (const d of expired) {
    await db.update(worldDisasters).set({ status: "ended", resolvedBy: "expired" }).where(eq(worldDisasters.id, d.id));
  }
}

/* ─────────────────────────────────────────────────────
   GET /api/disasters/:worldSlug — events đang active
───────────────────────────────────────────────────── */
router.get("/api/disasters/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    await settleExpiredDisasters();
    const { worldSlug } = req.params;
    const events = await db.select().from(worldDisasters)
      .where(and(eq(worldDisasters.worldSlug, worldSlug), eq(worldDisasters.status, "active")))
      .orderBy(desc(worldDisasters.startedAt));
    res.json(events);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/disasters/all/active — tất cả events active toàn server
───────────────────────────────────────────────────── */
router.get("/api/disasters/all/active", isAuthenticated, async (_req, res) => {
  try {
    await settleExpiredDisasters();
    const events = await db.select().from(worldDisasters)
      .where(eq(worldDisasters.status, "active"))
      .orderBy(desc(worldDisasters.startedAt));
    res.json(events);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/disasters/history/:worldSlug — lịch sử
───────────────────────────────────────────────────── */
router.get("/api/disasters/history/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const events = await db.select().from(worldDisasters)
      .where(eq(worldDisasters.worldSlug, worldSlug))
      .orderBy(desc(worldDisasters.startedAt)).limit(20);
    res.json(events);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/disasters/trigger/:worldSlug — trigger event (AI random hoặc manual)
───────────────────────────────────────────────────── */
router.post("/api/disasters/trigger/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { templateId, forceType } = z.object({
      templateId: z.string().optional(),
      forceType:  z.enum(["disaster", "blessing"]).optional(),
    }).parse(req.body);

    // Chọn template
    let template: typeof ALL_TEMPLATES[0];
    if (templateId) {
      const found = ALL_TEMPLATES.find(t => t.name === templateId);
      template = found ?? ALL_TEMPLATES[Math.floor(Math.random() * ALL_TEMPLATES.length)];
    } else {
      const pool = forceType ? ALL_TEMPLATES.filter(t => t.type === forceType) :
        (Math.random() < 0.3 ? BLESSING_TEMPLATES : DISASTER_TEMPLATES);
      template = pool[Math.floor(Math.random() * pool.length)];
    }

    const endsAt = new Date(Date.now() + template.durationH * 3600 * 1000);

    // Lấy tên thế giới
    const worldResult = await db.execute(sql`SELECT name FROM custom_worlds WHERE slug = ${worldSlug} LIMIT 1`);
    const worldName = (worldResult.rows[0] as any)?.name ?? worldSlug;

    const narrative = await geminiText(
      `Bạn là người dẫn chuyện thế giới "${worldName}". Sự kiện "${template.name}" vừa xảy ra: ${template.desc}.
      Viết 2-3 câu mô tả kịch tính, huyền bí về sự kiện này theo phong cách lore thế giới. Chỉ trả về đoạn văn.`
    );

    const [event] = await db.insert(worldDisasters).values({
      worldSlug, eventType: template.type,
      eventName: template.name,
      severity: template.severity,
      description: template.desc,
      aiNarrative: narrative || template.desc,
      effect: template.effect,
      endsAt,
    }).returning();

    res.status(201).json({ event });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/disasters/:disasterId/pray — cầu nguyện
───────────────────────────────────────────────────── */
router.post("/api/disasters/:disasterId/pray", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { disasterId } = req.params;
    const { characterId, prayerText } = z.object({
      characterId: z.string().uuid(),
      prayerText:  z.string().default(""),
    }).parse(req.body);

    const [disaster] = await db.select().from(worldDisasters).where(eq(worldDisasters.id, disasterId));
    if (!disaster || disaster.status !== "active") return res.status(400).json({ message: "Sự kiện không còn active" });
    if (disaster.eventType !== "disaster") return res.status(400).json({ message: "Chỉ cầu nguyện khi có thiên tai" });

    // Kiểm tra đã cầu nguyện chưa
    const existing = await db.select().from(disasterPrayers)
      .where(and(eq(disasterPrayers.disasterId, disasterId), eq(disasterPrayers.characterId, characterId)));
    if (existing.length) return res.status(400).json({ message: "Nhân vật đã cầu nguyện rồi" });

    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    // Sức mạnh cầu nguyện dựa vào level
    const prayerPower = (char.level ?? 1) * 10;

    await db.insert(disasterPrayers).values({
      disasterId, characterId, characterName: char.name,
      prayerText: prayerText || "Kính mời Thiên Đạo hiển linh, tiêu trừ tai họa!",
      prayerPower,
    });

    // Cộng dồn
    const newTotal = disaster.prayerPower + prayerPower;
    const newCount = disaster.prayerCount + 1;

    let resolved = false;
    let newSeverity = disaster.severity;

    // threshold theo severity
    const threshold = disaster.severity === "catastrophic" ? 2000 :
      disaster.severity === "major" ? 1000 : 500;

    if (newTotal >= threshold) {
      // Giảm severity hoặc kết thúc
      if (disaster.severity === "minor") {
        // kết thúc sớm
        await db.update(worldDisasters)
          .set({ status: "ended", resolvedBy: "prayer", prayerCount: newCount, prayerPower: newTotal })
          .where(eq(worldDisasters.id, disasterId));
        resolved = true;
      } else {
        newSeverity = disaster.severity === "catastrophic" ? "major" : "minor";
        // Reset prayer counter sau khi giảm cấp
        await db.update(worldDisasters)
          .set({ severity: newSeverity, prayerCount: 0, prayerPower: 0 })
          .where(eq(worldDisasters.id, disasterId));
      }
    } else {
      await db.update(worldDisasters)
        .set({ prayerCount: newCount, prayerPower: newTotal })
        .where(eq(worldDisasters.id, disasterId));
    }

    res.json({
      contributed: true,
      prayerPower,
      totalPower: newTotal,
      threshold,
      resolved,
      severityDowngrade: newSeverity !== disaster.severity,
      message: resolved ? "🙏 Thiên tai đã bị đẩy lùi bởi sức mạnh tập thể!" :
        newSeverity !== disaster.severity ? `⬇️ Thiên tai giảm xuống mức ${newSeverity}!` :
        `🙏 Đã cầu nguyện. Tổng: ${newTotal}/${threshold}`
    });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/disasters/effect/:worldSlug — hiệu ứng hiện tại của thế giới
───────────────────────────────────────────────────── */
router.get("/api/disasters/effect/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const active = await db.select().from(worldDisasters)
      .where(and(eq(worldDisasters.worldSlug, worldSlug), eq(worldDisasters.status, "active")));

    // Tổng hợp hiệu ứng
    let expMult = 1.0;
    let resourceMult = 1.0;
    let enemyBuff = 1.0;
    let bonusDrop = false;

    for (const e of active) {
      const effect = e.effect as any;
      if (effect.expMult) expMult *= effect.expMult;
      if (effect.resourceMult) resourceMult *= effect.resourceMult;
      if (effect.enemyBuff) enemyBuff *= effect.enemyBuff;
      if (effect.bonusDrop) bonusDrop = true;
    }

    res.json({ worldSlug, expMult, resourceMult, enemyBuff, bonusDrop, activeCount: active.length });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
