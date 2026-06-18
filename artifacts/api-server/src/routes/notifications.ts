import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/notifications", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Không thể tải thông báo" });
  }
});

router.patch("/notifications/:id/read", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    const { id } = req.params as Record<string, string>;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Không thể đánh dấu đã đọc" });
  }
});

router.patch("/notifications/read-all", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Không thể đánh dấu tất cả đã đọc" });
  }
});

router.delete("/notifications/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    const { id } = req.params as Record<string, string>;
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Không thể xoá thông báo" });
  }
});

router.delete("/notifications", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    await db.delete(notifications).where(eq(notifications.userId, userId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Không thể xoá tất cả thông báo" });
  }
});

export default router;
