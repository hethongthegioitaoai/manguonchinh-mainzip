import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldCurrencies, worldTreasury, currencyExchanges, characters } from "@workspace/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/* ─── Helper: tạo Gemini content ─── */
async function geminiText(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/* ─── Helper: lấy character của user ─── */
async function getUserChar(userId: string, charId: string) {
  const [char] = await db.select().from(characters)
    .where(and(eq(characters.id, charId), eq(characters.userId, userId)));
  return char;
}

function getGold(stats: unknown): number { return ((stats as any)?.gold ?? 0) as number; }

/* ─── RATE fluctuation: mỗi giao dịch lớn tác động nhỏ đến tỷ giá ─── */
async function adjustRate(worldSlug: string, direction: "up" | "down", amount: number) {
  const [cur] = await db.select().from(worldCurrencies).where(eq(worldCurrencies.worldSlug, worldSlug));
  if (!cur) return;
  const currentRate = parseFloat(cur.exchangeRateToGold as string);
  const impact = Math.min(amount / 10000, 0.05); // max ±5%
  const newRate = direction === "up"
    ? currentRate * (1 + impact)
    : currentRate * (1 - impact);
  const clamped = Math.max(0.01, Math.min(newRate, 1000));
  await db.update(worldCurrencies)
    .set({ exchangeRateToGold: clamped.toFixed(4) })
    .where(eq(worldCurrencies.worldSlug, worldSlug));
}

/* ───────────────────────────────────────────────
   GET /api/world-economy/rates — tỷ giá tất cả thế giới
─────────────────────────────────────────────── */
router.get("/api/world-economy/rates", isAuthenticated, async (_req, res) => {
  try {
    const currencies = await db.select().from(worldCurrencies)
      .orderBy(desc(worldCurrencies.volume24h));
    const treasuries = await db.select().from(worldTreasury);
    const tMap = new Map(treasuries.map(t => [t.worldSlug, t]));
    const data = currencies.map(c => ({
      ...c,
      treasury: tMap.get(c.worldSlug) ?? null,
    }));
    res.json(data);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   GET /api/world-economy/history — lịch sử giao dịch
─────────────────────────────────────────────── */
router.get("/api/world-economy/history", isAuthenticated, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "30"), 100);
    const history = await db.select().from(currencyExchanges)
      .orderBy(desc(currencyExchanges.executedAt)).limit(limit);
    res.json(history);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   GET /api/world-economy/:worldSlug — chi tiết 1 thế giới
─────────────────────────────────────────────── */
router.get("/api/world-economy/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const [currency] = await db.select().from(worldCurrencies).where(eq(worldCurrencies.worldSlug, worldSlug));
    const [treasury] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, worldSlug));

    // 24h volume
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const recentExchanges = await db.select().from(currencyExchanges)
      .where(and(
        sql`(from_world_slug = ${worldSlug} OR to_world_slug = ${worldSlug})`,
        gte(currencyExchanges.executedAt, since24h)
      )).orderBy(desc(currencyExchanges.executedAt)).limit(20);

    res.json({ currency: currency ?? null, treasury: treasury ?? null, recentExchanges });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   GET /api/world-economy/my-worlds — thế giới user sở hữu (để setup)
─────────────────────────────────────────────── */
router.get("/api/world-economy/my-worlds", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    // Lấy từ custom_worlds nếu có, hoặc return builtin worlds của user
    const result = await db.execute(
      sql`SELECT id, slug, name, description, theme, creator_user_id
          FROM custom_worlds WHERE creator_user_id = ${userId} ORDER BY created_at DESC`
    );
    res.json(result.rows ?? []);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   GET /api/world-economy/my-characters — nhân vật user để giao dịch
─────────────────────────────────────────────── */
router.get("/api/world-economy/my-characters", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars = await db.select().from(characters).where(eq(characters.userId, userId));
    res.json(chars);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   POST /api/world-economy/setup — creator setup tiền tệ (AI đặt tên)
─────────────────────────────────────────────── */
router.post("/api/world-economy/setup", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug, worldName, worldTheme, customName, customSymbol } = z.object({
      worldSlug:   z.string().min(1),
      worldName:   z.string().min(1),
      worldTheme:  z.string().default("fantasy"),
      customName:  z.string().optional(),
      customSymbol: z.string().optional(),
    }).parse(req.body);

    // Kiểm tra đã setup chưa
    const [existing] = await db.select().from(worldCurrencies).where(eq(worldCurrencies.worldSlug, worldSlug));
    if (existing) return res.status(400).json({ message: "Thế giới này đã có tiền tệ. Dùng endpoint update." });

    let currencyName = customName;
    let currencySymbol = customSymbol;
    let currencyLore = "";

    if (!currencyName) {
      // AI sinh tên tiền tệ
      const aiPrompt = `Bạn là AI chuyên về xây dựng thế giới ảo. Thế giới tên "${worldName}" có chủ đề "${worldTheme}".
Hãy tạo ra:
1. Tên đồng tiền (1-3 từ, phù hợp lore, tiếng Việt hoặc tiếng Anh tùy chủ đề)
2. Biểu tượng (1-2 ký tự emoji hoặc ký hiệu đặc biệt, KHÔNG dùng $, €, ¥)
3. Một câu lore ngắn về nguồn gốc đồng tiền này (< 40 từ)

Trả về JSON: {"name": "...", "symbol": "...", "lore": "..."}
Chỉ trả JSON, không giải thích thêm.`;

      try {
        const aiText = await geminiText(aiPrompt);
        const cleaned = aiText.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        currencyName = parsed.name || "Linh Thạch";
        currencySymbol = parsed.symbol || "⬡";
        currencyLore = parsed.lore || "";
      } catch {
        currencyName = worldTheme === "cyberpunk" ? "NeuroCoin" :
                       worldTheme === "wasteland" ? "Scrap Token" : "Linh Thạch";
        currencySymbol = "◈";
      }
    }

    const [currency] = await db.insert(worldCurrencies).values({
      worldSlug, worldName, currencyName: currencyName!, currencySymbol: currencySymbol!,
      currencyLore, exchangeRateToGold: "1.0000", totalSupply: 1000000, reserveGold: 0,
    }).returning();

    // Tạo kho bạc
    await db.insert(worldTreasury).values({
      worldSlug, balance: 10000, taxRate: 5,
      totalRevenue: 0, totalExpenditure: 0,
    }).onConflictDoNothing();

    res.status(201).json({ currency, message: `Đã tạo đồng tiền "${currencyName}" cho thế giới ${worldName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ───────────────────────────────────────────────
   POST /api/world-economy/exchange — đổi tiền giữa 2 thế giới
─────────────────────────────────────────────── */
router.post("/api/world-economy/exchange", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId, fromWorldSlug, toWorldSlug, fromAmount } = z.object({
      characterId:   z.string().uuid(),
      fromWorldSlug: z.string(),
      toWorldSlug:   z.string(),
      fromAmount:    z.number().int().positive().max(1000000),
    }).parse(req.body);

    if (fromWorldSlug === toWorldSlug) return res.status(400).json({ message: "Không thể đổi cùng 1 thế giới" });

    const char = await getUserChar(userId, characterId);
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [fromCur] = await db.select().from(worldCurrencies).where(eq(worldCurrencies.worldSlug, fromWorldSlug));
    const [toCur]   = await db.select().from(worldCurrencies).where(eq(worldCurrencies.worldSlug, toWorldSlug));
    if (!fromCur || !toCur) return res.status(404).json({ message: "Thế giới chưa có tiền tệ" });

    // Tỷ giá chéo: fromWorld → gold → toWorld
    const fromRate = parseFloat(fromCur.exchangeRateToGold as string); // X gold / 1 fromCoin
    const toRate   = parseFloat(toCur.exchangeRateToGold as string);   // Y gold / 1 toCoin
    const goldValue = fromAmount * fromRate;
    const fee = Math.max(1, Math.floor(goldValue * 0.01)); // phí 1% tính bằng gold
    const netGold = goldValue - fee;
    const toAmount = Math.floor(netGold / toRate);

    if (toAmount <= 0) return res.status(400).json({ message: "Số tiền quá nhỏ sau khi tính phí" });

    // Trừ gold của nhân vật (fromAmount × fromRate = goldValue)
    const currentGold = getGold(char.stats);
    const totalGoldNeeded = Math.ceil(goldValue);
    if (currentGold < totalGoldNeeded) {
      return res.status(400).json({ message: `Không đủ vàng (cần ${totalGoldNeeded}, có ${currentGold})` });
    }

    // Trừ gold, cộng gold quy đổi sang đồng tiền đích (lưu dưới dạng gold equiv)
    const newGold = currentGold - totalGoldNeeded + Math.floor(netGold);
    await db.update(characters)
      .set({ stats: sql`stats || jsonb_build_object('gold', ${newGold})` })
      .where(eq(characters.id, characterId));

    // Ghi lịch sử
    await db.insert(currencyExchanges).values({
      fromWorldSlug, toWorldSlug, fromAmount, toAmount,
      rate: (fromRate / toRate).toFixed(6),
      feeGold: fee, executedByCharId: characterId,
      executorName: (char as any).name ?? "",
    });

    // Volume tracking
    await db.update(worldCurrencies)
      .set({ volume24h: sql`volume_24h + ${fromAmount}` })
      .where(eq(worldCurrencies.worldSlug, fromWorldSlug));

    // Tỷ giá dao động
    await adjustRate(fromWorldSlug, "down", fromAmount);
    await adjustRate(toWorldSlug, "up", toAmount);

    // Thuế vào kho bạc
    const [treasury] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, toWorldSlug));
    if (treasury) {
      const taxAmount = Math.floor(netGold * (treasury.taxRate / 100));
      if (taxAmount > 0) {
        await db.update(worldTreasury)
          .set({ balance: sql`balance + ${taxAmount}`, totalRevenue: sql`total_revenue + ${taxAmount}`, lastUpdated: new Date() })
          .where(eq(worldTreasury.worldSlug, toWorldSlug));
      }
    }

    res.json({
      ok: true, fromAmount, toAmount, feeGold: fee,
      fromCurrency: fromCur.currencyName, toCurrency: toCur.currencyName,
      newGold,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ───────────────────────────────────────────────
   POST /api/world-economy/tax/:worldSlug — owner đặt thuế suất
─────────────────────────────────────────────── */
router.post("/api/world-economy/tax/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { taxRate } = z.object({ taxRate: z.number().int().min(0).max(30) }).parse(req.body);

    // Kiểm tra quyền owner
    const ownerCheck = await db.execute(
      sql`SELECT id FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId}`
    );
    if ((ownerCheck.rows?.length ?? 0) === 0) {
      return res.status(403).json({ message: "Chỉ world owner mới có thể đặt thuế suất" });
    }

    await db.update(worldTreasury)
      .set({ taxRate, lastUpdated: new Date() })
      .where(eq(worldTreasury.worldSlug, worldSlug));

    res.json({ ok: true, worldSlug, taxRate, message: `Thuế suất cập nhật: ${taxRate}%` });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ───────────────────────────────────────────────
   POST /api/world-economy/treasury/spend/:worldSlug — owner chi tiêu kho bạc
─────────────────────────────────────────────── */
router.post("/api/world-economy/treasury/spend/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { amount, reason, characterId } = z.object({
      amount: z.number().int().positive(),
      reason: z.string().min(1).max(200),
      characterId: z.string().uuid(),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT id FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId}`
    );
    if ((ownerCheck.rows?.length ?? 0) === 0) {
      return res.status(403).json({ message: "Chỉ world owner mới có thể chi tiêu kho bạc" });
    }

    const [treasury] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, worldSlug));
    if (!treasury) return res.status(404).json({ message: "Kho bạc chưa được khởi tạo" });
    if (treasury.balance < amount) return res.status(400).json({ message: `Kho bạc không đủ (có ${treasury.balance})` });

    // Chuyển tiền vào nhân vật owner (dưới dạng gold)
    const char = await getUserChar(userId, characterId);
    if (!char) return res.status(403).json({ message: "Nhân vật không hợp lệ" });

    const newGold = getGold(char.stats) + amount;
    await db.update(characters)
      .set({ stats: sql`stats || jsonb_build_object('gold', ${newGold})` })
      .where(eq(characters.id, characterId));

    await db.update(worldTreasury)
      .set({ balance: sql`balance - ${amount}`, totalExpenditure: sql`total_expenditure + ${amount}`, lastUpdated: new Date() })
      .where(eq(worldTreasury.worldSlug, worldSlug));

    res.json({ ok: true, spent: amount, reason, newTreasuryBalance: treasury.balance - amount, newGold });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
