import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcCoreMemories,
  territories,
  npcGovernments, npcGovernmentLogs,
} from "@workspace/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const GOV_TYPE_LABELS: Record<string, string> = {
  village_council: "Hội Đồng Làng",
  city_authority:  "Chính Quyền Thành Phố",
  kingdom:         "Vương Quốc",
  republic:        "Cộng Hòa",
};

const GOV_TYPE_ICONS: Record<string, string> = {
  village_council: "🏘️",
  city_authority:  "🏙️",
  kingdom:         "👑",
  republic:        "🏛️",
};

function govTypeForTerritory(type: string, population: number): string {
  if (type === "village" || type === "farmland") return "village_council";
  if (type === "harbor" || type === "district")  return population > 200 ? "republic" : "city_authority";
  if (type === "city")                            return population > 500 ? "kingdom" : "city_authority";
  return "village_council";
}

/* ════════════════════════════════════════
   GET /api/npc-government/:worldSlug
   All governments with leader + logs
════════════════════════════════════════ */
router.get("/api/npc-government/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;

    const terrs = await db.select().from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ governments: [] });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds))
      .orderBy(desc(npcGovernments.treasury));

    const result = await Promise.all(govs.map(async (g) => {
      const terr = terrs.find(t => t.id === g.territoryId) ?? null;

      let leader = null;
      if (g.leaderNpcId) {
        const [l] = await db.select({
          id: npcCores.id, name: npcCores.name,
          occupation: npcCores.occupation, money: npcCores.money,
        }).from(npcCores).where(eq(npcCores.id, g.leaderNpcId));
        leader = l ?? null;
      }

      const logs = await db.select().from(npcGovernmentLogs)
        .where(eq(npcGovernmentLogs.governmentId, g.id))
        .orderBy(desc(npcGovernmentLogs.createdAt)).limit(10);

      return {
        ...g,
        territory: terr,
        leader,
        logs,
        govTypeLabel: GOV_TYPE_LABELS[g.govType] ?? g.govType,
        govTypeIcon:  GOV_TYPE_ICONS[g.govType]  ?? "🏛️",
      };
    }));

    return res.json({ governments: result });
  } catch (err) {
    console.error("[npc-government] GET error:", err);
    return res.status(500).json({ error: "Lỗi tải chính phủ" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-government/establish/:worldSlug
   Create governments for all territories that
   don't have one. Elect leader from resident NPCs.
════════════════════════════════════════ */
router.post("/api/npc-government/establish/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;

    const terrs = await db.select().from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    if (terrs.length === 0) {
      return res.json({ established: 0, message: "Chưa có lãnh thổ nào trong thế giới này." });
    }

    const terrIds = terrs.map(t => t.id);
    const existingGovs = await db.select({ territoryId: npcGovernments.territoryId })
      .from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));
    const existingTerrIds = new Set(existingGovs.map(g => g.territoryId));

    const newTerrs = terrs.filter(t => !existingTerrIds.has(t.id));
    if (newTerrs.length === 0) {
      return res.json({ established: 0, message: "Tất cả lãnh thổ đã có chính phủ." });
    }

    /* Load all NPCs in this world to pick leaders */
    const allNpcs = await db.select().from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug));

    let established = 0;
    const results: { territory: string; govType: string; leader: string }[] = [];

    for (const terr of newTerrs) {
      const govType = govTypeForTerritory(terr.type, terr.population);

      /* Pick leader: highest wealth + influence proxy (money + happiness/2) */
      let leaderId: string | null = null;
      let leaderName = "Không có lãnh đạo";
      if (allNpcs.length > 0) {
        const scored = allNpcs.map(n => ({
          id: n.id, name: n.name,
          score: n.money + Math.floor(n.happiness / 2),
        })).sort((a, b) => b.score - a.score);
        leaderId  = scored[0].id;
        leaderName = scored[0].name;
      }

      const initialTaxRate = govType === "village_council" ? 8
        : govType === "city_authority" ? 12
        : govType === "kingdom" ? 15
        : 10;

      const [newGov] = await db.insert(npcGovernments).values({
        territoryId:  terr.id,
        govType,
        leaderNpcId:  leaderId,
        treasury:     rand(50, 300),
        approvalRate: rand(55, 75),
        taxRate:      initialTaxRate,
      }).returning();

      const logMsg = `Chính phủ "${GOV_TYPE_LABELS[govType]}" được thành lập tại ${terr.name}. Lãnh đạo đầu tiên: ${leaderName}.`;
      await db.insert(npcGovernmentLogs).values({ governmentId: newGov.id, event: logMsg });

      if (leaderId) {
        await db.insert(npcCoreMemories).values({
          npcCoreId: leaderId,
          event: `Được bầu làm lãnh đạo của ${GOV_TYPE_LABELS[govType]} tại ${terr.name}.`,
          importance: 5,
        });
      }

      results.push({ territory: terr.name, govType: GOV_TYPE_LABELS[govType], leader: leaderName });
      established++;
    }

    return res.json({ established, governments: results, message: `Đã thành lập ${established} chính phủ.` });
  } catch (err) {
    console.error("[npc-government] establish error:", err);
    return res.status(500).json({ error: "Lỗi thành lập chính phủ" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-government/collect-taxes/:worldSlug
   Collect taxes from NPC income + market activity
════════════════════════════════════════ */
router.post("/api/npc-government/collect-taxes/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;

    const terrs = await db.select().from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ totalCollected: 0, message: "Không có lãnh thổ" });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));

    if (govs.length === 0) return res.json({ totalCollected: 0, message: "Chưa có chính phủ nào" });

    const allNpcs = await db.select().from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug));

    let totalCollected = 0;
    const breakdown: { territory: string; tax: number }[] = [];

    for (const gov of govs) {
      const terr = terrs.find(t => t.id === gov.territoryId);

      /* Tax income from NPCs (proportional share per territory) */
      const npcsPerGov = Math.max(1, Math.floor(allNpcs.length / govs.length));
      const npcSlice = allNpcs.slice(0, npcsPerGov);

      let npcTax = 0;
      for (const npc of npcSlice) {
        const taxAmount = Math.floor(npc.money * (gov.taxRate / 100));
        if (taxAmount > 0) {
          npcTax += taxAmount;
          await db.update(npcCores)
            .set({ money: Math.max(0, npc.money - taxAmount) })
            .where(eq(npcCores.id, npc.id));
        }
      }

      /* Market transaction tax (flat based on prosperity) */
      const marketTax = Math.floor(terr!.prosperity * 0.8);

      /* Faction contribution (small fixed amount) */
      const factionContrib = rand(10, 40);

      const total = npcTax + marketTax + factionContrib;
      totalCollected += total;

      await db.update(npcGovernments)
        .set({ treasury: gov.treasury + total, updatedAt: new Date() })
        .where(eq(npcGovernments.id, gov.id));

      const logMsg = `Thu thuế: ${npcTax} vàng từ NPC, ${marketTax} vàng từ giao dịch, ${factionContrib} vàng từ phe phái. Tổng: ${total} vàng.`;
      await db.insert(npcGovernmentLogs).values({ governmentId: gov.id, event: logMsg });

      breakdown.push({ territory: terr?.name ?? gov.territoryId, tax: total });
    }

    return res.json({
      totalCollected,
      breakdown,
      message: `Đã thu ${totalCollected} vàng từ ${govs.length} chính phủ.`,
    });
  } catch (err) {
    console.error("[npc-government] collect-taxes error:", err);
    return res.status(500).json({ error: "Lỗi thu thuế" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-government/update-approval/:worldSlug
   Recalculate approval based on prosperity,
   security, tax rate, and NPC happiness (food proxy)
════════════════════════════════════════ */
router.post("/api/npc-government/update-approval/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;

    const terrs = await db.select().from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ updated: 0, message: "Không có lãnh thổ" });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));

    const allNpcs = await db.select({ happiness: npcCores.happiness, hunger: npcCores.hunger })
      .from(npcCores).where(eq(npcCores.worldSlug, worldSlug));

    const avgHappiness = allNpcs.length > 0
      ? allNpcs.reduce((s, n) => s + n.happiness, 0) / allNpcs.length
      : 60;
    const avgHunger = allNpcs.length > 0
      ? allNpcs.reduce((s, n) => s + n.hunger, 0) / allNpcs.length
      : 30;

    let updated = 0;
    for (const gov of govs) {
      const terr = terrs.find(t => t.id === gov.territoryId);
      if (!terr) continue;

      /* Formula:
         prosperity (0-100) → weight 0.30
         security   (0-100) → weight 0.25
         tax penalty: > 15% reduces 0.2 pts per % over threshold
         food supply (inverse hunger) → weight 0.25
         happiness   (0-100) → weight 0.20
      */
      const prosperityScore = terr.prosperity * 0.30;
      const securityScore   = terr.security   * 0.25;
      const foodScore       = Math.max(0, 100 - avgHunger) * 0.25;
      const happinessScore  = avgHappiness * 0.20;
      const taxPenalty      = Math.max(0, (gov.taxRate - 15) * 0.2);

      let newApproval = prosperityScore + securityScore + foodScore + happinessScore - taxPenalty;
      newApproval = Math.min(100, Math.max(0, Math.round(newApproval)));

      const delta = newApproval - gov.approvalRate;
      const trend = delta > 2 ? "tăng" : delta < -2 ? "giảm" : "ổn định";

      await db.update(npcGovernments)
        .set({ approvalRate: newApproval, updatedAt: new Date() })
        .where(eq(npcGovernments.id, gov.id));

      if (Math.abs(delta) > 2) {
        const logMsg = `Tỷ lệ ủng hộ ${trend} từ ${Math.round(gov.approvalRate)}% → ${newApproval}%. (Thịnh vượng: ${terr.prosperity}, An ninh: ${terr.security}, Thuế: ${gov.taxRate}%)`;
        await db.insert(npcGovernmentLogs).values({ governmentId: gov.id, event: logMsg });
      }

      updated++;
    }

    return res.json({ updated, message: `Đã cập nhật tỷ lệ ủng hộ cho ${updated} chính phủ.` });
  } catch (err) {
    console.error("[npc-government] update-approval error:", err);
    return res.status(500).json({ error: "Lỗi cập nhật tỷ lệ ủng hộ" });
  }
});

export default router;
