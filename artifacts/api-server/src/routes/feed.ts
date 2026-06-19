import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { storyPosts, postLikes, characters } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/feed — lấy tất cả posts (toàn server), phân trang
router.get("/feed", isAuthenticated, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Number(req.query.offset) || 0;
    const worldSlug = req.query.world as string | undefined;
    const userId = (req as any).userId;

    let query = db.select().from(storyPosts).orderBy(desc(storyPosts.createdAt)).limit(limit).offset(offset);

    const posts = worldSlug
      ? await db.select().from(storyPosts).where(eq(storyPosts.worldSlug, worldSlug)).orderBy(desc(storyPosts.createdAt)).limit(limit).offset(offset)
      : await db.select().from(storyPosts).orderBy(desc(storyPosts.createdAt)).limit(limit).offset(offset);

    // Lấy likes của user hiện tại
    const postIds = posts.map((p) => p.id);
    let likedSet = new Set<string>();
    if (postIds.length > 0) {
      const liked = await db.select({ postId: postLikes.postId }).from(postLikes).where(
        and(eq(postLikes.userId, userId), sql`${postLikes.postId} = ANY(${sql.raw(`ARRAY[${postIds.map(() => "?").join(",")}]::uuid[]`)})`),
      );
      // Simple approach: query individually
      for (const pid of postIds) {
        const r = await db.select().from(postLikes).where(and(eq(postLikes.postId, pid), eq(postLikes.userId, userId)));
        if (r.length > 0) likedSet.add(pid);
      }
    }

    res.json(posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải feed" });
  }
});

// POST /api/feed — đăng bài thủ công
router.post("/feed", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, content } = req.body;
    if (!characterId || !content?.trim()) return res.status(400).json({ error: "Thiếu thông tin" });

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không tìm thấy nhân vật" });

    const [post] = await db.insert(storyPosts).values({
      characterId,
      userId,
      worldSlug: (char.stats as any)?.world_slug ?? "cultivation",
      authorName: char.name,
      authorSystem: (char.stats as any)?.system ?? "",
      authorLevel: char.level,
      content: content.trim().slice(0, 500),
      postType: "manual",
      metadata: {},
    }).returning();

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi đăng bài" });
  }
});

// POST /api/feed/auto — tự động đăng từ sự kiện game (internal)
router.post("/feed/auto", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, postType, content, metadata } = req.body;
    if (!characterId || !content || !postType) return res.status(400).json({ error: "Thiếu thông tin" });

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không tìm thấy nhân vật" });

    const [post] = await db.insert(storyPosts).values({
      characterId,
      userId,
      worldSlug: (char.stats as any)?.world_slug ?? "cultivation",
      authorName: char.name,
      authorSystem: (char.stats as any)?.system ?? "",
      authorLevel: char.level,
      content: content.slice(0, 500),
      postType,
      metadata: metadata ?? {},
    }).returning();

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tự động đăng bài" });
  }
});

// POST /api/feed/:postId/like — thích / bỏ thích
router.post("/feed/:postId/like", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { postId } = req.params as Record<string, string>;

    const existing = await db.select().from(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));

    if (existing.length > 0) {
      // Bỏ thích
      await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
      await db.update(storyPosts).set({ likes: sql`${storyPosts.likes} - 1` }).where(eq(storyPosts.id, postId));
      res.json({ liked: false });
    } else {
      // Thích
      await db.insert(postLikes).values({ postId, userId });
      await db.update(storyPosts).set({ likes: sql`${storyPosts.likes} + 1` }).where(eq(storyPosts.id, postId));
      res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi thích bài" });
  }
});

// DELETE /api/feed/:postId — xoá bài của mình
router.delete("/feed/:postId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { postId } = req.params as Record<string, string>;
    await db.delete(storyPosts).where(and(eq(storyPosts.id, postId), eq(storyPosts.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi xoá bài" });
  }
});

export default router;
