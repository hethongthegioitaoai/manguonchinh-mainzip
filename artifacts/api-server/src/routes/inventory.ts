import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { inventory, items, characters } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/inventory/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const rows = await db
      .select({
        id: inventory.id,
        characterId: inventory.characterId,
        itemId: inventory.itemId,
        quantity: inventory.quantity,
        equippedSlot: inventory.equippedSlot,
        acquiredAt: inventory.acquiredAt,
        item: {
          id: items.id,
          name: items.name,
          type: items.type,
          rarity: items.rarity,
          worldSlug: items.worldSlug,
          description: items.description,
          icon: items.icon,
          bonusStats: items.bonusStats,
        },
      })
      .from(inventory)
      .innerJoin(items, eq(inventory.itemId, items.id))
      .where(eq(inventory.characterId, characterId))
      .orderBy(inventory.acquiredAt);

    rows.reverse();
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
});

router.post("/inventory/equip", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { inventoryId, slot } = req.body;

    if (!inventoryId) return res.status(400).json({ message: "inventoryId required" });

    const [inv] = await db.select({
      id: inventory.id,
      characterId: inventory.characterId,
      itemId: inventory.itemId,
      equippedSlot: inventory.equippedSlot,
      item: {
        id: items.id,
        type: items.type,
      },
    })
      .from(inventory)
      .innerJoin(items, eq(inventory.itemId, items.id))
      .where(eq(inventory.id, inventoryId));

    if (!inv) return res.status(404).json({ message: "Inventory item not found" });

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, inv.characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(403).json({ message: "Forbidden" });

    if (inv.item.type === "consumable") {
      return res.status(400).json({ message: "Consumable items cannot be equipped" });
    }

    const targetSlot = slot ?? inv.item.type;

    if (inv.equippedSlot === targetSlot) {
      const [updated] = await db
        .update(inventory)
        .set({ equippedSlot: null })
        .where(eq(inventory.id, inventoryId))
        .returning();
      return res.json({ action: "unequipped", inventory: updated });
    }

    await db
      .update(inventory)
      .set({ equippedSlot: null })
      .where(
        and(eq(inventory.characterId, inv.characterId), eq(inventory.equippedSlot, targetSlot))
      );

    const [updated] = await db
      .update(inventory)
      .set({ equippedSlot: targetSlot })
      .where(eq(inventory.id, inventoryId))
      .returning();

    res.json({ action: "equipped", inventory: updated });
  } catch {
    res.status(500).json({ message: "Failed to equip item" });
  }
});

export default router;
