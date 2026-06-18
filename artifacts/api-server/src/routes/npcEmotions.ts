import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories, npcRelationships,
  npcEmotions, npcEmotionLogs, npcLongTermGoals, npcPlans,
} from "@workspace/db/schema";
import { eq, desc, and, or } from "drizzle-orm";

const router = Router();

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

type EmotionState = {
  happiness: number; anger: number; fear: number;
  sadness: number; confidence: number; stress: number;
};

/* ── Ensure emotion row exists ── */
async function ensureEmotion(npcId: string): Promise<typeof npcEmotions.$inferSelect> {
  const [existing] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npcId));
  if (existing) return existing;
  const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
  const happiness = npc ? clamp(npc.happiness, 0, 100) : 50;
  const [created] = await db.insert(npcEmotions).values({
    npcId, happiness, anger: 10, fear: 10, sadness: 10, confidence: 50, stress: 20,
  }).returning();
  return created;
}

/* ── Log emotion change ── */
async function logEmotion(npcId: string, emotionType: string, delta: number, reason: string) {
  if (delta === 0) return;
  await db.insert(npcEmotionLogs).values({ npcId, emotionType, delta, reason });
}

/* ── Apply delta to emotion state ── */
function applyDelta(state: EmotionState, field: keyof EmotionState, delta: number): EmotionState {
  return { ...state, [field]: clamp(state[field] + delta, 0, 100) };
}

/* ── Compute emotion updates from NPC state ── */
async function computeEmotionTick(
  npc: typeof npcCores.$inferSelect,
  emotion: typeof npcEmotions.$inferSelect,
  personality: typeof npcPersonalities.$inferSelect | null,
): Promise<{ state: EmotionState; events: Array<{ type: keyof EmotionState; delta: number; reason: string }> }> {
  let state: EmotionState = {
    happiness: emotion.happiness,
    anger: emotion.anger,
    fear: emotion.fear,
    sadness: emotion.sadness,
    confidence: emotion.confidence,
    stress: emotion.stress,
  };
  const events: Array<{ type: keyof EmotionState; delta: number; reason: string }> = [];

  const push = (type: keyof EmotionState, delta: number, reason: string) => {
    if (delta === 0) return;
    state = applyDelta(state, type, delta);
    events.push({ type, delta, reason });
  };

  // ── Hunger → stress + sadness ──
  if (npc.hunger > 80) {
    push("stress", rand(5, 12), "Bị đói nặng, cơ thể kiệt quệ");
    push("sadness", rand(3, 8), "Không có gì ăn, tâm trạng xuống dốc");
    push("happiness", -rand(5, 10), "Đói bụng làm giảm niềm vui");
  } else if (npc.hunger > 60) {
    push("stress", rand(2, 6), "Đang đói, lo lắng về thức ăn");
  }

  // ── Energy → sadness + stress ──
  if (npc.energy < 20) {
    push("sadness", rand(3, 8), "Kiệt sức hoàn toàn, không còn sức lực");
    push("stress", rand(4, 9), "Mệt mỏi quá mức gây căng thẳng");
  } else if (npc.energy < 40) {
    push("stress", rand(1, 4), "Năng lượng thấp làm tăng áp lực");
  }

  // ── Money ──
  if (npc.money < 50) {
    push("stress", rand(5, 12), "Tài chính cạn kiệt, lo lắng về tương lai");
    push("fear", rand(3, 8), "Sợ không có tiền sống qua ngày");
    push("anger", rand(2, 6), "Tức giận vì hoàn cảnh nghèo khó");
    push("confidence", -rand(3, 8), "Mất tự tin khi không có tiền");
  } else if (npc.money > 500) {
    push("confidence", rand(2, 6), "Tài sản dồi dào tạo sự tự tin");
    push("happiness", rand(2, 5), "Có của ăn của để, thoải mái hơn");
    push("stress", -rand(2, 5), "Tiền bạc dư dả giảm bớt gánh nặng");
  } else if (npc.money > 200) {
    push("stress", -rand(1, 3), "Cuộc sống ổn định, ít lo lắng hơn");
  }

  // ── Happiness from core ──
  if (npc.happiness > 80) {
    push("happiness", rand(2, 5), "Tâm trạng tuyệt vời, cuộc sống đang thuận lợi");
    push("confidence", rand(1, 4), "Hạnh phúc nuôi dưỡng sự tự tin");
    push("anger", -rand(2, 5), "Vui vẻ xua tan nỗi tức giận");
  } else if (npc.happiness < 30) {
    push("sadness", rand(4, 10), "Cuộc đời ảm đạm, buồn chán kéo dài");
    push("confidence", -rand(3, 7), "Hạnh phúc thấp làm mất tự tin");
  }

  // ── Personality modifiers ──
  if (personality) {
    if (personality.greed > 0.7 && npc.money < 200) {
      push("anger", rand(3, 8), "Tham vọng tiền bạc mà không đạt được");
    }
    if (personality.bravery > 0.8) {
      push("fear", -rand(2, 6), "Bản tính dũng cảm làm giảm nỗi sợ");
      push("confidence", rand(1, 4), "Dũng cảm sinh ra sự tự tin");
    }
    if (personality.kindness > 0.7) {
      push("anger", -rand(2, 5), "Tính hiền lành giúp kiềm chế cơn giận");
    }
    if (personality.intelligence > 0.8) {
      push("stress", -rand(1, 4), "Trí thông minh giúp giải quyết vấn đề tốt hơn");
    }
  }

  // ── Memory-driven emotions (recent important memories) ──
  const recentMems = await db.select().from(npcCoreMemories)
    .where(eq(npcCoreMemories.npcCoreId, npc.id))
    .orderBy(desc(npcCoreMemories.timestamp))
    .limit(5);

  for (const mem of recentMems) {
    const e = mem.event.toLowerCase();
    const imp = mem.importance ?? 1;
    const scale = Math.max(1, Math.floor(imp / 2));

    if (e.includes("bị đói") || e.includes("đói bụng") || e.includes("thiếu thức ăn")) {
      push("stress", scale * rand(1, 3), `Ký ức: "${mem.event.slice(0, 40)}..."`);
    }
    if (e.includes("hoàn thành") || e.includes("đạt được") || e.includes("thắng")) {
      push("confidence", scale * rand(1, 4), `Ký ức thành công: "${mem.event.slice(0, 40)}..."`);
      push("happiness", scale * rand(1, 3), `Niềm vui từ thành quả`);
    }
    if (e.includes("thất bại") || e.includes("không đủ") || e.includes("từ bỏ")) {
      push("sadness", scale * rand(1, 3), `Ký ức thất bại: "${mem.event.slice(0, 40)}..."`);
      push("confidence", -scale * rand(1, 3), `Thất bại làm lung lay tự tin`);
    }
    if (e.includes("bị cướp") || e.includes("phản bội") || e.includes("mất tiền")) {
      push("anger", scale * rand(2, 5), `Ký ức phẫn nộ: "${mem.event.slice(0, 40)}..."`);
    }
    if (e.includes("kết hôn") || e.includes("gia đình") || e.includes("bạn bè")) {
      push("happiness", scale * rand(2, 5), `Ký ức vui: "${mem.event.slice(0, 40)}..."`);
      push("sadness", -scale * rand(1, 3), `Ký ức ấm áp xua tan nỗi buồn`);
    }
    if (e.includes("chiến tranh") || e.includes("tấn công") || e.includes("nguy hiểm")) {
      push("fear", scale * rand(2, 6), `Ký ức nguy hiểm: "${mem.event.slice(0, 40)}..."`);
    }
  }

  // ── Relationships ──
  const relationships = await db.select().from(npcRelationships)
    .where(or(eq(npcRelationships.npcAId, npc.id), eq(npcRelationships.npcBId, npc.id)))
    .limit(10);

  const alliesCount = relationships.filter((r) => r.relationshipScore > 60).length;
  const enemiesCount = relationships.filter((r) => r.relationshipScore < -40).length;

  if (alliesCount >= 2) push("confidence", rand(1, 3), "Có nhiều đồng minh bên cạnh");
  if (alliesCount >= 3) push("happiness", rand(2, 4), "Mạng lưới quan hệ tốt mang lại niềm vui");
  if (enemiesCount >= 2) push("fear", rand(2, 5), "Nhiều kẻ thù xung quanh gây lo sợ");
  if (enemiesCount >= 2) push("stress", rand(3, 7), "Kẻ thù nhiều, không thể yên tâm");

  // ── Plans & Goals ──
  const [activePlan] = await db.select().from(npcPlans)
    .where(and(eq(npcPlans.npcId, npc.id), eq(npcPlans.status, "đang_thực_hiện")))
    .limit(1);
  if (activePlan) push("confidence", rand(1, 3), "Có kế hoạch rõ ràng, tự tin vào tương lai");

  const [failedPlan] = await db.select().from(npcPlans)
    .where(and(eq(npcPlans.npcId, npc.id), eq(npcPlans.status, "thất_bại")))
    .orderBy(desc(npcPlans.updatedAt))
    .limit(1);
  if (failedPlan) {
    push("sadness", rand(2, 5), "Kế hoạch vừa thất bại, tâm trạng xuống");
    push("stress", rand(3, 6), "Kế hoạch đổ vỡ tạo ra căng thẳng");
  }

  // ── Passive decay (emotions tend toward baseline) ──
  const BASELINE: EmotionState = { happiness: 50, anger: 10, fear: 10, sadness: 10, confidence: 50, stress: 20 };
  for (const key of Object.keys(BASELINE) as (keyof EmotionState)[]) {
    const diff = BASELINE[key] - state[key];
    if (Math.abs(diff) > 5) {
      const decay = Math.sign(diff) * Math.min(3, Math.abs(diff) * 0.1);
      state = applyDelta(state, key, Math.round(decay));
    }
  }

  return { state, events };
}

/* ── Behavior influence helper (exported for other routes to use) ── */
export function getEmotionBehavior(emotion: typeof npcEmotions.$inferSelect): {
  avoidsConflict: boolean;
  likelyToRunForLeader: boolean;
  workEfficiency: number;
  likelyToExpand: boolean;
  aggressive: boolean;
} {
  return {
    avoidsConflict:        emotion.fear > 65,
    likelyToRunForLeader:  emotion.confidence > 70 && emotion.fear < 40,
    workEfficiency:        Math.max(0.3, 1 - emotion.stress / 150),
    likelyToExpand:        emotion.confidence > 65 && emotion.stress < 50,
    aggressive:            emotion.anger > 70,
  };
}

/* ════════════════════════════════════════
   GET emotions for a single NPC
════════════════════════════════════════ */
router.get("/api/npc-emotions/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const emotion = await ensureEmotion(npcId);
    const logs = await db.select().from(npcEmotionLogs)
      .where(eq(npcEmotionLogs.npcId, npcId))
      .orderBy(desc(npcEmotionLogs.createdAt))
      .limit(20);
    return res.json({ emotion, logs });
  } catch (err) { console.error("[npcEmotions] GET:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET emotions for all NPCs in a world
════════════════════════════════════════ */
router.get("/api/npc-emotions/world/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    const result = await Promise.all(npcs.map(async (npc) => {
      const emotion = await ensureEmotion(npc.id);
      const recentLogs = await db.select().from(npcEmotionLogs)
        .where(eq(npcEmotionLogs.npcId, npc.id))
        .orderBy(desc(npcEmotionLogs.createdAt))
        .limit(5);
      const behavior = getEmotionBehavior(emotion);
      return { npc, emotion, recentLogs, behavior };
    }));

    return res.json(result);
  } catch (err) { console.error("[npcEmotions] world:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST tick — update all emotions in a world
════════════════════════════════════════ */
router.post("/api/npc-emotions/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length === 0) return res.json({ message: "Không có NPC", ticked: 0 });

    let ticked = 0;
    const summary: Array<{ name: string; dominant: string; behavior: string }> = [];

    for (const npc of npcs) {
      const emotion = await ensureEmotion(npc.id);
      const [personality] = await db.select().from(npcPersonalities)
        .where(eq(npcPersonalities.npcCoreId, npc.id));

      const { state, events } = await computeEmotionTick(npc, emotion, personality ?? null);

      // Update emotion row
      await db.update(npcEmotions).set({
        happiness: state.happiness,
        anger: state.anger,
        fear: state.fear,
        sadness: state.sadness,
        confidence: state.confidence,
        stress: state.stress,
        updatedAt: new Date(),
      }).where(eq(npcEmotions.npcId, npc.id));

      // Log significant changes only (|delta| >= 3)
      for (const ev of events) {
        if (Math.abs(ev.delta) >= 3) {
          await logEmotion(npc.id, ev.type, ev.delta, ev.reason);
        }
      }

      // Trim old logs (keep 30 per NPC)
      const allLogs = await db.select({ id: npcEmotionLogs.id }).from(npcEmotionLogs)
        .where(eq(npcEmotionLogs.npcId, npc.id))
        .orderBy(desc(npcEmotionLogs.createdAt));
      if (allLogs.length > 30) {
        for (const l of allLogs.slice(30)) {
          await db.delete(npcEmotionLogs).where(eq(npcEmotionLogs.id, l.id));
        }
      }

      // Dominant emotion
      const dominant = Object.entries(state).reduce((a, b) => b[1] > a[1] ? b : a)[0];

      // Behavior-driven memory
      const behavior = getEmotionBehavior({ ...emotion, ...state });
      let behaviorNote = "";
      if (behavior.aggressive && state.anger > 75) {
        behaviorNote = `${npc.name} đang rất tức giận — hành vi có thể gây xung đột.`;
      } else if (behavior.avoidsConflict && state.fear > 70) {
        behaviorNote = `${npc.name} đang sợ hãi — né tránh mọi đối đầu.`;
      } else if (behavior.likelyToRunForLeader) {
        behaviorNote = `${npc.name} đang rất tự tin — có thể tranh cử lãnh đạo.`;
      } else if (state.stress > 75) {
        behaviorNote = `${npc.name} đang căng thẳng nặng — hiệu quả làm việc giảm sút.`;
      }

      if (behaviorNote) {
        await db.insert(npcCoreMemories).values({
          npcCoreId: npc.id, event: behaviorNote, importance: 3,
        });
      }

      summary.push({ name: npc.name, dominant, behavior: behaviorNote || "Bình thường" });
      ticked++;
    }

    return res.json({ message: `Đã cập nhật cảm xúc ${ticked} NPC`, ticked, summary });
  } catch (err) { console.error("[npcEmotions] tick:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST trigger — fire a specific emotion event
════════════════════════════════════════ */
router.post("/api/npc-emotions/trigger/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const { event } = req.body as { event: string };

    const TRIGGERS: Record<string, Partial<EmotionState> & { reason: string }> = {
      "nhận_tiền":     { happiness: 10, confidence: 5, stress: -5,  reason: "Nhận được tiền bạc" },
      "mất_tiền":      { anger: 15,  sadness: 8,  stress: 10, confidence: -5, reason: "Mất tiền" },
      "bị_phản_bội":   { anger: 25,  sadness: 15, fear: 10,   confidence: -10, reason: "Bị phản bội" },
      "chiến_thắng":   { confidence: 20, happiness: 15, anger: -10, fear: -5, reason: "Chiến thắng vẻ vang" },
      "thất_bại":      { sadness: 15, confidence: -15, stress: 10, reason: "Thất bại đau đớn" },
      "kết_hôn":       { happiness: 30, confidence: 10, sadness: -15, stress: -10, reason: "Kết hôn hạnh phúc" },
      "mất_người_thân":{ sadness: 35, anger: 10, fear: 10, happiness: -20, reason: "Mất đi người thân yêu" },
      "thăng_cấp":     { confidence: 20, happiness: 15, stress: -10, reason: "Thăng tiến trong sự nghiệp" },
      "bị_cướp":       { anger: 20, fear: 20, sadness: 10, confidence: -10, stress: 15, reason: "Bị cướp tài sản" },
      "gặp_bạn":       { happiness: 15, sadness: -10, stress: -8, reason: "Gặp gỡ bạn bè thân thiết" },
    };

    const trigger = TRIGGERS[event];
    if (!trigger) return res.status(400).json({ message: "Event không hợp lệ", valid: Object.keys(TRIGGERS) });

    const emotion = await ensureEmotion(npcId);
    const updates: Partial<EmotionState> = {};

    for (const [key, delta] of Object.entries(trigger)) {
      if (key === "reason") continue;
      const k = key as keyof EmotionState;
      const newVal = clamp((emotion[k] ?? 50) + (delta as number), 0, 100);
      updates[k] = newVal;
      await logEmotion(npcId, k, delta as number, trigger.reason);
    }

    await db.update(npcEmotions).set({ ...updates, updatedAt: new Date() }).where(eq(npcEmotions.npcId, npcId));
    const [updated] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npcId));

    // Add memory
    const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
    if (npc) {
      await db.insert(npcCoreMemories).values({
        npcCoreId: npcId, event: `${npc.name}: ${trigger.reason}`, importance: 6,
      });
    }

    return res.json({ message: `Đã kích hoạt sự kiện "${event}"`, emotion: updated });
  } catch (err) { console.error("[npcEmotions] trigger:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   GET world emotion summary
════════════════════════════════════════ */
router.get("/api/npc-emotions/summary/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select({ id: npcCores.id }).from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug));
    if (npcs.length === 0) return res.json({ avg: {}, dominant: "Bình Thường", count: 0 });

    const totals = { happiness: 0, anger: 0, fear: 0, sadness: 0, confidence: 0, stress: 0 };
    let count = 0;

    for (const { id } of npcs) {
      const emotion = await ensureEmotion(id);
      totals.happiness  += emotion.happiness;
      totals.anger      += emotion.anger;
      totals.fear       += emotion.fear;
      totals.sadness    += emotion.sadness;
      totals.confidence += emotion.confidence;
      totals.stress     += emotion.stress;
      count++;
    }

    const avg = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v / count)]));
    const dominant = Object.entries(avg).reduce((a, b) => b[1] > a[1] ? b : a)[0];

    return res.json({ avg, dominant, count });
  } catch (err) { console.error("[npcEmotions] summary:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
