import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { guilds, guildMembers, characters, worlds, users } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

router.get("/guilds", isAuthenticated, async (req: any, res) => {
  try {
    const worldSlug = (req.query.world as string) || null;

    const rows = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        worldSlug: guilds.worldSlug,
        description: guilds.description,
        tag: guilds.tag,
        memberCount: guilds.memberCount,
        totalExp: guilds.totalExp,
        createdAt: guilds.createdAt,
        leaderName: characters.name,
        leaderLevel: characters.level,
      })
      .from(guilds)
      .leftJoin(characters, eq(guilds.leaderId, characters.id))
      .orderBy(desc(guilds.totalExp))
      .limit(50);

    const filtered = worldSlug ? rows.filter(r => r.worldSlug === worldSlug) : rows;
    res.json(filtered.map((r, i) => ({ ...r, rank: i + 1 })));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch guilds" });
  }
});

router.get("/guilds/:guildId", isAuthenticated, async (req: any, res) => {
  try {
    const { guildId } = req.params;

    const [guild] = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        worldSlug: guilds.worldSlug,
        description: guilds.description,
        tag: guilds.tag,
        memberCount: guilds.memberCount,
        totalExp: guilds.totalExp,
        createdAt: guilds.createdAt,
        leaderId: guilds.leaderId,
        leaderName: characters.name,
        leaderLevel: characters.level,
      })
      .from(guilds)
      .leftJoin(characters, eq(guilds.leaderId, characters.id))
      .where(eq(guilds.id, guildId));

    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const members = await db
      .select({
        id: guildMembers.id,
        characterId: guildMembers.characterId,
        role: guildMembers.role,
        joinedAt: guildMembers.joinedAt,
        characterName: characters.name,
        characterLevel: characters.level,
        characterExp: characters.exp,
        characterStats: characters.stats,
      })
      .from(guildMembers)
      .leftJoin(characters, eq(guildMembers.characterId, characters.id))
      .where(eq(guildMembers.guildId, guildId))
      .orderBy(desc(characters.level), desc(characters.exp));

    res.json({ ...guild, members });
  } catch {
    res.status(500).json({ message: "Failed to fetch guild" });
  }
});

router.post("/guilds", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { name, worldSlug, description, tag, characterId } = req.body;

    if (!name?.trim() || !worldSlug || !characterId) {
      return res.status(400).json({ message: "Thiếu thông tin tạo bang hội" });
    }
    if (name.trim().length < 2 || name.trim().length > 32) {
      return res.status(400).json({ message: "Tên bang hội 2–32 ký tự" });
    }

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const existing = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(eq(guildMembers.characterId, characterId));
    if (existing.length > 0) {
      return res.status(409).json({ message: "Nhân vật đã thuộc một bang hội khác" });
    }

    const [newGuild] = await db
      .insert(guilds)
      .values({
        name: name.trim(),
        worldSlug,
        leaderId: characterId,
        description: description?.trim() || "",
        tag: tag?.trim().slice(0, 8) || "",
        memberCount: 1,
        totalExp: char.exp,
      })
      .returning();

    await db.insert(guildMembers).values({
      guildId: newGuild.id,
      characterId,
      role: "leader",
    });

    res.status(201).json(newGuild);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Tên bang hội đã tồn tại" });
    }
    res.status(500).json({ message: "Failed to create guild" });
  }
});

router.post("/guilds/:guildId/join", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { guildId } = req.params;
    const { characterId } = req.body;

    if (!characterId) return res.status(400).json({ message: "Thiếu characterId" });

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId));
    if (!guild) return res.status(404).json({ message: "Bang hội không tồn tại" });

    if (guild.worldSlug !== (char.stats as any)?.world_slug) {
      return res.status(400).json({ message: "Nhân vật phải cùng thế giới với bang hội" });
    }

    const existing = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(eq(guildMembers.characterId, characterId));
    if (existing.length > 0) {
      return res.status(409).json({ message: "Nhân vật đã thuộc bang hội khác" });
    }

    await db.insert(guildMembers).values({ guildId, characterId, role: "member" });

    await db
      .update(guilds)
      .set({
        memberCount: sql`${guilds.memberCount} + 1`,
        totalExp: sql`${guilds.totalExp} + ${char.exp}`,
      })
      .where(eq(guilds.id, guildId));

    res.json({ message: "Gia nhập bang hội thành công" });
  } catch {
    res.status(500).json({ message: "Failed to join guild" });
  }
});

router.post("/guilds/:guildId/leave", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { guildId } = req.params;
    const { characterId } = req.body;

    if (!characterId) return res.status(400).json({ message: "Thiếu characterId" });

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const [membership] = await db
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.characterId, characterId), eq(guildMembers.guildId, guildId)));
    if (!membership) return res.status(404).json({ message: "Không tìm thấy thành viên" });

    if (membership.role === "leader") {
      return res.status(400).json({ message: "Bang chủ không thể rời bang — hãy giải tán hoặc nhường chức" });
    }

    await db.delete(guildMembers).where(eq(guildMembers.id, membership.id));

    await db
      .update(guilds)
      .set({
        memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`,
        totalExp: sql`GREATEST(${guilds.totalExp} - ${char.exp}, 0)`,
      })
      .where(eq(guilds.id, guildId));

    res.json({ message: "Rời bang hội thành công" });
  } catch {
    res.status(500).json({ message: "Failed to leave guild" });
  }
});

router.delete("/guilds/:guildId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { guildId } = req.params;

    const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId));
    if (!guild) return res.status(404).json({ message: "Bang hội không tồn tại" });

    const [leaderChar] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, guild.leaderId), eq(characters.userId, userId)));
    if (!leaderChar) return res.status(403).json({ message: "Chỉ bang chủ mới có thể giải tán" });

    await db.delete(guilds).where(eq(guilds.id, guildId));
    res.json({ message: "Đã giải tán bang hội" });
  } catch {
    res.status(500).json({ message: "Failed to disband guild" });
  }
});

export default router;
