import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldFairs, fairBooths, fairVisits, characters, customWorlds } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const FAIR_DURATION_DAYS = 3;
const ENTRY_FEE = 50;

async function getOrCreateActiveFair() {
  const [active] = await db
    .select()
    .from(worldFairs)
    .where(eq(worldFairs.status, "active"))
    .orderBy(desc(worldFairs.createdAt))
    .limit(1);

  if (active) {
    if (new Date() > new Date(active.endsAt)) {
      await settleFair(active.id);
      return createNewFair();
    }
    return active;
  }
  return createNewFair();
}

async function createNewFair() {
  const [last] = await db.select().from(worldFairs).orderBy(desc(worldFairs.season)).limit(1);
  const season = (last?.season ?? 0) + 1;
  const endsAt = new Date(Date.now() + FAIR_DURATION_DAYS * 86400000);

  const [fair] = await db.insert(worldFairs).values({
    season, status: "active",
    theme: `Đại Hội Thương Nhân Mùa ${season}`,
    endsAt,
  }).returning();

  await seedBooths(fair.id);
  return fair;
}

async function seedBooths(fairId: string) {
  const worlds = await db.select().from(customWorlds).where(eq(customWorlds.isPublic, true)).limit(8);

  const builtinWorlds = [
    { slug: "cultivation", name: "Tu Tiên Giới", owner: "system", ownerName: "Hệ Thống" },
    { slug: "cyberpunk", name: "Thế Giới Cyberpunk", owner: "system", ownerName: "Hệ Thống" },
    { slug: "wasteland", name: "Vùng Hoang Phế", owner: "system", ownerName: "Hệ Thống" },
  ];

  for (const w of builtinWorlds) {
    const existing = await db.select().from(fairBooths).where(and(eq(fairBooths.fairId, fairId), eq(fairBooths.worldSlug, w.slug)));
    if (existing.length > 0) continue;
    const boothName = await generateBoothName(w.name);
    await db.insert(fairBooths).values({
      fairId, worldSlug: w.slug, worldName: w.name,
      boothName, entryFee: ENTRY_FEE,
      ownerId: w.owner, ownerName: w.ownerName,
      featured: true,
    }).onConflictDoNothing();
  }

  for (const w of worlds.slice(0, 5)) {
    const existing = await db.select().from(fairBooths).where(and(eq(fairBooths.fairId, fairId), eq(fairBooths.worldSlug, w.slug)));
    if (existing.length > 0) continue;
    const boothName = await generateBoothName(w.name);
    await db.insert(fairBooths).values({
      fairId, worldSlug: w.slug, worldName: w.name,
      boothName, entryFee: ENTRY_FEE,
      ownerId: w.createdBy, ownerName: "Ẩn Danh",
    }).onConflictDoNothing();
  }
}

async function generateBoothName(worldName: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `Tạo tên gian hàng hội chợ (5-8 từ, tiếng Việt, phong cách lore) cho thế giới "${worldName}". Chỉ trả tên, không giải thích.`
    );
    return result.response.text().trim().slice(0, 100) || `Gian Hàng ${worldName}`;
  } catch {
    return `Gian Hàng ${worldName}`;
  }
}

async function settleFair(fairId: string) {
  const booths = await db.select().from(fairBooths).where(eq(fairBooths.fairId, fairId)).orderBy(desc(fairBooths.votes)).limit(1);
  const winner = booths[0];
  await db.update(worldFairs).set({
    status: "ended",
    winnerWorldSlug: winner?.worldSlug ?? null,
  }).where(eq(worldFairs.id, fairId));
}

/* ─────────────────────────────────────────────────────
   GET /api/fair/current — hội chợ đang diễn ra + gian hàng
───────────────────────────────────────────────────── */
router.get("/fair/current", isAuthenticated, async (req, res) => {
  try {
    const fair = await getOrCreateActiveFair();
    const booths = await db.select().from(fairBooths).where(eq(fairBooths.fairId, fair.id)).orderBy(desc(fairBooths.votes));
    res.json({ fair, booths });
  } catch (e) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ─────────────────────────────────────────────────────
   GET /api/fair/history — hội chợ đã kết thúc
───────────────────────────────────────────────────── */
router.get("/fair/history", isAuthenticated, async (req, res) => {
  try {
    const history = await db.select().from(worldFairs).where(eq(worldFairs.status, "ended")).orderBy(desc(worldFairs.createdAt)).limit(10);
    res.json(history);
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ─────────────────────────────────────────────────────
   POST /api/fair/visit/:boothId — tham quan gian hàng
───────────────────────────────────────────────────── */
router.post("/fair/visit/:boothId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { boothId } = req.params as Record<string, string>;

    const [booth] = await db.select().from(fairBooths).where(eq(fairBooths.id, boothId));
    if (!booth) return res.status(404).json({ message: "Không tìm thấy gian hàng" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const alreadyVisited = await db.select().from(fairVisits).where(
      and(eq(fairVisits.boothId, boothId), eq(fairVisits.userId, userId))
    );
    if (alreadyVisited.length > 0) return res.status(400).json({ message: "Bạn đã tham quan gian hàng này rồi" });

    const fee = booth.entryFee;
    if (((char.stats as any)?.gold ?? 0) < fee) return res.status(400).json({ message: `Cần ${fee} gold để vào` });

    await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) - fee } }).where(eq(characters.id, char.id));

    if (!booth.aiNarrative) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const result = await model.generateContent(
          `Viết mô tả gian hàng hội chợ (3-4 câu, tiếng Việt) của thế giới "${booth.worldName}" tên gian hàng "${booth.boothName}". Phong cách huyền bí, sống động, mời gọi. Nhắc đến hàng hoá độc đáo từ thế giới đó.`
        );
        const narrative = result.response.text().trim();
        await db.update(fairBooths).set({ aiNarrative: narrative }).where(eq(fairBooths.id, boothId));
      } catch {}
    }

    await db.update(fairBooths).set({ visits: (booth.visits ?? 0) + 1 }).where(eq(fairBooths.id, boothId));
    await db.update(worldFairs).set({ totalVisits: sql`total_visits + 1` }).where(eq(worldFairs.id, booth.fairId));

    await db.insert(fairVisits).values({
      fairId: booth.fairId, boothId, characterId: char.id, userId, goldSpent: fee,
    });

    const [updatedBooth] = await db.select().from(fairBooths).where(eq(fairBooths.id, boothId));
    const expGain = 30;
    await db.update(characters).set({ exp: (char.exp ?? 0) + expGain }).where(eq(characters.id, char.id));

    res.json({ booth: updatedBooth, expGain, goldSpent: fee, message: `Đã tham quan ${booth.boothName}! +${expGain} EXP` });
  } catch (e) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ─────────────────────────────────────────────────────
   POST /api/fair/vote/:boothId — bình chọn gian hàng
───────────────────────────────────────────────────── */
router.post("/fair/vote/:boothId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { boothId } = req.params as Record<string, string>;

    const [visited] = await db.select().from(fairVisits).where(
      and(eq(fairVisits.boothId, boothId), eq(fairVisits.userId, userId))
    );
    if (!visited) return res.status(400).json({ message: "Bạn phải tham quan trước khi bình chọn" });
    if (visited.voted) return res.status(400).json({ message: "Bạn đã bình chọn gian hàng này rồi" });

    await db.update(fairBooths).set({ votes: sql`votes + 1` }).where(eq(fairBooths.id, boothId));
    await db.update(fairVisits).set({ voted: true }).where(eq(fairVisits.id, visited.id));

    res.json({ message: "Bình chọn thành công!" });
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ─────────────────────────────────────────────────────
   POST /api/fair/register — đăng ký gian hàng (creator)
───────────────────────────────────────────────────── */
router.post("/fair/register", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const fair = await getOrCreateActiveFair();

    const myWorld = await db.select().from(customWorlds).where(and(eq(customWorlds.createdBy, userId), eq(customWorlds.isPublic, true))).limit(1);
    if (!myWorld.length) return res.status(400).json({ message: "Bạn cần có thế giới công khai để đăng ký" });

    const w = myWorld[0];
    const existing = await db.select().from(fairBooths).where(and(eq(fairBooths.fairId, fair.id), eq(fairBooths.worldSlug, w.slug)));
    if (existing.length > 0) return res.status(400).json({ message: "Thế giới của bạn đã có gian hàng trong hội chợ này" });

    const boothName = await generateBoothName(w.name);
    const [booth] = await db.insert(fairBooths).values({
      fairId: fair.id, worldSlug: w.slug, worldName: w.name,
      boothName, entryFee: ENTRY_FEE,
      ownerId: userId, ownerName: "Ẩn Danh",
    }).returning();

    res.json({ booth, message: `Đã đăng ký gian hàng "${boothName}" thành công!` });
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ─────────────────────────────────────────────────────
   GET /api/fair/my-visits — lịch sử tham quan của user
───────────────────────────────────────────────────── */
router.get("/fair/my-visits", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const visits = await db.select().from(fairVisits).where(eq(fairVisits.userId, userId)).orderBy(desc(fairVisits.visitedAt)).limit(20);
    res.json(visits);
  } catch {
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
