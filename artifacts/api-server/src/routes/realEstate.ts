import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { landPlots, landTransactions, characters } from "@workspace/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const INCOME_PER_HOUR: Record<string, number> = {
  farmland:  5,
  shop:      15,
  mine:      25,
  residence: 8,
};

const BASE_PRICE: Record<string, number> = {
  farmland:  500,
  shop:      2000,
  mine:      5000,
  residence: 1000,
};

const PLOT_NAMES: Record<string, string[]> = {
  farmland:  ["Linh Điền Phúc Địa", "Ngọc Điền Tiên Thổ", "Kim Điền Cát Địa", "Thần Nông Bảo Điền", "Thiên Phúc Linh Địa", "Thanh Vân Điền Thổ", "Hồng Vân Nông Trang", "Bích Ngọc Điền Viên", "Long Hổ Điền Địa", "Kim Phúc Linh Nông"],
  shop:      ["Thiên Long Thương Điếm", "Bảo Long Cửa Hàng", "Kim Khẩu Thương Gia", "Linh Bảo Đại Điếm", "Phượng Hoàng Thương Hội", "Cát Tường Thương Điếm", "Thần Bảo Tiệm Đặc Biệt", "Vạn Bảo Thương Điếm", "Thiên Thành Đại Thương", "Kim Ngân Thương Hội"],
  mine:      ["Huyền Thiết Mỏ Sâu", "Tinh Vân Khoáng Huyệt", "Long Nha Đá Quý", "Thiên Vân Mỏ Tinh", "Kim Cương Khoáng Mạch", "Thiên Lôi Mỏ Thần", "Hắc Diệm Khoáng Địa", "Thần Lực Mỏ Tiên", "Đại Mạch Tinh Thạch", "Kim Quang Khoáng Huyệt"],
  residence: ["Bích Vân Cung Điện", "Linh Sơn Biệt Viện", "Thiên Phong Cư Sở", "Ngọc Bảo Miếu Đường", "Phong Vân Cư Thất", "Hoa Viên Thần Cư", "Linh Tháp Cư Sở", "Vạn Hoa Cung", "Thiên Không Cư Viện", "Bạch Vân Biệt Thự"],
};

async function seedPlotsForWorld(worldSlug: string) {
  const existing = await db.select().from(landPlots).where(eq(landPlots.worldSlug, worldSlug));
  if (existing.length >= 30) return;

  const types: Array<keyof typeof INCOME_PER_HOUR> = ["farmland", "farmland", "farmland", "farmland", "farmland", "farmland", "farmland", "farmland", "farmland", "farmland", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "shop", "mine", "mine", "mine", "mine", "mine", "residence", "residence", "residence", "residence", "residence"];

  for (const plotType of types) {
    const namePool = PLOT_NAMES[plotType];
    const plotName = namePool[Math.floor(Math.random() * namePool.length)] + " " + (Math.floor(Math.random() * 99) + 1);
    const price = BASE_PRICE[plotType] * (1 + Math.floor(Math.random() * 3));
    await db.insert(landPlots).values({
      worldSlug, plotName, plotType, tier: 1,
      baseIncome: INCOME_PER_HOUR[plotType],
      purchasePrice: price,
      isForSale: true,
      salePrice: price,
    }).onConflictDoNothing();
  }
}

function calcIncome(plot: any): number {
  const now = Date.now();
  const last = new Date(plot.lastCollectedAt ?? plot.purchasedAt ?? now).getTime();
  const hoursElapsed = (now - last) / 3600000;
  const incomePerH = (INCOME_PER_HOUR[plot.plotType] ?? 5) * plot.upgradeLevel;
  return Math.floor(hoursElapsed * incomePerH);
}

/* ─────────────────────────────────────────────────────
   GET /api/realestate/:worldSlug — tất cả plots
───────────────────────────────────────────────────── */
router.get("/api/realestate/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    await seedPlotsForWorld(worldSlug);
    const plots = await db.select().from(landPlots).where(eq(landPlots.worldSlug, worldSlug));
    res.json(plots);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/realestate/my-plots — plots của nhân vật hiện tại
───────────────────────────────────────────────────── */
router.get("/api/realestate/my-plots", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.json([]);
    const plots = await db.select().from(landPlots).where(eq(landPlots.ownerCharId, char.id));
    const plotsWithPending = plots.map(p => ({ ...p, pendingIncome: calcIncome(p) }));
    res.json(plotsWithPending);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/realestate/buy/:plotId — mua đất
───────────────────────────────────────────────────── */
router.post("/api/realestate/buy/:plotId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { plotId } = req.params;

    const [plot] = await db.select().from(landPlots).where(eq(landPlots.id, plotId));
    if (!plot) return res.status(404).json({ message: "Không tìm thấy đất" });
    if (!plot.isForSale) return res.status(400).json({ message: "Đất không phải rao bán" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const price = plot.salePrice ?? plot.purchasePrice;
    if ((char.gold ?? 0) < price) return res.status(400).json({ message: `Cần ${price} gold` });

    // Hoàn tiền cho chủ cũ (nếu có)
    if (plot.ownerCharId) {
      const [oldOwner] = await db.select().from(characters).where(eq(characters.id, plot.ownerCharId));
      if (oldOwner) {
        await db.update(characters).set({ gold: (oldOwner.gold ?? 0) + price }).where(eq(characters.id, oldOwner.id));
      }
    }

    await db.update(characters).set({ gold: (char.gold ?? 0) - price }).where(eq(characters.id, char.id));
    const [updated] = await db.update(landPlots).set({
      ownerCharId: char.id, ownerCharName: char.name, ownerId: userId,
      isForSale: false, salePrice: null, purchasedAt: new Date(), lastCollectedAt: new Date(),
    }).where(eq(landPlots.id, plotId)).returning();

    await db.insert(landTransactions).values({ plotId, fromCharId: plot.ownerCharId ?? undefined, toCharId: char.id, transactionType: "purchase", amount: price });

    res.json({ plot: updated, message: `Đã mua ${plot.plotName} với giá ${price} gold!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/realestate/sell/:plotId — rao bán đất
───────────────────────────────────────────────────── */
router.post("/api/realestate/sell/:plotId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { plotId } = req.params;
    const { salePrice } = z.object({ salePrice: z.number().int().min(1) }).parse(req.body);

    const [plot] = await db.select().from(landPlots).where(eq(landPlots.id, plotId));
    if (!plot || plot.ownerId !== userId) return res.status(403).json({ message: "Bạn không sở hữu đất này" });

    const [updated] = await db.update(landPlots).set({ isForSale: true, salePrice }).where(eq(landPlots.id, plotId)).returning();
    res.json({ plot: updated, message: `Đã rao bán với giá ${salePrice} gold` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/realestate/upgrade/:plotId — nâng cấp
───────────────────────────────────────────────────── */
router.post("/api/realestate/upgrade/:plotId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { plotId } = req.params;

    const [plot] = await db.select().from(landPlots).where(eq(landPlots.id, plotId));
    if (!plot || plot.ownerId !== userId) return res.status(403).json({ message: "Bạn không sở hữu đất này" });
    if (plot.upgradeLevel >= 5) return res.status(400).json({ message: "Đã đạt cấp độ tối đa (5)" });

    const upgradeCost = plot.purchasePrice * plot.upgradeLevel;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char || (char.gold ?? 0) < upgradeCost) return res.status(400).json({ message: `Cần ${upgradeCost} gold để nâng cấp` });

    await db.update(characters).set({ gold: (char.gold ?? 0) - upgradeCost }).where(eq(characters.id, char.id));
    const [updated] = await db.update(landPlots)
      .set({ upgradeLevel: plot.upgradeLevel + 1 }).where(eq(landPlots.id, plotId)).returning();

    await db.insert(landTransactions).values({ plotId, fromCharId: char.id, transactionType: "upgrade", amount: upgradeCost, notes: `Nâng lên cấp ${plot.upgradeLevel + 1}` });

    res.json({ plot: updated, message: `Nâng cấp thành công! Cấp ${plot.upgradeLevel + 1} — thu nhập tăng 50%` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/realestate/collect/:plotId — thu nhập 1 plot
───────────────────────────────────────────────────── */
router.post("/api/realestate/collect/:plotId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { plotId } = req.params;

    const [plot] = await db.select().from(landPlots).where(eq(landPlots.id, plotId));
    if (!plot || plot.ownerId !== userId) return res.status(403).json({ message: "Bạn không sở hữu đất này" });

    const income = calcIncome(plot);
    if (income <= 0) return res.status(400).json({ message: "Chưa có thu nhập để thu" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    await db.update(characters).set({ gold: (char.gold ?? 0) + income }).where(eq(characters.id, char.id));
    const [updated] = await db.update(landPlots).set({ lastCollectedAt: new Date() }).where(eq(landPlots.id, plotId)).returning();

    await db.insert(landTransactions).values({ plotId, toCharId: char.id, transactionType: "income", amount: income });

    res.json({ plot: updated, income, message: `Thu được ${income} gold từ ${plot.plotName}!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/realestate/collect-all — thu tất cả
───────────────────────────────────────────────────── */
router.post("/api/realestate/collect-all", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const plots = await db.select().from(landPlots).where(eq(landPlots.ownerCharId, char.id));
    let totalIncome = 0;

    for (const plot of plots) {
      const income = calcIncome(plot);
      if (income > 0) {
        totalIncome += income;
        await db.update(landPlots).set({ lastCollectedAt: new Date() }).where(eq(landPlots.id, plot.id));
        await db.insert(landTransactions).values({ plotId: plot.id, toCharId: char.id, transactionType: "income", amount: income });
      }
    }

    if (totalIncome > 0) {
      await db.update(characters).set({ gold: (char.gold ?? 0) + totalIncome }).where(eq(characters.id, char.id));
    }

    res.json({ totalIncome, message: totalIncome > 0 ? `Thu được ${totalIncome} gold từ ${plots.length} mảnh đất!` : "Chưa có thu nhập nào cả" });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
