import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { bankAccounts, bankLoans, bankTransfers, characters, worldRelations } from "@workspace/db/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const INTEREST_RATE_DAILY = 0.02;   // 2%/ngày tiết kiệm
const LOAN_RATE_DAILY = 0.05;       // 5%/ngày vay
const TRANSFER_FEE_PCT = 0.05;      // 5% phí chuyển khoản
const TRANSFER_FIXED_FEE = 10;       // + 10 gold cố định

// ─── Helpers — gold/worldSlug sống trong char.stats JSON ─────────────────────

function getCharGold(char: { stats: unknown }): number {
  return (char.stats as any)?.gold ?? 0;
}

function getCharWorldSlug(char: { stats: unknown }): string {
  return (char.stats as any)?.world_slug ?? "cultivation";
}

async function setCharGold(charId: string, stats: unknown, newGold: number) {
  await db.update(characters)
    .set({ stats: { ...(stats as object), gold: newGold } })
    .where(eq(characters.id, charId));
}

// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateAccount(characterId: string, worldSlug: string, charName: string) {
  const [existing] = await db.select().from(bankAccounts).where(eq(bankAccounts.characterId, characterId));
  if (existing) return existing;
  const [created] = await db.insert(bankAccounts).values({ characterId, characterName: charName, worldSlug }).returning();
  return created;
}

async function applyInterest(account: typeof bankAccounts.$inferSelect) {
  const now = new Date();
  const last = new Date(account.lastInterestAt);
  const daysDiff = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
  if (daysDiff < 1 || account.balance <= 0) return account;

  const days = Math.floor(daysDiff);
  const interest = Math.floor(account.balance * Math.pow(1 + INTEREST_RATE_DAILY, days) - account.balance);

  if (interest <= 0) return account;

  const [updated] = await db.update(bankAccounts)
    .set({ balance: account.balance + interest, lastInterestAt: now })
    .where(eq(bankAccounts.id, account.id)).returning();
  return updated;
}

/* ─────────────────────────────────────────────────────
   GET /api/bank/account — tài khoản + lãi suất auto-apply
───────────────────────────────────────────────────── */
router.get("/api/bank/account", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.json(null);

    let account = await getOrCreateAccount(char.id, getCharWorldSlug(char), char.name);
    account = await applyInterest(account);

    const loans = await db.select().from(bankLoans)
      .where(and(eq(bankLoans.characterId, char.id), eq(bankLoans.status, "active")));

    const transfers = await db.select().from(bankTransfers)
      .where(or(eq(bankTransfers.fromCharId, char.id), eq(bankTransfers.toCharId, char.id)))
      .orderBy(desc(bankTransfers.transferredAt)).limit(10);

    res.json({ account, loans, transfers });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/bank/rates — tỷ giá hối đoái
───────────────────────────────────────────────────── */
router.get("/api/bank/rates", isAuthenticated, async (_req, res) => {
  try {
    const worlds = [
      { slug: "tu-tien",   currency: "Linh Thạch", symbol: "◈" },
      { slug: "cyberpunk", currency: "Credits",     symbol: "₡" },
      { slug: "wasteland", currency: "Phế Liệu",   symbol: "⬡" },
    ];

    const customWorldsResult = await db.execute(sql`SELECT slug, name FROM custom_worlds LIMIT 20`);
    for (const w of customWorldsResult.rows as any[]) {
      worlds.push({ slug: w.slug, currency: `${w.name} Gold`, symbol: "⬡" });
    }

    const relations = await db.select().from(worldRelations);
    const rates: Record<string, Record<string, number>> = {};
    for (const w of worlds) {
      rates[w.slug] = {};
      for (const other of worlds) {
        if (w.slug === other.slug) { rates[w.slug][other.slug] = 1.0; continue; }
        const rel = relations.find(r =>
          (r.worldSlugA === w.slug && r.worldSlugB === other.slug) ||
          (r.worldSlugB === w.slug && r.worldSlugA === other.slug)
        );
        const statusBonus = rel?.status === "ally" ? 0.1 :
          rel?.status === "trade_partner" ? 0.05 :
          rel?.status === "enemy" ? -0.2 : 0;
        rates[w.slug][other.slug] = Math.max(0.5, 1.0 + statusBonus);
      }
    }

    res.json({ worlds, rates });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bank/deposit — gửi tiết kiệm
───────────────────────────────────────────────────── */
router.post("/api/bank/deposit", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount } = z.object({ amount: z.number().int().min(1) }).parse(req.body);

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const currentGold = getCharGold(char);
    if (currentGold < amount) return res.status(400).json({ message: "Không đủ gold" });

    const account = await getOrCreateAccount(char.id, getCharWorldSlug(char), char.name);

    await setCharGold(char.id, char.stats, currentGold - amount);
    const [updated] = await db.update(bankAccounts)
      .set({ balance: account.balance + amount, totalDeposited: account.totalDeposited + amount })
      .where(eq(bankAccounts.id, account.id)).returning();

    res.json({ account: updated, message: `Đã gửi ${amount} gold vào ngân hàng` });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bank/withdraw — rút tiền
───────────────────────────────────────────────────── */
router.post("/api/bank/withdraw", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount } = z.object({ amount: z.number().int().min(1) }).parse(req.body);

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    let account = await getOrCreateAccount(char.id, getCharWorldSlug(char), char.name);
    account = await applyInterest(account);

    if (account.balance < amount) return res.status(400).json({ message: "Số dư không đủ" });

    await setCharGold(char.id, char.stats, getCharGold(char) + amount);
    const [updated] = await db.update(bankAccounts)
      .set({ balance: account.balance - amount, totalWithdrawn: account.totalWithdrawn + amount })
      .where(eq(bankAccounts.id, account.id)).returning();

    res.json({ account: updated, message: `Đã rút ${amount} gold` });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bank/loan — vay vốn
───────────────────────────────────────────────────── */
router.post("/api/bank/loan", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount } = z.object({ amount: z.number().int().min(100) }).parse(req.body);

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const worldSlug = getCharWorldSlug(char);
    const account = await getOrCreateAccount(char.id, worldSlug, char.name);
    const maxLoan = account.balance * 5;
    if (amount > maxLoan) return res.status(400).json({ message: `Vay tối đa ${maxLoan} (500% số dư)` });

    const existing = await db.select().from(bankLoans)
      .where(and(eq(bankLoans.characterId, char.id), eq(bankLoans.status, "active")));
    if (existing.length >= 3) return res.status(400).json({ message: "Tối đa 3 khoản vay cùng lúc" });

    const totalOwed = Math.floor(amount * 1.3);
    const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const [loan] = await db.insert(bankLoans).values({
      characterId: char.id, worldSlug,
      principal: amount, interestRate: LOAN_RATE_DAILY,
      totalOwed, dueAt,
    }).returning();

    await setCharGold(char.id, char.stats, getCharGold(char) + amount);

    res.status(201).json({ loan, message: `Đã vay ${amount} gold. Phải trả ${totalOwed} trong 7 ngày.` });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bank/repay/:loanId — trả nợ
───────────────────────────────────────────────────── */
router.post("/api/bank/repay/:loanId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { loanId } = req.params as Record<string, string>;

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const [loan] = await db.select().from(bankLoans).where(eq(bankLoans.id, loanId));
    if (!loan || loan.status !== "active") return res.status(400).json({ message: "Khoản vay không tồn tại" });
    if (loan.characterId !== char.id) return res.status(403).json({ message: "Không phải khoản vay của bạn" });

    const currentGold = getCharGold(char);
    if (currentGold < loan.totalOwed) return res.status(400).json({ message: `Cần ${loan.totalOwed} gold để trả hết` });

    await setCharGold(char.id, char.stats, currentGold - loan.totalOwed);
    const [updated] = await db.update(bankLoans)
      .set({ status: "paid", paidAt: new Date() }).where(eq(bankLoans.id, loanId)).returning();

    res.json({ loan: updated, message: "Đã trả nợ xong!" });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/bank/transfer — chuyển khoản cross-world
───────────────────────────────────────────────────── */
router.post("/api/bank/transfer", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { toCharId, amount, note } = z.object({
      toCharId: z.string().uuid(),
      amount:   z.number().int().min(1),
      note:     z.string().default(""),
    }).parse(req.body);

    const [fromChar] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!fromChar) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const [toChar] = await db.select().from(characters).where(eq(characters.id, toCharId));
    if (!toChar) return res.status(404).json({ message: "Nhân vật đích không tồn tại" });
    if (fromChar.id === toChar.id) return res.status(400).json({ message: "Không thể chuyển cho chính mình" });

    const fromWorldSlug = getCharWorldSlug(fromChar);
    const toWorldSlug   = getCharWorldSlug(toChar);

    const fromAccount = await getOrCreateAccount(fromChar.id, fromWorldSlug, fromChar.name);
    const toAccount   = await getOrCreateAccount(toChar.id, toWorldSlug, toChar.name);

    const isCrossWorld = fromWorldSlug !== toWorldSlug;
    const fee = isCrossWorld ? Math.floor(amount * TRANSFER_FEE_PCT) + TRANSFER_FIXED_FEE : 0;
    const totalCost = amount + fee;

    if (fromAccount.balance < totalCost) return res.status(400).json({ message: `Cần ${totalCost} gold (gồm ${fee} phí)` });

    const exchangeRate = 1.0;
    const received = Math.floor(amount * exchangeRate);

    await db.update(bankAccounts).set({ balance: fromAccount.balance - totalCost }).where(eq(bankAccounts.id, fromAccount.id));
    await db.update(bankAccounts).set({ balance: toAccount.balance + received }).where(eq(bankAccounts.id, toAccount.id));

    const [transfer] = await db.insert(bankTransfers).values({
      fromCharId: fromChar.id, toCharId: toChar.id,
      amount, fromCurrency: "Gold", toCurrency: "Gold",
      exchangeRate, fee, note,
    }).returning();

    res.json({ transfer, fee, received, message: `Đã chuyển ${amount} gold cho ${toChar.name}` + (fee > 0 ? ` (phí: ${fee})` : "") });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
