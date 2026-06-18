import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  characterTitles, characters, battles, dungeonRuns, dungeons,
  prophecyClaims, isekaiRecords, auctionListings, guilds,
  worldTradeHistory, fateReadings, worldPassports,
} from "@workspace/db/schema";
import { eq, and, sql, count, inArray } from "drizzle-orm";

const router = Router();

export interface TitleDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  worldSlug?: string;
}

export const ALL_TITLES: TitleDef[] = [
  { key: "first_blood",      name: "Máu Đầu Tiên",           icon: "🩸", rarity: "common",    description: "Giành chiến thắng trong trận đấu đầu tiên" },
  { key: "veteran",          name: "Chiến Binh Dày Dạn",     icon: "⚔️", rarity: "uncommon",  description: "Thắng 10 trận chiến" },
  { key: "warlord",          name: "Chiến Thần",              icon: "🏆", rarity: "epic",      description: "Thắng 50 trận chiến — kẻ bất khả chiến bại" },
  { key: "dungeon_explorer", name: "Thám Hiểm Ngục Tối",     icon: "🗝️", rarity: "uncommon",  description: "Hoàn thành một ngục tối bất kỳ" },
  { key: "dungeon_lord",     name: "Bá Chủ Ngục Tối",        icon: "💀", rarity: "epic",      description: "Chinh phục một ngục tối cấp độ KHÓ" },
  { key: "rising_star",      name: "Ngôi Sao Đang Lên",      icon: "⭐", rarity: "common",    description: "Đạt level 5" },
  { key: "ascending",        name: "Tiến Lên Đỉnh Cao",      icon: "🌟", rarity: "uncommon",  description: "Đạt level 20" },
  { key: "immortal_seeker",  name: "Tầm Đạo Giả",            icon: "✨", rarity: "rare",      description: "Đạt level 30 — hành trình siêu phàm bắt đầu" },
  { key: "legend",           name: "Huyền Thoại",             icon: "👑", rarity: "legendary", description: "Đạt level 50 — danh vọng vĩnh cửu" },
  { key: "wealthy",          name: "Phú Ông Vạn Thế",        icon: "💰", rarity: "rare",      description: "Sở hữu 5.000 vàng — giàu hơn cả quốc vương" },
  { key: "prophet_true",     name: "Tiên Tri Ứng Nghiệm",    icon: "🔮", rarity: "epic",      description: "Hoàn thành một lời tiên tri AI" },
  { key: "time_traveler",    name: "Lữ Khách Xuyên Không",   icon: "🌀", rarity: "rare",      description: "Trải nghiệm Isekai — sống lại kiếp khác" },
  { key: "fate_master",      name: "Bậc Thầy Mệnh Số",       icon: "☯️", rarity: "epic",      description: "Tham vấn Thiên Cơ Tiên 3 lần" },
  { key: "auctioneer",       name: "Bậc Thầy Đấu Giá",       icon: "🔨", rarity: "uncommon",  description: "Đăng 3 vật phẩm lên nhà đấu giá" },
  { key: "guild_leader",     name: "Hội Trưởng Trứ Danh",    icon: "🛡️", rarity: "rare",      description: "Dẫn dắt một bang hội" },
  { key: "trader",           name: "Thương Nhân Lưu Động",   icon: "💎", rarity: "rare",      description: "Hoàn thành 5 giao dịch liên thế giới" },
  { key: "passport_holder",  name: "Du Khách Thế Giới",      icon: "🌐", rarity: "uncommon",  description: "Được cấp hộ chiếu du lịch thế giới" },
];

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

async function checkAndGrantTitles(characterId: string): Promise<string[]> {
  const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
  if (!char) return [];

  const userId = char.userId;
  const gold = ((char.stats as any)?.gold ?? 0) as number;
  const level = char.level ?? 1;

  // Parallel queries
  const [
    battleWins,
    completedDungeons,
    hardDungeonClears,
    approvedProphecies,
    isekaiCount,
    auctionCount,
    guildLead,
    tradeCount,
    fateCount,
    passportApproved,
    existingTitles,
  ] = await Promise.all([
    db.select({ c: count() }).from(battles).where(and(eq(battles.characterId, characterId), eq(battles.result, "win"))),
    db.select({ c: count() }).from(dungeonRuns).where(and(eq(dungeonRuns.characterId, characterId), eq(dungeonRuns.status, "completed"))),
    db.select({ c: count() }).from(dungeonRuns)
      .innerJoin(dungeons, eq(dungeonRuns.dungeonId, dungeons.id))
      .where(and(eq(dungeonRuns.characterId, characterId), eq(dungeonRuns.status, "completed"), eq(dungeons.difficulty, "hard"))),
    db.select({ c: count() }).from(prophecyClaims).where(and(eq(prophecyClaims.characterId, characterId), eq(prophecyClaims.status, "approved"))),
    db.select({ c: count() }).from(isekaiRecords).where(eq(isekaiRecords.userId, userId)),
    db.select({ c: count() }).from(auctionListings).where(eq(auctionListings.sellerCharId, characterId)),
    db.select({ id: guilds.id }).from(guilds).where(eq(guilds.leaderId, characterId)).limit(1),
    db.select({ c: count() }).from(worldTradeHistory).where(eq(worldTradeHistory.buyerCharacterId, characterId)),
    db.select({ c: count() }).from(fateReadings).where(eq(fateReadings.characterId, characterId)),
    db.select({ id: worldPassports.id }).from(worldPassports).where(and(eq(worldPassports.characterId, characterId), eq(worldPassports.status, "approved"))).limit(1),
    db.select({ titleKey: characterTitles.titleKey }).from(characterTitles).where(eq(characterTitles.characterId, characterId)),
  ]);

  const wins = Number(battleWins[0]?.c ?? 0);
  const dungeonsDone = Number(completedDungeons[0]?.c ?? 0);
  const hardDone = Number(hardDungeonClears[0]?.c ?? 0);
  const propheciesDone = Number(approvedProphecies[0]?.c ?? 0);
  const isekai = Number(isekaiCount[0]?.c ?? 0);
  const auctions = Number(auctionCount[0]?.c ?? 0);
  const isGuildLeader = guildLead.length > 0;
  const trades = Number(tradeCount[0]?.c ?? 0);
  const fateConsults = Number(fateCount[0]?.c ?? 0);
  const hasPassport = passportApproved.length > 0;

  const alreadyHas = new Set(existingTitles.map(t => t.titleKey));

  const conditions: Record<string, boolean> = {
    first_blood:      wins >= 1,
    veteran:          wins >= 10,
    warlord:          wins >= 50,
    dungeon_explorer: dungeonsDone >= 1,
    dungeon_lord:     hardDone >= 1,
    rising_star:      level >= 5,
    ascending:        level >= 20,
    immortal_seeker:  level >= 30,
    legend:           level >= 50,
    wealthy:          gold >= 5000,
    prophet_true:     propheciesDone >= 1,
    time_traveler:    isekai >= 1,
    fate_master:      fateConsults >= 3,
    auctioneer:       auctions >= 3,
    guild_leader:     isGuildLeader,
    trader:           trades >= 5,
    passport_holder:  hasPassport,
  };

  const newlyGranted: string[] = [];
  for (const [key, met] of Object.entries(conditions)) {
    if (met && !alreadyHas.has(key)) {
      await db.insert(characterTitles).values({ characterId, titleKey: key, equipped: false });
      newlyGranted.push(key);
    }
  }
  return newlyGranted;
}

// GET /api/titles/:characterId — tất cả danh hiệu + unlocked status
router.get("/api/titles/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params as Record<string, string>;

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const newTitles = await checkAndGrantTitles(characterId);
    const myTitles = await db.select().from(characterTitles).where(eq(characterTitles.characterId, characterId));

    const unlockedMap = new Map(myTitles.map(t => [t.titleKey, t]));
    const equipped = myTitles.find(t => t.equipped);

    const result = ALL_TITLES.map(def => ({
      ...def,
      unlocked: unlockedMap.has(def.key),
      equipped: unlockedMap.get(def.key)?.equipped ?? false,
      unlockedAt: unlockedMap.get(def.key)?.unlockedAt ?? null,
    })).sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
    });

    res.json({ titles: result, equippedTitle: equipped ? ALL_TITLES.find(t => t.key === equipped.titleKey) : null, newlyGranted: newTitles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/titles/my-chars — nhân vật của user
router.get("/api/titles/my-chars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars = await db.select({ id: characters.id, name: characters.name, level: characters.level, stats: characters.stats })
      .from(characters).where(eq(characters.userId, userId));
    res.json(chars);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/titles/equip/:characterId — trang bị danh hiệu
router.post("/api/titles/equip/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params as Record<string, string>;
    const { titleKey } = req.body as { titleKey: string };

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [existing] = await db.select().from(characterTitles).where(and(eq(characterTitles.characterId, characterId), eq(characterTitles.titleKey, titleKey)));
    if (!existing) return res.status(404).json({ message: "Chưa sở hữu danh hiệu này" });

    // Unequip all, then equip target
    await db.update(characterTitles).set({ equipped: false }).where(eq(characterTitles.characterId, characterId));
    await db.update(characterTitles).set({ equipped: true, unlockedAt: existing.unlockedAt }).where(and(eq(characterTitles.characterId, characterId), eq(characterTitles.titleKey, titleKey)));

    res.json({ ok: true, equipped: titleKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/titles/unequip/:characterId — gỡ danh hiệu
router.post("/api/titles/unequip/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params as Record<string, string>;

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    await db.update(characterTitles).set({ equipped: false }).where(eq(characterTitles.characterId, characterId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

export { checkAndGrantTitles };
export default router;
