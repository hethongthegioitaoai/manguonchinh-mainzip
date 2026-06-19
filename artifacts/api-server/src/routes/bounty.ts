import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { bounties, bountyClaims, characters } from "@workspace/db/schema";
import { eq, and, or, sql, desc, lt } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const MIN_REWARD = 100;
const MAX_ACTIVE_PER_CHAR = 3;
const EXPIRE_DAYS = 7;
const CANCEL_PENALTY_PCT = 0.5;

/* ─── Auto-expire bounties ─── */
async function settleExpiredBounties() {
  await db.update(bounties)
    .set({ status: "expired" })
    .where(and(eq(bounties.status, "active"), lt(bounties.expiresAt, new Date())));
}

/* ─────────────────────────────────────────────────────
   GET /api/bounties/active — danh sách bounty đang active (public)
───────────────────────────────────────────────────── */
router.get("/bounties/active", isAuthenticated, async (_req, res) => {
  try {
    await settleExpiredBounties();
    const list = await db.select().from(bounties)
      .where(eq(bounties.status, "active"))
      .orderBy(desc(bounties.reward)).limit(50);
    res.json(list);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/bounties/my — bounty của mình (đặt + bị đặt)
───────────────────────────────────────────────────── */
router.get("/bounties/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.json({ posted: [], targeted: [], claims: [] });

    const posted = await db.select().from(bounties)
      .where(eq(bounties.postedByCharId, char.id))
      .orderBy(desc(bounties.postedAt)).limit(20);

    const targeted = await db.select().from(bounties)
      .where(eq(bounties.targetCharId, char.id))
      .orderBy(desc(bounties.postedAt)).limit(20);

    const claims = await db.select().from(bountyClaims)
      .where(eq(bountyClaims.claimerCharId, char.id))
      .orderBy(desc(bountyClaims.claimedAt)).limit(10);

    res.json({ posted, targeted, claims, charId: char.id });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/bounties/leaderboard — top bị truy nã
───────────────────────────────────────────────────── */
router.get("/bounties/leaderboard", isAuthenticated, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT target_char_id, target_char_name, target_world_slug,
             COUNT(*) as bounty_count, SUM(reward) as total_reward
      FROM bounties WHERE status = 'active'
      GROUP BY target_char_id, target_char_name, target_world_slug
      ORDER BY total_reward DESC LIMIT 10
    `);
    res.json(result.rows);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bounties/post — đặt tiền truy nã
───────────────────────────────────────────────────── */
router.post("/bounties/post", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { targetCharId, reward, reason } = z.object({
      targetCharId: z.string().uuid(),
      reward:       z.number().int().min(MIN_REWARD),
      reason:       z.string().max(500).default(""),
    }).parse(req.body);

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });
    if (char.id === targetCharId) return res.status(400).json({ message: "Không thể truy nã bản thân" });

    const [target] = await db.select().from(characters).where(eq(characters.id, targetCharId));
    if (!target) return res.status(404).json({ message: "Nhân vật đích không tồn tại" });

    if (((char.stats as any)?.gold ?? 0) < reward) return res.status(400).json({ message: "Không đủ gold" });

    // Giới hạn active
    const existing = await db.select().from(bounties)
      .where(and(eq(bounties.postedByCharId, char.id), eq(bounties.status, "active")));
    if (existing.length >= MAX_ACTIVE_PER_CHAR) {
      return res.status(400).json({ message: `Tối đa ${MAX_ACTIVE_PER_CHAR} bounty đang active` });
    }

    // Trừ gold
    await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) - reward } }).where(eq(characters.id, char.id));

    const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 24 * 3600 * 1000);
    const [bounty] = await db.insert(bounties).values({
      postedByCharId: char.id, postedByName: char.name,
      targetCharId, targetCharName: target.name,
      targetWorldSlug: (target.stats as any)?.world_slug ?? "cultivation",
      reward, reason, expiresAt,
    }).returning();

    res.status(201).json({ bounty, message: `Đã đặt ${reward} gold tiền truy nã ${target.name}!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bounties/claim/:bountyId — claim tiền thưởng
───────────────────────────────────────────────────── */
router.post("/bounties/claim/:bountyId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { bountyId } = req.params as Record<string, string>;
    const { note } = z.object({ note: z.string().default("") }).parse(req.body);

    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty || bounty.status !== "active") return res.status(400).json({ message: "Bounty không còn active" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });
    if (char.id === bounty.targetCharId) return res.status(400).json({ message: "Target không thể tự claim" });
    if (char.id === bounty.postedByCharId) return res.status(400).json({ message: "Người đặt không thể claim" });

    // Tạo claim — auto-approve ngay (simplified)
    const [claim] = await db.insert(bountyClaims).values({
      bountyId, claimerCharId: char.id, claimerName: char.name,
      note, status: "approved", approvedAt: new Date(),
    }).returning();

    // Cộng tiền cho claimer
    await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) + bounty.reward } }).where(eq(characters.id, char.id));

    // Đánh dấu bounty đã được claim
    await db.update(bounties)
      .set({ status: "claimed", claimedByCharId: char.id, claimedByName: char.name, claimedAt: new Date() })
      .where(eq(bounties.id, bountyId));

    res.json({ claim, reward: bounty.reward, message: `🏆 Đã nhận ${bounty.reward} gold tiền thưởng!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   DELETE /api/bounties/:bountyId — hủy bounty (mất 50% tiền)
───────────────────────────────────────────────────── */
router.delete("/bounties/:bountyId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { bountyId } = req.params as Record<string, string>;

    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
    if (!bounty || bounty.status !== "active") return res.status(400).json({ message: "Bounty không còn active" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char || char.id !== bounty.postedByCharId) return res.status(403).json({ message: "Không phải bounty của bạn" });

    const refund = Math.floor(bounty.reward * (1 - CANCEL_PENALTY_PCT));
    await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) + refund } }).where(eq(characters.id, char.id));
    await db.update(bounties).set({ status: "cancelled" }).where(eq(bounties.id, bountyId));

    res.json({ refund, message: `Đã hủy. Hoàn lại ${refund} gold (mất 50% penalty)` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
