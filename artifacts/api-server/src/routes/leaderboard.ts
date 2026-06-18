import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters, users, worlds } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/leaderboard", isAuthenticated, async (req: any, res) => {
  try {
    const worldSlug = (req.query.world as string) || null;

    const rows = await db
      .select({
        id: characters.id,
        name: characters.name,
        level: characters.level,
        exp: characters.exp,
        stats: characters.stats,
        worldSlug: worlds.slug,
        userName: users.firstName,
        userEmail: users.email,
      })
      .from(characters)
      .leftJoin(worlds, eq(characters.worldId, worlds.id))
      .leftJoin(users, eq(characters.userId, users.id))
      .orderBy(desc(characters.level), desc(characters.exp))
      .limit(50);

    const filtered = worldSlug
      ? rows.filter(r => r.worldSlug === worldSlug || (r.stats as any)?.world_slug === worldSlug)
      : rows;

    const ranked = filtered.slice(0, 20).map((row, i) => ({
      rank: i + 1,
      id: row.id,
      name: row.name,
      level: row.level,
      exp: row.exp,
      worldSlug: row.worldSlug ?? (row.stats as any)?.world_slug ?? "cultivation",
      system: (row.stats as any)?.system ?? "—",
      userName: row.userName ?? row.userEmail?.split("@")[0] ?? "Operative",
    }));

    res.json(ranked);
  } catch {
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

export default router;
