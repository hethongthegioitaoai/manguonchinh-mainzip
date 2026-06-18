import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  customWorlds, worldPortals, starDomains, npcs,
  userWorldSlots,
} from "@workspace/db/schema";
import { eq, and, or, count } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

async function getOrCreateSlot(userId: string) {
  const existing = await db.select().from(userWorldSlots).where(eq(userWorldSlots.userId, userId));
  if (existing.length) return existing[0];
  const [slot] = await db.insert(userWorldSlots).values({ userId, maxWorlds: 3 }).returning();
  return slot;
}

// GET /api/multiworld/my-worlds
router.get("/api/multiworld/my-worlds", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const slot = await getOrCreateSlot(userId);
    const worlds = await db.select().from(customWorlds).where(eq(customWorlds.createdBy, userId));

    const worldsWithStats = await Promise.all(worlds.map(async (w: any) => {
      const [npcRow] = await db.select({ cnt: count() }).from(npcs).where(and(eq(npcs.worldSlug, w.slug), eq(npcs.active, true)));
      const charRow = { cnt: 0 };
      const portals = await db.select().from(worldPortals).where(
        or(eq(worldPortals.fromWorldSlug, w.slug), eq(worldPortals.toWorldSlug, w.slug))
      );
      return {
        ...w,
        npcCount: Number(npcRow?.cnt ?? 0),
        playerCount: Number(charRow?.cnt ?? 0),
        portalCount: portals.length,
      };
    }));

    const myPortals = worlds.length
      ? await db.select().from(worldPortals).where(eq(worldPortals.createdBy, userId))
      : [];

    const [domain] = await db.select().from(starDomains).where(eq(starDomains.ownerUserId, userId));

    res.json({
      slot: { maxWorlds: slot.maxWorlds, currentWorlds: worlds.length },
      worlds: worldsWithStats,
      portals: myPortals,
      starDomain: domain ?? null,
    });
  } catch (err) {
    console.error("[multiworld/my-worlds]", err);
    res.status(500).json({ message: "Lỗi tải danh sách thế giới" });
  }
});

// POST /api/multiworld/portal/create
router.post("/api/multiworld/portal/create", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const { fromWorldSlug, toWorldSlug, portalName, portalType, travelCost } = req.body;

    const [fw] = await db.select().from(customWorlds).where(eq(customWorlds.slug, fromWorldSlug));
    const [tw] = await db.select().from(customWorlds).where(eq(customWorlds.slug, toWorldSlug));
    if (!fw || !tw) return res.status(404).json({ message: "Thế giới không tồn tại" });
    if (fw.createdBy !== userId) return res.status(403).json({ message: "Không phải chủ thế giới nguồn" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `Hãy viết 1 đoạn narrative ngắn (2-3 câu, tiếng Việt, văn phong sử thi) mô tả việc mở cổng truyền tống "${portalName}" nối từ thế giới "${fw.name}" (${fw.genre}) đến "${tw.name}" (${tw.genre}). Chỉ trả về đoạn văn, không có gì khác.`
    );
    const narrative = result.response.text().trim();

    const [portal] = await db.insert(worldPortals).values({
      fromWorldSlug, toWorldSlug,
      portalName: portalName || `Cổng ${fw.name} ↔ ${tw.name}`,
      portalType: portalType || "owner_only",
      travelCost: travelCost || 0,
      aiNarrative: narrative,
      createdBy: userId,
    }).returning();

    res.json({ portal });
  } catch (err) {
    console.error("[multiworld/portal/create]", err);
    res.status(500).json({ message: "Lỗi tạo cổng" });
  }
});

// POST /api/multiworld/portal/travel/:portalId
router.post("/api/multiworld/portal/travel/:portalId", isAuthenticated, async (req: any, res) => {
  try {
    const { portalId } = req.params;
    const { characterId } = req.body;

    const [portal] = await db.select().from(worldPortals).where(and(eq(worldPortals.id, portalId), eq(worldPortals.isActive, true)));
    if (!portal) return res.status(404).json({ message: "Cổng không tồn tại hoặc đã đóng" });

    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char) return res.status(404).json({ message: "Nhân vật không tồn tại" });

    await db.update(characters).set({ currentWorld: portal.toWorldSlug }).where(eq(characters.id, characterId));

    res.json({
      message: "Di chuyển qua cổng thành công",
      narrative: portal.aiNarrative,
      arrivedAt: portal.toWorldSlug,
    });
  } catch (err) {
    console.error("[multiworld/portal/travel]", err);
    res.status(500).json({ message: "Lỗi di chuyển qua cổng" });
  }
});

// POST /api/multiworld/domain/create
router.post("/api/multiworld/domain/create", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const { domainName } = req.body;

    const worlds = await db.select().from(customWorlds).where(eq(customWorlds.createdBy, userId));
    if (worlds.length < 3) return res.status(400).json({ message: "Cần ít nhất 3 thế giới để tạo Tinh Vực" });

    const existing = await db.select().from(starDomains).where(eq(starDomains.ownerUserId, userId));
    if (existing.length) return res.status(400).json({ message: "Bạn đã có Tinh Vực" });

    const [domain] = await db.insert(starDomains).values({
      ownerUserId: userId,
      domainName: domainName || "Tinh Vực Vô Danh",
      worldSlugs: worlds.map((w: any) => w.slug),
      domainLevel: 1,
    }).returning();

    res.json({ domain });
  } catch (err) {
    console.error("[multiworld/domain/create]", err);
    res.status(500).json({ message: "Lỗi tạo Tinh Vực" });
  }
});

// GET /api/multiworld/domain/my
router.get("/api/multiworld/domain/my", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId as string;
    const [domain] = await db.select().from(starDomains).where(eq(starDomains.ownerUserId, userId));
    res.json({ domain: domain ?? null });
  } catch {
    res.status(500).json({ message: "Lỗi tải Tinh Vực" });
  }
});

export default router;
