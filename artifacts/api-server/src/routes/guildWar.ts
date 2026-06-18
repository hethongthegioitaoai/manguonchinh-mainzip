import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { clanWars, guilds, guildMembers, characters, characterFaction } from "@workspace/db/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { saveAndNotifyMany } from "../lib/notify.js";

const router = Router();

async function getCharAndGuild(userId: string) {
  const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
  if (!char) return { char: null, guild: null, member: null };
  const [member] = await db.select().from(guildMembers).where(eq(guildMembers.characterId, char.id));
  if (!member) return { char, guild: null, member: null };
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, member.guildId));
  return { char, guild: guild ?? null, member: member ?? null };
}

// GET /api/guild-war/status
router.get("/guild-war/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { char, guild, member } = await getCharAndGuild(userId);

    if (!guild) return res.json({ myGuild: null, activeWar: null, history: [], allGuilds: [], isLeader: false });

    const [activeWar] = await db.select().from(clanWars)
      .where(and(or(eq(clanWars.guildId1, guild.id), eq(clanWars.guildId2, guild.id)), eq(clanWars.active, true)))
      .orderBy(desc(clanWars.startAt)).limit(1);

    const history = await db.select().from(clanWars)
      .where(and(or(eq(clanWars.guildId1, guild.id), eq(clanWars.guildId2, guild.id)), eq(clanWars.active, false)))
      .orderBy(desc(clanWars.startAt)).limit(10);

    const allGuilds = await db.select({ id: guilds.id, name: guilds.name, description: guilds.description }).from(guilds);

    let warWithAutoEnd = activeWar ?? null;
    if (activeWar?.endAt && new Date(activeWar.endAt) < new Date()) {
      warWithAutoEnd = await autoEndWar(activeWar.id);
    }

    const isLeader = member?.role === "leader";

    res.json({ myGuild: guild, activeWar: warWithAutoEnd, history, allGuilds, isLeader });
  } catch (err: any) {
    console.error("guild-war status error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy trạng thái chiến tranh" });
  }
});

async function autoEndWar(warId: string) {
  const [war] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
  if (!war || !war.active) return war;

  let winnerId: string | null = null;
  let winnerName = "";
  if (war.score1 > war.score2) { winnerId = war.guildId1; winnerName = war.guildName1; }
  else if (war.score2 > war.score1) { winnerId = war.guildId2; winnerName = war.guildName2; }

  await db.update(clanWars).set({ active: false, winnerId, endAt: new Date() }).where(eq(clanWars.id, warId));

  if (winnerId && !war.rewardDistributed) {
    const winnerMembers = await db.select({ characterId: guildMembers.characterId })
      .from(guildMembers).where(eq(guildMembers.guildId, winnerId));
    for (const m of winnerMembers) {
      const [charFaction] = await db.select().from(characterFaction).where(eq(characterFaction.characterId, m.characterId));
      if (charFaction) {
        await db.update(characterFaction).set({ reputation: charFaction.reputation + 50 }).where(eq(characterFaction.id, charFaction.id));
      }
    }
    await db.update(clanWars).set({ rewardDistributed: true }).where(eq(clanWars.id, warId));
  }

  const [updated] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
  return updated;
}

// POST /api/guild-war/declare/:targetGuildId
router.post("/guild-war/declare/:targetGuildId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { targetGuildId } = req.params;
    const { char, guild, member } = await getCharAndGuild(userId);

    if (!guild) return res.status(400).json({ message: "Bạn chưa thuộc bang hội nào" });
    if (member?.role !== "leader") return res.status(403).json({ message: "Chỉ thủ lĩnh bang mới có thể tuyên chiến" });
    if (guild.id === targetGuildId) return res.status(400).json({ message: "Không thể tuyên chiến với chính bang mình" });

    const [existingWar] = await db.select().from(clanWars)
      .where(and(or(eq(clanWars.guildId1, guild.id), eq(clanWars.guildId2, guild.id)), eq(clanWars.active, true)));
    if (existingWar) return res.status(400).json({ message: "Bang đang có chiến tranh đang diễn ra — cần kết thúc trước" });

    const [targetGuild] = await db.select().from(guilds).where(eq(guilds.id, targetGuildId));
    if (!targetGuild) return res.status(404).json({ message: "Bang hội địch không tồn tại" });

    const endAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [war] = await db.insert(clanWars).values({
      guildId1: guild.id, guildId2: targetGuild.id,
      guildName1: guild.name, guildName2: targetGuild.name,
      score1: 0, score2: 0, active: true, endAt,
    }).returning();

    const targetMembers = await db
      .select({ userId: characters.userId })
      .from(guildMembers)
      .innerJoin(characters, eq(characters.id, guildMembers.characterId))
      .where(eq(guildMembers.guildId, targetGuild.id));
    const targetUserIds = targetMembers.map(m => m.userId);
    await saveAndNotifyMany(targetUserIds, { type: "guild_war_declared", attackerGuildName: guild.name, defenderGuildName: targetGuild.name });

    res.json({ message: `Tuyên chiến với ${targetGuild.name} thành công! Chiến tranh kéo dài 24h.`, war });
  } catch (err: any) {
    console.error("guild-war declare error:", err?.message);
    res.status(500).json({ message: "Lỗi tuyên chiến" });
  }
});

// POST /api/guild-war/end/:warId — manual end (leader only)
router.post("/guild-war/end/:warId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { warId } = req.params;
    const { guild, member } = await getCharAndGuild(userId);

    if (!guild) return res.status(403).json({ message: "Không có quyền" });
    if (member?.role !== "leader") return res.status(403).json({ message: "Chỉ thủ lĩnh mới có thể kết thúc chiến tranh" });

    const [war] = await db.select().from(clanWars).where(eq(clanWars.id, warId));
    if (!war) return res.status(404).json({ message: "Chiến tranh không tồn tại" });
    if (war.guildId1 !== guild.id && war.guildId2 !== guild.id) return res.status(403).json({ message: "Không có quyền kết thúc chiến tranh này" });

    const ended = await autoEndWar(warId);
    const winnerName = ended?.winnerId === war.guildId1 ? war.guildName1 : ended?.winnerId === war.guildId2 ? war.guildName2 : null;

    res.json({
      message: winnerName ? `${winnerName} thắng! Phần thưởng đã được phân phối.` : "Hòa — không có phần thưởng.",
      winnerId: ended?.winnerId, winnerName,
      score1: ended?.score1, score2: ended?.score2,
    });
  } catch (err: any) {
    console.error("guild-war end error:", err?.message);
    res.status(500).json({ message: "Lỗi kết thúc chiến tranh" });
  }
});

// POST /api/guild-war/pvp-score — gọi từ PvP route khi thắng
export async function addPvpScoreToWar(winnerId: string, loserId: string) {
  try {
    const [winnerMember] = await db.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.characterId, winnerId));
    const [loserMember] = await db.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.characterId, loserId));

    if (!winnerMember || !loserMember || winnerMember.guildId === loserMember.guildId) return;

    const [war] = await db.select().from(clanWars)
      .where(and(
        or(
          and(eq(clanWars.guildId1, winnerMember.guildId), eq(clanWars.guildId2, loserMember.guildId)),
          and(eq(clanWars.guildId1, loserMember.guildId), eq(clanWars.guildId2, winnerMember.guildId))
        ),
        eq(clanWars.active, true)
      )).limit(1);

    if (!war) return;

    if (war.guildId1 === winnerMember.guildId) {
      await db.update(clanWars).set({ score1: war.score1 + 1 }).where(eq(clanWars.id, war.id));
    } else {
      await db.update(clanWars).set({ score2: war.score2 + 1 }).where(eq(clanWars.id, war.id));
    }
  } catch (err: any) {
    console.error("addPvpScoreToWar error:", err?.message);
  }
}

export default router;
