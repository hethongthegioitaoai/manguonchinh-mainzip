import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories,
  npcLongTermGoals, npcPlans, npcPlanSteps, npcJobs,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ── Plan templates per goal type ── */
type PlanStep = { actionType: string; target: string };

const PLAN_TEMPLATES: Record<string, PlanStep[]> = {
  "làm_giàu": [
    { actionType: "tìm_việc",        target: "Tìm kiếm công việc có thu nhập tốt hơn" },
    { actionType: "làm_việc_chăm",   target: "Làm việc chăm chỉ, tích lũy kỹ năng và kinh nghiệm" },
    { actionType: "tiết_kiệm",       target: "Tiết kiệm ít nhất 50% thu nhập mỗi chu kỳ" },
    { actionType: "mở_cửa_hàng",     target: "Dùng vốn tích lũy mở cửa hàng buôn bán" },
    { actionType: "thuê_nhân_công",  target: "Thuê người làm để mở rộng quy mô" },
    { actionType: "mở_rộng",         target: "Mở rộng kinh doanh ra nhiều lĩnh vực" },
  ],
  "mua_nhà": [
    { actionType: "đánh_giá_tài_sản", target: "Đánh giá tài sản hiện tại, xác định mục tiêu tiết kiệm" },
    { actionType: "tiết_kiệm",        target: "Tiết kiệm nghiêm túc, hạn chế chi tiêu xa xỉ" },
    { actionType: "tìm_nhà",          target: "Khảo sát các khu vực có nhà phù hợp túi tiền" },
    { actionType: "đàm_phán",         target: "Đàm phán giá cả với chủ nhà" },
    { actionType: "mua_nhà",          target: "Hoàn tất thủ tục mua nhà, chuyển vào ở" },
  ],
  "lập_gia_đình": [
    { actionType: "giao_tiếp",        target: "Tích cực giao tiếp xã hội, mở rộng vòng bạn bè" },
    { actionType: "kết_bạn",          target: "Kết thân với những người phù hợp" },
    { actionType: "hẹn_hò",           target: "Tìm kiếm bạn đời tiềm năng" },
    { actionType: "cưới_hỏi",         target: "Đề xuất kết hôn khi quan hệ đủ sâu" },
    { actionType: "sinh_con",         target: "Xây dựng gia đình ấm no, sinh con đẻ cái" },
  ],
  "tham_gia_phe_phái": [
    { actionType: "tìm_hiểu",         target: "Tìm hiểu các hội nhóm uy tín đang hoạt động" },
    { actionType: "kết_nối",          target: "Kết nối với thành viên cốt cán của phe phái" },
    { actionType: "chứng_minh",       target: "Chứng minh năng lực qua các nhiệm vụ thử thách" },
    { actionType: "gia_nhập",         target: "Chính thức gia nhập phe phái" },
    { actionType: "xây_dựng_uy_tín",  target: "Xây dựng uy tín trong nội bộ phe phái" },
  ],
  "trở_thành_lãnh_đạo": [
    { actionType: "học_hỏi",          target: "Học hỏi từ các lãnh đạo hiện tại, tích lũy kiến thức" },
    { actionType: "tăng_uy_tín",      target: "Xây dựng danh tiếng tích cực trong cộng đồng" },
    { actionType: "gia_nhập_phe",     target: "Gia nhập phe phái hoặc tổ chức có uy tín" },
    { actionType: "tranh_cử",         target: "Đề cử bản thân vào vị trí lãnh đạo" },
    { actionType: "lãnh_đạo",         target: "Đảm nhận vai trò lãnh đạo, điều hành tổ chức" },
  ],
  "mở_rộng_kinh_doanh": [
    { actionType: "phân_tích_thị_trường", target: "Phân tích thị trường, xác định cơ hội kinh doanh" },
    { actionType: "mở_rộng_hàng_hoá",    target: "Đa dạng hóa mặt hàng kinh doanh" },
    { actionType: "tìm_đối_tác",          target: "Tìm đối tác kinh doanh chiến lược" },
    { actionType: "mở_chi_nhánh",         target: "Mở thêm chi nhánh tại vị trí đắc địa" },
    { actionType: "thống_lĩnh",           target: "Thống lĩnh thị trường trong lĩnh vực chuyên sâu" },
  ],
  "trở_thành_tướng_lĩnh": [
    { actionType: "rèn_luyện",         target: "Rèn luyện thể lực và kỹ năng chiến đấu mỗi ngày" },
    { actionType: "lập_công",          target: "Lập công trong các trận chiến, nâng cao uy danh" },
    { actionType: "tuyển_quân",        target: "Tuyển mộ binh lính trung thành" },
    { actionType: "chiến_lược",        target: "Học thuật chiến lược quân sự, bố trận" },
    { actionType: "trở_thành_tướng",   target: "Đạt danh hiệu tướng lĩnh, thống lĩnh quân đội" },
  ],
};

/* ── Check step completion based on NPC state ── */
function canCompleteStep(
  step: typeof npcPlanSteps.$inferSelect,
  npc: typeof npcCores.$inferSelect,
): { ok: boolean; reason: string } {
  const action = step.actionType;
  const money = npc.money;
  const happiness = npc.happiness;
  const energy = npc.energy;

  if (action === "tiết_kiệm")          return { ok: money >= 200, reason: money < 200 ? `Cần 200 vàng (đang có ${money})` : "✓" };
  if (action === "mở_cửa_hàng")        return { ok: money >= 500, reason: money < 500 ? `Cần 500 vàng vốn (đang có ${money})` : "✓" };
  if (action === "mua_nhà")            return { ok: money >= 800, reason: money < 800 ? `Cần 800 vàng (đang có ${money})` : "✓" };
  if (action === "kết_bạn" || action === "hẹn_hò")  return { ok: happiness >= 60, reason: happiness < 60 ? `Cần hạnh phúc ≥60 (đang ${happiness})` : "✓" };
  if (action === "sinh_con")           return { ok: happiness >= 70, reason: happiness < 70 ? `Cần hạnh phúc ≥70 (đang ${happiness})` : "✓" };
  if (action === "rèn_luyện")          return { ok: energy >= 50, reason: energy < 50 ? `Cần năng lượng ≥50 (đang ${energy})` : "✓" };
  if (action === "thuê_nhân_công")     return { ok: money >= 300, reason: money < 300 ? `Cần 300 vàng trả lương (đang có ${money})` : "✓" };
  if (action === "tìm_đối_tác")        return { ok: happiness >= 50, reason: happiness < 50 ? `Cần hạnh phúc tốt hơn (đang ${happiness})` : "✓" };

  // Default: random success (70%)
  const ok = Math.random() < 0.70;
  return { ok, reason: ok ? "✓" : "Chưa đủ điều kiện, tiếp tục chuẩn bị" };
}

/* ── Memory helper ── */
async function addMemory(npcId: string, event: string, importance: number) {
  await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event, importance });
}

/* ════════════════════════════════════════
   GET plans for a single NPC
════════════════════════════════════════ */
router.get("/npc-plans/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const plans = await db.select().from(npcPlans)
      .where(eq(npcPlans.npcId, npcId))
      .orderBy(desc(npcPlans.createdAt));

    const result = await Promise.all(plans.map(async (plan) => {
      const steps = await db.select().from(npcPlanSteps)
        .where(eq(npcPlanSteps.planId, plan.id))
        .orderBy(npcPlanSteps.stepOrder);
      let goal = null;
      if (plan.goalId) {
        const [g] = await db.select().from(npcLongTermGoals).where(eq(npcLongTermGoals.id, plan.goalId));
        goal = g ?? null;
      }
      return { ...plan, steps, goal };
    }));

    return res.json(result);
  } catch (err) { console.error("[npcPlans] GET:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET all plans for a world
════════════════════════════════════════ */
router.get("/npc-plans/world/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(eq(npcCores.worldSlug, worldSlug));

    const result = await Promise.all(npcs.map(async (npc) => {
      const activePlan = await db.select().from(npcPlans)
        .where(and(eq(npcPlans.npcId, npc.id), eq(npcPlans.status, "đang_thực_hiện")))
        .orderBy(desc(npcPlans.createdAt))
        .limit(1);

      if (activePlan.length === 0) return { npc, plan: null, steps: [], goal: null };

      const plan = activePlan[0];
      const steps = await db.select().from(npcPlanSteps)
        .where(eq(npcPlanSteps.planId, plan.id))
        .orderBy(npcPlanSteps.stepOrder);

      let goal = null;
      if (plan.goalId) {
        const [g] = await db.select().from(npcLongTermGoals).where(eq(npcLongTermGoals.id, plan.goalId));
        goal = g ?? null;
      }
      return { npc, plan, steps, goal };
    }));

    return res.json(result);
  } catch (err) { console.error("[npcPlans] world GET:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST auto-generate plans from active goals
════════════════════════════════════════ */
router.post("/npc-plans/auto-generate/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length === 0) return res.json({ message: "Không có NPC", generated: 0 });

    let generated = 0;

    for (const npc of npcs) {
      // Get active goals without a plan
      const activeGoals = await db.select().from(npcLongTermGoals)
        .where(and(eq(npcLongTermGoals.npcId, npc.id), eq(npcLongTermGoals.status, "active")))
        .orderBy(desc(npcLongTermGoals.priority));

      for (const goal of activeGoals) {
        // Check if this goal already has an active plan
        const existingPlans = await db.select({ id: npcPlans.id }).from(npcPlans)
          .where(and(eq(npcPlans.goalId, goal.id), eq(npcPlans.status, "đang_thực_hiện")));

        if (existingPlans.length > 0) continue;

        const template = PLAN_TEMPLATES[goal.goalType];
        if (!template) continue;

        const [plan] = await db.insert(npcPlans).values({
          npcId: npc.id,
          goalId: goal.id,
          currentStep: 0,
          status: "đang_thực_hiện",
        }).returning();

        for (let i = 0; i < template.length; i++) {
          await db.insert(npcPlanSteps).values({
            planId: plan.id,
            stepOrder: i,
            actionType: template[i].actionType,
            target: template[i].target,
            completed: false,
          });
        }

        const goalLabel = goal.goalType.replace(/_/g, " ");
        await addMemory(npc.id, `${npc.name} đã bắt đầu kế hoạch: "${goalLabel}" với ${template.length} bước thực hiện.`, 5);
        generated++;
        break; // One plan per NPC per tick
      }
    }

    return res.json({ message: `Đã tạo ${generated} kế hoạch mới`, generated });
  } catch (err) { console.error("[npcPlans] auto-generate:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST tick — advance plans for a world
════════════════════════════════════════ */
router.post("/npc-plans/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length === 0) return res.json({ message: "Không có NPC", advanced: 0, completed: 0, failed: 0 });

    let advanced = 0;
    let completed = 0;
    let failed = 0;
    const events: Array<{ npc: string; event: string }> = [];

    for (const npc of npcs) {
      const [activePlan] = await db.select().from(npcPlans)
        .where(and(eq(npcPlans.npcId, npc.id), eq(npcPlans.status, "đang_thực_hiện")))
        .orderBy(desc(npcPlans.createdAt));

      if (!activePlan) continue;

      const steps = await db.select().from(npcPlanSteps)
        .where(eq(npcPlanSteps.planId, activePlan.id))
        .orderBy(npcPlanSteps.stepOrder);

      if (steps.length === 0) continue;

      // Find current pending step
      const pendingStep = steps.find((s) => !s.completed);
      if (!pendingStep) {
        // All steps done — complete plan
        await db.update(npcPlans).set({ status: "hoàn_thành", updatedAt: new Date() }).where(eq(npcPlans.id, activePlan.id));
        const ev = `${npc.name} đã hoàn thành toàn bộ kế hoạch! Tất cả ${steps.length} bước đều đạt mục tiêu.`;
        await addMemory(npc.id, ev, 8);
        events.push({ npc: npc.name, event: ev });
        completed++;
        continue;
      }

      const { ok, reason } = canCompleteStep(pendingStep, npc);

      if (ok) {
        // Complete this step
        await db.update(npcPlanSteps).set({ completed: true }).where(eq(npcPlanSteps.id, pendingStep.id));
        await db.update(npcPlans).set({ currentStep: pendingStep.stepOrder + 1, updatedAt: new Date() }).where(eq(npcPlans.id, activePlan.id));

        const ev = `${npc.name} hoàn thành bước ${pendingStep.stepOrder + 1}: "${pendingStep.target}".`;
        await addMemory(npc.id, ev, 4);
        events.push({ npc: npc.name, event: ev });
        advanced++;

        // Check if all done
        const remaining = steps.filter((s) => !s.completed && s.id !== pendingStep.id);
        if (remaining.length === 0) {
          await db.update(npcPlans).set({ status: "hoàn_thành", updatedAt: new Date() }).where(eq(npcPlans.id, activePlan.id));
          const evDone = `${npc.name} hoàn thành kế hoạch! Đây là thành quả của sự kiên trì.`;
          await addMemory(npc.id, evDone, 8);
          events.push({ npc: npc.name, event: evDone });
          completed++;
        }
      } else {
        // Step failed — decide whether to retry or abandon
        const failCount = (activePlan.currentStep ?? 0);

        if (failCount >= 3 && Math.random() < 0.25) {
          // Abandon this plan
          await db.update(npcPlans).set({ status: "thất_bại", updatedAt: new Date() }).where(eq(npcPlans.id, activePlan.id));
          const ev = `${npc.name} từ bỏ kế hoạch: ${reason}. Cần lập kế hoạch mới.`;
          await addMemory(npc.id, ev, 6);
          events.push({ npc: npc.name, event: ev });
          failed++;

          // Auto-generate revised plan with different approach
          const goal = activePlan.goalId
            ? (await db.select().from(npcLongTermGoals).where(eq(npcLongTermGoals.id, activePlan.goalId)))[0]
            : null;

          if (goal && PLAN_TEMPLATES[goal.goalType]) {
            const template = PLAN_TEMPLATES[goal.goalType];
            const [newPlan] = await db.insert(npcPlans).values({
              npcId: npc.id, goalId: goal.id, currentStep: 0, status: "đang_thực_hiện",
            }).returning();

            // Skip first step (already tried), start from step 2
            const altSteps = template.slice(1);
            for (let i = 0; i < altSteps.length; i++) {
              await db.insert(npcPlanSteps).values({ planId: newPlan.id, stepOrder: i, actionType: altSteps[i].actionType, target: altSteps[i].target, completed: false });
            }
            await addMemory(npc.id, `${npc.name} điều chỉnh chiến lược — bắt đầu kế hoạch dự phòng.`, 5);
          }
        } else {
          // Log the block but keep trying
          const ev = `${npc.name} gặp trở ngại ở bước "${pendingStep.target}": ${reason}. Tiếp tục cố gắng.`;
          await addMemory(npc.id, ev, 3);
          events.push({ npc: npc.name, event: ev });
        }
      }
    }

    return res.json({ message: `Tick kế hoạch: ${advanced} tiến triển, ${completed} hoàn thành, ${failed} thất_bại`, advanced, completed, failed, events });
  } catch (err) { console.error("[npcPlans] tick:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET summary stats for a world
════════════════════════════════════════ */
router.get("/npc-plans/summary/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select({ id: npcCores.id }).from(npcCores).where(eq(npcCores.worldSlug, worldSlug));

    let active = 0, planCompleted = 0, planFailed = 0, totalSteps = 0, completedSteps = 0;

    for (const npc of npcs) {
      const plans = await db.select().from(npcPlans).where(eq(npcPlans.npcId, npc.id));
      for (const plan of plans) {
        if (plan.status === "đang_thực_hiện") active++;
        if (plan.status === "hoàn_thành") planCompleted++;
        if (plan.status === "thất_bại") planFailed++;

        const steps = await db.select().from(npcPlanSteps).where(eq(npcPlanSteps.planId, plan.id));
        totalSteps += steps.length;
        completedSteps += steps.filter((s) => s.completed).length;
      }
    }

    return res.json({ active, completed: planCompleted, failed: planFailed, totalSteps, completedSteps });
  } catch (err) { console.error("[npcPlans] summary:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
