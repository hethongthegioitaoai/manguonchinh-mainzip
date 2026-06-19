import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { citizenships, citizenshipBenefits, characters, customWorlds } from "@workspace/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";

const router = Router();

/* ─────────────────────────────────────────────────────
   GET /api/citizenship/worlds — thế giới đang nhận công dân
───────────────────────────────────────────────────── */
router.get("/citizenship/worlds", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const worlds = await db.select().from(customWorlds)
      .where(and(eq(customWorlds.isPublic, true), ne(customWorlds.createdBy, userId)))
      .limit(20);

    const result = await Promise.all(worlds.map(async (w) => {
      const citizenCount = await db.select().from(citizenships)
        .where(and(eq(citizenships.worldSlug, w.slug), eq(citizenships.status, "approved")));
      const [benefits] = await db.select().from(citizenshipBenefits).where(eq(citizenshipBenefits.worldSlug, w.slug));
      return { ...w, citizenCount: citizenCount.length, benefits: benefits ?? null };
    }));

    res.json(result);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/citizenship/my — quốc tịch của user
───────────────────────────────────────────────────── */
router.get("/citizenship/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const list = await db.select().from(citizenships)
      .where(eq(citizenships.userId, userId))
      .orderBy(desc(citizenships.appliedAt));
    res.json(list);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/citizenship/apply/:worldSlug — nộp đơn
───────────────────────────────────────────────────── */
router.post("/citizenship/apply/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;
    const { applicationNote } = z.object({ applicationNote: z.string().max(500).optional() }).parse(req.body);

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ message: "Không tìm thấy thế giới" });
    if (world.createdBy === userId) return res.status(400).json({ message: "Bạn không thể xin quốc tịch thế giới của mình" });

    const existing = await db.select().from(citizenships).where(
      and(eq(citizenships.userId, userId), eq(citizenships.worldSlug, worldSlug))
    );
    if (existing.length > 0 && existing[0].status !== "revoked") {
      return res.status(400).json({ message: "Bạn đã có đơn hoặc quốc tịch ở thế giới này" });
    }

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));

    const [benefits] = await db.select().from(citizenshipBenefits).where(eq(citizenshipBenefits.worldSlug, worldSlug));
    const citizenCount = await db.select().from(citizenships).where(
      and(eq(citizenships.worldSlug, worldSlug), eq(citizenships.status, "approved"))
    );
    if (benefits && citizenCount.length >= benefits.maxCitizens) {
      return res.status(400).json({ message: "Thế giới này đã đầy công dân" });
    }

    const [cit] = await db.insert(citizenships).values({
      characterId: char?.id ?? undefined as any,
      characterName: char?.name ?? "Ẩn Danh",
      userId, worldSlug, worldName: world.name,
      applicationNote: applicationNote ?? "",
      annualTax: benefits?.annualTaxAmount ?? 200,
    }).returning();

    res.json({ citizenship: cit, message: `Đã nộp đơn xin quốc tịch ${world.name}!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/citizenship/applications/:worldSlug — creator xem đơn
───────────────────────────────────────────────────── */
router.get("/citizenship/applications/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world || world.createdBy !== userId) return res.status(403).json({ message: "Không có quyền" });

    const apps = await db.select().from(citizenships)
      .where(eq(citizenships.worldSlug, worldSlug))
      .orderBy(desc(citizenships.appliedAt));
    res.json(apps);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/citizenship/approve/:id — phê duyệt
───────────────────────────────────────────────────── */
router.post("/citizenship/approve/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params as Record<string, string>;
    const { approvalNote } = z.object({ approvalNote: z.string().max(300).optional() }).parse(req.body);

    const [cit] = await db.select().from(citizenships).where(eq(citizenships.id, id));
    if (!cit) return res.status(404).json({ message: "Không tìm thấy đơn" });

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, cit.worldSlug));
    if (!world || world.createdBy !== userId) return res.status(403).json({ message: "Không có quyền" });

    const [updated] = await db.update(citizenships).set({
      status: "approved", approvalNote: approvalNote ?? "Chào mừng công dân mới!",
      approvedAt: new Date(), taxPaidAt: new Date(),
    }).where(eq(citizenships.id, id)).returning();

    res.json({ citizenship: updated, message: `Đã phê duyệt quốc tịch cho ${cit.characterName}!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/citizenship/revoke/:id — thu hồi quốc tịch
───────────────────────────────────────────────────── */
router.post("/citizenship/revoke/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params as Record<string, string>;

    const [cit] = await db.select().from(citizenships).where(eq(citizenships.id, id));
    if (!cit) return res.status(404).json({ message: "Không tìm thấy" });

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, cit.worldSlug));
    const isOwner = world?.createdBy === userId;
    const isSelf = cit.userId === userId;
    if (!isOwner && !isSelf) return res.status(403).json({ message: "Không có quyền" });

    const [updated] = await db.update(citizenships).set({ status: "revoked", revokedAt: new Date() })
      .where(eq(citizenships.id, id)).returning();
    res.json({ citizenship: updated, message: "Đã thu hồi quốc tịch" });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/citizenship/pay-tax/:worldSlug — nộp thuế thường niên
───────────────────────────────────────────────────── */
router.post("/citizenship/pay-tax/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;

    const [cit] = await db.select().from(citizenships).where(
      and(eq(citizenships.userId, userId), eq(citizenships.worldSlug, worldSlug), eq(citizenships.status, "approved"))
    );
    if (!cit) return res.status(404).json({ message: "Bạn không có quốc tịch ở thế giới này" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const tax = cit.annualTax;
    if (((char.stats as any)?.gold ?? 0) < tax) return res.status(400).json({ message: `Cần ${tax} gold để nộp thuế` });

    await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) - tax } }).where(eq(characters.id, char.id));
    const [updated] = await db.update(citizenships).set({ taxPaidAt: new Date() }).where(eq(citizenships.id, cit.id)).returning();

    res.json({ citizenship: updated, message: `Đã nộp ${tax} gold thuế thường niên!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/citizenship/benefits/:worldSlug — creator cài quyền lợi
───────────────────────────────────────────────────── */
router.post("/citizenship/benefits/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;
    const body = z.object({
      tradeTaxDiscount: z.number().int().min(0).max(50).optional(),
      maxCitizens: z.number().int().min(1).max(500).optional(),
      annualTaxAmount: z.number().int().min(0).max(10000).optional(),
      welcomeMessage: z.string().max(300).optional(),
    }).parse(req.body);

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world || world.createdBy !== userId) return res.status(403).json({ message: "Không có quyền" });

    const existing = await db.select().from(citizenshipBenefits).where(eq(citizenshipBenefits.worldSlug, worldSlug));
    let result;
    if (existing.length > 0) {
      [result] = await db.update(citizenshipBenefits).set({ ...body, updatedAt: new Date() }).where(eq(citizenshipBenefits.worldSlug, worldSlug)).returning();
    } else {
      [result] = await db.insert(citizenshipBenefits).values({ worldSlug, ...body }).returning();
    }
    res.json({ benefits: result, message: "Đã cập nhật quyền lợi công dân!" });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
