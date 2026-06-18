import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characterMemories, worldMemories, npcMemories, characters } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/api/memories/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const memories = await db
      .select()
      .from(characterMemories)
      .where(eq(characterMemories.characterId, characterId))
      .orderBy(desc(characterMemories.importance), desc(characterMemories.createdAt))
      .limit(50);

    res.json(memories);
  } catch {
    res.status(500).json({ message: "Failed to fetch memories" });
  }
});

router.post("/api/memories/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;
    const { content, memoryType, importance, worldSlug } = req.body;

    if (!content) return res.status(400).json({ message: "Thiếu content" });

    const [char] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const [mem] = await db
      .insert(characterMemories)
      .values({
        characterId,
        content,
        memoryType: memoryType ?? "event",
        importance: Math.min(Math.max(Number(importance) || 1, 1), 10),
        worldSlug,
      })
      .returning();

    res.status(201).json(mem);
  } catch {
    res.status(500).json({ message: "Failed to save memory" });
  }
});

router.delete("/api/memories/:characterId/:memoryId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, memoryId } = req.params;

    const [char] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    await db
      .delete(characterMemories)
      .where(and(eq(characterMemories.id, memoryId), eq(characterMemories.characterId, characterId)));

    res.json({ message: "Đã xóa ký ức" });
  } catch {
    res.status(500).json({ message: "Failed to delete memory" });
  }
});

router.get("/api/world-memories/:worldSlug", isAuthenticated, async (_req: any, res) => {
  try {
    const { worldSlug } = _req.params;
    const events = await db
      .select()
      .from(worldMemories)
      .where(eq(worldMemories.worldSlug, worldSlug))
      .orderBy(desc(worldMemories.happenedAt))
      .limit(20);
    res.json(events);
  } catch {
    res.status(500).json({ message: "Failed to fetch world memories" });
  }
});

export default router;
