import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { achievements, characterAchievements, characters } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

const ACHIEVEMENT_DEFS = [
  // ── CHIẾN ĐẤU ──
  { key: "first_blood",      title: "Sơ Xuất Chi Chiến",   description: "Thắng trận chiến đầu tiên",              icon: "⚔️",  category: "battle",   xpReward: 50,  condition: "battle_wins>=1" },
  { key: "battle_10",        title: "Chiến Binh Sơ Cấp",   description: "Thắng 10 trận chiến",                    icon: "🗡️",  category: "battle",   xpReward: 100, condition: "battle_wins>=10" },
  { key: "battle_50",        title: "Kiếm Khách Lão Luyện", description: "Thắng 50 trận chiến",                   icon: "⚔️",  category: "battle",   xpReward: 300, condition: "battle_wins>=50" },
  { key: "battle_100",       title: "Chiến Thần Vô Song",   description: "Thắng 100 trận chiến",                  icon: "🏆",  category: "battle",   xpReward: 500, condition: "battle_wins>=100" },
  { key: "no_damage",        title: "Bất Khả Xâm Phạm",    description: "Thắng trận với HP tối đa còn lại",      icon: "🛡️",  category: "battle",   xpReward: 200, condition: "perfect_win" },
  { key: "kill_boss",        title: "Đả Bại Đại Yêu",       description: "Tiêu diệt boss thế giới lần đầu",       icon: "💀",  category: "battle",   xpReward: 400, condition: "boss_kills>=1" },
  // ── PVP ──
  { key: "pvp_first",        title: "Dũng Cảm Xung Trận",  description: "Hoàn thành trận PvP đầu tiên",           icon: "🥊",  category: "pvp",      xpReward: 100, condition: "pvp_battles>=1" },
  { key: "pvp_wins_5",       title: "Kẻ Thách Đấu",         description: "Thắng 5 trận PvP",                      icon: "🏅",  category: "pvp",      xpReward: 200, condition: "pvp_wins>=5" },
  { key: "pvp_wins_20",      title: "Bá Chủ Đấu Trường",   description: "Thắng 20 trận PvP",                     icon: "👑",  category: "pvp",      xpReward: 500, condition: "pvp_wins>=20" },
  { key: "pvp_streak_5",     title: "Ngũ Liên Sát",         description: "Thắng 5 trận PvP liên tiếp",            icon: "🔥",  category: "pvp",      xpReward: 300, condition: "pvp_streak>=5" },
  { key: "pvp_gold",         title: "Chiến Sĩ Vàng",        description: "Đạt hạng Vàng trong PvP",               icon: "🥇",  category: "pvp",      xpReward: 400, condition: "pvp_tier=gold" },
  { key: "pvp_immortal",     title: "Bất Tử Chi Thân",      description: "Đạt hạng Bất Tử trong PvP",             icon: "☯️",  category: "pvp",      xpReward: 1000,condition: "pvp_tier=immortal" },
  // ── TU LUYỆN ──
  { key: "level_10",         title: "Bước Vào Cổng Đạo",   description: "Đạt cấp 10",                            icon: "✨",  category: "cultivate",xpReward: 100, condition: "level>=10" },
  { key: "level_30",         title: "Linh Hồn Thức Tỉnh",   description: "Đạt cấp 30",                            icon: "💫",  category: "cultivate",xpReward: 300, condition: "level>=30" },
  { key: "level_50",         title: "Thiên Địa Nguyên Thần", description: "Đạt cấp 50",                           icon: "🌟",  category: "cultivate",xpReward: 500, condition: "level>=50" },
  { key: "level_100",        title: "Vô Thượng Đại Năng",   description: "Đạt cấp 100",                           icon: "⭐",  category: "cultivate",xpReward: 2000,condition: "level>=100" },
  { key: "harvest_100",      title: "Khai Quặng Tiên",       description: "Thu thập 100 đơn vị tài nguyên",        icon: "⛏️",  category: "cultivate",xpReward: 150, condition: "harvests>=100" },
  // ── KHÁM PHÁ ──
  { key: "first_quest",      title: "Sứ Đồ Sơ Khởi",        description: "Hoàn thành nhiệm vụ đầu tiên",          icon: "📜",  category: "explore",  xpReward: 50,  condition: "quests>=1" },
  { key: "quest_20",         title: "Phong Trần Lãng Nhân",  description: "Hoàn thành 20 nhiệm vụ",                icon: "🗺️",  category: "explore",  xpReward: 300, condition: "quests>=20" },
  { key: "world_traveler",   title: "Du Lịch Đa Vũ Trụ",    description: "Du hành sang thế giới khác",            icon: "🌐",  category: "explore",  xpReward: 200, condition: "world_travels>=1" },
  { key: "npc_friend",       title: "Kẻ Giao Tiếp Kỳ Tài",  description: "Hội thoại với 5 NPC khác nhau",         icon: "🤝",  category: "explore",  xpReward: 150, condition: "npc_chats>=5" },
  { key: "memory_hoarder",   title: "Người Ghi Nhớ Lịch Sử", description: "Tích lũy 10 ký ức hành trình",          icon: "🧠",  category: "explore",  xpReward: 150, condition: "memories>=10" },
  // ── XÃ HỘI ──
  { key: "guild_member",     title: "Nhập Bang Khai Đầu",    description: "Gia nhập bang hội lần đầu",             icon: "🏰",  category: "social",   xpReward: 100, condition: "in_guild" },
  { key: "faction_join",     title: "Chọn Phe Lập Trường",   description: "Gia nhập một phe phái",                 icon: "⚜️",  category: "social",   xpReward: 100, condition: "in_faction" },
  { key: "market_trade",     title: "Thương Nhân Tiểu Tử",   description: "Mua hoặc bán vật phẩm trên chợ đen",    icon: "💰",  category: "social",   xpReward: 100, condition: "market_trades>=1" },
  { key: "world_creator",    title: "Thiên Tạo Giả",         description: "Tạo ra một thế giới riêng",             icon: "🌍",  category: "social",   xpReward: 500, condition: "worlds_created>=1" },
  // ── BÍ ẨN ──
  { key: "dark_soul",        title: "Hắc Ám Căn Cơ",         description: "Thua 10 trận chiến — học từ thất bại",  icon: "🖤",  category: "secret",   xpReward: 200, condition: "battle_losses>=10" },
  { key: "ghost",            title: "Bóng Ma Hành Giả",      description: "Đến thăm trang hồ sơ của chính mình",   icon: "👻",  category: "secret",   xpReward: 50,  condition: "profile_visit" },
  { key: "rich_man",         title: "Phú Gia Địch Quốc",     description: "Sở hữu 20 vật phẩm trong túi đồ",      icon: "💎",  category: "secret",   xpReward: 300, condition: "inventory>=20" },
  { key: "all_modes",        title: "Chiến Thuật Đa Dạng",   description: "Chiến đấu bằng tất cả 6 chế độ",        icon: "🎯",  category: "secret",   xpReward: 400, condition: "all_battle_modes" },
  { key: "first_death",      title: "Khai Thiên Nhất Tử",    description: "Chết trong trận chiến đầu tiên",        icon: "☠️",  category: "secret",   xpReward: 50,  condition: "battle_losses>=1" },
];

async function seedAchievements() {
  const existing = await db.select({ key: achievements.key }).from(achievements);
  const existingKeys = new Set(existing.map(e => e.key));
  const toInsert = ACHIEVEMENT_DEFS.filter(a => !existingKeys.has(a.key));
  if (toInsert.length > 0) {
    await db.insert(achievements).values(toInsert);
  }
}

async function getUnlockedKeys(characterId: string): Promise<Set<string>> {
  const rows = await db.select({ key: characterAchievements.achievementKey })
    .from(characterAchievements)
    .where(eq(characterAchievements.characterId, characterId));
  return new Set(rows.map(r => r.key));
}

export async function checkAndUnlockAchievements(characterId: string, context: {
  battle_wins?: number; battle_losses?: number; pvp_wins?: number; pvp_battles?: number;
  pvp_streak?: number; pvp_tier?: string; level?: number; quests?: number;
  harvests?: number; world_travels?: number; npc_chats?: number; memories?: number;
  in_guild?: boolean; in_faction?: boolean; market_trades?: number;
  worlds_created?: number; inventory?: number; all_battle_modes?: boolean;
  perfect_win?: boolean; boss_kills?: number;
}): Promise<{ key: string; title: string; icon: string; xpReward: number }[]> {
  await seedAchievements();
  const unlocked = await getUnlockedKeys(characterId);
  const toUnlock: string[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    if (unlocked.has(def.key)) continue;
    const c = def.condition;
    let met = false;

    if (c === "battle_wins>=1")   met = (context.battle_wins ?? 0) >= 1;
    else if (c === "battle_wins>=10")  met = (context.battle_wins ?? 0) >= 10;
    else if (c === "battle_wins>=50")  met = (context.battle_wins ?? 0) >= 50;
    else if (c === "battle_wins>=100") met = (context.battle_wins ?? 0) >= 100;
    else if (c === "battle_losses>=1") met = (context.battle_losses ?? 0) >= 1;
    else if (c === "battle_losses>=10")met = (context.battle_losses ?? 0) >= 10;
    else if (c === "perfect_win")      met = context.perfect_win === true;
    else if (c === "boss_kills>=1")    met = (context.boss_kills ?? 0) >= 1;
    else if (c === "pvp_battles>=1")   met = (context.pvp_battles ?? 0) >= 1;
    else if (c === "pvp_wins>=5")      met = (context.pvp_wins ?? 0) >= 5;
    else if (c === "pvp_wins>=20")     met = (context.pvp_wins ?? 0) >= 20;
    else if (c === "pvp_streak>=5")    met = (context.pvp_streak ?? 0) >= 5;
    else if (c === "pvp_tier=gold")    met = ["gold","platinum","diamond","immortal"].includes(context.pvp_tier ?? "");
    else if (c === "pvp_tier=immortal")met = context.pvp_tier === "immortal";
    else if (c === "level>=10")        met = (context.level ?? 0) >= 10;
    else if (c === "level>=30")        met = (context.level ?? 0) >= 30;
    else if (c === "level>=50")        met = (context.level ?? 0) >= 50;
    else if (c === "level>=100")       met = (context.level ?? 0) >= 100;
    else if (c === "harvests>=100")    met = (context.harvests ?? 0) >= 100;
    else if (c === "quests>=1")        met = (context.quests ?? 0) >= 1;
    else if (c === "quests>=20")       met = (context.quests ?? 0) >= 20;
    else if (c === "world_travels>=1") met = (context.world_travels ?? 0) >= 1;
    else if (c === "npc_chats>=5")     met = (context.npc_chats ?? 0) >= 5;
    else if (c === "memories>=10")     met = (context.memories ?? 0) >= 10;
    else if (c === "in_guild")         met = context.in_guild === true;
    else if (c === "in_faction")       met = context.in_faction === true;
    else if (c === "market_trades>=1") met = (context.market_trades ?? 0) >= 1;
    else if (c === "worlds_created>=1")met = (context.worlds_created ?? 0) >= 1;
    else if (c === "dark_soul" || c === "battle_losses>=10") met = (context.battle_losses ?? 0) >= 10;
    else if (c === "profile_visit")    met = false;
    else if (c === "inventory>=20")    met = (context.inventory ?? 0) >= 20;
    else if (c === "all_battle_modes") met = context.all_battle_modes === true;

    if (met) toUnlock.push(def.key);
  }

  if (toUnlock.length > 0) {
    await db.insert(characterAchievements).values(
      toUnlock.map(key => ({ characterId, achievementKey: key }))
    );
  }

  return toUnlock.map(key => {
    const def = ACHIEVEMENT_DEFS.find(d => d.key === key)!;
    return { key, title: def.title, icon: def.icon, xpReward: def.xpReward };
  });
}

// GET /api/achievements/:characterId
router.get("/achievements/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    await seedAchievements();
    const { characterId } = req.params;
    const allDefs = await db.select().from(achievements);
    const unlockedRows = await db.select().from(characterAchievements)
      .where(eq(characterAchievements.characterId, characterId));
    const unlockedMap = new Map(unlockedRows.map(r => [r.achievementKey, r.unlockedAt]));

    const result = allDefs.map(def => ({
      ...def,
      unlocked: unlockedMap.has(def.key),
      unlockedAt: unlockedMap.get(def.key) ?? null,
    }));

    const totalXp = result.filter(r => r.unlocked).reduce((s, r) => s + r.xpReward, 0);
    res.json({ achievements: result, totalUnlocked: unlockedMap.size, total: allDefs.length, totalXp });
  } catch (err: any) {
    console.error("achievements GET error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy thành tựu" });
  }
});

// POST /api/achievements/check/:characterId — trigger full check với context từ DB
router.post("/achievements/check/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = (req as any).userId;

    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char || char.userId !== userId) return res.status(403).json({ message: "Không có quyền" });

    const { battles, pvpRankings, quests, characterWorldTravel, npcMemories,
      characterMemories, guildMembers, characterFaction, inventory, customWorlds } =
      await import("@workspace/db/schema");
    const { count } = await import("drizzle-orm");

    const [battleStats] = await db.select({
      wins: count(),
    }).from(battles).where(and(eq(battles.characterId, characterId)));

    const allBattles = await db.select({ result: battles.result, battleMode: battles.battleMode, hpLeft: battles.hpLeft })
      .from(battles).where(eq(battles.characterId, characterId));

    const wins = allBattles.filter(b => b.result === "win").length;
    const losses = allBattles.filter(b => b.result === "lose").length;
    const modesUsed = new Set(allBattles.map(b => b.battleMode)).size;
    const perfectWin = allBattles.some(b => b.result === "win" && (b.hpLeft ?? 0) >= 100);
    const pvpBattles = allBattles.filter(b => b.battleMode === "pvp");
    const pvpWins = pvpBattles.filter(b => b.result === "win").length;

    const [pvpRank] = await db.select().from(pvpRankings).where(eq(pvpRankings.characterId, characterId));
    const [guildMem] = await db.select().from(guildMembers).where(eq(guildMembers.characterId, characterId));
    const [factionMem] = await db.select().from(characterFaction).where(eq(characterFaction.characterId, characterId));
    const travelCount = (await db.select().from(characterWorldTravel).where(eq(characterWorldTravel.characterId, characterId))).length;
    const memCount = (await db.select().from(characterMemories).where(eq(characterMemories.characterId, characterId))).length;
    const invCount = (await db.select().from(inventory).where(eq(inventory.characterId, characterId))).length;
    const worldsCreated = (await db.select().from(customWorlds).where(eq(customWorlds.createdBy, userId))).length;

    const newlyUnlocked = await checkAndUnlockAchievements(characterId, {
      battle_wins: wins, battle_losses: losses,
      pvp_wins: pvpWins, pvp_battles: pvpBattles.length,
      pvp_streak: pvpRank?.bestStreak ?? 0, pvp_tier: pvpRank?.tier,
      level: char.level, quests: 0,
      world_travels: travelCount, memories: memCount,
      in_guild: !!guildMem, in_faction: !!factionMem,
      worlds_created: worldsCreated, inventory: invCount,
      all_battle_modes: modesUsed >= 6, perfect_win: perfectWin,
    });

    if (newlyUnlocked.length > 0) {
      const totalXp = newlyUnlocked.reduce((s, a) => s + a.xpReward, 0);
      const newExp = char.exp + totalXp;
      const newLevel = Math.floor(newExp / 100) + 1;
      await db.update(characters).set({ exp: newExp, level: newLevel }).where(eq(characters.id, characterId));
    }

    res.json({ newlyUnlocked });
  } catch (err: any) {
    console.error("achievements check error:", err?.message);
    res.status(500).json({ message: "Lỗi check thành tựu" });
  }
});

export default router;
