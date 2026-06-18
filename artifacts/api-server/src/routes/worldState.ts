import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldState, worldResources } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const DEFAULT_BOSSES: Record<string, Array<{ key: string; name: string; level: number }>> = {
  cultivation: [
    { key: "boss_cuu_vi_ho_yeu", name: "Cửu Vĩ Hồ Yêu", level: 50 },
    { key: "boss_phuc_ho_dai_ma", name: "Phục Hổ Đại Ma", level: 80 },
    { key: "boss_thien_long_vuong", name: "Thiên Long Vương", level: 120 },
  ],
  cyberpunk: [
    { key: "boss_nexus9", name: "NEXUS-9 Core AI", level: 50 },
    { key: "boss_syndicate_director", name: "Syndicate Director", level: 80 },
    { key: "boss_god_protocol", name: "God Protocol", level: 120 },
  ],
  zombie: [
    { key: "boss_mutant_warlord", name: "Mutant Warlord", level: 50 },
    { key: "boss_toxic_giant", name: "Toxic Giant", level: 80 },
    { key: "boss_apex_predator", name: "Apex Predator", level: 120 },
  ],
  wasteland: [
    { key: "boss_mutant_warlord", name: "Mutant Warlord", level: 50 },
    { key: "boss_toxic_giant", name: "Toxic Giant", level: 80 },
    { key: "boss_apex_predator", name: "Apex Predator", level: 120 },
  ],
};

const DEFAULT_RESOURCES: Record<string, Array<{
  resourceType: string; name: string; icon: string;
  maxQuantity: number; regenRatePerHour: number;
}>> = {
  cultivation: [
    { resourceType: "linh_thach", name: "Linh Thạch", icon: "💎", maxQuantity: 200, regenRatePerHour: 15 },
    { resourceType: "linh_thao", name: "Linh Thảo", icon: "🌿", maxQuantity: 150, regenRatePerHour: 20 },
    { resourceType: "moc_ban", name: "Mộc Bản", icon: "🪵", maxQuantity: 300, regenRatePerHour: 30 },
    { resourceType: "thiet_quang", name: "Thiết Quặng", icon: "⛏️", maxQuantity: 100, regenRatePerHour: 8 },
  ],
  cyberpunk: [
    { resourceType: "energy_cell", name: "Energy Cell", icon: "⚡", maxQuantity: 200, regenRatePerHour: 20 },
    { resourceType: "scrap_metal", name: "Scrap Metal", icon: "🔩", maxQuantity: 300, regenRatePerHour: 25 },
    { resourceType: "neural_chip", name: "Neural Chip", icon: "🧠", maxQuantity: 80, regenRatePerHour: 5 },
    { resourceType: "biosynth", name: "BioSynth", icon: "🧬", maxQuantity: 60, regenRatePerHour: 4 },
  ],
  zombie: [
    { resourceType: "clean_water", name: "Nước Sạch", icon: "💧", maxQuantity: 150, regenRatePerHour: 12 },
    { resourceType: "scrap", name: "Phế Liệu", icon: "🔧", maxQuantity: 300, regenRatePerHour: 20 },
    { resourceType: "mutant_hide", name: "Da Quái Biến", icon: "🦴", maxQuantity: 80, regenRatePerHour: 6 },
    { resourceType: "radiation_ore", name: "Quặng Phóng Xạ", icon: "☢️", maxQuantity: 50, regenRatePerHour: 3 },
  ],
  wasteland: [
    { resourceType: "clean_water", name: "Nước Sạch", icon: "💧", maxQuantity: 150, regenRatePerHour: 12 },
    { resourceType: "scrap", name: "Phế Liệu", icon: "🔧", maxQuantity: 300, regenRatePerHour: 20 },
    { resourceType: "mutant_hide", name: "Da Quái Biến", icon: "🦴", maxQuantity: 80, regenRatePerHour: 6 },
    { resourceType: "radiation_ore", name: "Quặng Phóng Xạ", icon: "☢️", maxQuantity: 50, regenRatePerHour: 3 },
  ],
};

async function applyRegen(resource: any): Promise<number> {
  const now = Date.now();
  const lastRegen = new Date(resource.lastRegenAt).getTime();
  const hoursPassed = (now - lastRegen) / (1000 * 60 * 60);
  const regenAmount = Math.floor(hoursPassed * resource.regenRatePerHour);
  if (regenAmount <= 0) return resource.quantity;
  const newQty = Math.min(resource.quantity + regenAmount, resource.maxQuantity);
  await db.update(worldResources)
    .set({ quantity: newQty, lastRegenAt: new Date(), updatedAt: new Date() })
    .where(eq(worldResources.id, resource.id));
  return newQty;
}

async function seedWorldDefaults(worldSlug: string): Promise<void> {
  const existingState = await db.select().from(worldState).where(eq(worldState.worldSlug, worldSlug));
  const existingResources = await db.select().from(worldResources).where(eq(worldResources.worldSlug, worldSlug));

  const bosses = DEFAULT_BOSSES[worldSlug] ?? DEFAULT_BOSSES.cultivation;
  const resources = DEFAULT_RESOURCES[worldSlug] ?? DEFAULT_RESOURCES.cultivation;

  for (const boss of bosses) {
    const exists = existingState.find(s => s.key === boss.key);
    if (!exists) {
      await db.insert(worldState).values({
        worldSlug,
        key: boss.key,
        value: { type: "boss", name: boss.name, level: boss.level, alive: true, diedAt: null, respawnAt: null },
      });
    }
  }

  for (const res of resources) {
    const exists = existingResources.find(r => r.resourceType === res.resourceType);
    if (!exists) {
      await db.insert(worldResources).values({
        worldSlug,
        resourceType: res.resourceType,
        quantity: res.maxQuantity,
        maxQuantity: res.maxQuantity,
        regenRatePerHour: res.regenRatePerHour,
      });
    }
  }
}

// GET /world/state/:worldSlug — full world state (public)
router.get("/world/state/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    await seedWorldDefaults(worldSlug);

    const stateRows = await db.select().from(worldState).where(eq(worldState.worldSlug, worldSlug));
    const resourceRows = await db.select().from(worldResources).where(eq(worldResources.worldSlug, worldSlug));

    // apply regen to all resources
    const resourcesWithRegen = await Promise.all(
      resourceRows.map(async r => {
        const qty = await applyRegen(r);
        return { ...r, quantity: qty };
      })
    );

    const bosses = stateRows
      .filter(s => (s.value as any)?.type === "boss")
      .map(s => {
        const v = s.value as any;
        const now = Date.now();
        const respawnAt = v.respawnAt ? new Date(v.respawnAt).getTime() : null;
        const isAlive = v.alive || (respawnAt !== null && now >= respawnAt);
        // auto-revive if respawn time passed
        if (!v.alive && respawnAt && now >= respawnAt) {
          db.update(worldState)
            .set({ value: { ...v, alive: true, respawnAt: null, diedAt: null }, updatedAt: new Date() })
            .where(eq(worldState.id, s.id))
            .catch(() => {});
        }
        return {
          key: s.key,
          name: v.name,
          level: v.level,
          alive: isAlive,
          diedAt: v.diedAt,
          respawnAt: v.respawnAt,
          secondsUntilRespawn: (!isAlive && respawnAt) ? Math.max(0, Math.floor((respawnAt - now) / 1000)) : null,
        };
      });

    const resourceMeta = DEFAULT_RESOURCES[worldSlug] ?? DEFAULT_RESOURCES.cultivation;
    const resources = resourcesWithRegen.map(r => {
      const meta = resourceMeta.find(m => m.resourceType === r.resourceType);
      return {
        resourceType: r.resourceType,
        name: meta?.name ?? r.resourceType,
        icon: meta?.icon ?? "📦",
        quantity: r.quantity,
        maxQuantity: r.maxQuantity,
        regenRatePerHour: r.regenRatePerHour,
        percent: Math.round((r.quantity / r.maxQuantity) * 100),
      };
    });

    res.json({ worldSlug, bosses, resources });
  } catch (err: any) {
    console.error("worldState GET error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy trạng thái thế giới" });
  }
});

// POST /world/boss/:worldSlug/:bossKey/kill — đánh dấu boss đã chết (sau battle thắng)
router.post("/world/boss/:worldSlug/:bossKey/kill", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug, bossKey } = req.params;
    const RESPAWN_HOURS = 24;

    const [row] = await db.select().from(worldState)
      .where(and(eq(worldState.worldSlug, worldSlug), eq(worldState.key, bossKey)));

    if (!row) return res.status(404).json({ message: "Boss không tồn tại" });

    const v = row.value as any;
    if (!v.alive) return res.status(400).json({ message: "Boss đã chết rồi" });

    const now = new Date();
    const respawnAt = new Date(now.getTime() + RESPAWN_HOURS * 60 * 60 * 1000);

    await db.update(worldState)
      .set({
        value: { ...v, alive: false, diedAt: now.toISOString(), respawnAt: respawnAt.toISOString() },
        updatedAt: now,
      })
      .where(eq(worldState.id, row.id));

    res.json({ message: `${v.name} đã bị tiêu diệt!`, respawnAt: respawnAt.toISOString() });
  } catch (err: any) {
    console.error("boss kill error:", err?.message);
    res.status(500).json({ message: "Lỗi cập nhật boss" });
  }
});

// POST /world/resources/:worldSlug/harvest — thu thập tài nguyên
router.post("/world/resources/:worldSlug/harvest", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const { resourceType, amount = 10 } = req.body;

    if (!resourceType) return res.status(400).json({ message: "Thiếu resourceType" });

    const [resource] = await db.select().from(worldResources)
      .where(and(eq(worldResources.worldSlug, worldSlug), eq(worldResources.resourceType, resourceType)));

    if (!resource) return res.status(404).json({ message: "Tài nguyên không tồn tại" });

    const currentQty = await applyRegen(resource);
    const harvestAmount = Math.min(amount, currentQty);

    if (harvestAmount <= 0) {
      return res.status(400).json({ message: "Tài nguyên đã cạn kiệt, đợi hồi phục!" });
    }

    await db.update(worldResources)
      .set({ quantity: currentQty - harvestAmount, updatedAt: new Date() })
      .where(eq(worldResources.id, resource.id));

    const meta = (DEFAULT_RESOURCES[worldSlug] ?? DEFAULT_RESOURCES.cultivation)
      .find(m => m.resourceType === resourceType);

    res.json({
      message: `Thu thập được ${harvestAmount} ${meta?.name ?? resourceType}`,
      harvested: harvestAmount,
      remaining: currentQty - harvestAmount,
      icon: meta?.icon ?? "📦",
    });
  } catch (err: any) {
    console.error("harvest error:", err?.message);
    res.status(500).json({ message: "Lỗi thu thập tài nguyên" });
  }
});

export { DEFAULT_BOSSES, DEFAULT_RESOURCES };
export default router;
