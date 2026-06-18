import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { marketPrices, items, inventory, characters, worldResources } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const RARITY_BASE: Record<string, number> = {
  common: 50, uncommon: 150, rare: 350, epic: 700, legendary: 1500,
};

const DEFAULT_GOLD = 500;

function getGold(stats: any): number {
  return typeof stats?.gold === "number" ? stats.gold : DEFAULT_GOLD;
}

function calcSupplyLevel(pct: number): string {
  if (pct >= 0.75) return "abundant";
  if (pct >= 0.4)  return "normal";
  if (pct >= 0.15) return "scarce";
  return "depleted";
}

function calcDemandLevel(worldSlug: string, itemType: string): string {
  const seed = (worldSlug.charCodeAt(0) + itemType.charCodeAt(0) + Math.floor(Date.now() / 3_600_000)) % 4;
  return ["low", "normal", "high", "frenzy"][seed];
}

function calcPrice(base: number, supply: string, demand: string): number {
  const sMap: Record<string, number> = { abundant: 0.8, normal: 1.0, scarce: 1.3, depleted: 1.8 };
  const dMap: Record<string, number> = { low: 0.85, normal: 1.0, high: 1.2, frenzy: 1.5 };
  const price = Math.round(base * (sMap[supply] ?? 1) * (dMap[demand] ?? 1));
  return Math.max(1, price);
}

async function getAvgResourcePct(worldSlug: string): Promise<number> {
  const rows = await db.select().from(worldResources).where(eq(worldResources.worldSlug, worldSlug));
  if (!rows.length) return 0.5;
  const pcts = rows.map((r) => r.quantity / Math.max(r.maxQuantity, 1));
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

async function ensureMarketPrices(worldSlug: string) {
  const existing = await db
    .select({ id: marketPrices.id })
    .from(marketPrices)
    .where(eq(marketPrices.worldSlug, worldSlug))
    .limit(1);

  const resourcePct = await getAvgResourcePct(worldSlug);
  const supplyLevel = calcSupplyLevel(resourcePct);

  if (existing.length === 0) {
    const worldItems = await db.select().from(items).where(eq(items.worldSlug, worldSlug));
    if (worldItems.length === 0) return;
    for (const item of worldItems) {
      const base = RARITY_BASE[item.rarity] ?? 100;
      const demand = calcDemandLevel(worldSlug, item.type);
      const current = calcPrice(base, supplyLevel, demand);
      await db.insert(marketPrices).values({
        worldSlug, itemId: item.id, basePrice: base,
        currentPrice: current, supplyLevel, demandLevel: demand,
      }).onConflictDoNothing();
    }
  } else {
    const allPrices = await db.select().from(marketPrices).where(eq(marketPrices.worldSlug, worldSlug));
    for (const mp of allPrices) {
      const [item] = await db.select({ type: items.type }).from(items).where(eq(items.id, mp.itemId));
      if (!item) continue;
      const demand = calcDemandLevel(worldSlug, item.type);
      const current = calcPrice(mp.basePrice, supplyLevel, demand);
      await db.update(marketPrices)
        .set({ currentPrice: current, supplyLevel, demandLevel: demand, updatedAt: new Date() })
        .where(eq(marketPrices.id, mp.id));
    }
  }
}

router.get("/market/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    await ensureMarketPrices(worldSlug);

    const rows = await db.select({
      id: marketPrices.id,
      worldSlug: marketPrices.worldSlug,
      itemId: marketPrices.itemId,
      basePrice: marketPrices.basePrice,
      currentPrice: marketPrices.currentPrice,
      supplyLevel: marketPrices.supplyLevel,
      demandLevel: marketPrices.demandLevel,
      updatedAt: marketPrices.updatedAt,
      item: {
        id: items.id,
        name: items.name,
        type: items.type,
        rarity: items.rarity,
        description: items.description,
        icon: items.icon,
        bonusStats: items.bonusStats,
      },
    })
      .from(marketPrices)
      .innerJoin(items, eq(marketPrices.itemId, items.id))
      .where(eq(marketPrices.worldSlug, worldSlug))
      .orderBy(items.rarity, items.name);

    const resourcePct = await getAvgResourcePct(worldSlug);
    res.json({ items: rows, resourceLevel: Math.round(resourcePct * 100) });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch market" });
  }
});

router.get("/market/:worldSlug/gold/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;
    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });
    res.json({ gold: getGold(char.stats) });
  } catch {
    res.status(500).json({ message: "Failed to fetch gold" });
  }
});

const buySchema = z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(99).default(1) });

router.post("/market/:worldSlug/buy", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const parsed = buySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "itemId required" });
    const { itemId, quantity } = parsed.data;

    const characterId = req.body.characterId as string;
    if (!characterId) return res.status(400).json({ message: "characterId required" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [mp] = await db.select().from(marketPrices)
      .where(and(eq(marketPrices.worldSlug, worldSlug), eq(marketPrices.itemId, itemId)));
    if (!mp) return res.status(404).json({ message: "Item not on market" });

    const total = mp.currentPrice * quantity;
    const gold = getGold(char.stats);
    if (gold < total) return res.status(400).json({ message: `Không đủ vàng. Cần ${total}, có ${gold}` });

    const newGold = gold - total;
    const updatedStats = { ...(char.stats as any), gold: newGold };
    await db.update(characters).set({ stats: updatedStats }).where(eq(characters.id, characterId));

    const [existingInv] = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, characterId), eq(inventory.itemId, itemId)));
    if (existingInv) {
      await db.update(inventory).set({ quantity: existingInv.quantity + quantity })
        .where(eq(inventory.id, existingInv.id));
    } else {
      await db.insert(inventory).values({ characterId, itemId, quantity });
    }

    const demandBump = ["low", "normal", "high", "frenzy"];
    const currentIdx = demandBump.indexOf(mp.demandLevel);
    const newDemand = demandBump[Math.min(currentIdx + 1, 3)];
    const newPrice = calcPrice(mp.basePrice, mp.supplyLevel, newDemand);
    await db.update(marketPrices)
      .set({ demandLevel: newDemand, currentPrice: newPrice, updatedAt: new Date() })
      .where(eq(marketPrices.id, mp.id));

    res.json({ gold: newGold, spent: total, quantity, newDemand, newPrice });
  } catch {
    res.status(500).json({ message: "Failed to buy item" });
  }
});

const sellSchema = z.object({ inventoryId: z.string().uuid(), quantity: z.number().int().min(1).max(99).default(1) });

router.post("/market/:worldSlug/sell", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const parsed = sellSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "inventoryId required" });
    const { inventoryId, quantity } = parsed.data;

    const characterId = req.body.characterId as string;
    if (!characterId) return res.status(400).json({ message: "characterId required" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [inv] = await db.select().from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.characterId, characterId)));
    if (!inv) return res.status(404).json({ message: "Item not in inventory" });
    if (inv.quantity < quantity) return res.status(400).json({ message: `Chỉ có ${inv.quantity} cái` });

    const [mp] = await db.select().from(marketPrices)
      .where(and(eq(marketPrices.worldSlug, worldSlug), eq(marketPrices.itemId, inv.itemId)));
    const sellPrice = mp ? Math.floor(mp.currentPrice * 0.6) : 10;
    const total = sellPrice * quantity;

    const gold = getGold(char.stats);
    const newGold = gold + total;
    const updatedStats = { ...(char.stats as any), gold: newGold };
    await db.update(characters).set({ stats: updatedStats }).where(eq(characters.id, characterId));

    if (inv.quantity === quantity) {
      await db.delete(inventory).where(eq(inventory.id, inventoryId));
    } else {
      await db.update(inventory).set({ quantity: inv.quantity - quantity }).where(eq(inventory.id, inventoryId));
    }

    if (mp) {
      const supplyBump = ["depleted", "scarce", "normal", "abundant"];
      const currentIdx = supplyBump.indexOf(mp.supplyLevel);
      const newSupply = supplyBump[Math.min(currentIdx + 1, 3)];
      const newPrice = calcPrice(mp.basePrice, newSupply, mp.demandLevel);
      await db.update(marketPrices)
        .set({ supplyLevel: newSupply, currentPrice: newPrice, updatedAt: new Date() })
        .where(eq(marketPrices.id, mp.id));
    }

    res.json({ gold: newGold, earned: total, quantity });
  } catch {
    res.status(500).json({ message: "Failed to sell item" });
  }
});

export default router;
