import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  worldTradeListings, worldTradeHistory,
  characters, items, inventory, customWorlds,
} from "@workspace/db/schema";
import { eq, and, desc, or, ne, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

function getGold(stats: unknown): number {
  return ((stats as any)?.gold ?? 0) as number;
}

const WORLD_LABELS: Record<string, string> = {
  cultivation: "Tu Tiên",
  cyberpunk: "Cyberpunk",
  zombie: "Vùng Hoang Phế",
  tu_tien: "Tu Tiên",
  fantasy: "Fantasy",
  horror: "Kinh Dị",
  scifi: "Khoa Học Viễn Tưởng",
  wasteland: "Hoang Phế",
  steampunk: "Steampunk",
  xianxia: "Tiên Hiệp",
};

async function renameItemCrossWorld(
  itemName: string, itemDesc: string, fromWorld: string, toWorld: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const from = WORLD_LABELS[fromWorld] ?? fromWorld;
    const to = WORLD_LABELS[toWorld] ?? toWorld;
    const prompt = `Item "${itemName}" (${itemDesc}) đến từ thế giới ${from} vừa vượt "Rào Cản Thế Giới" vào thế giới ${to}.
Do xung đột quy luật hai thế giới, item này được thế giới ${to} NHẬN THỨC LẠI với một tên mới phù hợp với lore của ${to}.
Ví dụ: "Laser Pistol" (Cyberpunk) → Tu Tiên → "Lôi Điện Linh Khí Pháo"
Chỉ trả về tên item mới (tiếng Việt, tối đa 20 ký tự), không giải thích.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().slice(0, 128);
  } catch {
    return `[${WORLD_LABELS[fromWorld] ?? fromWorld}] ${itemName}`;
  }
}

// GET /api/world-trade — danh sách listing active + filter
router.get("/api/world-trade", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { fromWorld, toWorld, myChar } = req.query as Record<string, string>;

    // Expire stale listings
    await db.update(worldTradeListings)
      .set({ status: "expired" })
      .where(and(eq(worldTradeListings.status, "active"), sql`expires_at < now()`));

    const rows = await db.select({
      listing: worldTradeListings,
      item: items,
      seller: { id: characters.id, name: characters.name, level: characters.level },
    }).from(worldTradeListings)
      .innerJoin(items, eq(worldTradeListings.itemId, items.id))
      .innerJoin(characters, eq(worldTradeListings.sellerCharacterId, characters.id))
      .where(eq(worldTradeListings.status, "active"))
      .orderBy(desc(worldTradeListings.createdAt))
      .limit(60);

    let result = rows;
    if (fromWorld) result = result.filter(r => r.listing.fromWorldSlug === fromWorld);
    if (toWorld) result = result.filter(r =>
      r.listing.toWorldSlug === "any" || r.listing.toWorldSlug === toWorld
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải danh sách giao thương" });
  }
});

// GET /api/world-trade/my-chars — nhân vật của user + gold + inventory
router.get("/api/world-trade/my-chars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!chars.length) return res.json([]);

    const result = await Promise.all(chars.map(async char => {
      const inv = await db.select({ invId: inventory.id, qty: inventory.quantity, item: items })
        .from(inventory)
        .innerJoin(items, eq(inventory.itemId, items.id))
        .where(eq(inventory.characterId, char.id));
      return { char, gold: getGold(char.stats), inventory: inv };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải nhân vật" });
  }
});

// GET /api/world-trade/history — lịch sử giao dịch
router.get("/api/world-trade/history", isAuthenticated, async (req, res) => {
  try {
    const history = await db.select({
      trade: worldTradeHistory,
      listing: worldTradeListings,
      item: items,
    }).from(worldTradeHistory)
      .innerJoin(worldTradeListings, eq(worldTradeHistory.listingId, worldTradeListings.id))
      .innerJoin(items, eq(worldTradeListings.itemId, items.id))
      .orderBy(desc(worldTradeHistory.soldAt))
      .limit(20);

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải lịch sử" });
  }
});

const listSchema = z.object({
  characterId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  priceGold: z.number().int().min(1).max(9999999),
  toWorldSlug: z.string().default("any"),
});

// POST /api/world-trade/list — đăng bán item
router.post("/api/world-trade/list", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const parsed = listSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { characterId, itemId, quantity, priceGold, toWorldSlug } = parsed.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [inv] = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, characterId), eq(inventory.itemId, itemId)));
    if (!inv || inv.quantity < quantity)
      return res.status(400).json({ error: `Không đủ số lượng trong túi (có ${inv?.quantity ?? 0})` });

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    if (!item) return res.status(404).json({ error: "Item không tồn tại" });

    // Trừ item từ inventory
    if (inv.quantity === quantity) {
      await db.delete(inventory).where(eq(inventory.id, inv.id));
    } else {
      await db.update(inventory).set({ quantity: inv.quantity - quantity }).where(eq(inventory.id, inv.id));
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    const [listing] = await db.insert(worldTradeListings).values({
      sellerCharacterId: characterId,
      fromWorldSlug: item.worldSlug,
      toWorldSlug,
      itemId,
      quantity,
      priceGold,
      expiresAt,
    }).returning();

    res.json({ listing, message: `Đã đăng bán ${item.name} x${quantity} với giá ${priceGold} vàng` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi đăng bán" });
  }
});

// POST /api/world-trade/:listingId/buy — mua item cross-world
router.post("/api/world-trade/:listingId/buy", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { listingId } = req.params as Record<string, string>;
    const { characterId } = req.body;

    if (!characterId) return res.status(400).json({ error: "Thiếu characterId" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [listing] = await db.select().from(worldTradeListings).where(eq(worldTradeListings.id, listingId));
    if (!listing || listing.status !== "active")
      return res.status(404).json({ error: "Listing không tồn tại hoặc đã hết hạn" });

    if (listing.sellerCharacterId === characterId)
      return res.status(400).json({ error: "Không thể mua item của chính mình" });

    const gold = getGold(char.stats);
    // Phí cổng 5% — tổng người mua trả = priceGold * 1.05
    const total = Math.ceil(listing.priceGold * 1.05);
    if (gold < total)
      return res.status(400).json({ error: `Không đủ vàng. Cần ${total} (gồm phí cổng 5%), có ${gold}` });

    const [item] = await db.select().from(items).where(eq(items.id, listing.itemId));
    if (!item) return res.status(404).json({ error: "Item không còn tồn tại" });

    // AI rename nếu cross-world
    let renamedItemName = item.name;
    const buyerWorldSlug = (char.stats as any)?.worldSlug ?? "";
    if (buyerWorldSlug && buyerWorldSlug !== listing.fromWorldSlug) {
      renamedItemName = await renameItemCrossWorld(item.name, item.description, listing.fromWorldSlug, buyerWorldSlug);
    }

    // Trừ gold người mua
    await db.update(characters).set({
      stats: { ...(char.stats as any), gold: gold - total },
    }).where(eq(characters.id, characterId));

    // Cộng gold người bán (giá gốc)
    const [seller] = await db.select().from(characters).where(eq(characters.id, listing.sellerCharacterId));
    if (seller) {
      await db.update(characters).set({
        stats: { ...(seller.stats as any), gold: getGold(seller.stats) + listing.priceGold },
      }).where(eq(characters.id, listing.sellerCharacterId));
    }

    // Cộng item vào inventory người mua
    const [existingInv] = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, characterId), eq(inventory.itemId, listing.itemId)));
    if (existingInv) {
      await db.update(inventory).set({ quantity: existingInv.quantity + listing.quantity })
        .where(eq(inventory.id, existingInv.id));
    } else {
      await db.insert(inventory).values({
        characterId,
        itemId: listing.itemId,
        quantity: listing.quantity,
      });
    }

    // Đánh dấu listing là sold
    await db.update(worldTradeListings).set({ status: "sold" }).where(eq(worldTradeListings.id, listingId));

    // Ghi lịch sử
    await db.insert(worldTradeHistory).values({
      listingId,
      buyerCharacterId: characterId,
      renamedItemName,
      priceGold: listing.priceGold,
    });

    res.json({
      success: true,
      renamedItemName,
      isCrossWorld: renamedItemName !== item.name,
      message: renamedItemName !== item.name
        ? `Đã mua "${item.name}" — qua Rào Cản Thế Giới, được nhận thức lại thành "${renamedItemName}"`
        : `Đã mua ${item.name} x${listing.quantity}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi mua item" });
  }
});

// DELETE /api/world-trade/:listingId/cancel — huỷ listing và hoàn lại item
router.delete("/api/world-trade/:listingId/cancel", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { listingId } = req.params as Record<string, string>;

    const rows = await db.select({ listing: worldTradeListings, char: characters })
      .from(worldTradeListings)
      .innerJoin(characters, eq(worldTradeListings.sellerCharacterId, characters.id))
      .where(and(eq(worldTradeListings.id, listingId), eq(characters.userId, userId)));

    if (!rows.length) return res.status(403).json({ error: "Không có quyền" });
    const { listing } = rows[0];
    if (listing.status !== "active") return res.status(400).json({ error: "Listing không còn active" });

    // Hoàn lại item vào inventory
    const [existingInv] = await db.select().from(inventory)
      .where(and(eq(inventory.characterId, listing.sellerCharacterId), eq(inventory.itemId, listing.itemId)));
    if (existingInv) {
      await db.update(inventory).set({ quantity: existingInv.quantity + listing.quantity })
        .where(eq(inventory.id, existingInv.id));
    } else {
      await db.insert(inventory).values({
        characterId: listing.sellerCharacterId,
        itemId: listing.itemId,
        quantity: listing.quantity,
      });
    }

    await db.update(worldTradeListings).set({ status: "cancelled" }).where(eq(worldTradeListings.id, listingId));
    res.json({ success: true, message: "Đã huỷ listing và hoàn lại item" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi huỷ listing" });
  }
});

export default router;
