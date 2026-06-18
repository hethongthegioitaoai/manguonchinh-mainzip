import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { battles, characters, items, inventory } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { shouldDropItem, pickDropItem } from "../lib/itemTemplates.js";
import { saveAndNotify } from "../lib/notify.js";

const router = Router();

const EXP_PER_LEVEL = 100;

function levelUp(currentExp: number, gained: number) {
  const newExp = currentExp + gained;
  const newLevel = Math.floor(newExp / EXP_PER_LEVEL) + 1;
  return { newExp, newLevel };
}

type WorldSlug = "cultivation" | "cyberpunk" | "zombie";

const ENEMY_TEMPLATES: Record<WorldSlug, Array<{ name: string; type: string }>> = {
  cultivation: [
    { name: "Thạch Hổ Yêu", type: "Yêu Thú" },
    { name: "Huyết Ảnh Lang", type: "Yêu Thú" },
    { name: "Phong Linh Điểu", type: "Yêu Thú" },
    { name: "Tà Tu Hắc Bào", type: "Tà Tu" },
    { name: "Ma Đạo Sát Thủ", type: "Tà Tu" },
    { name: "Cổ Yêu Rễ Thần", type: "Yêu Thú" },
  ],
  cyberpunk: [
    { name: "Corp Soldier MK-II", type: "Corp Soldier" },
    { name: "Arasaka Guard Elite", type: "Corp Soldier" },
    { name: "Rogue AI NEXUS-7", type: "Rogue AI" },
    { name: "Ghost Protocol Bot", type: "Rogue AI" },
    { name: "Maelstrom Enforcer", type: "Corp Soldier" },
    { name: "Neural Wraith v3", type: "Rogue AI" },
  ],
  zombie: [
    { name: "Zombie Horde Alpha", type: "Zombie Horde" },
    { name: "Bloater Mutant", type: "Zombie Horde" },
    { name: "Raider Captain", type: "Raider" },
    { name: "Scavenger Ambush", type: "Raider" },
    { name: "Screamer Pack", type: "Zombie Horde" },
    { name: "Warlord Scout", type: "Raider" },
  ],
};

const BATTLE_MODES = ["turn-based", "real-time", "auto", "puzzle", "narrative", "dice"] as const;
type BattleMode = (typeof BATTLE_MODES)[number];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEnemy(worldSlug: string, characterLevel: number) {
  const slug = (["cultivation", "cyberpunk", "zombie"].includes(worldSlug) ? worldSlug : "cultivation") as WorldSlug;
  const template = pickRandom(ENEMY_TEMPLATES[slug]);
  const levelVariance = Math.floor(characterLevel * 0.2);
  const enemyLevel = Math.max(1, characterLevel + Math.floor(Math.random() * (levelVariance * 2 + 1)) - levelVariance);
  const hpMax = 80 + enemyLevel * 20;
  const atk = 10 + enemyLevel * 3;
  const def = 5 + enemyLevel * 2;
  return { ...template, level: enemyLevel, hpMax, atk, def };
}

router.get("/battle/history/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const history = await db
      .select()
      .from(battles)
      .where(eq(battles.characterId, characterId))
      .orderBy(battles.createdAt)
      .limit(limit);

    history.reverse();

    const stats = {
      total: history.length,
      win: history.filter(b => b.result === "win").length,
      lose: history.filter(b => b.result === "lose").length,
      draw: history.filter(b => b.result === "draw").length,
      totalExp: history.reduce((s, b) => s + (b.expGained ?? 0), 0),
      byMode: {} as Record<string, { total: number; win: number; lose: number; draw: number }>,
    };

    for (const b of history) {
      const m = b.battleMode;
      if (!stats.byMode[m]) stats.byMode[m] = { total: 0, win: 0, lose: 0, draw: 0 };
      stats.byMode[m].total++;
      if (b.result === "win") stats.byMode[m].win++;
      else if (b.result === "lose") stats.byMode[m].lose++;
      else if (b.result === "draw") stats.byMode[m].draw++;
    }

    res.json({ battles: history, stats });
  } catch {
    res.status(500).json({ message: "Failed to fetch battle history" });
  }
});

router.post("/battle/start", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, mode } = req.body;

    if (!characterId) return res.status(400).json({ message: "characterId required" });

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const worldSlug = (char.stats as any)?.world_slug ?? "cultivation";
    const enemy = generateEnemy(worldSlug, char.level);
    const battleMode: BattleMode = BATTLE_MODES.includes(mode) ? mode : pickRandom(BATTLE_MODES as unknown as BattleMode[]);

    res.json({ enemy, mode: battleMode, character: { id: char.id, name: char.name, level: char.level, exp: char.exp, stats: char.stats } });
  } catch (err) {
    res.status(500).json({ message: "Failed to start battle" });
  }
});

router.post("/battle/finish", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, enemyName, enemyLevel, battleMode, result, hpLeft, duration, metadata } = req.body;

    if (!characterId || !enemyName || !enemyLevel || !battleMode || !result) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!["win", "lose", "draw"].includes(result)) {
      return res.status(400).json({ message: "result must be win/lose/draw" });
    }

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const baseExp = enemyLevel * 10;
    const expGained = result === "win" ? baseExp : result === "draw" ? Math.floor(baseExp * 0.3) : 0;

    const [battle] = await db.insert(battles).values({
      characterId,
      enemyName,
      enemyLevel,
      battleMode,
      result,
      expGained,
      hpLeft: hpLeft ?? null,
      duration: duration ?? null,
      metadata: metadata ?? {},
    }).returning();

    const cultivationEnergyGained = result === "win" ? 20 : result === "draw" ? 10 : 0;
    const currentStats = (char.stats as any) ?? {};
    const currentEnergy = typeof currentStats.cultivationEnergy === "number" ? currentStats.cultivationEnergy : 100;
    const updatedStats = { ...currentStats, cultivationEnergy: currentEnergy + cultivationEnergyGained };

    let updatedChar = char;
    let leveledUp = false;

    if (expGained > 0 || cultivationEnergyGained > 0) {
      const { newExp, newLevel } = levelUp(char.exp, expGained);
      leveledUp = newLevel > char.level;
      const [updated] = await db.update(characters).set({
        exp: newExp,
        level: newLevel,
        stats: updatedStats,
      }).where(eq(characters.id, characterId)).returning();
      updatedChar = updated;
    }

    let droppedItem = null;
    const worldSlug = ((char.stats as any)?.world_slug ?? "cultivation") as string;
    if (shouldDropItem(result, enemyLevel)) {
      const template = pickDropItem(worldSlug, enemyLevel);
      if (template) {
        let [dbItem] = await db.select().from(items).where(
          and(eq(items.name, template.name), eq(items.worldSlug, template.worldSlug))
        );
        if (!dbItem) {
          const [inserted] = await db.insert(items).values({
            name: template.name,
            type: template.type,
            rarity: template.rarity,
            worldSlug: template.worldSlug,
            description: template.description,
            icon: template.icon,
            bonusStats: template.bonusStats,
          }).returning();
          dbItem = inserted;
        }
        const [invRow] = await db.insert(inventory).values({
          characterId,
          itemId: dbItem.id,
          quantity: 1,
        }).returning();
        droppedItem = { ...dbItem, inventoryId: invRow.id };
      }
    }

    if (leveledUp) {
      await saveAndNotify(userId, { type: "level_up", characterName: char.name, newLevel: updatedChar.level });
    }

    res.json({ battle, character: updatedChar, expGained, leveledUp, droppedItem, cultivationEnergyGained });
  } catch (err) {
    res.status(500).json({ message: "Failed to finish battle" });
  }
});

export default router;
