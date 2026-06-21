import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories, npcRelationships,
  npcEmotions, npcLongTermGoals, npcPlans, npcPlanSteps,
  npcFactionMembers, npcFactions, npcFamilies,
  npcGovernments,
  npcDialogueSessions, npcDialogueMemories,
} from "@workspace/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();

/* ════════════════════════════════════════
   NPC CONTEXT BUILDER
   Tổng hợp toàn bộ trạng thái NPC thành 1 object
════════════════════════════════════════ */
export interface NpcContext {
  npc: { id: string; name: string; age: number; occupation: string; money: number; energy: number; worldSlug: string };
  personality: { kindness: number; greed: number; bravery: number; intelligence: number; curiosity: number } | null;
  emotion: { happiness: number; anger: number; fear: number; sadness: number; confidence: number; stress: number } | null;
  goals: Array<{ goalType: string; progress: number; targetValue: number; status: string }>;
  currentPlan: { steps: Array<{ actionType: string; target: string; completed: boolean }> } | null;
  relationshipWithPlayer: { score: number; type: string } | null;
  importantMemories: string[];
  faction: { name: string; type: string; role: string } | null;
  family: { spouseId: string | null; fatherId: string | null; motherId: string | null; familyName: string | null } | null;
  politicalRole: string | null;
}

async function buildNpcContext(npcId: string, playerId = "guest"): Promise<NpcContext | null> {
  const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
  if (!npc) return null;

  const [personality] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npcId));
  const [emotion] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npcId));

  const goals = await db.select().from(npcLongTermGoals)
    .where(and(eq(npcLongTermGoals.npcId, npcId), eq(npcLongTermGoals.status, "active")))
    .orderBy(desc(npcLongTermGoals.priority)).limit(3);

  const [activePlan] = await db.select().from(npcPlans)
    .where(and(eq(npcPlans.npcId, npcId), eq(npcPlans.status, "đang_thực_hiện")))
    .orderBy(desc(npcPlans.updatedAt)).limit(1);

  let currentPlan: NpcContext["currentPlan"] = null;
  if (activePlan) {
    const steps = await db.select().from(npcPlanSteps)
      .where(eq(npcPlanSteps.planId, activePlan.id))
      .orderBy(npcPlanSteps.stepOrder).limit(5);
    currentPlan = { steps: steps.map(s => ({ actionType: s.actionType, target: s.target, completed: s.completed })) };
  }

  // Relationship với player (dùng playerId như một npcId ảo nếu không tìm thấy)
  const [rel] = await db.select().from(npcRelationships)
    .where(or(
      and(eq(npcRelationships.npcAId, npcId), eq(npcRelationships.npcBId, playerId)),
      and(eq(npcRelationships.npcAId, playerId), eq(npcRelationships.npcBId, npcId)),
    )).limit(1);

  const relScore = rel?.relationshipScore ?? 0;
  const relType = rel?.relationshipType ?? scoreToType(relScore);

  const memories = await db.select().from(npcCoreMemories)
    .where(eq(npcCoreMemories.npcCoreId, npcId))
    .orderBy(desc(npcCoreMemories.importance), desc(npcCoreMemories.timestamp))
    .limit(5);

  // Faction
  const [factionMember] = await db.select({
    factionId: npcFactionMembers.factionId,
    role: npcFactionMembers.role,
  }).from(npcFactionMembers).where(eq(npcFactionMembers.npcId, npcId)).limit(1);

  let faction: NpcContext["faction"] = null;
  if (factionMember) {
    const [factionRow] = await db.select().from(npcFactions).where(eq(npcFactions.id, factionMember.factionId));
    if (factionRow) faction = { name: factionRow.name, type: factionRow.type, role: factionMember.role };
  }

  // Family
  const [familyRow] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcId)).limit(1);
  const family = familyRow ? {
    spouseId: familyRow.spouseId, fatherId: familyRow.fatherId,
    motherId: familyRow.motherId, familyName: familyRow.familyName,
  } : null;

  // Political role: có phải là leader của một chính phủ nào không
  const [govRow] = await db.select().from(npcGovernments)
    .where(eq(npcGovernments.leaderNpcId, npcId)).limit(1);
  const politicalRole = govRow ? `Lãnh đạo ${govRow.govType}` : null;

  return {
    npc: { id: npc.id, name: npc.name, age: npc.age, occupation: npc.occupation, money: npc.money, energy: npc.energy, worldSlug: npc.worldSlug },
    personality: personality ? { kindness: personality.kindness, greed: personality.greed, bravery: personality.bravery, intelligence: personality.intelligence, curiosity: personality.curiosity } : null,
    emotion: emotion ? { happiness: emotion.happiness, anger: emotion.anger, fear: emotion.fear, sadness: emotion.sadness, confidence: emotion.confidence, stress: emotion.stress } : null,
    goals: goals.map(g => ({ goalType: g.goalType, progress: g.progress, targetValue: g.targetValue, status: g.status })),
    currentPlan,
    relationshipWithPlayer: { score: relScore, type: relType },
    importantMemories: memories.map(m => m.event),
    faction, family, politicalRole,
  };
}

function scoreToType(score: number): string {
  if (score <= -61) return "kẻ thù";
  if (score <= -21) return "đối thủ";
  if (score <= 20)  return "người lạ";
  if (score <= 50)  return "người quen";
  if (score <= 75)  return "bạn bè";
  return "đồng minh";
}

/* ════════════════════════════════════════
   BUILD SYSTEM PROMPT FROM CONTEXT
════════════════════════════════════════ */
function buildSystemPrompt(ctx: NpcContext): string {
  const { npc, personality, emotion, goals, currentPlan, relationshipWithPlayer, importantMemories, faction, family, politicalRole } = ctx;

  const p = personality;
  const e = emotion;

  // Personality description
  const traits: string[] = [];
  if (p) {
    if (p.kindness > 0.7) traits.push("tốt bụng, hay giúp đỡ người khác");
    else if (p.kindness < 0.3) traits.push("lạnh lùng, ít quan tâm người khác");
    if (p.greed > 0.7) traits.push("tham lam, luôn tính toán lợi ích");
    else if (p.greed < 0.3) traits.push("rộng lượng, không ham tiền bạc");
    if (p.bravery > 0.7) traits.push("dũng cảm, không sợ rủi ro");
    else if (p.bravery < 0.3) traits.push("thận trọng, hay lo lắng");
    if (p.intelligence > 0.7) traits.push("thông minh, nhạy bén");
    if (p.curiosity > 0.7) traits.push("tò mò, hay đặt câu hỏi");
    else if (p.curiosity < 0.3) traits.push("bảo thủ, ít quan tâm điều mới");
  }

  // Emotion description
  const emotionDesc: string[] = [];
  if (e) {
    if (e.anger > 70) emotionDesc.push("đang rất tức giận — trả lời gắt gỏng, khó chịu, có thể mất kiên nhẫn");
    else if (e.anger > 45) emotionDesc.push("đang có phần bực bội — giọng điệu hơi gay gắt");
    if (e.fear > 65) emotionDesc.push("đang sợ hãi — thận trọng, nói chuyện dè dặt, hay nhìn quanh");
    if (e.sadness > 65) emotionDesc.push("đang buồn — giọng trầm, dễ xúc động");
    if (e.confidence > 70) emotionDesc.push("đang rất tự tin — nói năng chắc chắn, kiêu hãnh");
    if (e.stress > 70) emotionDesc.push("đang căng thẳng — trả lời ngắn, dễ bực bội");
    if (e.happiness > 75) emotionDesc.push("đang vui vẻ — thân thiện, cởi mở");
  }

  // Relationship tone
  let relTone = "";
  const relScore = relationshipWithPlayer?.score ?? 0;
  if (relScore <= -20) relTone = "Đây là người ngươi không ưa hoặc kẻ thù — lạnh nhạt, thù địch, nói chuyện thẳng thắn không nể";
  else if (relScore <= 20) relTone = "Đây là người lạ hoặc quen biết sơ — giữ khoảng cách, lịch sự nhưng không thân thiết";
  else if (relScore <= 50) relTone = "Đây là người quen — thân thiện, sẵn sàng chia sẻ vừa phải";
  else relTone = "Đây là bạn bè hoặc đồng minh tin cậy — rất thân thiện, chia sẻ thông tin, quan tâm chân thành";

  const goalDesc = goals.length > 0
    ? goals.map(g => `"${g.goalType}" (tiến độ ${g.progress}/${g.targetValue})`).join(", ")
    : "chưa có mục tiêu rõ ràng";

  const memDesc = importantMemories.length > 0
    ? importantMemories.slice(0, 3).join(" | ")
    : "không có ký ức đặc biệt";

  const factionDesc = faction ? `Thành viên ${faction.role} của ${faction.name} (${faction.type})` : "không thuộc phe phái nào";
  const politicalDesc = politicalRole ? `Chức vụ chính trị: ${politicalRole}` : "";

  const planDesc = currentPlan && currentPlan.steps.length > 0
    ? "Đang thực hiện kế hoạch: " + currentPlan.steps.filter(s => !s.completed).slice(0, 2).map(s => s.target).join(", ")
    : "";

  return `Bạn là ${npc.name}, một nhân vật NPC trong thế giới game nhập vai.

=== THÔNG TIN CƠ BẢN ===
- Tên: ${npc.name}
- Tuổi: ${npc.age} tuổi
- Nghề nghiệp: ${npc.occupation}
- Tài sản: ${npc.money} vàng
- ${factionDesc}
${politicalDesc ? `- ${politicalDesc}` : ""}

=== TÍNH CÁCH ===
${traits.length > 0 ? traits.join("; ") : "Tính cách bình thường"}

=== TRẠNG THÁI CẢM XÚC HIỆN TẠI ===
${emotionDesc.length > 0 ? emotionDesc.join("; ") : "Tâm trạng bình thường"}

=== MỤC TIÊU DÀI HẠN ===
${goalDesc}
${planDesc}

=== KÝ ỨC QUAN TRỌNG ===
${memDesc}

=== QUAN HỆ VỚI NGƯỜI CHƠI ===
${relTone}
Điểm quan hệ: ${relScore > 0 ? "+" : ""}${relScore}

=== QUY TẮC ĐÓI ĐÁP ===
1. Luôn trả lời bằng TIẾNG VIỆT, xưng tên mình hoặc "ta/tôi/mình" tùy tính cách
2. Phản ánh đúng cảm xúc hiện tại trong cách nói chuyện
3. Không phá vỡ nhân vật — chỉ nói về những gì nhân vật biết
4. Giữ câu trả lời ngắn gọn (2-4 câu), tự nhiên như hội thoại thực
5. Có thể hỏi lại người chơi để tạo tính tương tác
6. Nếu người chơi hứa hẹn điều gì, nhận xét về điều đó
7. Phong cách nói phù hợp với nghề ${npc.occupation} và thế giới game`.trim();
}

/* ════════════════════════════════════════
   RULE-BASED FALLBACK RESPONSE ENGINE
   Khi không có GEMINI_API_KEY
════════════════════════════════════════ */
function generateRuleBasedResponse(ctx: NpcContext, playerMsg: string): string {
  const { npc, personality: p, emotion: e, goals, relationshipWithPlayer } = ctx;
  const msg = playerMsg.toLowerCase();
  const relScore = relationshipWithPlayer?.score ?? 0;
  const name = npc.name;

  // Chọn xưng hô dựa theo tính cách
  const self = (p?.kindness ?? 0.5) > 0.6 ? "tôi" : (p?.greed ?? 0.5) > 0.6 ? "ta" : "tôi";

  // Prefix cảm xúc
  let prefix = "";
  if (e?.anger && e.anger > 70) prefix = "*cau mày* ";
  else if (e?.fear && e.fear > 65) prefix = "*nhìn quanh lo lắng* ";
  else if (e?.happiness && e.happiness > 75) prefix = "*mỉm cười* ";
  else if (e?.stress && e.stress > 70) prefix = "*thở dài* ";
  else if (e?.confidence && e.confidence > 70) prefix = "*khoanh tay tự tin* ";

  // Xác định tone dựa trên quan hệ
  const isFriendly = relScore > 50;
  const isHostile  = relScore < -20;
  const greeting   = isFriendly ? `${name} cười nhẹ` : isHostile ? `${name} nhíu mày` : `${name} nhìn ngươi`;

  // Phân tích nội dung
  if (/chào|xin chào|hello|alo/.test(msg)) {
    if (isHostile) return `${prefix}${greeting}. "Ngươi muốn gì? Đừng làm mất thời gian của ${self}."`;
    if (isFriendly) return `${prefix}${greeting}. "${self.charAt(0).toUpperCase() + self.slice(1)} đã đợi ngươi. Có chuyện gì thế?"`;
    return `${prefix}${greeting}. "Ừ, có việc gì không?"`;
  }

  if (/tiền|vàng|mua|bán|giao dịch|thương/.test(msg)) {
    const greedy = (p?.greed ?? 0.5) > 0.6;
    if (greedy) return `${prefix}*ánh mắt sáng lên* "${self.charAt(0).toUpperCase() + self.slice(1)} lắng nghe đây. Ngươi muốn giao dịch bao nhiêu?"`;
    return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} có ${npc.money} vàng trong tay. Nếu giá cả hợp lý, ${self} xem xét."`;
  }

  if (/giúp|hỗ trợ|nhờ|nhờ vả/.test(msg)) {
    const kind = (p?.kindness ?? 0.5) > 0.6;
    const goal = goals[0]?.goalType ?? "";
    if (kind && isFriendly) return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} sẵn lòng. Ngươi cần gì cứ nói thẳng."`;
    if (isHostile) return `${prefix}"Hừ. Tại sao ${self} phải giúp ngươi?"`;
    return `${prefix}"Tùy việc. Nếu không ảnh hưởng đến ${goal ? goal : "kế hoạch của " + self}, ${self} có thể xem xét."`;
  }

  if (/thông tin|tin tức|biết gì|nghe nói/.test(msg)) {
    const intel = (p?.intelligence ?? 0.5) > 0.6;
    if (isHostile) return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} không có gì để nói với ngươi."`;
    const mem = ctx.importantMemories[0] ?? "thành phố đang có nhiều biến động";
    return `${prefix}"${intel ? "À, " + self + " đang theo dõi việc này." : "Nghe nói"} ${mem}. Ngươi hỏi cụ thể điều gì?"`;
  }

  if (/chiến|đánh|tấn công|chiến tranh|chiến đấu/.test(msg)) {
    const brave = (p?.bravery ?? 0.5) > 0.6;
    if (brave) return `${prefix}*đứng thẳng* "${self.charAt(0).toUpperCase() + self.slice(1)} không ngại chiến đấu. Nhưng phải có lý do xứng đáng."`;
    if (e?.fear && e.fear > 65) return `${prefix}*nhìn quanh* "Đừng... nói chuyện như vậy ở đây. Nguy hiểm lắm."`;
    return `${prefix}"Chiến tranh chỉ mang lại tổn thất. Hãy tính kỹ trước khi hành động."`;
  }

  if (/hứa|cam kết|thề|đảm bảo/.test(msg)) {
    const trust = relScore > 20;
    if (trust) return `${prefix}*nhìn thẳng vào mắt ngươi* "${self.charAt(0).toUpperCase() + self.slice(1)} nhớ lời ngươi đấy. Đừng để ${self} thất vọng."`;
    return `${prefix}"Lời hứa... ${self} đã nghe nhiều rồi. Hành động mới là thứ ${self} tin."`;
  }

  if (/xúc phạm|chửi|đồ|kẻ|thằng|con/.test(msg)) {
    const angry = e?.anger && e.anger > 50;
    return `${prefix}*${angry ? "đứng dậy giận dữ" : "nhíu mày"}* "${self.charAt(0).toUpperCase() + self.slice(1)} không chịu đựng sự vô lễ. Ngươi nên xem lại cách nói chuyện."`;
  }

  if (/mục tiêu|ước mơ|kế hoạch|muốn làm/.test(msg)) {
    const goal = goals[0]?.goalType ?? "xây dựng tương lai tốt hơn";
    return `${prefix}"Mục tiêu của ${self} à? ${self.charAt(0).toUpperCase() + self.slice(1)} muốn ${goal}. Không phải chuyện dễ, nhưng ${self} đang từng bước thực hiện."`;
  }

  if (/gia đình|vợ|chồng|con|cha|mẹ/.test(msg)) {
    if (ctx.family?.familyName) return `${prefix}"Gia đình ${ctx.family.familyName}... đó là thứ ${self} trân trọng nhất."`;
    return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} ít nói về chuyện gia đình. Đó là chuyện riêng tư."`;
  }

  // Default theo cảm xúc
  if (e?.anger && e.anger > 70) {
    return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} đang không có tâm trạng nói chuyện bây giờ. Có gì quan trọng không?"`;
  }
  if (e?.sadness && e.sadness > 65) {
    return `${prefix}"Ừ... *thở dài* ${self} đang có nhiều chuyện trong đầu. Ngươi muốn nói gì?"`;
  }
  if (isFriendly) {
    return `${prefix}"${self.charAt(0).toUpperCase() + self.slice(1)} hiểu ý ngươi. Cứ nói tiếp đi, ${self} lắng nghe."`;
  }
  if (isHostile) {
    return `${prefix}"Nói thẳng ra đi. ${self} không có nhiều thời gian."`;
  }
  return `${prefix}"Ừm... ${self} cần suy nghĩ thêm về điều này."`;
}

/* ════════════════════════════════════════
   GEMINI DIALOGUE GENERATION
════════════════════════════════════════ */
async function generateGeminiResponse(
  ctx: NpcContext,
  history: Array<{ role: string; content: string }>,
  playerMessage: string,
): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

  const systemPrompt = buildSystemPrompt(ctx);

  const recentHistory = history.slice(-8);
  const contents = [
    { role: "user" as const, parts: [{ text: systemPrompt }] },
    { role: "model" as const, parts: [{ text: `Được rồi, ${ctx.npc.name} ở đây. Tôi hiểu vai trò và sẽ duy trì nhân vật.` }] },
    ...recentHistory.map(h => ({
      role: (h.role === "player" ? "user" : "model") as "user" | "model",
      parts: [{ text: h.content }],
    })),
    { role: "user" as const, parts: [{ text: playerMessage }] },
  ];

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents,
    config: { maxOutputTokens: 256, temperature: 0.85 },
  });
  return (result.text ?? "").trim();
}

/* ════════════════════════════════════════
   DETECT SIGNIFICANCE & CREATE MEMORY
════════════════════════════════════════ */
function detectSignificance(playerMsg: string, npcResponse: string): "neutral" | "promise" | "insult" | "threat" | "alliance" | "secret" {
  const msg = playerMsg.toLowerCase();
  if (/hứa|cam kết|thề|đảm bảo|sẽ giúp/.test(msg)) return "promise";
  if (/xúc phạm|chửi|đồ|kẻ|thằng|con mẹ|đổ thừa|ghét/.test(msg)) return "insult";
  if (/đe dọa|cảnh báo|coi chừng|hãy nhớ|sẽ trả giá/.test(msg)) return "threat";
  if (/liên minh|hợp tác|cùng nhau|bắt tay|đồng minh/.test(msg)) return "alliance";
  if (/bí mật|đừng nói|chỉ mình|không ai biết|tiết lộ/.test(msg)) return "secret";
  return "neutral";
}

function buildMemoryContent(name: string, significance: string, playerMsg: string): string {
  switch (significance) {
    case "promise":  return `Người chơi hứa: "${playerMsg.slice(0, 80)}"`;
    case "insult":   return `Người chơi xúc phạm ${name}: "${playerMsg.slice(0, 80)}"`;
    case "threat":   return `Người chơi đe dọa ${name}: "${playerMsg.slice(0, 80)}"`;
    case "alliance": return `Người chơi đề nghị hợp tác với ${name}`;
    case "secret":   return `Người chơi tiết lộ bí mật cho ${name}`;
    default:         return "";
  }
}

/* ════════════════════════════════════════
   COMPUTE EMOTION DELTA FROM PLAYER MESSAGE
════════════════════════════════════════ */
function computeEmotionDelta(playerMsg: string, significance: string): Record<string, number> {
  const msg = playerMsg.toLowerCase();
  const deltas: Record<string, number> = {};

  if (significance === "insult")   { deltas.anger = 15; deltas.happiness = -10; }
  if (significance === "threat")   { deltas.fear = 12; deltas.anger = 8; }
  if (significance === "promise")  { deltas.happiness = 8; deltas.confidence = 5; }
  if (significance === "alliance") { deltas.happiness = 10; deltas.confidence = 8; }

  if (/giúp|tặng|cho|chia sẻ/.test(msg))       { deltas.happiness = (deltas.happiness ?? 0) + 5; }
  if (/tấn công|chiến|thù|phá/.test(msg))       { deltas.fear = (deltas.fear ?? 0) + 8; deltas.anger = (deltas.anger ?? 0) + 5; }
  if (/buồn|khóc|mất|chết|đau/.test(msg))       { deltas.sadness = (deltas.sadness ?? 0) + 6; }
  if (/tốt|hay|xuất sắc|giỏi|đúng rồi/.test(msg)) { deltas.happiness = (deltas.happiness ?? 0) + 4; deltas.confidence = (deltas.confidence ?? 0) + 3; }

  return deltas;
}

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-dialogue/context/:npcId
   Lấy context đầy đủ của một NPC
════════════════════════════════════════ */
router.get("/npc-dialogue/context/:npcId", isAuthenticated, async (req, res) => {
  try {
    const ctx = await buildNpcContext(req.params.npcId as string);
    if (!ctx) return res.status(404).json({ message: "Không tìm thấy NPC" });
    return res.json(ctx);
  } catch (err) {
    console.error("[npcDialogue] context:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: POST /api/npc-dialogue
   Main dialogue endpoint
════════════════════════════════════════ */
router.post("/npc-dialogue", isAuthenticated, async (req, res) => {
  try {
    const { npc_id, player_message, player_id = "guest" } = req.body;

    if (!npc_id || !player_message?.trim()) {
      return res.status(400).json({ message: "Thiếu npc_id hoặc player_message" });
    }

    const ctx = await buildNpcContext(npc_id, player_id);
    if (!ctx) return res.status(404).json({ message: "Không tìm thấy NPC" });

    // Lấy lịch sử hội thoại
    const [session] = await db.select().from(npcDialogueSessions)
      .where(and(eq(npcDialogueSessions.npcId, npc_id), eq(npcDialogueSessions.playerId, player_id)))
      .orderBy(desc(npcDialogueSessions.updatedAt)).limit(1);

    const existingMessages = (session?.messages as Array<{ role: string; content: string; timestamp: string }>) ?? [];

    // Generate response
    let npcResponse: string;
    let generatedBy: "gemini" | "rule-based";
    try {
      npcResponse = await generateGeminiResponse(ctx, existingMessages, player_message);
      generatedBy = "gemini";
    } catch {
      npcResponse = generateRuleBasedResponse(ctx, player_message);
      generatedBy = "rule-based";
    }

    // Detect significance & emotion changes
    const significance = detectSignificance(player_message, npcResponse);
    const emotionDelta = computeEmotionDelta(player_message, significance);

    // Update session messages
    const newMessages = [
      ...existingMessages,
      { role: "player", content: player_message, timestamp: new Date().toISOString() },
      { role: "npc",    content: npcResponse,    timestamp: new Date().toISOString() },
    ].slice(-40); // giữ 40 tin nhắn gần nhất

    if (session) {
      await db.update(npcDialogueSessions)
        .set({ messages: newMessages, updatedAt: new Date() })
        .where(eq(npcDialogueSessions.id, session.id));
    } else {
      await db.insert(npcDialogueSessions).values({ npcId: npc_id, playerId: player_id, messages: newMessages });
    }

    // Lưu ký ức hội thoại nếu quan trọng
    let memoryUpdates: string[] = [];
    if (significance !== "neutral") {
      const memContent = buildMemoryContent(ctx.npc.name, significance, player_message);
      await db.insert(npcDialogueMemories).values({ npcId: npc_id, playerId: player_id, content: memContent, significance, relatedMessage: player_message });

      // Cũng lưu vào npcCoreMemories
      await db.insert(npcCoreMemories).values({ npcCoreId: npc_id, event: memContent, importance: significance === "insult" || significance === "threat" ? 8 : 6 });

      memoryUpdates = [memContent];
    }

    // Apply emotion delta (update DB)
    if (Object.keys(emotionDelta).length > 0) {
      const [em] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npc_id));
      if (em) {
        const clamp = (v: number) => Math.max(0, Math.min(100, v));
        await db.update(npcEmotions).set({
          anger:      clamp(em.anger      + (emotionDelta.anger      ?? 0)),
          fear:       clamp(em.fear       + (emotionDelta.fear       ?? 0)),
          happiness:  clamp(em.happiness  + (emotionDelta.happiness  ?? 0)),
          sadness:    clamp(em.sadness    + (emotionDelta.sadness    ?? 0)),
          confidence: clamp(em.confidence + (emotionDelta.confidence ?? 0)),
          stress:     clamp(em.stress     + (emotionDelta.stress     ?? 0)),
          updatedAt: new Date(),
        }).where(eq(npcEmotions.npcId, npc_id));
      }
    }

    return res.json({
      npc_response: npcResponse,
      emotion_changes: emotionDelta,
      memory_updates: memoryUpdates,
      significance,
      generated_by: generatedBy,
    });
  } catch (err) {
    console.error("[npcDialogue] POST:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-dialogue/history/:npcId
   Lấy lịch sử hội thoại + ký ức
════════════════════════════════════════ */
router.get("/npc-dialogue/history/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const playerId = (req.query.player_id as string) ?? "guest";

    const [session] = await db.select().from(npcDialogueSessions)
      .where(and(eq(npcDialogueSessions.npcId, npcId), eq(npcDialogueSessions.playerId, playerId)))
      .orderBy(desc(npcDialogueSessions.updatedAt)).limit(1);

    const memories = await db.select().from(npcDialogueMemories)
      .where(and(eq(npcDialogueMemories.npcId, npcId), eq(npcDialogueMemories.playerId, playerId)))
      .orderBy(desc(npcDialogueMemories.createdAt)).limit(20);

    return res.json({
      messages: (session?.messages as any[]) ?? [],
      memories,
    });
  } catch (err) {
    console.error("[npcDialogue] history:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   ROUTE: GET /api/npc-dialogue/list/:worldSlug
   Lấy danh sách NPC có thể chat trong thế giới
════════════════════════════════════════ */
router.get("/npc-dialogue/list/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select({
      id: npcCores.id, name: npcCores.name,
      occupation: npcCores.occupation, age: npcCores.age,
    }).from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)))
      .orderBy(npcCores.name).limit(50);
    return res.json(npcs);
  } catch (err) {
    console.error("[npcDialogue] list:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
