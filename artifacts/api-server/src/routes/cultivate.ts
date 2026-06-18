import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const STAT_KEYS = ["STR", "INT", "AGI", "LCK", "END", "SPR"] as const;
type StatKey = (typeof STAT_KEYS)[number];

const MAX_STAT = 100;
const STARTER_ENERGY = 100;

function calcCost(currentValue: number): number {
  return Math.floor(currentValue / 10) * 10 + 10;
}

function initBaseStats(): Record<StatKey, number> {
  return { STR: 10, INT: 10, AGI: 10, LCK: 10, END: 10, SPR: 10 };
}

function getBaseStats(stats: any): Record<StatKey, number> {
  if (stats?.baseStats && typeof stats.baseStats === "object") {
    const bs = stats.baseStats;
    return {
      STR: typeof bs.STR === "number" ? bs.STR : 10,
      INT: typeof bs.INT === "number" ? bs.INT : 10,
      AGI: typeof bs.AGI === "number" ? bs.AGI : 10,
      LCK: typeof bs.LCK === "number" ? bs.LCK : 10,
      END: typeof bs.END === "number" ? bs.END : 10,
      SPR: typeof bs.SPR === "number" ? bs.SPR : 10,
    };
  }
  return initBaseStats();
}

function getCultivationEnergy(stats: any): number {
  const e = stats?.cultivationEnergy;
  return typeof e === "number" ? e : STARTER_ENERGY;
}

router.get("/cultivate/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const stats = char.stats as any;
    const baseStats = getBaseStats(stats);
    const cultivationEnergy = getCultivationEnergy(stats);

    const costs: Record<StatKey, number> = {} as any;
    for (const key of STAT_KEYS) {
      costs[key] = baseStats[key] >= MAX_STAT ? -1 : calcCost(baseStats[key]);
    }

    res.json({ character: char, baseStats, cultivationEnergy, costs, maxStat: MAX_STAT });
  } catch {
    res.status(500).json({ message: "Failed to fetch cultivation data" });
  }
});

const investSchema = z.object({
  stat: z.enum(STAT_KEYS),
});

router.post("/cultivate/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const parsed = investSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "stat must be one of STR, INT, AGI, LCK, END, SPR" });
    }
    const { stat } = parsed.data;

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const currentStats = (char.stats as any) ?? {};
    const baseStats = getBaseStats(currentStats);
    const cultivationEnergy = getCultivationEnergy(currentStats);

    if (baseStats[stat] >= MAX_STAT) {
      return res.status(400).json({ message: `${stat} đã đạt tối đa (${MAX_STAT})` });
    }

    const cost = calcCost(baseStats[stat]);
    if (cultivationEnergy < cost) {
      return res.status(400).json({ message: `Không đủ năng lượng. Cần ${cost}, có ${cultivationEnergy}` });
    }

    const newBaseStats = { ...baseStats, [stat]: baseStats[stat] + 1 };
    const newEnergy = cultivationEnergy - cost;
    const updatedStats = {
      ...currentStats,
      baseStats: newBaseStats,
      cultivationEnergy: newEnergy,
    };

    const [updated] = await db
      .update(characters)
      .set({ stats: updatedStats })
      .where(eq(characters.id, characterId))
      .returning();

    const newCosts: Record<StatKey, number> = {} as any;
    for (const key of STAT_KEYS) {
      newCosts[key] = newBaseStats[key] >= MAX_STAT ? -1 : calcCost(newBaseStats[key]);
    }

    res.json({
      character: updated,
      baseStats: newBaseStats,
      cultivationEnergy: newEnergy,
      costs: newCosts,
      stat,
      gained: 1,
      spent: cost,
    });
  } catch {
    res.status(500).json({ message: "Failed to invest cultivation energy" });
  }
});

export default router;
export { getCultivationEnergy, getBaseStats, STARTER_ENERGY };
