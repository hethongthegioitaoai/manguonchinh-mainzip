import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { auctionListings, auctionBids, characters, items, inventory } from "@workspace/db/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function getGold(stats: unknown): number {
  return ((stats as any)?.gold ?? 0) as number;
}

async function setGold(charId: string, newGold: number) {
  await db.update(characters)
    .set({ stats: sql`stats || jsonb_build_object('gold', ${newGold})` })
    .where(eq(characters.id, charId));
}

async function settleExpiredAuctions() {
  const expired = await db.select().from(auctionListings)
    .where(and(eq(auctionListings.status, "active"), sql`expires_at < now()`));

  for (const listing of expired) {
    if (listing.currentBidderId) {
      // Winner gets item
      const existingInv = await db.select().from(inventory)
        .where(and(eq(inventory.characterId, listing.currentBidderId), eq(inventory.itemId, listing.itemId)))
        .limit(1);
      if (existingInv.length > 0) {
        await db.update(inventory)
          .set({ quantity: existingInv[0].quantity + listing.quantity })
          .where(eq(inventory.id, existingInv[0].id));
      } else {
        await db.insert(inventory).values({
          characterId: listing.currentBidderId,
          itemId: listing.itemId,
          quantity: listing.quantity,
        });
      }
      // Seller gets gold
      const seller = await db.select().from(characters).where(eq(characters.id, listing.sellerCharId)).limit(1);
      if (seller[0]) {
        await setGold(listing.sellerCharId, getGold(seller[0].stats) + listing.currentBid);
      }
      await db.update(auctionListings).set({ status: "sold" }).where(eq(auctionListings.id, listing.id));
    } else {
      // No bidder — return item to seller
      const existingInv = await db.select().from(inventory)
        .where(and(eq(inventory.characterId, listing.sellerCharId), eq(inventory.itemId, listing.itemId)))
        .limit(1);
      if (existingInv.length > 0) {
        await db.update(inventory)
          .set({ quantity: existingInv[0].quantity + listing.quantity })
          .where(eq(inventory.id, existingInv[0].id));
      } else {
        await db.insert(inventory).values({
          characterId: listing.sellerCharId,
          itemId: listing.itemId,
          quantity: listing.quantity,
        });
      }
      await db.update(auctionListings).set({ status: "expired" }).where(eq(auctionListings.id, listing.id));
    }
  }
}

// GET /api/auction/list — danh sách đấu giá active (auto-settle expired)
router.get("/auction/list", isAuthenticated, async (req, res) => {
  try {
    await settleExpiredAuctions();
    const { worldSlug } = req.query as Record<string, string>;

    const rows = await db.select({
      listing: auctionListings,
      seller: { id: characters.id, name: characters.name, level: characters.level },
    }).from(auctionListings)
      .innerJoin(characters, eq(auctionListings.sellerCharId, characters.id))
      .where(eq(auctionListings.status, "active"))
      .orderBy(desc(auctionListings.createdAt))
      .limit(60);

    const result = worldSlug ? rows.filter(r => r.listing.worldSlug === worldSlug) : rows;
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/auction/my — listings + bids của tôi
router.get("/auction/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const myChars = await db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId));
    const charIds = myChars.map(c => c.id);
    if (charIds.length === 0) return res.json({ listings: [], bids: [] });

    const listings = await db.select().from(auctionListings)
      .where(sql`seller_char_id = ANY(${charIds})`)
      .orderBy(desc(auctionListings.createdAt))
      .limit(30);

    const bids = await db.select({
      bid: auctionBids,
      listing: auctionListings,
    }).from(auctionBids)
      .innerJoin(auctionListings, eq(auctionBids.auctionId, auctionListings.id))
      .where(sql`auction_bids.bidder_char_id = ANY(${charIds})`)
      .orderBy(desc(auctionBids.bidAt))
      .limit(30);

    res.json({ listings, bids });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/auction/my-chars — nhân vật + inventory
router.get("/auction/my-chars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars = await db.select().from(characters).where(eq(characters.userId, userId));
    const result = await Promise.all(chars.map(async (c) => {
      const inv = await db.select({ inv: inventory, item: items })
        .from(inventory)
        .innerJoin(items, eq(inventory.itemId, items.id))
        .where(and(eq(inventory.characterId, c.id), sql`quantity > 0`))
        .orderBy(items.rarity);
      return { character: c, inventory: inv };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

const listSchema = z.object({
  charId: z.string().uuid(),
  inventoryId: z.string().uuid(),
  startBid: z.number().int().min(1),
  buyoutPrice: z.number().int().min(1).optional(),
  durationHours: z.number().int().min(1).max(48).default(24),
});

// POST /api/auction/list-item — đăng item lên đấu giá
router.post("/auction/list-item", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const body = listSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    const { charId, inventoryId, startBid, buyoutPrice, durationHours } = body.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [inv] = await db.select({ inv: inventory, item: items })
      .from(inventory)
      .innerJoin(items, eq(inventory.itemId, items.id))
      .where(and(eq(inventory.id, inventoryId), eq(inventory.characterId, charId)));
    if (!inv) return res.status(404).json({ message: "Không tìm thấy vật phẩm" });
    if (inv.inv.quantity < 1) return res.status(400).json({ message: "Số lượng không đủ" });

    const equippedSlot = inv.inv.equippedSlot;
    if (equippedSlot) return res.status(400).json({ message: "Không thể đấu giá vật phẩm đang trang bị" });

    // Reduce inventory
    if (inv.inv.quantity === 1) {
      await db.delete(inventory).where(eq(inventory.id, inventoryId));
    } else {
      await db.update(inventory).set({ quantity: inv.inv.quantity - 1 }).where(eq(inventory.id, inventoryId));
    }

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);
    const [listing] = await db.insert(auctionListings).values({
      sellerCharId: charId,
      itemId: inv.item.id,
      itemName: inv.item.name,
      itemIcon: inv.item.icon,
      itemRarity: inv.item.rarity,
      worldSlug: char.stats ? (char.stats as any).world_slug ?? "cultivation" : "cultivation",
      startBid,
      currentBid: startBid,
      buyoutPrice: buyoutPrice ?? null,
      quantity: 1,
      status: "active",
      expiresAt,
    }).returning();

    res.status(201).json(listing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

const bidSchema = z.object({ charId: z.string().uuid(), amount: z.number().int().min(1) });

// POST /api/auction/:id/bid — đặt giá
router.post("/auction/:id/bid", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const auctionId = req.params.id as string;
    const body = bidSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    const { charId, amount } = body.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [listing] = await db.select().from(auctionListings)
      .where(and(eq(auctionListings.id, auctionId), eq(auctionListings.status, "active")));
    if (!listing) return res.status(404).json({ message: "Phiên đấu giá không tồn tại" });
    if (listing.expiresAt < new Date()) return res.status(400).json({ message: "Phiên đấu giá đã kết thúc" });
    if (listing.sellerCharId === charId) return res.status(400).json({ message: "Không thể đặt giá vật phẩm của mình" });
    if (amount <= listing.currentBid) return res.status(400).json({ message: `Giá phải cao hơn ${listing.currentBid} vàng` });

    const gold = getGold(char.stats);
    if (gold < amount) return res.status(400).json({ message: `Không đủ vàng (có ${gold}, cần ${amount})` });

    // Refund previous bidder
    if (listing.currentBidderId && listing.currentBidderId !== listing.sellerCharId) {
      const [prevBidder] = await db.select().from(characters).where(eq(characters.id, listing.currentBidderId));
      if (prevBidder) {
        await setGold(listing.currentBidderId, getGold(prevBidder.stats) + listing.currentBid);
      }
    }

    // Deduct gold from new bidder
    await setGold(charId, gold - amount);

    // Update auction
    await db.update(auctionListings)
      .set({ currentBid: amount, currentBidderId: charId })
      .where(eq(auctionListings.id, auctionId));

    // Record bid
    await db.insert(auctionBids).values({ auctionId, bidderCharId: charId, bidAmount: amount });

    res.json({ ok: true, newBid: amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/auction/:id/buyout — mua ngay
router.post("/auction/:id/buyout", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const auctionId = req.params.id as string;
    const charId = z.string().uuid().parse(req.body.charId);

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [listing] = await db.select().from(auctionListings)
      .where(and(eq(auctionListings.id, auctionId), eq(auctionListings.status, "active")));
    if (!listing || !listing.buyoutPrice) return res.status(404).json({ message: "Không có giá mua ngay" });
    if (listing.expiresAt < new Date()) return res.status(400).json({ message: "Phiên đã kết thúc" });
    if (listing.sellerCharId === charId) return res.status(400).json({ message: "Không thể mua vật phẩm của mình" });

    const gold = getGold(char.stats);
    if (gold < listing.buyoutPrice) return res.status(400).json({ message: `Không đủ vàng (cần ${listing.buyoutPrice})` });

    // Refund current bidder if any
    if (listing.currentBidderId && listing.currentBidderId !== charId) {
      const [prevBidder] = await db.select().from(characters).where(eq(characters.id, listing.currentBidderId));
      if (prevBidder) {
        await setGold(listing.currentBidderId, getGold(prevBidder.stats) + listing.currentBid);
      }
    }

    // Deduct from buyer
    await setGold(charId, gold - listing.buyoutPrice);

    // Give gold to seller
    const [seller] = await db.select().from(characters).where(eq(characters.id, listing.sellerCharId));
    if (seller) await setGold(listing.sellerCharId, getGold(seller.stats) + listing.buyoutPrice);

    // Transfer item to buyer
    const existingInv = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, charId), eq(inventory.itemId, listing.itemId))).limit(1);
    if (existingInv.length > 0) {
      await db.update(inventory).set({ quantity: existingInv[0].quantity + listing.quantity }).where(eq(inventory.id, existingInv[0].id));
    } else {
      await db.insert(inventory).values({ characterId: charId, itemId: listing.itemId, quantity: listing.quantity });
    }

    await db.update(auctionListings).set({ status: "sold", currentBidderId: charId }).where(eq(auctionListings.id, auctionId));

    res.json({ ok: true, itemName: listing.itemName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// DELETE /api/auction/:id/cancel — huỷ đấu giá (chỉ seller, chưa có bid)
router.delete("/auction/:id/cancel", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const auctionId = req.params.id as string;
    const charId = z.string().uuid().parse(req.body.charId);

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [listing] = await db.select().from(auctionListings)
      .where(and(eq(auctionListings.id, auctionId), eq(auctionListings.sellerCharId, charId), eq(auctionListings.status, "active")));
    if (!listing) return res.status(404).json({ message: "Không tìm thấy phiên đấu giá" });

    if (listing.currentBidderId) return res.status(400).json({ message: "Không thể huỷ khi đã có người đặt giá" });

    // Return item to seller
    const existingInv = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, charId), eq(inventory.itemId, listing.itemId))).limit(1);
    if (existingInv.length > 0) {
      await db.update(inventory).set({ quantity: existingInv[0].quantity + listing.quantity }).where(eq(inventory.id, existingInv[0].id));
    } else {
      await db.insert(inventory).values({ characterId: charId, itemId: listing.itemId, quantity: listing.quantity });
    }

    await db.update(auctionListings).set({ status: "cancelled" }).where(eq(auctionListings.id, auctionId));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
