import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldWars, warContributions, worldRelations, worldTreasury, characters } from "@workspace/db/schema";
import { eq, and, or, sql, desc, lt } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { broadcastUnity } from "../lib/unityWs.js";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

async function getWorldName(slug: string): Promise<string> {
  const builtins: Record<string, string> = {
    "tu-tien": "Thiên Ngoại Cổ Giới", cyberpunk: "Neo Thành Phố 2077", wasteland: "Vùng Hoang Phế"
  };
  if (builtins[slug]) return builtins[slug];
  const result = await db.execute(sql`SELECT name FROM custom_worlds WHERE slug = ${slug} LIMIT 1`);
  return (result.rows[0] as any)?.name ?? slug;
}

/* ─── Auto-settle wars đã hết hạn ─── */
async function settleExpiredWars() {
  const expired = await db.select().from(worldWars)
    .where(and(eq(worldWars.status, "active"), lt(worldWars.endsAt, new Date())));

  for (const war of expired) {
    const winnerId = war.attackerScore >= war.defenderScore
      ? war.attackerWorldSlug : war.defenderWorldSlug;
    const loserId = winnerId === war.attackerWorldSlug ? war.defenderWorldSlug : war.attackerWorldSlug;

    // Thắng nhận 20% kho bạc thua
    const [loserTreasury] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, loserId));
    if (loserTreasury && loserTreasury.balance > 0) {
      const prize = Math.floor(loserTreasury.balance * 0.2);
      await db.update(worldTreasury)
        .set({ balance: loserTreasury.balance - prize })
        .where(eq(worldTreasury.worldSlug, loserId));
      const [winnerT] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, winnerId));
      if (winnerT) {
        await db.update(worldTreasury)
          .set({ balance: winnerT.balance + prize, totalRevenue: winnerT.totalRevenue + prize })
          .where(eq(worldTreasury.worldSlug, winnerId));
      }
    }

    await db.update(worldWars)
      .set({ status: "ended", winnerId })
      .where(eq(worldWars.id, war.id));

    /* Unity realtime broadcast — war ended */
    broadcastUnity({
      type: "war_end",
      worldSlug: war.attackerWorldSlug,
      warId: war.id,
      winner: winnerId === war.attackerWorldSlug ? war.attackerWorldName : war.defenderWorldName,
    });
    broadcastUnity({
      type: "war_end",
      worldSlug: war.defenderWorldSlug,
      warId: war.id,
      winner: winnerId === war.attackerWorldSlug ? war.attackerWorldName : war.defenderWorldName,
    });

    // Chuyển quan hệ về neutral
    const [a, b] = [war.attackerWorldSlug, war.defenderWorldSlug].sort();
    await db.update(worldRelations)
      .set({ status: "neutral", updatedAt: new Date() })
      .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));
  }
}

/* ─────────────────────────────────────────────────────
   GET /api/world-war/active — tất cả chiến tranh đang active
───────────────────────────────────────────────────── */
router.get("/api/world-war/active", isAuthenticated, async (_req, res) => {
  try {
    await settleExpiredWars();
    const wars = await db.select().from(worldWars)
      .where(eq(worldWars.status, "active"))
      .orderBy(desc(worldWars.declaredAt));
    res.json(wars);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/world-war/history — chiến tranh đã kết thúc
───────────────────────────────────────────────────── */
router.get("/api/world-war/history", isAuthenticated, async (_req, res) => {
  try {
    const wars = await db.select().from(worldWars)
      .where(eq(worldWars.status, "ended"))
      .orderBy(desc(worldWars.declaredAt)).limit(20);
    res.json(wars);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/world-war/:warId — chi tiết + bảng đóng góp
───────────────────────────────────────────────────── */
router.get("/api/world-war/:warId", isAuthenticated, async (req, res) => {
  try {
    const { warId } = req.params as Record<string, string>;
    const [war] = await db.select().from(worldWars).where(eq(worldWars.id, warId));
    if (!war) return res.status(404).json({ message: "Không tìm thấy chiến tranh" });

    const contributions = await db.select().from(warContributions)
      .where(eq(warContributions.warId, warId))
      .orderBy(desc(warContributions.contribution));

    res.json({ war, contributions });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-war/declare/:targetWorldSlug — tuyên chiến
───────────────────────────────────────────────────── */
router.post("/api/world-war/declare/:targetWorldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { targetWorldSlug } = req.params as Record<string, string>;
    const { fromWorldSlug, reason } = z.object({
      fromWorldSlug: z.string().min(1),
      reason: z.string().default("Vì danh dự của thế giới!"),
    }).parse(req.body);

    if (fromWorldSlug === targetWorldSlug) return res.status(400).json({ message: "Không thể tuyên chiến với chính mình" });

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${fromWorldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(fromWorldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    // Kiểm tra quan hệ — không thể tuyên chiến thế giới ally
    const [a, b] = [fromWorldSlug, targetWorldSlug].sort();
    const [relation] = await db.select().from(worldRelations)
      .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));
    if (relation?.status === "ally") {
      return res.status(400).json({ message: "Không thể tuyên chiến đồng minh. Hãy hủy liên minh trước." });
    }

    // Kiểm tra chiến tranh đang active
    const existing = await db.select().from(worldWars).where(
      and(
        eq(worldWars.status, "active"),
        or(
          and(eq(worldWars.attackerWorldSlug, fromWorldSlug), eq(worldWars.defenderWorldSlug, targetWorldSlug)),
          and(eq(worldWars.attackerWorldSlug, targetWorldSlug), eq(worldWars.defenderWorldSlug, fromWorldSlug))
        )
      )
    );
    if (existing.length) return res.status(400).json({ message: "Đã có chiến tranh đang diễn ra giữa 2 thế giới" });

    const attackerName = await getWorldName(fromWorldSlug);
    const defenderName = await getWorldName(targetWorldSlug);
    const endsAt = new Date(Date.now() + 72 * 3600 * 1000);

    const bulletin = await geminiText(
      `Bạn là sử gia thế giới ảo. Thế giới "${attackerName}" vừa tuyên chiến với thế giới "${defenderName}".
      Lý do: "${reason}".
      Viết 3-4 câu tường thuật mở đầu chiến tranh theo phong cách sử thi/lore viễn tưởng. Kịch tính, bi tráng. Chỉ trả về đoạn tường thuật.`
    );

    const [war] = await db.insert(worldWars).values({
      attackerWorldSlug: fromWorldSlug,
      defenderWorldSlug: targetWorldSlug,
      attackerWorldName: attackerName,
      defenderWorldName: defenderName,
      declaredByUserId: userId,
      warReason: reason,
      warBulletin: bulletin || `${attackerName} tuyên chiến với ${defenderName}! Chiến tranh bắt đầu!`,
      lastBulletinAt: new Date(),
      endsAt,
    }).returning();

    // Chuyển quan hệ sang enemy
    if (relation) {
      await db.update(worldRelations)
        .set({ status: "enemy", updatedAt: new Date() })
        .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));
    } else {
      await db.insert(worldRelations).values({
        worldSlugA: a, worldSlugB: b, status: "enemy", treatiesDetails: {},
      });
    }

    /* Unity realtime broadcast — war started (broadcast to both worlds) */
    broadcastUnity({
      type: "war_start",
      worldSlug: fromWorldSlug,
      warId: war.id,
      attacker: attackerName,
      defender: defenderName,
      reason,
    });
    broadcastUnity({
      type: "war_start",
      worldSlug: targetWorldSlug,
      warId: war.id,
      attacker: attackerName,
      defender: defenderName,
      reason,
    });

    res.status(201).json({ war });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-war/contribute — PvP kill cộng điểm chiến tranh
───────────────────────────────────────────────────── */
router.post("/api/world-war/contribute", isAuthenticated, async (req, res) => {
  try {
    const { characterId, worldSlug, kills } = z.object({
      characterId: z.string().uuid(),
      worldSlug:   z.string().min(1),
      kills:       z.number().int().min(1).default(1),
    }).parse(req.body);

    const activeWars = await db.select().from(worldWars).where(
      and(
        eq(worldWars.status, "active"),
        or(eq(worldWars.attackerWorldSlug, worldSlug), eq(worldWars.defenderWorldSlug, worldSlug))
      )
    );
    if (!activeWars.length) return res.json({ contributed: false, message: "Không có chiến tranh active" });

    const war = activeWars[0];
    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const points = kills * 10;

    const existing = await db.select().from(warContributions)
      .where(and(eq(warContributions.warId, war.id), eq(warContributions.characterId, characterId)));

    if (existing.length) {
      await db.update(warContributions)
        .set({ pvpKills: existing[0].pvpKills + kills, contribution: existing[0].contribution + points })
        .where(eq(warContributions.id, existing[0].id));
    } else {
      await db.insert(warContributions).values({
        warId: war.id, characterId, characterName: char.name,
        worldSlug, pvpKills: kills, pvpDeaths: 0, contribution: points,
      });
    }

    // Cộng điểm cho thế giới
    if (worldSlug === war.attackerWorldSlug) {
      await db.update(worldWars).set({ attackerScore: war.attackerScore + points }).where(eq(worldWars.id, war.id));
    } else {
      await db.update(worldWars).set({ defenderScore: war.defenderScore + points }).where(eq(worldWars.id, war.id));
    }

    res.json({ contributed: true, points, warId: war.id });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-war/:warId/surrender — đầu hàng sớm
───────────────────────────────────────────────────── */
router.post("/api/world-war/:warId/surrender", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { warId } = req.params as Record<string, string>;
    const { worldSlug } = z.object({ worldSlug: z.string().min(1) }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const [war] = await db.select().from(worldWars).where(eq(worldWars.id, warId));
    if (!war || war.status !== "active") return res.status(400).json({ message: "Chiến tranh không tồn tại hoặc đã kết thúc" });
    if (war.attackerWorldSlug !== worldSlug && war.defenderWorldSlug !== worldSlug) {
      return res.status(400).json({ message: "Thế giới này không tham chiến" });
    }

    const winnerId = war.attackerWorldSlug === worldSlug ? war.defenderWorldSlug : war.attackerWorldSlug;
    const loserId = worldSlug;

    // Đầu hàng → mất 30% kho bạc (ít hơn auto-end 50%)
    const [loserT] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, loserId));
    if (loserT && loserT.balance > 0) {
      const penalty = Math.floor(loserT.balance * 0.3);
      await db.update(worldTreasury).set({ balance: loserT.balance - penalty }).where(eq(worldTreasury.worldSlug, loserId));
      const [winnerT] = await db.select().from(worldTreasury).where(eq(worldTreasury.worldSlug, winnerId));
      if (winnerT) {
        await db.update(worldTreasury)
          .set({ balance: winnerT.balance + penalty, totalRevenue: winnerT.totalRevenue + penalty })
          .where(eq(worldTreasury.worldSlug, winnerId));
      }
    }

    const [updated] = await db.update(worldWars)
      .set({ status: "ended", winnerId, warBulletin: (war.warBulletin ?? "") + `\n\n⚡ ${await getWorldName(loserId)} đã đầu hàng! ${await getWorldName(winnerId)} chiến thắng!` })
      .where(eq(worldWars.id, warId))
      .returning();

    const [a, b] = [war.attackerWorldSlug, war.defenderWorldSlug].sort();
    await db.update(worldRelations)
      .set({ status: "neutral", updatedAt: new Date() })
      .where(and(eq(worldRelations.worldSlugA, a), eq(worldRelations.worldSlugB, b)));

    res.json({ war: updated, message: "Đã đầu hàng. Tổn thất: 30% kho bạc." });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-war/:warId/bulletin — AI sinh tường thuật chiến sự
───────────────────────────────────────────────────── */
router.post("/api/world-war/:warId/bulletin", isAuthenticated, async (req, res) => {
  try {
    const { warId } = req.params as Record<string, string>;
    const [war] = await db.select().from(worldWars).where(eq(worldWars.id, warId));
    if (!war || war.status !== "active") return res.status(400).json({ message: "Chiến tranh không active" });

    const now = new Date();
    const lastBulletin = war.lastBulletinAt ? new Date(war.lastBulletinAt) : new Date(0);
    if (now.getTime() - lastBulletin.getTime() < 12 * 3600 * 1000) {
      return res.status(429).json({ message: "Tường thuật chỉ cập nhật mỗi 12h" });
    }

    const contribs = await db.select().from(warContributions).where(eq(warContributions.warId, warId))
      .orderBy(desc(warContributions.contribution)).limit(5);
    const heroes = contribs.map(c => `${c.characterName} (${c.contribution} điểm)`).join(", ");

    const bulletin = await geminiText(
      `Bạn là sử gia chiến tranh thế giới ảo. Đây là diễn biến chiến tranh giữa "${war.attackerWorldName}" và "${war.defenderWorldName}":
      - Điểm tấn công: ${war.attackerScore} — Điểm phòng thủ: ${war.defenderScore}
      - Anh hùng chiến trường: ${heroes || "Chưa có"}
      - Đã ${Math.floor((now.getTime() - new Date(war.declaredAt).getTime()) / 3600000)}h kể từ khi khai chiến
      Viết 3-4 câu tường thuật chiến sự hấp dẫn, kịch tính theo phong cách lore viễn tưởng. Chỉ trả về đoạn tường thuật.`
    );

    const [updated] = await db.update(worldWars)
      .set({ warBulletin: bulletin || war.warBulletin, lastBulletinAt: now })
      .where(eq(worldWars.id, warId))
      .returning();

    res.json({ war: updated, bulletin });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
