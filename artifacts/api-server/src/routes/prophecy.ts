import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { prophecies, prophecyClaims, characters, customWorlds } from "@workspace/db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// Sinh prophecy mới bằng AI
async function generateProphecy(worldSlug: string): Promise<{ content: string; hiddenCondition: string; clue: string } | null> {
  try {
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    const worldName = world?.name ?? worldSlug;
    const genre = world?.genre ?? "fantasy";
    const lore = world?.lore?.slice(0, 300) ?? "";

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const prompt = `Bạn là Oracle — nhà tiên tri huyền bí của thế giới "${worldName}" (${genre}).
Lore: ${lore}

Hãy tạo một LỜI TIÊN TRI cho thế giới này. Trả về JSON (không markdown):
{
  "content": "<lời tiên tri dạng thơ/ẩn dụ — 3-4 dòng, bí ẩn, epic, mang đậm lore. VD: 'Khi máu rồng thấm đất đỏ / Kiếm thần thức giấc ngàn năm / Ba mặt trời chiếu cùng lúc / Người được chọn sẽ thăng thiên'>",
  "hiddenCondition": "<điều kiện hoàn thành thực sự — rõ ràng, VD: 'Nhân vật đạt level 50 trong thế giới này'>",
  "clue": "<gợi ý nhỏ giúp người chơi — 1 câu mơ hồ, VD: 'Sức mạnh đến từ sự kiên trì, không phải từ vũ khí'>"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    return JSON.parse(text);
  } catch (err) {
    console.error("Prophecy generate error:", err);
    return null;
  }
}

// GET /api/prophecy/:worldSlug — xem tiên tri active + history
router.get("/prophecy/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const active = await db.select().from(prophecies)
      .where(and(eq(prophecies.worldSlug, worldSlug), eq(prophecies.isActive, true)))
      .orderBy(desc(prophecies.generatedAt))
      .limit(5);

    const fulfilled = await db.select({
      prophecy: prophecies,
      char: { id: characters.id, name: characters.name, level: characters.level },
    }).from(prophecies)
      .leftJoin(characters, eq(prophecies.fulfilledBy, characters.id))
      .where(and(eq(prophecies.worldSlug, worldSlug), eq(prophecies.isActive, false)))
      .orderBy(desc(prophecies.fulfilledAt))
      .limit(10);

    res.json({ active, fulfilled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải tiên tri" });
  }
});

// POST /api/prophecy/generate/:worldSlug — AI sinh prophecy mới (trigger thủ công)
router.post("/prophecy/generate/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;

    // Chỉ creator hoặc bất kỳ user nào với thế giới public được trigger
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ error: "Thế giới không tồn tại" });

    // Kiểm tra đã có active prophecy chưa
    const [existing] = await db.select().from(prophecies)
      .where(and(eq(prophecies.worldSlug, worldSlug), eq(prophecies.isActive, true)))
      .limit(1);

    if (existing && world.createdBy !== userId) {
      return res.status(400).json({ error: "Đã có lời tiên tri đang hoạt động. Chờ hoàn thành rồi mới có lời mới." });
    }

    const data = await generateProphecy(worldSlug as string);
    if (!data) return res.status(500).json({ error: "AI không thể tạo tiên tri lúc này" });

    const [prophecy] = await db.insert(prophecies).values({
      worldSlug,
      content: data.content,
      hiddenCondition: data.hiddenCondition,
      clue: data.clue,
      reward: { exp: 800, gold: 300, title: "Kẻ Giải Mã Tiên Tri" },
    }).returning();

    res.json({ prophecy, message: "Lời tiên tri mới đã giáng xuống thế giới" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi sinh tiên tri" });
  }
});

const claimSchema = z.object({
  characterId: z.string().uuid(),
  proof: z.string().min(10).max(500),
});

// POST /api/prophecy/claim/:prophecyId — nhân vật submit claim
router.post("/prophecy/claim/:prophecyId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { prophecyId } = req.params as Record<string, string>;
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, proof } = parsed.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [prophecy] = await db.select().from(prophecies).where(eq(prophecies.id, prophecyId));
    if (!prophecy || !prophecy.isActive) return res.status(404).json({ error: "Tiên tri không còn active" });

    // Kiểm tra đã claim chưa
    const [existing] = await db.select().from(prophecyClaims)
      .where(and(eq(prophecyClaims.prophecyId, prophecyId), eq(prophecyClaims.characterId, characterId)));
    if (existing) return res.status(400).json({ error: "Bạn đã nộp claim cho tiên tri này rồi" });

    // AI chấm điểm claim
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const scorePrompt = `Lời tiên tri: "${prophecy.content}"
Điều kiện hoàn thành thực sự: "${prophecy.hiddenCondition}"
Bằng chứng của người chơi: "${proof}"

Chấm điểm bằng chứng này trên thang 0-100.
- 80-100: Bằng chứng khớp rõ ràng với điều kiện
- 50-79: Khớp một phần
- 0-49: Không khớp hoặc mơ hồ

Chỉ trả về số nguyên từ 0 đến 100.`;

    let score = 0;
    let autoApproved = false;
    try {
      const result = await model.generateContent(scorePrompt);
      score = Math.min(100, Math.max(0, parseInt(result.response.text().trim()) || 0));
      autoApproved = score >= 80;
    } catch (_) { score = 50; }

    const [claim] = await db.insert(prophecyClaims).values({
      prophecyId,
      characterId,
      proof,
      score,
      status: autoApproved ? "approved" : "pending",
      judgedAt: autoApproved ? new Date() : null,
    }).returning();

    // Auto-approve: trao reward và mark prophecy fulfilled
    if (autoApproved) {
      const reward = prophecy.reward as any;
      const newStats = {
        ...(char.stats as any),
        exp: ((char.stats as any)?.exp ?? char.exp ?? 0) + (reward?.exp ?? 800),
        gold: ((char.stats as any)?.gold ?? 0) + (reward?.gold ?? 300),
        title: reward?.title ?? "Kẻ Giải Mã Tiên Tri",
      };
      await db.update(characters).set({
        stats: newStats,
        exp: char.exp + (reward?.exp ?? 800),
      }).where(eq(characters.id, characterId));

      await db.update(prophecies).set({
        isActive: false,
        fulfilledAt: new Date(),
        fulfilledBy: characterId,
      }).where(eq(prophecies.id, prophecyId));
    }

    res.json({
      claim,
      score,
      autoApproved,
      message: autoApproved
        ? `🎉 Tiên tri đã được giải mã! Điểm: ${score}/100. Nhận reward: +${(prophecy.reward as any)?.exp ?? 800} EXP, +${(prophecy.reward as any)?.gold ?? 300} vàng`
        : `Claim đã được ghi nhận (${score}/100). Đang chờ xét duyệt.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi submit claim" });
  }
});

// GET /api/prophecy/claims/:prophecyId — xem tất cả claims (creator only)
router.get("/prophecy/claims/:prophecyId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { prophecyId } = req.params as Record<string, string>;

    const [prophecy] = await db.select().from(prophecies).where(eq(prophecies.id, prophecyId));
    if (!prophecy) return res.status(404).json({ error: "Tiên tri không tồn tại" });

    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, prophecy.worldSlug), eq(customWorlds.createdBy, userId)));
    if (!world) return res.status(403).json({ error: "Không có quyền" });

    const claims = await db.select({
      claim: prophecyClaims,
      char: { id: characters.id, name: characters.name, level: characters.level },
    }).from(prophecyClaims)
      .innerJoin(characters, eq(prophecyClaims.characterId, characters.id))
      .where(eq(prophecyClaims.prophecyId, prophecyId))
      .orderBy(desc(prophecyClaims.score));

    res.json(claims);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải claims" });
  }
});

// POST /api/prophecy/judge/:claimId — creator approve/reject claim thủ công
router.post("/prophecy/judge/:claimId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { claimId } = req.params as Record<string, string>;
    const { approve } = req.body;

    const [claim] = await db.select().from(prophecyClaims).where(eq(prophecyClaims.id, claimId));
    if (!claim) return res.status(404).json({ error: "Claim không tồn tại" });

    const [prophecy] = await db.select().from(prophecies).where(eq(prophecies.id, claim.prophecyId));
    const [world] = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.slug, prophecy.worldSlug), eq(customWorlds.createdBy, userId)));
    if (!world) return res.status(403).json({ error: "Không có quyền" });

    await db.update(prophecyClaims).set({
      status: approve ? "approved" : "rejected",
      judgedAt: new Date(),
    }).where(eq(prophecyClaims.id, claimId));

    if (approve) {
      const [char] = await db.select().from(characters).where(eq(characters.id, claim.characterId));
      if (char) {
        const reward = prophecy.reward as any;
        await db.update(characters).set({
          stats: { ...(char.stats as any), exp: ((char.stats as any)?.exp ?? 0) + (reward?.exp ?? 800), gold: ((char.stats as any)?.gold ?? 0) + (reward?.gold ?? 300) },
          exp: char.exp + (reward?.exp ?? 800),
        }).where(eq(characters.id, claim.characterId));
      }
      await db.update(prophecies).set({ isActive: false, fulfilledAt: new Date(), fulfilledBy: claim.characterId }).where(eq(prophecies.id, claim.prophecyId));
    }

    res.json({ success: true, message: approve ? "Đã phê duyệt — reward đã trao" : "Đã từ chối claim" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi xét duyệt" });
  }
});

export default router;
