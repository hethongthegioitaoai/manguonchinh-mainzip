import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories,
  npcLongTermGoals, npcRelationships, npcJobs,
} from "@workspace/db/schema";
import { eq, desc, and, count } from "drizzle-orm";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ── Goal config ── */
const GOAL_CONFIG: Record<string, { label: string; description: string; baseTarget: number; priorityBase: number }> = {
  "làm_giàu":              { label: "Làm Giàu", description: "Tích lũy tài sản vàng bạc", baseTarget: 2000, priorityBase: 3 },
  "mua_nhà":               { label: "Mua Nhà", description: "Dành dụm đủ tiền mua chỗ ở", baseTarget: 1000, priorityBase: 2 },
  "lập_gia_đình":          { label: "Lập Gia Đình", description: "Kết hôn và có con", baseTarget: 1, priorityBase: 2 },
  "tham_gia_phe_phái":     { label: "Tham Gia Phe Phái", description: "Gia nhập một hội nhóm có thế lực", baseTarget: 1, priorityBase: 1 },
  "trở_thành_lãnh_đạo":   { label: "Trở Thành Lãnh Đạo", description: "Vươn lên đứng đầu tổ chức", baseTarget: 100, priorityBase: 3 },
  "mở_rộng_kinh_doanh":   { label: "Mở Rộng Kinh Doanh", description: "Xây dựng đế chế thương mại", baseTarget: 3000, priorityBase: 2 },
  "trở_thành_tướng_lĩnh": { label: "Trở Thành Tướng Lĩnh", description: "Lãnh đạo một đội quân hùng mạnh", baseTarget: 50, priorityBase: 3 },
};

/* ── Auto-generate goals based on NPC traits ── */
function generateGoalsForNpc(
  npc: typeof npcCores.$inferSelect,
  personality: typeof npcPersonalities.$inferSelect | null,
  existingGoalTypes: string[],
  relationshipCount: number,
  hasJob: boolean,
): Array<{ goalType: string; targetValue: number; priority: number }> {
  const goals: Array<{ goalType: string; targetValue: number; priority: number }> = [];
  const p = personality;

  const add = (type: string, priorityMod = 0) => {
    if (existingGoalTypes.includes(type)) return;
    const cfg = GOAL_CONFIG[type];
    if (!cfg) return;
    goals.push({ goalType: type, targetValue: cfg.baseTarget, priority: cfg.priorityBase + priorityMod });
  };

  // Personality-based
  if (p) {
    if (p.greed > 0.7)       add("làm_giàu", 1);
    if (p.greed > 0.5)       add("mở_rộng_kinh_doanh");
    if (p.kindness > 0.7)    add("lập_gia_đình", 1);
    if (p.bravery > 0.75)    add("trở_thành_tướng_lĩnh", 1);
    if (p.intelligence > 0.8) add("trở_thành_lãnh_đạo", 1);
    if (p.curiosity > 0.7)   add("tham_gia_phe_phái");
    if (p.bravery > 0.5 && p.intelligence > 0.5) add("trở_thành_lãnh_đạo");
  }

  // Age-based
  if (npc.age >= 20 && npc.age <= 40 && relationshipCount < 2) add("lập_gia_đình");
  if (npc.age >= 25 && npc.money < 300) add("mua_nhà");

  // Wealth-based
  if (npc.money > 500 && hasJob) add("mở_rộng_kinh_doanh");
  if (npc.money < 200) add("làm_giàu");

  // Occupation-based
  const occ = npc.occupation.toLowerCase();
  if (occ.includes("thương") || occ.includes("buôn") || occ.includes("chủ")) add("mở_rộng_kinh_doanh", 1);
  if (occ.includes("kiếm") || occ.includes("vệ") || occ.includes("quân")) add("trở_thành_tướng_lĩnh", 1);
  if (occ.includes("lãnh") || occ.includes("đứng đầu")) add("trở_thành_lãnh_đạo", 2);

  // Always at least one baseline goal
  if (goals.length === 0 && !existingGoalTypes.includes("làm_giàu")) {
    add("làm_giàu");
  }

  // Limit to 3 goals at a time
  return goals.slice(0, 3);
}

/* ── Goal tick: advance progress based on NPC state ── */
function tickProgress(goal: typeof npcLongTermGoals.$inferSelect, npc: typeof npcCores.$inferSelect): number {
  const type = goal.goalType;
  let delta = 0;

  if (type === "làm_giàu" || type === "mua_nhà" || type === "mở_rộng_kinh_doanh") {
    delta = Math.max(0, Math.round(npc.money * 0.05));
  } else if (type === "trở_thành_lãnh_đạo" || type === "tham_gia_phe_phái") {
    delta = npc.happiness > 60 ? rand(1, 3) : rand(0, 1);
  } else if (type === "lập_gia_đình") {
    delta = npc.happiness > 70 ? rand(0, 1) : 0;
  } else if (type === "trở_thành_tướng_lĩnh") {
    const occ = npc.occupation.toLowerCase();
    const isMilitary = occ.includes("kiếm") || occ.includes("vệ") || occ.includes("quân");
    delta = isMilitary ? rand(1, 4) : rand(0, 1);
  }

  return delta;
}

function goalMemory(goalType: string, npc: typeof npcCores.$inferSelect, progress: number, target: number): string | null {
  const label = GOAL_CONFIG[goalType]?.label ?? goalType;
  const pct = Math.round((progress / target) * 100);
  if (progress === 0) return `${npc.name} đặt mục tiêu: ${label}.`;
  if (pct === 25) return `${npc.name} đã hoàn thành 25% mục tiêu "${label}".`;
  if (pct === 50) return `${npc.name} tiến được nửa đường đến "${label}" — không bỏ cuộc!`;
  if (pct === 75) return `${npc.name} sắp đạt mục tiêu "${label}" — còn 25% nữa!`;
  return null;
}

/* ════════════════════════════════════════
   GET goals for a single NPC
════════════════════════════════════════ */
router.get("/api/npc-goals/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const goals = await db.select().from(npcLongTermGoals)
      .where(eq(npcLongTermGoals.npcId, npcId))
      .orderBy(desc(npcLongTermGoals.priority), desc(npcLongTermGoals.createdAt));
    return res.json(goals);
  } catch (err) { console.error("[npcGoals] GET:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET goals for all NPCs in a world
════════════════════════════════════════ */
router.get("/api/npc-goals/world/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(eq(npcCores.worldSlug, worldSlug));
    const results = await Promise.all(npcs.map(async (npc) => {
      const goals = await db.select().from(npcLongTermGoals)
        .where(eq(npcLongTermGoals.npcId, npc.id))
        .orderBy(desc(npcLongTermGoals.priority));
      return { npc, goals };
    }));
    return res.json(results);
  } catch (err) { console.error("[npcGoals] world GET:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST auto-generate goals for all NPCs in a world
════════════════════════════════════════ */
router.post("/api/npc-goals/auto-generate/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length === 0) return res.json({ message: "Không có NPC", generated: 0 });

    let generated = 0;
    for (const npc of npcs) {
      const [personality] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npc.id));
      const [job] = await db.select().from(npcJobs).where(eq(npcJobs.npcCoreId, npc.id));
      const relationships = await db.select({ id: npcRelationships.id }).from(npcRelationships)
        .where(eq(npcRelationships.npcAId, npc.id));
      const existingGoals = await db.select({ goalType: npcLongTermGoals.goalType }).from(npcLongTermGoals)
        .where(and(eq(npcLongTermGoals.npcId, npc.id), eq(npcLongTermGoals.status, "active")));

      const existingTypes = existingGoals.map((g) => g.goalType);
      const newGoals = generateGoalsForNpc(npc, personality ?? null, existingTypes, relationships.length, !!job);

      for (const g of newGoals) {
        await db.insert(npcLongTermGoals).values({
          npcId: npc.id,
          goalType: g.goalType,
          targetValue: g.targetValue,
          progress: 0,
          priority: g.priority,
          status: "active",
        });
        await db.insert(npcCoreMemories).values({
          npcCoreId: npc.id,
          event: goalMemory(g.goalType, npc, 0, g.targetValue) ?? `${npc.name} đặt mục tiêu mới: ${GOAL_CONFIG[g.goalType]?.label}.`,
          importance: 4,
        });
        generated++;
      }
    }

    return res.json({ message: `Đã sinh ${generated} mục tiêu cho ${npcs.length} NPC`, generated });
  } catch (err) { console.error("[npcGoals] auto-generate:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST tick — advance all active goals in a world
════════════════════════════════════════ */
router.post("/api/npc-goals/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length === 0) return res.json({ message: "Không có NPC", completed: 0, advanced: 0 });

    let advanced = 0;
    let completed = 0;
    const events: Array<{ npc: string; goal: string; event: string }> = [];

    for (const npc of npcs) {
      const goals = await db.select().from(npcLongTermGoals)
        .where(and(eq(npcLongTermGoals.npcId, npc.id), eq(npcLongTermGoals.status, "active")))
        .orderBy(desc(npcLongTermGoals.priority));

      // Focus on top-priority goal each tick
      const topGoal = goals[0];
      if (!topGoal) continue;

      const delta = tickProgress(topGoal, npc);
      if (delta <= 0) continue;

      const newProgress = Math.min(topGoal.progress + delta, topGoal.targetValue);
      const cfg = GOAL_CONFIG[topGoal.goalType];
      const oldPct = Math.floor((topGoal.progress / topGoal.targetValue) * 100);
      const newPct = Math.floor((newProgress / topGoal.targetValue) * 100);

      if (newProgress >= topGoal.targetValue) {
        // Goal completed!
        await db.update(npcLongTermGoals)
          .set({ progress: topGoal.targetValue, status: "completed", updatedAt: new Date() })
          .where(eq(npcLongTermGoals.id, topGoal.id));

        const completionEvent = `${npc.name} đã hoàn thành mục tiêu "${cfg?.label ?? topGoal.goalType}"! Thành tựu vĩ đại!`;
        await db.insert(npcCoreMemories).values({ npcCoreId: npc.id, event: completionEvent, importance: 8 });
        events.push({ npc: npc.name, goal: cfg?.label ?? topGoal.goalType, event: completionEvent });
        completed++;

        // Auto-generate next goal
        const [personality] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npc.id));
        const [job] = await db.select().from(npcJobs).where(eq(npcJobs.npcCoreId, npc.id));
        const remaining = goals.slice(1).map((g) => g.goalType);
        const nextGoals = generateGoalsForNpc(npc, personality ?? null, remaining, 0, !!job);
        if (nextGoals.length > 0) {
          const ng = nextGoals[0];
          await db.insert(npcLongTermGoals).values({ npcId: npc.id, goalType: ng.goalType, targetValue: ng.targetValue, progress: 0, priority: ng.priority, status: "active" });
          await db.insert(npcCoreMemories).values({ npcCoreId: npc.id, event: `${npc.name} đặt mục tiêu tiếp theo: ${GOAL_CONFIG[ng.goalType]?.label}.`, importance: 4 });
        }
      } else {
        await db.update(npcLongTermGoals)
          .set({ progress: newProgress, updatedAt: new Date() })
          .where(eq(npcLongTermGoals.id, topGoal.id));

        // Milestone memory at 25/50/75%
        const milestones = [25, 50, 75];
        for (const ms of milestones) {
          if (oldPct < ms && newPct >= ms) {
            const mem = goalMemory(topGoal.goalType, npc, newProgress, topGoal.targetValue);
            if (mem) {
              await db.insert(npcCoreMemories).values({ npcCoreId: npc.id, event: mem, importance: 5 });
              events.push({ npc: npc.name, goal: cfg?.label ?? topGoal.goalType, event: mem });
            }
          }
        }
        advanced++;
      }
    }

    return res.json({ message: `Tick mục tiêu: ${advanced} tiến triển, ${completed} hoàn thành`, advanced, completed, events });
  } catch (err) { console.error("[npcGoals] tick:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET summary stats for a world
════════════════════════════════════════ */
router.get("/api/npc-goals/summary/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, worldSlug));
    const npcIds = npcs.map((n) => n.id);
    if (npcIds.length === 0) return res.json({ total: 0, active: 0, completed: 0, byType: {} });

    let total = 0;
    let active = 0;
    let completed = 0;
    const byType: Record<string, number> = {};

    for (const npcId of npcIds) {
      const goals = await db.select().from(npcLongTermGoals).where(eq(npcLongTermGoals.npcId, npcId));
      for (const g of goals) {
        total++;
        if (g.status === "active") active++;
        if (g.status === "completed") completed++;
        byType[g.goalType] = (byType[g.goalType] ?? 0) + 1;
      }
    }

    return res.json({ total, active, completed, byType });
  } catch (err) { console.error("[npcGoals] summary:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
