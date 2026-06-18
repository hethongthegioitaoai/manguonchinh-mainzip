import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters, battles, pvpRankings } from "@workspace/db/schema";
import { eq, ne, and, desc, asc } from "drizzle-orm";
import { saveAndNotify } from "../lib/notify.js";

const router = Router();

const EXP_PER_LEVEL = 100;

const TIERS = [
  { name: "bronze",   minRp: 0,    maxRp: 1199, label: "Đồng",     icon: "🥉", color: "#cd7f32" },
  { name: "silver",   minRp: 1200, maxRp: 1499, label: "Bạc",      icon: "🥈", color: "#94a3b8" },
  { name: "gold",     minRp: 1500, maxRp: 1799, label: "Vàng",     icon: "🥇", color: "#f59e0b" },
  { name: "platinum", minRp: 1800, maxRp: 2099, label: "Bạch Kim", icon: "💎", color: "#38bdf8" },
  { name: "diamond",  minRp: 2100, maxRp: 2499, label: "Kim Cương",icon: "🔷", color: "#818cf8" },
  { name: "immortal", minRp: 2500, maxRp: Infinity, label: "Bất Tử", icon: "☯️", color: "#c084fc" },
];

function getTier(rp: number) {
  return TIERS.find(t => rp >= t.minRp && rp <= t.maxRp) ?? TIERS[0];
}

function calcRpChange(result: "win" | "lose" | "draw", myRp: number, oppRp: number): number {
  const expected = 1 / (1 + Math.pow(10, (oppRp - myRp) / 400));
  const actual = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  return Math.round(32 * (actual - expected));
}

function calcPower(char: any): number {
  const stats = char.stats as any ?? {};
  const base =
    (stats.strength ?? 10) +
    (stats.intelligence ?? 10) +
    (stats.agility ?? 10) +
    (stats.luck ?? 10) +
    (stats.endurance ?? 10) +
    (stats.charisma ?? 10);
  return base + char.level * 5;
}

function simulatePvp(challenger: any, defender: any) {
  const cStats = challenger.stats as any ?? {};
  const dStats = defender.stats as any ?? {};
  const cAtk = (cStats.strength ?? 10) + challenger.level * 3;
  const dAtk = (dStats.strength ?? 10) + defender.level * 3;
  const cDef = (cStats.endurance ?? 10) + challenger.level * 2;
  const dDef = (dStats.endurance ?? 10) + defender.level * 2;
  const cAgi = (cStats.agility ?? 10) + challenger.level;
  const dAgi = (dStats.agility ?? 10) + defender.level;

  let cHp = 100 + challenger.level * 20 + (cStats.endurance ?? 10) * 5;
  let dHp = 100 + defender.level * 20 + (dStats.endurance ?? 10) * 5;
  const rounds: Array<{ attacker: string; damage: number; hp: number }> = [];
  let turn = 0;

  while (cHp > 0 && dHp > 0 && turn < 20) {
    const cSpeed = cAgi + Math.random() * 10;
    const dSpeed = dAgi + Math.random() * 10;
    if (cSpeed >= dSpeed) {
      const dmg = Math.max(1, Math.floor(cAtk * (0.8 + Math.random() * 0.4) - dDef * 0.3));
      dHp -= dmg;
      rounds.push({ attacker: challenger.name, damage: dmg, hp: Math.max(0, dHp) });
    } else {
      const dmg = Math.max(1, Math.floor(dAtk * (0.8 + Math.random() * 0.4) - cDef * 0.3));
      cHp -= dmg;
      rounds.push({ attacker: defender.name, damage: dmg, hp: Math.max(0, cHp) });
    }
    turn++;
  }

  let result: "win" | "lose" | "draw";
  if (cHp <= 0 && dHp <= 0) result = "draw";
  else if (dHp <= 0 || cHp > dHp) result = "win";
  else result = "lose";

  return { result, rounds, challengerHpLeft: Math.max(0, cHp), defenderHpLeft: Math.max(0, dHp) };
}

async function getOrCreateRanking(characterId: string) {
  const [existing] = await db.select().from(pvpRankings).where(eq(pvpRankings.characterId, characterId));
  if (existing) return existing;
  const [created] = await db.insert(pvpRankings).values({ characterId }).returning();
  return created;
}

async function updateRanking(characterId: string, result: "win" | "lose" | "draw", rpChange: number) {
  const ranking = await getOrCreateRanking(characterId);
  const newRp = Math.max(0, ranking.ratingPoints + rpChange);
  const newWins = ranking.wins + (result === "win" ? 1 : 0);
  const newLosses = ranking.losses + (result === "lose" ? 1 : 0);
  const newDraws = ranking.draws + (result === "draw" ? 1 : 0);
  const newStreak = result === "win" ? ranking.currentStreak + 1 : result === "lose" ? 0 : ranking.currentStreak;
  const newBestStreak = Math.max(ranking.bestStreak, newStreak);
  const tier = getTier(newRp);
  await db.update(pvpRankings)
    .set({
      wins: newWins,
      losses: newLosses,
      draws: newDraws,
      ratingPoints: newRp,
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      tier: tier.name,
      updatedAt: new Date(),
    })
    .where(eq(pvpRankings.characterId, characterId));
  return { ratingPoints: newRp, tier: tier.name, currentStreak: newStreak, bestStreak: newBestStreak };
}

// GET /api/pvp/opponents
router.get("/pvp/opponents", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const myChars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!myChars.length) return res.status(404).json({ message: "Chưa có nhân vật" });
    const myChar = myChars[0];
    const myStats = myChar.stats as any ?? {};
    const myWorldSlug = myStats.world_slug;

    const allChars = await db.select().from(characters).where(ne(characters.userId, userId));
    const opponents = allChars
      .filter(c => {
        const s = c.stats as any ?? {};
        return !myWorldSlug || s.world_slug === myWorldSlug;
      })
      .map(c => {
        const s = c.stats as any ?? {};
        return {
          id: c.id, name: c.name, level: c.level,
          system: s.system ?? "unknown", worldSlug: s.world_slug ?? "cultivation",
          power: calcPower(c),
        };
      })
      .sort((a, b) => Math.abs(a.level - myChar.level) - Math.abs(b.level - myChar.level))
      .slice(0, 10);

    const myRanking = await getOrCreateRanking(myChar.id);
    const myTier = getTier(myRanking.ratingPoints);

    res.json({
      myCharacter: {
        id: myChar.id, name: myChar.name, level: myChar.level,
        power: calcPower(myChar), system: myStats.system ?? "unknown",
        ranking: {
          ratingPoints: myRanking.ratingPoints,
          wins: myRanking.wins, losses: myRanking.losses, draws: myRanking.draws,
          currentStreak: myRanking.currentStreak, bestStreak: myRanking.bestStreak,
          tier: myTier,
        },
      },
      opponents,
    });
  } catch (err: any) {
    console.error("pvp opponents error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy danh sách đối thủ" });
  }
});

// POST /api/pvp/challenge/:defenderId
router.post("/pvp/challenge/:defenderId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { defenderId } = req.params;

    const myChars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!myChars.length) return res.status(404).json({ message: "Chưa có nhân vật" });
    const challenger = myChars[0];

    const [defender] = await db.select().from(characters).where(eq(characters.id, defenderId));
    if (!defender) return res.status(404).json({ message: "Đối thủ không tồn tại" });
    if (defender.userId === userId) return res.status(400).json({ message: "Không thể thách đấu chính mình" });

    const battle = simulatePvp(challenger, defender);

    const challRanking = await getOrCreateRanking(challenger.id);
    const defRanking = await getOrCreateRanking(defender.id);

    const challRpChange = calcRpChange(battle.result, challRanking.ratingPoints, defRanking.ratingPoints);
    const defResult: "win" | "lose" | "draw" = battle.result === "win" ? "lose" : battle.result === "lose" ? "win" : "draw";
    const defRpChange = calcRpChange(defResult, defRanking.ratingPoints, challRanking.ratingPoints);

    const [newChallRanking] = await Promise.all([
      updateRanking(challenger.id, battle.result, challRpChange),
      updateRanking(defender.id, defResult, defRpChange),
    ]);

    const expGained = battle.result === "win" ? defender.level * 10 : battle.result === "draw" ? defender.level * 3 : 0;
    if (expGained > 0) {
      const newExp = challenger.exp + expGained;
      const newLevel = Math.floor(newExp / EXP_PER_LEVEL) + 1;
      await db.update(characters).set({ exp: newExp, level: newLevel }).where(eq(characters.id, challenger.id));
    }

    await db.insert(battles).values({
      characterId: challenger.id,
      enemyName: `[PvP] ${defender.name}`,
      enemyLevel: defender.level,
      battleMode: "pvp",
      result: battle.result,
      expGained,
      hpLeft: battle.challengerHpLeft,
      metadata: {
        pvp: true,
        defenderId: defender.id, defenderName: defender.name,
        rounds: battle.rounds,
        challengerHpLeft: battle.challengerHpLeft, defenderHpLeft: battle.defenderHpLeft,
        rpChange: challRpChange, newRp: newChallRanking.ratingPoints,
      },
    });

    const oldLevel = challenger.level;
    const newExp = challenger.exp + expGained;
    const newLevel = Math.floor(newExp / EXP_PER_LEVEL) + 1;
    const newTier = getTier(newChallRanking.ratingPoints);

    await saveAndNotify(defender.userId, {
      type: "pvp_challenged",
      challengerName: challenger.name,
      result: defResult,
      rpChange: defRpChange,
    });
    if (newLevel > oldLevel) {
      await saveAndNotify(userId, { type: "level_up", characterName: challenger.name, newLevel });
    }

    res.json({
      result: battle.result,
      challenger: { name: challenger.name, level: challenger.level, hpLeft: battle.challengerHpLeft },
      defender: { name: defender.name, level: defender.level, hpLeft: battle.defenderHpLeft },
      rounds: battle.rounds,
      expGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      rpChange: challRpChange,
      newRp: newChallRanking.ratingPoints,
      newTier,
      streak: newChallRanking.currentStreak,
    });
  } catch (err: any) {
    console.error("pvp challenge error:", err?.message);
    res.status(500).json({ message: "Lỗi thách đấu PvP" });
  }
});

// GET /api/pvp/history
router.get("/pvp/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const myChars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!myChars.length) return res.status(404).json({ message: "Chưa có nhân vật" });

    const pvpBattles = await db.select().from(battles)
      .where(and(eq(battles.characterId, myChars[0].id), eq(battles.battleMode, "pvp")))
      .orderBy(desc(battles.createdAt))
      .limit(20);
    res.json(pvpBattles);
  } catch (err: any) {
    console.error("pvp history error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy lịch sử PvP" });
  }
});

// GET /api/pvp/leaderboard
router.get("/pvp/leaderboard", isAuthenticated, async (req: any, res) => {
  try {
    const rows = await db
      .select({
        characterId: pvpRankings.characterId,
        wins: pvpRankings.wins,
        losses: pvpRankings.losses,
        draws: pvpRankings.draws,
        ratingPoints: pvpRankings.ratingPoints,
        currentStreak: pvpRankings.currentStreak,
        bestStreak: pvpRankings.bestStreak,
        tier: pvpRankings.tier,
        charName: characters.name,
        charLevel: characters.level,
        charStats: characters.stats,
      })
      .from(pvpRankings)
      .innerJoin(characters, eq(pvpRankings.characterId, characters.id))
      .orderBy(desc(pvpRankings.ratingPoints))
      .limit(50);

    const result = rows.map((r, i) => {
      const total = r.wins + r.losses + r.draws;
      const winRate = total > 0 ? Math.round((r.wins / total) * 100) : 0;
      const stats = r.charStats as any ?? {};
      return {
        rank: i + 1,
        characterId: r.characterId,
        name: r.charName,
        level: r.charLevel,
        system: stats.system ?? "unknown",
        worldSlug: stats.world_slug ?? "cultivation",
        ratingPoints: r.ratingPoints,
        wins: r.wins, losses: r.losses, draws: r.draws,
        winRate,
        currentStreak: r.currentStreak,
        bestStreak: r.bestStreak,
        tier: getTier(r.ratingPoints),
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error("pvp leaderboard error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy bảng xếp hạng PvP" });
  }
});

export default router;
