import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores,
  territories,
  npcGovernments, npcGovernmentLogs,
  governmentPolicies, governmentActivePolicies, governmentPolicyHistory,
} from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";

const router = Router();

/* ─── Default policy definitions ─── */
const DEFAULT_POLICIES = [
  {
    name: "Thuế Thấp",
    category: "kinh_tế",
    description: "Giảm thuế để tăng sự hài lòng của dân chúng và kích thích kinh tế.",
    effects: { taxAdjust: -5, approvalAdjust: 5, foodAdjust: 0, securityAdjust: 0, prosperityAdjust: 0, tradeAdjust: 0, treasuryCostPerTick: 0 },
  },
  {
    name: "Thuế Cao",
    category: "kinh_tế",
    description: "Tăng thuế để nhanh chóng bổ sung ngân quỹ, nhưng làm giảm tỷ lệ ủng hộ.",
    effects: { taxAdjust: 10, approvalAdjust: -10, foodAdjust: 0, securityAdjust: 0, prosperityAdjust: 0, tradeAdjust: 0, treasuryCostPerTick: 0 },
  },
  {
    name: "Trợ Cấp Lương Thực",
    category: "phúc_lợi",
    description: "Chính phủ trợ cấp lương thực cho dân nghèo, giảm nguy cơ đói và tăng ủng hộ.",
    effects: { taxAdjust: 0, approvalAdjust: 8, foodAdjust: 15, securityAdjust: 0, prosperityAdjust: 0, tradeAdjust: 0, treasuryCostPerTick: 20 },
  },
  {
    name: "Khuyến Khích Thương Mại",
    category: "thương_mại",
    description: "Miễn thuế giao dịch và mở rộng chợ, thúc đẩy buôn bán và thịnh vượng.",
    effects: { taxAdjust: 0, approvalAdjust: 0, foodAdjust: 0, securityAdjust: 0, prosperityAdjust: 10, tradeAdjust: 15, treasuryCostPerTick: 0 },
  },
  {
    name: "Mở Rộng Quân Sự",
    category: "quân_sự",
    description: "Tăng ngân sách quân sự, cải thiện an ninh lãnh thổ nhưng tốn ngân quỹ.",
    effects: { taxAdjust: 0, approvalAdjust: -3, foodAdjust: 0, securityAdjust: 15, prosperityAdjust: 0, tradeAdjust: 0, treasuryCostPerTick: 30 },
  },
  {
    name: "Đầu Tư Hạ Tầng",
    category: "hạ_tầng",
    description: "Xây dựng đường xá, cầu cống và công trình công cộng, tăng thịnh vượng lâu dài.",
    effects: { taxAdjust: 0, approvalAdjust: 5, foodAdjust: 0, securityAdjust: 0, prosperityAdjust: 20, tradeAdjust: 0, treasuryCostPerTick: 25 },
  },
];

/* ════════════════════════════════════════
   POST /api/npc-policy/seed
   Seed default policies if not exist
════════════════════════════════════════ */
router.post("/api/npc-policy/seed", isAuthenticated, async (_req, res) => {
  try {
    const existing = await db.select({ name: governmentPolicies.name }).from(governmentPolicies);
    const existingNames = new Set(existing.map(p => p.name));
    const toInsert = DEFAULT_POLICIES.filter(p => !existingNames.has(p.name));

    if (toInsert.length === 0) return res.json({ seeded: 0, message: "Chính sách mặc định đã tồn tại." });

    await db.insert(governmentPolicies).values(toInsert.map(p => ({ ...p, isDefault: 1 })));
    return res.json({ seeded: toInsert.length, message: `Đã tạo ${toInsert.length} chính sách mặc định.` });
  } catch (err) {
    console.error("[npc-policy] seed error:", err);
    return res.status(500).json({ error: "Lỗi tạo chính sách mặc định" });
  }
});

/* ════════════════════════════════════════
   GET /api/npc-policy/catalog
   All available policy templates
════════════════════════════════════════ */
router.get("/api/npc-policy/catalog", isAuthenticated, async (_req, res) => {
  try {
    const policies = await db.select().from(governmentPolicies).orderBy(governmentPolicies.category);
    return res.json({ policies });
  } catch (err) {
    console.error("[npc-policy] catalog error:", err);
    return res.status(500).json({ error: "Lỗi tải danh sách chính sách" });
  }
});

/* ════════════════════════════════════════
   GET /api/npc-policy/active/:govId
   Active policies for a government + history
════════════════════════════════════════ */
router.get("/api/npc-policy/active/:govId", isAuthenticated, async (req, res) => {
  try {
    const { govId } = req.params as Record<string, string>;

    const activePolicies = await db
      .select({
        activeId:    governmentActivePolicies.id,
        activatedAt: governmentActivePolicies.activatedAt,
        policyId:    governmentPolicies.id,
        name:        governmentPolicies.name,
        category:    governmentPolicies.category,
        description: governmentPolicies.description,
        effects:     governmentPolicies.effects,
      })
      .from(governmentActivePolicies)
      .innerJoin(governmentPolicies, eq(governmentActivePolicies.policyId, governmentPolicies.id))
      .where(eq(governmentActivePolicies.governmentId, govId));

    const history = await db.select().from(governmentPolicyHistory)
      .where(eq(governmentPolicyHistory.governmentId, govId))
      .orderBy(governmentPolicyHistory.activatedAt);

    return res.json({ activePolicies, history });
  } catch (err) {
    console.error("[npc-policy] active error:", err);
    return res.status(500).json({ error: "Lỗi tải chính sách" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-policy/activate/:govId/:policyId
════════════════════════════════════════ */
router.post("/api/npc-policy/activate/:govId/:policyId", isAuthenticated, async (req, res) => {
  try {
    const { govId, policyId } = req.params as Record<string, string>;

    const [gov] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govId));
    if (!gov) return res.status(404).json({ error: "Không tìm thấy chính phủ" });

    const [policy] = await db.select().from(governmentPolicies).where(eq(governmentPolicies.id, policyId));
    if (!policy) return res.status(404).json({ error: "Không tìm thấy chính sách" });

    const existing = await db.select().from(governmentActivePolicies)
      .where(and(eq(governmentActivePolicies.governmentId, govId), eq(governmentActivePolicies.policyId, policyId)));
    if (existing.length > 0) return res.json({ ok: false, message: "Chính sách đã được kích hoạt." });

    await db.insert(governmentActivePolicies).values({ governmentId: govId, policyId });

    let leaderName = "Lãnh đạo";
    if (gov.leaderNpcId) {
      const [l] = await db.select({ name: npcCores.name }).from(npcCores).where(eq(npcCores.id, gov.leaderNpcId));
      leaderName = l?.name ?? leaderName;
    }

    await db.insert(governmentPolicyHistory).values({
      governmentId: govId,
      policyId,
      policyName:   policy.name,
      leaderName,
      action:       "activate",
      activatedAt:  new Date(),
    });

    const logMsg = `Ban hành "${policy.name}" — ${policy.description}`;
    await db.insert(npcGovernmentLogs).values({ governmentId: govId, event: logMsg });

    return res.json({ ok: true, message: `Đã kích hoạt "${policy.name}".` });
  } catch (err) {
    console.error("[npc-policy] activate error:", err);
    return res.status(500).json({ error: "Lỗi kích hoạt chính sách" });
  }
});

/* ════════════════════════════════════════
   DELETE /api/npc-policy/deactivate/:govId/:policyId
════════════════════════════════════════ */
router.delete("/api/npc-policy/deactivate/:govId/:policyId", isAuthenticated, async (req, res) => {
  try {
    const { govId, policyId } = req.params as Record<string, string>;

    const [gov] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, govId));
    if (!gov) return res.status(404).json({ error: "Không tìm thấy chính phủ" });

    const [policy] = await db.select().from(governmentPolicies).where(eq(governmentPolicies.id, policyId));
    if (!policy) return res.status(404).json({ error: "Không tìm thấy chính sách" });

    await db.delete(governmentActivePolicies)
      .where(and(eq(governmentActivePolicies.governmentId, govId), eq(governmentActivePolicies.policyId, policyId)));

    let leaderName = "Lãnh đạo";
    if (gov.leaderNpcId) {
      const [l] = await db.select({ name: npcCores.name }).from(npcCores).where(eq(npcCores.id, gov.leaderNpcId));
      leaderName = l?.name ?? leaderName;
    }

    await db.insert(governmentPolicyHistory).values({
      governmentId:  govId,
      policyId,
      policyName:    policy.name,
      leaderName,
      action:        "deactivate",
      activatedAt:   new Date(),
      deactivatedAt: new Date(),
    });

    const logMsg = `Hủy bỏ chính sách "${policy.name}".`;
    await db.insert(npcGovernmentLogs).values({ governmentId: govId, event: logMsg });

    return res.json({ ok: true, message: `Đã hủy "${policy.name}".` });
  } catch (err) {
    console.error("[npc-policy] deactivate error:", err);
    return res.status(500).json({ error: "Lỗi hủy chính sách" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-policy/auto-decide/:worldSlug
   AI leader automatically activates/deactivates
   policies based on territory conditions
════════════════════════════════════════ */
router.post("/api/npc-policy/auto-decide/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (terrs.length === 0) return res.json({ decisions: 0, message: "Không có lãnh thổ" });

    const terrIds = terrs.map(t => t.id);
    const govs = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ decisions: 0, message: "Chưa có chính phủ" });

    const allPolicies = await db.select().from(governmentPolicies);
    const policyMap = Object.fromEntries(allPolicies.map(p => [p.name, p]));

    const activateByName = async (govId: string, name: string, reason: string) => {
      const p = policyMap[name];
      if (!p) return;
      const exists = await db.select().from(governmentActivePolicies)
        .where(and(eq(governmentActivePolicies.governmentId, govId), eq(governmentActivePolicies.policyId, p.id)));
      if (exists.length > 0) return;
      await db.insert(governmentActivePolicies).values({ governmentId: govId, policyId: p.id });
      await db.insert(npcGovernmentLogs).values({ governmentId: govId, event: `[Tự động] ${reason} → Ban hành "${name}".` });
    };

    const deactivateByName = async (govId: string, name: string) => {
      const p = policyMap[name];
      if (!p) return;
      await db.delete(governmentActivePolicies)
        .where(and(eq(governmentActivePolicies.governmentId, govId), eq(governmentActivePolicies.policyId, p.id)));
    };

    let decisions = 0;

    for (const gov of govs) {
      const terr = terrs.find(t => t.id === gov.territoryId);
      if (!terr) continue;

      /* Rule: low food → food subsidy */
      if (terr.prosperity < 30) {
        await activateByName(gov.id, "Trợ Cấp Lương Thực", "Nguồn thực phẩm thấp");
        decisions++;
      } else {
        await deactivateByName(gov.id, "Trợ Cấp Lương Thực");
      }

      /* Rule: low treasury → high tax; high treasury → low tax */
      if (gov.treasury < 100) {
        await activateByName(gov.id, "Thuế Cao", "Ngân quỹ cạn kiệt");
        await deactivateByName(gov.id, "Thuế Thấp");
        decisions++;
      } else if (gov.treasury > 500 && gov.approvalRate < 40) {
        await activateByName(gov.id, "Thuế Thấp", "Tỷ lệ ủng hộ thấp, ngân quỹ dồi dào");
        await deactivateByName(gov.id, "Thuế Cao");
        decisions++;
      }

      /* Rule: low approval → low tax */
      if (gov.approvalRate < 30) {
        await activateByName(gov.id, "Thuế Thấp", "Tỷ lệ ủng hộ nguy hiểm");
        decisions++;
      }

      /* Rule: low security → military expansion */
      if (terr.security < 30) {
        await activateByName(gov.id, "Mở Rộng Quân Sự", "An ninh nguy hiểm");
        decisions++;
      } else {
        await deactivateByName(gov.id, "Mở Rộng Quân Sự");
      }

      /* Rule: stagnant economy (prosperity < 40) → trade or infrastructure */
      if (terr.prosperity < 40) {
        await activateByName(gov.id, gov.treasury > 200 ? "Đầu Tư Hạ Tầng" : "Khuyến Khích Thương Mại",
          "Kinh tế trì trệ");
        decisions++;
      }
    }

    return res.json({ decisions, message: `Lãnh đạo đã ban hành ${decisions} quyết định chính sách.` });
  } catch (err) {
    console.error("[npc-policy] auto-decide error:", err);
    return res.status(500).json({ error: "Lỗi tự động quyết định chính sách" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-policy/apply-tick/:worldSlug
   Apply active policy effects to governments
   Called by world tick
════════════════════════════════════════ */
router.post("/api/npc-policy/apply-tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    await applyGovernmentPolicies(worldSlug);
    return res.json({ ok: true, message: "Đã áp dụng chính sách tick." });
  } catch (err) {
    console.error("[npc-policy] apply-tick error:", err);
    return res.status(500).json({ error: "Lỗi áp dụng chính sách" });
  }
});

/* ─── Exported for worldSimulation integration ─── */
export async function applyGovernmentPolicies(worldSlug: string): Promise<void> {
  try {
    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (terrs.length === 0) return;

    const terrIds = terrs.map(t => t.id);
    const govs = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return;

    for (const gov of govs) {
      const activePolicies = await db
        .select({ effects: governmentPolicies.effects, name: governmentPolicies.name })
        .from(governmentActivePolicies)
        .innerJoin(governmentPolicies, eq(governmentActivePolicies.policyId, governmentPolicies.id))
        .where(eq(governmentActivePolicies.governmentId, gov.id));

      if (activePolicies.length === 0) continue;

      const terr = terrs.find(t => t.id === gov.territoryId);
      if (!terr) continue;

      /* Aggregate effects */
      let dTax = 0, dApproval = 0, dFood = 0, dSecurity = 0, dProsperity = 0, dTreasury = 0;
      for (const p of activePolicies) {
        const e = p.effects as any;
        dTax        += e.taxAdjust         ?? 0;
        dApproval   += e.approvalAdjust    ?? 0;
        dFood       += e.foodAdjust        ?? 0;
        dSecurity   += e.securityAdjust    ?? 0;
        dProsperity += e.prosperityAdjust  ?? 0;
        dTreasury   -= e.treasuryCostPerTick ?? 0;
      }

      /* Tax adjustments also affect treasury: high tax → income boost */
      dTreasury += Math.floor(dTax * 2);

      /* Update government */
      const newApproval = Math.min(100, Math.max(0, gov.approvalRate + dApproval));
      const newTaxRate  = Math.min(50,  Math.max(0, gov.taxRate + dTax));
      const newTreasury = Math.max(0, gov.treasury + dTreasury);

      await db.update(npcGovernments)
        .set({ approvalRate: newApproval, taxRate: newTaxRate, treasury: newTreasury, updatedAt: new Date() })
        .where(eq(npcGovernments.id, gov.id));

      /* Update territory stats */
      const newProsperity = Math.min(100, Math.max(0, terr.prosperity + dProsperity + Math.floor(dFood * 0.3)));
      const newSecurity   = Math.min(100, Math.max(0, terr.security   + dSecurity));

      await db.update(territories)
        .set({ prosperity: newProsperity, security: newSecurity, updatedAt: new Date() })
        .where(eq(territories.id, terr.id));
    }
  } catch (err) {
    console.error("[npc-policy] applyGovernmentPolicies error:", err);
  }
}

export default router;
