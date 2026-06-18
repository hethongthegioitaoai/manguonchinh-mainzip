import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters, worlds } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const createCharacterSchema = z.object({
  worldSlug: z.string().min(1),
  name: z.string().min(2).max(64),
  stats: z.object({
    system: z.string(),
    world_slug: z.string(),
    created_at: z.string().optional(),
  }),
});

router.get("/characters", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const userChars = await db
      .select()
      .from(characters)
      .where(eq(characters.userId, userId))
      .orderBy(characters.createdAt);
    res.json(userChars);
  } catch {
    res.status(500).json({ message: "Failed to fetch characters" });
  }
});

router.post("/characters", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const parsed = createCharacterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
    }

    const { worldSlug, name, stats } = parsed.data;

    let [world] = await db.select().from(worlds).where(eq(worlds.slug, worldSlug));
    if (!world) {
      [world] = await db.insert(worlds).values({ slug: worldSlug }).returning();
    }

    const [character] = await db
      .insert(characters)
      .values({
        userId,
        worldId: world.id,
        name,
        stats: { ...stats, created_at: new Date().toISOString() },
      })
      .returning();

    res.status(201).json(character);
  } catch (err) {
    res.status(500).json({ message: "Failed to create character" });
  }
});

router.delete("/characters/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));

    if (!char) {
      return res.status(404).json({ message: "Character not found" });
    }

    await db
      .delete(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));

    res.json({ message: "Character deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete character" });
  }
});

export default router;
