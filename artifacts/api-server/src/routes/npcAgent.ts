import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories, npcRelationships,
  npcEmotions, npcLongTermGoals, npcPlans, npcPlanSteps,
  npcFactionMembers, npcFactions, npcFamilies, npcGovernments,
  npcJobs, npcAgentLogs,
} from "@workspace/db/schema";
import { eq, desc, and, or, asc, lt, gt, ne } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
export interface AgentContext {
  npc: {
    id: string; name: string; age: number; occupation: string;
    money: number; energy: number; happiness: number;
    hunger: number; tickCount: number; worldSlug: string;
    currentGoal: string | null;
  };
  personality: { kindness: number; greed: number; bravery: number; intelligence: number; curiosity: number } | null;
  emotion: { happiness: number; anger: number; fear: number; sadness: number; confidence: number; stress: number } | null;
  job: { jobType: string; salary: number; skillLevel: number } | null;
  goals: Array<{ id: string; goalType: string; progress: number; targetValue: number; status: string; priority: number }>;
  currentPlan: { id: string; steps: Array<{ actionType: string; target: string; completed: boolean }> } | null;
  relationships: Array<{ npcId: string; score: number; type: string }>;
  importantMemories: Array<{ event: string; importance: number }>;
  faction: { id: string; name: string; type: string; role: string } | null;
  family: { spouseId: string | null; fatherId: string | null; motherId: string | null; familyName: string | null } | null;
  politicalRole: string | null;
  availableFactions: Array<{ id: string; name: string; type: string }>;
  crisisLevel: "none" | "low" | "medium" | "high";
  triggerReason: string;
}

export type DecisionType =
  | "change_job" | "join_faction" | "leave_faction" | "run_for_office"
  | "invest" | "expand_business" | "declare_goal" | "make_friend" | "none";

export interface AgentDecision {
  type: DecisionType;
  params: Record<string, unknown>;
  reasoning: string;
  explanation: string;
  confidence: number;
}

/* ════════════════════════════════════════
   CRISIS ASSESSMENT
════════════════════════════════════════ */
function assessCrisis(
  npc: AgentContext["npc"],
  emotion: AgentContext["emotion"],
): { level: AgentContext["crisisLevel"]; reason: string } {
  if (!emotion) return { level: "none", reason: "" };

  if (emotion.anger > 80 && npc.money < 100)
    return { level: "high", reason: "Vừa tức giận cực độ lại nghèo túng — cần hành động khẩn cấp" };
  if (emotion.fear > 80)
    return { level: "high", reason: "Đang sợ hãi tột độ — phải tìm cách thoát hiểm" };
  if (npc.money < 30)
    return { level: "high", reason: "Gần như phá sản — phải thay đổi ngay" };
  if (emotion.anger > 65 || emotion.sadness > 70)
    return { level: "medium", reason: "Tâm lý tiêu cực kéo dài — cần định hướng lại" };
  if (npc.money < 100 || emotion.stress > 75)
    return { level: "medium", reason: "Tài chính eo hẹp, căng thẳng cao" };
  if (emotion.confidence > 75 && npc.money > 400)
    return { level: "low", reason: "Tự tin cao, kinh tế tốt — cơ hội mở rộng chiến lược" };
  return { level: "none", reason: "" };
}

/* ════════════════════════════════════════
   AGENT CONTEXT BUILDER
   Tổng hợp toàn bộ ngữ cảnh NPC cho quyết định
════════════════════════════════════════ */
async function buildAgentContext(npcId: string, trigger: string): Promise<AgentContext | null> {
  const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
  if (!npc) return null;

  const [personality] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npcId));
  const [emotion] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npcId));
  const [job] = await db.select().from(npcJobs).where(eq(npcJobs.npcCoreId, npcId)).limit(1);

  const goals = await db.select().from(npcLongTermGoals)
    .where(eq(npcLongTermGoals.npcId, npcId))
    .orderBy(asc(npcLongTermGoals.priority)).limit(5);

  const [activePlan] = await db.select().from(npcPlans)
    .where(and(eq(npcPlans.npcId, npcId), eq(npcPlans.status, "đang_thực_hiện")))
    .orderBy(desc(npcPlans.updatedAt)).limit(1);

  let currentPlan: AgentContext["currentPlan"] = null;
  if (activePlan) {
    const steps = await db.select().from(npcPlanSteps)
      .where(eq(npcPlanSteps.planId, activePlan.id))
      .orderBy(npcPlanSteps.stepOrder).limit(6);
    currentPlan = { id: activePlan.id, steps: steps.map(s => ({ actionType: s.actionType, target: s.target, completed: s.completed })) };
  }

  // Top relationships
  const rels = await db.select().from(npcRelationships)
    .where(or(eq(npcRelationships.npcAId, npcId), eq(npcRelationships.npcBId, npcId)))
    .orderBy(desc(npcRelationships.relationshipScore)).limit(5);

  const relationships = rels.map(r => ({
    npcId: r.npcAId === npcId ? r.npcBId : r.npcAId,
    score: r.relationshipScore,
    type: r.relationshipType,
  }));

  // Important memories
  const mems = await db.select().from(npcCoreMemories)
    .where(eq(npcCoreMemories.npcCoreId, npcId))
    .orderBy(desc(npcCoreMemories.importance), desc(npcCoreMemories.timestamp))
    .limit(6);

  // Current faction
  const [factionMember] = await db.select({ factionId: npcFactionMembers.factionId, role: npcFactionMembers.role })
    .from(npcFactionMembers).where(eq(npcFactionMembers.npcId, npcId)).limit(1);

  let faction: AgentContext["faction"] = null;
  if (factionMember) {
    const [fRow] = await db.select().from(npcFactions).where(eq(npcFactions.id, factionMember.factionId));
    if (fRow) faction = { id: fRow.id, name: fRow.name, type: fRow.type, role: factionMember.role };
  }

  // Available factions to join (in same world)
  const availableFactions = await db.select({ id: npcFactions.id, name: npcFactions.name, type: npcFactions.type })
    .from(npcFactions)
    .where(eq(npcFactions.worldSlug, npc.worldSlug))
    .limit(5);

  const [familyRow] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcId)).limit(1);
  const family = familyRow ? { spouseId: familyRow.spouseId, fatherId: familyRow.fatherId, motherId: familyRow.motherId, familyName: familyRow.familyName } : null;

  const [govRow] = await db.select().from(npcGovernments).where(eq(npcGovernments.leaderNpcId, npcId)).limit(1);
  const politicalRole = govRow ? `Lãnh đạo ${govRow.govType}` : null;

  const crisis = assessCrisis(
    { id: npc.id, name: npc.name, age: npc.age, occupation: npc.occupation, money: npc.money, energy: npc.energy, happiness: npc.happiness, hunger: npc.hunger, tickCount: npc.tickCount, worldSlug: npc.worldSlug, currentGoal: npc.currentGoal },
    emotion ?? null,
  );

  return {
    npc: { id: npc.id, name: npc.name, age: npc.age, occupation: npc.occupation, money: npc.money, energy: npc.energy, happiness: npc.happiness, hunger: npc.hunger, tickCount: npc.tickCount, worldSlug: npc.worldSlug, currentGoal: npc.currentGoal },
    personality: personality ? { kindness: personality.kindness, greed: personality.greed, bravery: personality.bravery, intelligence: personality.intelligence, curiosity: personality.curiosity } : null,
    emotion: emotion ? { happiness: emotion.happiness, anger: emotion.anger, fear: emotion.fear, sadness: emotion.sadness, confidence: emotion.confidence, stress: emotion.stress } : null,
    job: job ? { jobType: job.jobType, salary: job.salary, skillLevel: job.skillLevel } : null,
    goals: goals.map(g => ({ id: g.id, goalType: g.goalType, progress: g.progress, targetValue: g.targetValue, status: g.status, priority: g.priority })),
    currentPlan, relationships,
    importantMemories: mems.map(m => ({ event: m.event, importance: m.importance })),
    faction, family, politicalRole, availableFactions,
    crisisLevel: crisis.level,
    triggerReason: trigger === "auto" ? crisis.reason : trigger,
  };
}

/* ════════════════════════════════════════
   AGENT PROMPT GENERATOR
════════════════════════════════════════ */
function buildAgentPrompt(ctx: AgentContext): string {
  const { npc, personality: p, emotion: e, job, goals, faction, family, politicalRole, relationships, importantMemories, availableFactions, crisisLevel, triggerReason } = ctx;

  const pDesc: string[] = [];
  if (p) {
    if (p.kindness > 0.7) pDesc.push("tốt bụng"); else if (p.kindness < 0.3) pDesc.push("lạnh lùng");
    if (p.greed > 0.7) pDesc.push("tham lam, tham vọng cao"); else if (p.greed < 0.3) pDesc.push("vô tư, ít ham muốn");
    if (p.bravery > 0.7) pDesc.push("dũng cảm"); else if (p.bravery < 0.3) pDesc.push("nhút nhát");
    if (p.intelligence > 0.7) pDesc.push("thông minh, sắc bén");
    if (p.curiosity > 0.7) pDesc.push("tò mò, ham khám phá");
  }

  const eDesc: string[] = [];
  if (e) {
    if (e.anger > 65) eDesc.push(`tức giận (${e.anger}/100)`);
    if (e.fear > 65) eDesc.push(`sợ hãi (${e.fear}/100)`);
    if (e.happiness > 70) eDesc.push(`vui vẻ (${e.happiness}/100)`);
    if (e.sadness > 65) eDesc.push(`buồn bã (${e.sadness}/100)`);
    if (e.confidence > 70) eDesc.push(`tự tin (${e.confidence}/100)`);
    if (e.stress > 70) eDesc.push(`căng thẳng (${e.stress}/100)`);
    if (eDesc.length === 0) eDesc.push("bình thường");
  }

  const goalDesc = goals.length > 0
    ? goals.slice(0, 3).map(g => `"${g.goalType}" (${g.progress}/${g.targetValue})`).join(", ")
    : "chưa có mục tiêu rõ ràng";

  const memDesc = importantMemories.length > 0
    ? importantMemories.slice(0, 4).map(m => `• ${m.event} [tầm quan trọng: ${m.importance}]`).join("\n")
    : "• Không có ký ức đặc biệt";

  const relDesc = relationships.length > 0
    ? relationships.slice(0, 3).map(r => `${r.type} (điểm: ${r.score > 0 ? "+" : ""}${r.score})`).join(", ")
    : "không có quan hệ đặc biệt";

  const factionDesc = faction ? `Thành viên ${faction.role} của "${faction.name}" (${faction.type})` : "Chưa thuộc phe nào";
  const availFactionDesc = availableFactions.length > 0
    ? availableFactions.map(f => `"${f.name}" (${f.type})`).join(", ")
    : "không có phe nào";

  const crisis: Record<string, string> = {
    high: "⚠️ KHỦNG HOẢNG NGHIÊM TRỌNG",
    medium: "⚡ THAY ĐỔI ĐÁNG KỂ",
    low: "💡 CƠ HỘI CHIẾN LƯỢC",
    none: "📋 ĐÁNH GIÁ ĐỊNH KỲ",
  };

  const jobTypes = ["nông dân", "thương nhân", "thợ rèn", "thầy thuốc", "lính", "thầy giáo", "quan chức", "thám tử", "mưu sĩ"];
  const jobDesc = jobTypes.filter(j => j !== npc.occupation).join(", ");

  return `Bạn là một hệ thống AI ra quyết định cho NPC trong game nhập vai. Hãy phân tích tình huống và đưa ra quyết định tối ưu cho nhân vật.

${crisis[crisisLevel]} — ${triggerReason}

=== NHÂN VẬT: ${npc.name.toUpperCase()} ===
• Tuổi: ${npc.age} | Nghề: ${npc.occupation} | Vàng: ${npc.money} | Năng lượng: ${npc.energy}%
• Giai đoạn đời: ${npc.age < 18 ? "trẻ em" : npc.age < 60 ? "trưởng thành" : "lão niên"}
${politicalRole ? `• Chức vụ chính trị: ${politicalRole}` : ""}
${family?.familyName ? `• Gia đình: dòng họ ${family.familyName}` : ""}

=== TÍNH CÁCH ===
${pDesc.length > 0 ? pDesc.join(", ") : "Bình thường, không nổi bật"}

=== CẢM XÚC HIỆN TẠI ===
${eDesc.join(", ")}

=== CÔNG VIỆC ===
Hiện tại: ${job ? `${job.jobType} (lương ${job.salary}/tick, kỹ năng ${Math.round(job.skillLevel * 100)}%)` : npc.occupation}

=== MỤC TIÊU DÀI HẠN ===
${goalDesc}

=== KÝ ỨC QUAN TRỌNG ===
${memDesc}

=== QUAN HỆ ===
${relDesc}

=== PHE PHÁI ===
${factionDesc}
Các phe có thể gia nhập: ${availFactionDesc}

=== QUYẾT ĐỊNH CÓ THỂ THỰC HIỆN ===
1. "change_job" — Đổi sang nghề khác. Các nghề: ${jobDesc}
2. "join_faction" — Gia nhập một phe phái. params: { faction_id, faction_name }
3. "leave_faction" — Rời phe phái hiện tại. (chỉ khi đang trong phe)
4. "run_for_office" — Tranh cử lãnh đạo. params: { gov_type }
5. "invest" — Đầu tư tiền vào kinh doanh. params: { amount, reason }
6. "expand_business" — Mở rộng hoặc nâng cấp công việc hiện tại.
7. "declare_goal" — Tuyên bố mục tiêu mới. params: { goalType, targetValue }
8. "make_friend" — Chủ động kết thân với người có quan hệ tốt.
9. "none" — Không hành động, tiếp tục quan sát.

=== YÊU CẦU PHẢN HỒI ===
Phân tích tình huống và trả về JSON hợp lệ (không có markdown, chỉ JSON thuần):
{
  "reasoning": "Phân tích chi tiết tình huống, tại sao cần hành động này (2-4 câu tiếng Việt)",
  "decision_type": "<tên quyết định>",
  "decision_params": { <tham số nếu cần> },
  "confidence": <0.0 đến 1.0>,
  "explanation": "Tóm tắt ngắn gọn quyết định (1 câu)"
}`.trim();
}

/* ════════════════════════════════════════
   RULE-BASED FALLBACK DECISION ENGINE
════════════════════════════════════════ */
function ruleBasedDecision(ctx: AgentContext): AgentDecision {
  const { npc, personality: p, emotion: e, faction, goals, availableFactions, crisisLevel, job } = ctx;

  const kindness   = p?.kindness   ?? 0.5;
  const greed      = p?.greed      ?? 0.5;
  const bravery    = p?.bravery    ?? 0.5;
  const intel      = p?.intelligence ?? 0.5;
  const curiosity  = p?.curiosity  ?? 0.5;
  const anger      = e?.anger      ?? 0;
  const fear       = e?.fear       ?? 0;
  const confidence = e?.confidence ?? 50;
  const stress     = e?.stress     ?? 0;
  const happiness  = e?.happiness  ?? 50;

  // HIGH CRISIS — money emergency
  if (npc.money < 30) {
    if (job && job.salary < 30) {
      return {
        type: "change_job",
        params: { new_occupation: "thương nhân", reason: "cần thu nhập cao hơn" },
        reasoning: `${npc.name} gần như phá sản với chỉ ${npc.money} vàng. Nghề hiện tại (${npc.occupation}) trả lương quá thấp. Cần chuyển sang nghề có thu nhập cao hơn để thoát khỏi khủng hoảng kinh tế.`,
        explanation: "Đổi sang nghề thương nhân để tăng thu nhập khẩn cấp",
        confidence: 0.85,
      };
    }
    return {
      type: "declare_goal",
      params: { goalType: "thoát khỏi nghèo đói", targetValue: 500, priority: 1 },
      reasoning: `${npc.name} đang trong tình trạng khẩn cấp về tài chính (${npc.money} vàng). Cần đặt mục tiêu kinh tế rõ ràng để tập trung hành động.`,
      explanation: "Tuyên bố mục tiêu thoát nghèo khẩn cấp",
      confidence: 0.90,
    };
  }

  // HIGH ANGER — seek alliance or revenge
  if (anger > 75 && !faction && availableFactions.length > 0) {
    const targetFaction = availableFactions[0];
    return {
      type: "join_faction",
      params: { faction_id: targetFaction.id, faction_name: targetFaction.name, reason: "tìm kiếm đồng minh khi tức giận" },
      reasoning: `${npc.name} đang tức giận cực độ (${anger}/100) và không có phe phái hỗ trợ. Gia nhập "${targetFaction.name}" sẽ cung cấp sức mạnh tập thể và bảo vệ cần thiết.`,
      explanation: `Gia nhập phe ${targetFaction.name} để tìm sức mạnh đồng minh`,
      confidence: 0.78,
    };
  }

  // HIGH FEAR — leave dangerous faction or none
  if (fear > 80 && faction) {
    return {
      type: "leave_faction",
      params: { reason: "quá sợ hãi, cần tránh xa xung đột" },
      reasoning: `${npc.name} đang sợ hãi tột độ (${fear}/100). Ở lại phe "${faction.name}" khiến ${npc.name} liên tục đối mặt với nguy hiểm. Tách ra để giảm rủi ro.`,
      explanation: "Rời phe phái để tránh nguy hiểm",
      confidence: 0.72,
    };
  }

  // HIGH CONFIDENCE + MONEY → political ambition
  if (confidence > 75 && npc.money > 500 && bravery > 0.7 && !ctx.politicalRole) {
    return {
      type: "run_for_office",
      params: { gov_type: "village_council", reason: "đủ tự tin và tiền bạc để tranh cử" },
      reasoning: `${npc.name} đang ở đỉnh cao tự tin (${confidence}/100) với ${npc.money} vàng tích lũy và tính cách dũng cảm. Đây là thời điểm lý tưởng để bước vào chính trường.`,
      explanation: "Tranh cử hội đồng làng nhờ tự tin và kinh tế vững",
      confidence: 0.75,
    };
  }

  // GREED + MONEY → invest
  if (greed > 0.65 && npc.money > 300 && confidence > 55) {
    const amount = Math.floor(npc.money * 0.4);
    return {
      type: "invest",
      params: { amount, reason: "mở rộng kinh doanh" },
      reasoning: `${npc.name} có bản năng tham lam cao và đang nắm ${npc.money} vàng. Đầu tư ${amount} vàng vào kinh doanh sẽ nhân số tiền này lên.`,
      explanation: `Đầu tư ${amount} vàng để sinh lời`,
      confidence: 0.70,
    };
  }

  // HIGH SKILL → expand business
  if (job && job.skillLevel > 0.8 && intel > 0.6) {
    return {
      type: "expand_business",
      params: { reason: "kỹ năng cao, đủ điều kiện mở rộng" },
      reasoning: `${npc.name} đã đạt kỹ năng ${Math.round(job.skillLevel * 100)}% trong nghề ${job.jobType}. Đây là lúc mở rộng quy mô để tăng thu nhập.`,
      explanation: "Mở rộng quy mô công việc nhờ kỹ năng cao",
      confidence: 0.73,
    };
  }

  // CURIOSITY + SKILLS MAXED → change job
  if (curiosity > 0.75 && job && job.skillLevel > 0.9) {
    const newJobs = ["thầy thuốc", "mưu sĩ", "thầy giáo", "thám tử"].filter(j => j !== npc.occupation);
    return {
      type: "change_job",
      params: { new_occupation: newJobs[0] ?? "thầy giáo", reason: "muốn khám phá lĩnh vực mới" },
      reasoning: `${npc.name} là người tò mò (${Math.round(curiosity * 100)}%) và đã thành thạo nghề ${npc.occupation}. Đây là lúc chuyển sang lĩnh vực mới để phát triển.`,
      explanation: "Chuyển nghề vì đã thành thạo và muốn khám phá",
      confidence: 0.68,
    };
  }

  // SADNESS → declare new goal for meaning
  if ((e?.sadness ?? 0) > 70 && goals.length === 0) {
    return {
      type: "declare_goal",
      params: { goalType: "tìm lại ý nghĩa cuộc sống", targetValue: 1, priority: 1 },
      reasoning: `${npc.name} đang buồn bã sâu sắc (${e?.sadness}/100) mà không có mục tiêu nào để hướng đến. Đặt ra một mục tiêu mới sẽ giúp tìm lại động lực sống.`,
      explanation: "Tuyên bố mục tiêu mới để thoát khỏi buồn bã",
      confidence: 0.65,
    };
  }

  // KINDNESS + good relationship → make friend
  if (kindness > 0.7 && ctx.relationships.length > 0 && happiness > 60) {
    return {
      type: "make_friend",
      params: { reason: "tính cách tốt bụng, muốn kết thân" },
      reasoning: `${npc.name} là người tốt bụng (${Math.round(kindness * 100)}%) và đang vui vẻ (${happiness}/100). Đây là lúc chủ động phát triển các mối quan hệ xã hội.`,
      explanation: "Chủ động kết bạn nhờ bản tính tốt bụng",
      confidence: 0.60,
    };
  }

  // DEFAULT — observe
  return {
    type: "none",
    params: {},
    reasoning: `${npc.name} đang trong trạng thái ổn định. Không có sự kiện đặc biệt nào cần hành động ngay. Tiếp tục quan sát và chờ đợi cơ hội phù hợp.`,
    explanation: "Quan sát và chờ đợi thời điểm phù hợp",
    confidence: 0.55,
  };
}

/* ════════════════════════════════════════
   GEMINI AGENT REASONING
════════════════════════════════════════ */
async function callGeminiAgent(ctx: AgentContext): Promise<AgentDecision> {
  const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

  const prompt = buildAgentPrompt(ctx);
  const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: prompt, config: { maxOutputTokens: 512, temperature: 0.7, responseMimeType: "application/json" } });
  const raw = (r.text ?? "").trim();

  const parsed = JSON.parse(raw);
  return {
    type: (parsed.decision_type ?? "none") as DecisionType,
    params: parsed.decision_params ?? {},
    reasoning: parsed.reasoning ?? "",
    explanation: parsed.explanation ?? "",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
  };
}

/* ════════════════════════════════════════
   EXECUTE DECISION — applies changes to DB
════════════════════════════════════════ */
async function executeDecision(npcId: string, decision: AgentDecision, ctx: AgentContext): Promise<boolean> {
  const { npc } = ctx;
  try {
    switch (decision.type) {
      case "change_job": {
        const newOcc = (decision.params.new_occupation as string) ?? "thương nhân";
        await db.update(npcCores).set({ occupation: newOcc }).where(eq(npcCores.id, npcId));
        const [existingJob] = await db.select().from(npcJobs).where(eq(npcJobs.npcCoreId, npcId));
        if (existingJob) {
          await db.update(npcJobs).set({ jobType: newOcc, skillLevel: 0.3 }).where(eq(npcJobs.npcCoreId, npcId));
        } else {
          await db.insert(npcJobs).values({ npcCoreId: npcId, jobType: newOcc, salary: 25, skillLevel: 0.3 });
        }
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Đổi sang nghề ${newOcc}: ${decision.explanation}`, importance: 6 });
        return true;
      }

      case "join_faction": {
        const factionId = decision.params.faction_id as string;
        if (!factionId) return false;
        // Check if already in this faction
        const [existing] = await db.select().from(npcFactionMembers)
          .where(and(eq(npcFactionMembers.npcId, npcId), eq(npcFactionMembers.factionId, factionId)));
        if (existing) return false;
        await db.insert(npcFactionMembers).values({ npcId, factionId, role: "member" });
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Gia nhập phe "${decision.params.faction_name}": ${decision.explanation}`, importance: 7 });
        return true;
      }

      case "leave_faction": {
        if (!ctx.faction) return false;
        await db.delete(npcFactionMembers).where(and(eq(npcFactionMembers.npcId, npcId), eq(npcFactionMembers.factionId, ctx.faction.id)));
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Rời phe "${ctx.faction.name}": ${decision.explanation}`, importance: 7 });
        return true;
      }

      case "declare_goal": {
        const goalType = (decision.params.goalType as string) ?? "đạt được mục tiêu mới";
        const targetValue = Number(decision.params.targetValue) || 1;
        const priority = Number(decision.params.priority) || 1;
        await db.insert(npcLongTermGoals).values({ npcId, goalType, targetValue, progress: 0, priority, status: "active" });
        await db.update(npcCores).set({ currentGoal: goalType }).where(eq(npcCores.id, npcId));
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Tuyên bố mục tiêu mới: "${goalType}"`, importance: 5 });
        return true;
      }

      case "invest": {
        const amount = Math.min(Number(decision.params.amount) || 50, npc.money);
        if (amount <= 0) return false;
        await db.update(npcCores).set({ money: npc.money - amount }).where(eq(npcCores.id, npcId));
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Đầu tư ${amount} vàng: ${decision.explanation}`, importance: 5 });
        return true;
      }

      case "expand_business": {
        const [existJob] = await db.select().from(npcJobs).where(eq(npcJobs.npcCoreId, npcId));
        if (existJob) {
          await db.update(npcJobs).set({ skillLevel: Math.min(1, existJob.skillLevel + 0.1), salary: existJob.salary + 10 })
            .where(eq(npcJobs.npcCoreId, npcId));
        }
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Mở rộng công việc: ${decision.explanation}`, importance: 4 });
        return true;
      }

      case "run_for_office": {
        const govType = (decision.params.gov_type as string) ?? "village_council";
        await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Quyết định tranh cử ${govType}: ${decision.explanation}`, importance: 8 });
        await db.insert(npcLongTermGoals).values({ npcId, goalType: `trở thành lãnh đạo ${govType}`, targetValue: 1, progress: 0, priority: 1, status: "active" });
        return true;
      }

      case "make_friend": {
        const topRel = ctx.relationships[0];
        if (topRel && topRel.score > 20) {
          await db.update(npcRelationships).set({ relationshipScore: Math.min(100, topRel.score + 15), relationshipType: "bạn bè" })
            .where(or(
              and(eq(npcRelationships.npcAId, npcId), eq(npcRelationships.npcBId, topRel.npcId)),
              and(eq(npcRelationships.npcAId, topRel.npcId), eq(npcRelationships.npcBId, npcId)),
            ));
          await db.insert(npcCoreMemories).values({ npcCoreId: npcId, event: `Chủ động kết bạn: ${decision.explanation}`, importance: 4 });
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  } catch (err) {
    console.error("[npcAgent] executeDecision:", err);
    return false;
  }
}

/* ════════════════════════════════════════
   CHECK SHOULD TRIGGER AGENT
   Chỉ gọi LLM khi thực sự cần thiết
════════════════════════════════════════ */
function shouldTriggerAgent(ctx: AgentContext): boolean {
  return ctx.crisisLevel !== "none";
}

/* ════════════════════════════════════════
   ROUTE: POST /api/npc-agent/decide/:npcId
   Main agent decision endpoint
════════════════════════════════════════ */
router.post("/npc-agent/decide/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const { trigger = "manual", force = false } = req.body;

    const ctx = await buildAgentContext(npcId, trigger);
    if (!ctx) return res.status(404).json({ message: "Không tìm thấy NPC" });

    // Hybrid check: chỉ trigger LLM khi cần thiết (trừ khi force=true)
    if (!force && !shouldTriggerAgent(ctx) && trigger === "auto") {
      return res.json({
        triggered: false,
        reason: "Không có sự kiện đủ quan trọng để kích hoạt suy luận",
        crisisLevel: ctx.crisisLevel,
      });
    }

    // Generate decision
    let decision: AgentDecision;
    let generatedBy: "gemini" | "rule-based";
    const promptSummary = buildAgentPrompt(ctx).slice(0, 500) + "...";

    try {
      decision = await callGeminiAgent(ctx);
      generatedBy = "gemini";
    } catch {
      decision = ruleBasedDecision(ctx);
      generatedBy = "rule-based";
    }

    // Execute decision
    const actionTaken = await executeDecision(npcId, decision, ctx);

    // Log to DB
    const [log] = await db.insert(npcAgentLogs).values({
      npcId,
      worldSlug: ctx.npc.worldSlug,
      trigger,
      decisionType: decision.type,
      promptSummary,
      reasoningSummary: decision.reasoning,
      decision: decision as any,
      confidence: decision.confidence,
      actionTaken,
      generatedBy,
    }).returning();

    return res.json({
      triggered: true,
      decision,
      actionTaken,
      generatedBy,
      crisisLevel: ctx.crisisLevel,
      logId: log.id,
    });
  } catch (err) {
    console.error("[npcAgent] decide:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-agent/logs/:npcId
   Lấy lịch sử suy luận của NPC
════════════════════════════════════════ */
router.get("/npc-agent/logs/:npcId", isAuthenticated, async (req, res) => {
  try {
    const logs = await db.select().from(npcAgentLogs)
      .where(eq(npcAgentLogs.npcId, req.params.npcId as string))
      .orderBy(desc(npcAgentLogs.createdAt)).limit(20);
    return res.json(logs);
  } catch (err) {
    console.error("[npcAgent] logs:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-agent/dashboard/:worldSlug
   Dashboard — tất cả suy luận gần đây trong thế giới
════════════════════════════════════════ */
router.get("/npc-agent/dashboard/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const logs = await db.select({
      id: npcAgentLogs.id,
      npcId: npcAgentLogs.npcId,
      npcName: npcCores.name,
      npcOccupation: npcCores.occupation,
      trigger: npcAgentLogs.trigger,
      decisionType: npcAgentLogs.decisionType,
      reasoningSummary: npcAgentLogs.reasoningSummary,
      decision: npcAgentLogs.decision,
      confidence: npcAgentLogs.confidence,
      actionTaken: npcAgentLogs.actionTaken,
      generatedBy: npcAgentLogs.generatedBy,
      createdAt: npcAgentLogs.createdAt,
    })
      .from(npcAgentLogs)
      .innerJoin(npcCores, eq(npcAgentLogs.npcId, npcCores.id))
      .where(eq(npcAgentLogs.worldSlug, req.params.worldSlug as string))
      .orderBy(desc(npcAgentLogs.createdAt))
      .limit(50);
    return res.json(logs);
  } catch (err) {
    console.error("[npcAgent] dashboard:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: POST /api/npc-agent/scan/:worldSlug
   Quét toàn bộ NPC trong world và trigger những NPC đang khủng hoảng
════════════════════════════════════════ */
router.post("/npc-agent/scan/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select({ id: npcCores.id, name: npcCores.name })
      .from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)))
      .limit(20);

    const results: Array<{ npcId: string; npcName: string; triggered: boolean; decisionType: string; crisisLevel: string }> = [];

    for (const npc of npcs) {
      const ctx = await buildAgentContext(npc.id, "auto");
      if (!ctx) continue;

      if (shouldTriggerAgent(ctx)) {
        let decision: AgentDecision;
        let generatedBy: "gemini" | "rule-based";
        const promptSummary = buildAgentPrompt(ctx).slice(0, 500) + "...";
        try {
          decision = await callGeminiAgent(ctx);
          generatedBy = "gemini";
        } catch {
          decision = ruleBasedDecision(ctx);
          generatedBy = "rule-based";
        }
        const actionTaken = await executeDecision(npc.id, decision, ctx);
        await db.insert(npcAgentLogs).values({ npcId: npc.id, worldSlug, trigger: "auto", decisionType: decision.type, promptSummary, reasoningSummary: decision.reasoning, decision: decision as any, confidence: decision.confidence, actionTaken, generatedBy });
        results.push({ npcId: npc.id, npcName: npc.name, triggered: true, decisionType: decision.type, crisisLevel: ctx.crisisLevel });
      } else {
        results.push({ npcId: npc.id, npcName: npc.name, triggered: false, decisionType: "none", crisisLevel: ctx.crisisLevel });
      }
    }

    return res.json({ scanned: npcs.length, triggered: results.filter(r => r.triggered).length, results });
  } catch (err) {
    console.error("[npcAgent] scan:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-agent/context/:npcId
   Preview context trước khi quyết định
════════════════════════════════════════ */
router.get("/npc-agent/context/:npcId", isAuthenticated, async (req, res) => {
  try {
    const ctx = await buildAgentContext(req.params.npcId as string, "manual");
    if (!ctx) return res.status(404).json({ message: "Không tìm thấy NPC" });
    const prompt = buildAgentPrompt(ctx);
    return res.json({ context: ctx, prompt, shouldTrigger: shouldTriggerAgent(ctx) });
  } catch (err) {
    console.error("[npcAgent] context:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
