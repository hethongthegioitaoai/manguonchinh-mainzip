import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { dailyLogins, characters, inventory, items } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const DAILY_REWARDS: Record<number, { type: "exp" | "item" | "gold"; amount: number; label: string; icon: string; rarity?: string }> = {
  1: { type: "exp",  amount: 50,  label: "50 EXP",          icon: "✨" },
  2: { type: "exp",  amount: 100, label: "100 EXP",         icon: "💫" },
  3: { type: "exp",  amount: 150, label: "150 EXP",         icon: "⭐" },
  4: { type: "exp",  amount: 200, label: "200 EXP",         icon: "🌟" },
  5: { type: "item", amount: 1,   label: "Vật Phẩm Thường", icon: "📦", rarity: "common" },
  6: { type: "exp",  amount: 300, label: "300 EXP",         icon: "💎" },
  7: { type: "item", amount: 1,   label: "Vật Phẩm Hiếm",  icon: "🎁", rarity: "rare" },
};

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getRewardForStreak(streak: number) {
  const day = ((streak - 1) % 7) + 1;
  return { ...DAILY_REWARDS[day], day };
}

// GET /api/daily/status
router.get("/daily/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const today = getTodayStr();

    const [todayRow] = await db.select().from(dailyLogins)
      .where(and(eq(dailyLogins.userId, userId), eq(dailyLogins.loginDate, today)));

    const [lastRow] = await db.select().from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .orderBy(desc(dailyLogins.createdAt))
      .limit(1);

    let currentStreak = 1;
    if (lastRow && lastRow.loginDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      currentStreak = lastRow.loginDate === yesterdayStr ? lastRow.streak + 1 : 1;
    } else if (lastRow) {
      currentStreak = lastRow.streak;
    }

    const reward = getRewardForStreak(currentStreak);

    const calendar = Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      const r = DAILY_REWARDS[day];
      return { day, ...r, current: ((currentStreak - 1) % 7) + 1 === day };
    });

    res.json({
      claimed: !!todayRow?.rewardClaimed,
      streak: currentStreak,
      todayReward: reward,
      calendar,
    });
  } catch (err: any) {
    console.error("daily status error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy trạng thái daily" });
  }
});

// POST /api/daily/claim
router.post("/daily/claim", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const today = getTodayStr();

    const [existing] = await db.select().from(dailyLogins)
      .where(and(eq(dailyLogins.userId, userId), eq(dailyLogins.loginDate, today)));

    if (existing?.rewardClaimed) return res.status(400).json({ message: "Đã nhận thưởng hôm nay rồi!" });

    const [lastRow] = await db.select().from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .orderBy(desc(dailyLogins.createdAt))
      .limit(1);

    let newStreak = 1;
    if (lastRow && !existing) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      newStreak = lastRow.loginDate === yesterdayStr ? lastRow.streak + 1 : 1;
    } else if (existing) {
      newStreak = existing.streak;
    }

    const reward = getRewardForStreak(newStreak);

    if (existing) {
      await db.update(dailyLogins).set({ rewardClaimed: true, streak: newStreak }).where(eq(dailyLogins.id, existing.id));
    } else {
      await db.insert(dailyLogins).values({ userId, loginDate: today, streak: newStreak, rewardClaimed: true });
    }

    const chars = await db.select().from(characters).where(eq(characters.userId, userId));
    if (chars.length > 0) {
      const char = chars[0];
      if (reward.type === "exp") {
        const newExp = char.exp + reward.amount;
        const newLevel = Math.floor(newExp / 100) + 1;
        await db.update(characters).set({ exp: newExp, level: newLevel }).where(eq(characters.id, char.id));
      } else if (reward.type === "item" && reward.rarity) {
        const worldSlug = (char.stats as any)?.world_slug ?? "cultivation";
        const eligibleItems = await db.select().from(items)
          .where(and(eq(items.worldSlug, worldSlug), eq(items.rarity, reward.rarity)));
        if (eligibleItems.length > 0) {
          const picked = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
          await db.insert(inventory).values({ characterId: char.id, itemId: picked.id, quantity: 1 });
        }
      }
    }

    res.json({
      message: `Nhận thưởng ngày ${reward.day} thành công!`,
      streak: newStreak,
      reward,
    });
  } catch (err: any) {
    console.error("daily claim error:", err?.message);
    res.status(500).json({ message: "Lỗi nhận thưởng daily" });
  }
});

export default router;
