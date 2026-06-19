import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcFactions,
  territories, territoryResources, territoryLogs,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

/* ── Constants ── */
const TYPE_LABELS: Record<string, string> = {
  village:  "Làng Xã",
  district: "Quận/Huyện",
  city:     "Thành Phố",
  farmland: "Đất Nông Nghiệp",
  harbor:   "Bến Cảng",
};

const TYPE_ICONS: Record<string, string> = {
  village:  "🏘️",
  district: "🏙️",
  city:     "🌆",
  farmland: "🌾",
  harbor:   "⚓",
};

/* Resources produced per harvest by territory type */
const HARVEST_CONFIG: Record<string, Array<{ resource: string; base: number; variance: number }>> = {
  village:  [{ resource: "thực phẩm", base: 8,  variance: 4 }, { resource: "dân công", base: 3, variance: 2 }],
  district: [{ resource: "vàng",      base: 15, variance: 7 }, { resource: "công cụ",  base: 4, variance: 2 }],
  city:     [{ resource: "vàng",      base: 30, variance: 10 }, { resource: "công cụ", base: 6, variance: 3 }, { resource: "thực phẩm", base: 5, variance: 3 }],
  farmland: [{ resource: "thực phẩm", base: 20, variance: 8 }, { resource: "gỗ",       base: 5, variance: 3 }],
  harbor:   [{ resource: "cá",        base: 18, variance: 8 }, { resource: "vàng",     base: 10, variance: 5 }],
};

/* Prosperity bonus multiplier per type */
const PROSPERITY_BASE: Record<string, number> = {
  village: 30, district: 50, city: 80, farmland: 20, harbor: 40,
};

/* Names pool by type for auto-generation */
const NAME_POOLS: Record<string, string[]> = {
  village:  ["Làng Thanh Bình", "Xóm Cây Đa", "Làng Hoa Đào", "Thôn Gió Ngàn", "Làng Bến Tre", "Xóm Mái Tranh"],
  district: ["Quận Đông Thành", "Huyện Tây Nguyên", "Quận Bắc Môn", "Huyện Nam Quan", "Quận Trung Tâm"],
  city:     ["Thành Phố Lưu Ly", "Đô Thành Hắc Thiết", "Kinh Thành Bạch Ngọc", "Thành Trấn Huyết Nguyệt"],
  farmland: ["Đồng Lúa Vàng", "Ruộng Phù Sa", "Thảo Nguyên Màu Mỡ", "Bình Nguyên Xanh", "Đất Đỏ Tây Nguyên"],
  harbor:   ["Bến Cảng Gió Đông", "Cảng Thương Mại Biển Bạc", "Bến Tàu Hải Long", "Cảng Ngư Nghiệp Nam Hải"],
};

function genName(type: string): string {
  const pool = NAME_POOLS[type] ?? NAME_POOLS["village"];
  return pool[rand(0, pool.length - 1)];
}

/* ════════════════════════════════════════
   GET /api/territories/:worldSlug
   All territories with owner faction + resources
════════════════════════════════════════ */
router.get("/territories/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const rows = await db.select().from(territories)
      .where(eq(territories.worldSlug, worldSlug))
      .orderBy(desc(territories.prosperity));

    const result = await Promise.all(rows.map(async (t) => {
      let ownerFaction = null;
      if (t.ownerFactionId) {
        const [f] = await db.select({ id: npcFactions.id, name: npcFactions.name, type: npcFactions.type, treasury: npcFactions.treasury })
          .from(npcFactions).where(eq(npcFactions.id, t.ownerFactionId));
        ownerFaction = f ?? null;
      }

      const resources = await db.select().from(territoryResources).where(eq(territoryResources.territoryId, t.id));
      const logs = await db.select().from(territoryLogs).where(eq(territoryLogs.territoryId, t.id)).orderBy(desc(territoryLogs.createdAt)).limit(5);

      return {
        ...t,
        typeLabel: TYPE_LABELS[t.type] ?? t.type,
        typeIcon:  TYPE_ICONS[t.type]  ?? "🏛️",
        ownerFaction,
        resources,
        logs,
      };
    }));

    return res.json({ territories: result });
  } catch (err) {
    console.error("[territories] GET error:", err);
    return res.status(500).json({ error: "Lỗi tải lãnh thổ" });
  }
});

/* ════════════════════════════════════════
   POST /api/territories/seed/:worldSlug
   Auto-seed territories for a world (idempotent — skips if already exist)
════════════════════════════════════════ */
router.post("/territories/seed/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const existing = await db.select({ id: territories.id }).from(territories).where(eq(territories.worldSlug, worldSlug));
    if (existing.length >= 5) {
      return res.json({ seeded: 0, message: "Lãnh thổ đã được khởi tạo trước đó" });
    }

    const types: Array<typeof territories.$inferInsert["type"]> = ["village", "village", "farmland", "harbor", "district"];
    let seeded = 0;

    for (const type of types) {
      const [t] = await db.insert(territories).values({
        worldSlug,
        name:       genName(type as string),
        type:       type as string,
        population: rand(200, 2000),
        prosperity: PROSPERITY_BASE[type as string] + rand(-10, 20),
        security:   rand(30, 80),
      }).returning();

      /* Seed initial resources */
      const cfg = HARVEST_CONFIG[type as string] ?? [];
      for (const res of cfg) {
        await db.insert(territoryResources).values({
          territoryId: t.id,
          resourceType: res.resource,
          amount: rand(10, 50),
        });
      }

      await db.insert(territoryLogs).values({ territoryId: t.id, event: `Lãnh thổ ${t.name} được khai phá và đưa vào bản đồ thế giới.` });
      seeded++;
    }

    return res.json({ seeded, message: `Đã khởi tạo ${seeded} lãnh thổ cho thế giới` });
  } catch (err) {
    console.error("[territories] seed error:", err);
    return res.status(500).json({ error: "Lỗi khởi tạo lãnh thổ" });
  }
});

/* ════════════════════════════════════════
   POST /api/territories/:territoryId/claim
   Faction claims a territory
   Body: { factionId }
════════════════════════════════════════ */
router.post("/territories/:territoryId/claim", isAuthenticated, async (req, res) => {
  try {
    const { territoryId } = req.params as Record<string, string>;
    const { factionId } = req.body;

    if (!factionId) return res.status(400).json({ error: "Thiếu factionId" });

    const [t] = await db.select().from(territories).where(eq(territories.id, territoryId));
    if (!t) return res.status(404).json({ error: "Không tìm thấy lãnh thổ" });

    const [f] = await db.select().from(npcFactions).where(eq(npcFactions.id, factionId));
    if (!f) return res.status(404).json({ error: "Không tìm thấy hội nhóm" });

    const prevOwner = t.ownerFactionId;

    await db.update(territories)
      .set({ ownerFactionId: factionId, updatedAt: new Date() })
      .where(eq(territories.id, territoryId));

    const logMsg = prevOwner
      ? `${f.name} chiếm lãnh thổ ${t.name} từ hội nhóm cũ.`
      : `${f.name} tuyên bố sở hữu lãnh thổ ${t.name}.`;

    await db.insert(territoryLogs).values({ territoryId, event: logMsg });

    return res.json({ success: true, message: logMsg });
  } catch (err) {
    console.error("[territories] claim error:", err);
    return res.status(500).json({ error: "Lỗi chiếm lãnh thổ" });
  }
});

/* ════════════════════════════════════════
   POST /api/territories/harvest/:worldSlug
   Run resource harvest for all territories in world
   — adds resources, updates prosperity, logs events
════════════════════════════════════════ */
router.post("/territories/harvest/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const rows = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (rows.length === 0) return res.json({ harvested: 0, message: "Chưa có lãnh thổ nào" });

    let totalHarvested = 0;
    const summary: Array<{ name: string; yields: string[] }> = [];

    for (const t of rows) {
      const cfg = HARVEST_CONFIG[t.type] ?? [];
      if (cfg.length === 0) continue;

      /* Prosperity multiplier */
      const prosperityMult = 0.5 + (t.prosperity / 100);
      const yields: string[] = [];

      for (const resCfg of cfg) {
        const baseAmount = Math.floor((resCfg.base + rand(0, resCfg.variance)) * prosperityMult);
        if (baseAmount <= 0) continue;

        /* Upsert resource */
        const [existing] = await db.select().from(territoryResources)
          .where(and(eq(territoryResources.territoryId, t.id), eq(territoryResources.resourceType, resCfg.resource)));

        if (existing) {
          await db.update(territoryResources)
            .set({ amount: existing.amount + baseAmount, updatedAt: new Date() })
            .where(eq(territoryResources.id, existing.id));
        } else {
          await db.insert(territoryResources).values({ territoryId: t.id, resourceType: resCfg.resource, amount: baseAmount });
        }

        yields.push(`+${baseAmount} ${resCfg.resource}`);
        totalHarvested += baseAmount;
      }

      /* Slight prosperity drift */
      const prosperityDelta = rand(-3, 5);
      await db.update(territories)
        .set({ prosperity: clamp(t.prosperity + prosperityDelta, 0, 100), lastHarvestAt: new Date(), updatedAt: new Date() })
        .where(eq(territories.id, t.id));

      /* Log */
      if (yields.length) {
        await db.insert(territoryLogs).values({
          territoryId: t.id,
          event: `Thu hoạch: ${yields.join(" · ")}${t.ownerFactionId ? " → vào kho hội nhóm chủ sở hữu" : ""}`,
        });
      }

      summary.push({ name: t.name, yields });
    }

    return res.json({ harvested: totalHarvested, territories: summary, message: `Thu hoạch xong ${rows.length} lãnh thổ, tổng ${totalHarvested} đơn vị tài nguyên.` });
  } catch (err) {
    console.error("[territories] harvest error:", err);
    return res.status(500).json({ error: "Lỗi thu hoạch lãnh thổ" });
  }
});

export default router;
