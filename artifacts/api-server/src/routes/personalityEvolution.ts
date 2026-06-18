import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcPersonalities, npcCoreMemories, npcRelationships,
  npcPersonalityHistory, npcPersonalityLogs, npcEmotions,
} from "@workspace/db/schema";
import { eq, desc, and, or, lt, gt } from "drizzle-orm";

const router = Router();

function clamp(v: number, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }

/* ── Tạo câu nhật ký từ trait và delta ── */
function makeJournal(name: string, trait: string, delta: number, cause: string): string {
  const sign = delta > 0 ? "tăng" : "giảm";
  const abs = Math.abs(delta);
  const significant = abs >= 0.04;

  const entries: Record<string, { up: string[]; down: string[] }> = {
    kindness: {
      up: [
        `${name} trở nên tốt bụng hơn sau những trải nghiệm ấm lòng.`,
        `${name} bắt đầu tin tưởng người khác nhiều hơn.`,
        `Lòng nhân từ của ${name} lớn dần theo từng ngày.`,
      ],
      down: [
        `${name} mất niềm tin vào người khác.`,
        `${name} trở nên lạnh lùng và xa cách hơn.`,
        `Trái tim của ${name} dần chai lì theo năm tháng.`,
      ],
    },
    greed: {
      up: [
        `${name} trở nên tham vọng hơn.`,
        `${name} bắt đầu coi trọng của cải hơn tình cảm.`,
        `Cơn khát vàng trong lòng ${name} ngày càng mạnh.`,
      ],
      down: [
        `${name} trở nên rộng lượng hơn với người xung quanh.`,
        `${name} nhận ra tiền bạc không phải là tất cả.`,
        `Lòng tham của ${name} dần nguội đi.`,
      ],
    },
    bravery: {
      up: [
        `${name} trở nên dũng cảm hơn sau những thử thách.`,
        `${name} dũng cảm hơn sau chiến tranh.`,
        `Sự gan dạ của ${name} được tôi luyện qua lửa đạn.`,
      ],
      down: [
        `${name} mất đi sự dũng cảm của mình.`,
        `${name} trở nên dè dặt hơn trước nguy hiểm.`,
        `Những thất bại liên tiếp khiến ${name} do dự hơn.`,
      ],
    },
    intelligence: {
      up: [
        `${name} trở nên thông minh và sắc bén hơn.`,
        `Trí tuệ của ${name} ngày càng được mài giũa.`,
        `${name} học hỏi được nhiều điều từ cuộc sống.`,
      ],
      down: [
        `${name} trở nên thụ động và ít suy nghĩ hơn.`,
        `Sự căng thẳng khiến tư duy của ${name} kém đi.`,
        `${name} dần mất đi sự nhạy bén của mình.`,
      ],
    },
    curiosity: {
      up: [
        `${name} trở nên tò mò và ham khám phá hơn.`,
        `Ánh mắt của ${name} luôn tìm kiếm điều mới lạ.`,
        `${name} bắt đầu đặt câu hỏi về mọi thứ xung quanh.`,
      ],
      down: [
        `${name} trở nên thờ ơ với thế giới xung quanh.`,
        `Sự tò mò của ${name} bị dập tắt bởi áp lực.`,
        `${name} không còn muốn khám phá nữa.`,
      ],
    },
  };

  const options = entries[trait]?.[delta > 0 ? "up" : "down"] ?? [];
  const base = options[Math.floor(Math.random() * options.length)] ?? `Tính cách ${trait} của ${name} đã ${sign}.`;

  if (significant) return base;
  return base.replace("trở nên", "dần").replace("bắt đầu", "có vẻ");
}

/* ════════════════════════════════════════
   CORE: Tiến hóa tính cách một NPC
════════════════════════════════════════ */
export async function evolveNpcPersonality(npcId: string): Promise<{
  changed: boolean;
  deltas: Record<string, number>;
  journals: string[];
}> {
  const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
  if (!npc) return { changed: false, deltas: {}, journals: [] };

  const [personality] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npcId));
  if (!personality) return { changed: false, deltas: {}, journals: [] };

  const recentMemories = await db
    .select()
    .from(npcCoreMemories)
    .where(eq(npcCoreMemories.npcCoreId, npcId))
    .orderBy(desc(npcCoreMemories.timestamp))
    .limit(20);

  const [emotion] = await db.select().from(npcEmotions).where(eq(npcEmotions.npcId, npcId));

  const relationships = await db
    .select()
    .from(npcRelationships)
    .where(or(eq(npcRelationships.npcAId, npcId), eq(npcRelationships.npcBId, npcId)));

  const deltas: Record<string, number> = {
    kindness: 0,
    greed: 0,
    bravery: 0,
    intelligence: 0,
    curiosity: 0,
  };

  const causes: Array<{ trait: string; delta: number; cause: string; causeType: string }> = [];

  /* ── 1. Phân tích ký ức ── */
  const memoryText = recentMemories.map(m => m.event.toLowerCase()).join(" | ");

  // Kindness changes
  if (/phản bội|bội phản|phản|đâm sau lưng|lừa dối/.test(memoryText)) {
    const d = -0.03;
    deltas.kindness += d;
    causes.push({ trait: "kindness", delta: d, cause: "Bị phản bội nhiều lần", causeType: "memory" });
  }
  if (/được giúp|giúp đỡ|hỗ trợ|chia sẻ|cứu|tốt bụng/.test(memoryText)) {
    const d = 0.025;
    deltas.kindness += d;
    causes.push({ trait: "kindness", delta: d, cause: "Được giúp đỡ nhiều lần", causeType: "memory" });
  }

  // Greed changes
  const wealthMatches = (memoryText.match(/nhận tiền|lương|thu nhập|lợi nhuận|bán.*vàng|giàu|thu.*vàng/g) ?? []).length;
  if (wealthMatches >= 3) {
    const d = 0.02 * Math.min(wealthMatches, 5) / 5;
    deltas.greed += d;
    causes.push({ trait: "greed", delta: d, cause: `Liên tục làm giàu (${wealthMatches} lần gần đây)`, causeType: "memory" });
  }
  if (/mất tiền|bị cướp|nghèo|túi rỗng/.test(memoryText)) {
    const d = 0.015;
    deltas.greed += d;
    causes.push({ trait: "greed", delta: d, cause: "Mất mát về tài sản → khao khát giàu có hơn", causeType: "memory" });
  }

  // Bravery changes
  const winMatches = (memoryText.match(/chiến thắng|thắng|đánh bại|chiến công|anh hùng|dũng/g) ?? []).length;
  if (winMatches >= 2) {
    const d = 0.025 * Math.min(winMatches, 4) / 4;
    deltas.bravery += d;
    causes.push({ trait: "bravery", delta: d, cause: `Chiến thắng nhiều trận (${winMatches} lần)`, causeType: "memory" });
  }
  const loseMatches = (memoryText.match(/thất bại|thua|bại trận|thất trận|thua cuộc/g) ?? []).length;
  if (loseMatches >= 2) {
    const d = -0.025 * Math.min(loseMatches, 4) / 4;
    deltas.bravery += d;
    causes.push({ trait: "bravery", delta: d, cause: `Thất bại liên tiếp (${loseMatches} lần)`, causeType: "memory" });
  }

  // Intelligence & Curiosity from learning
  if (/học|khám phá|tìm hiểu|nghiên cứu|đọc|thư viện/.test(memoryText)) {
    const d = 0.02;
    deltas.intelligence += d;
    deltas.curiosity += d;
    causes.push({ trait: "intelligence", delta: d, cause: "Học hỏi và khám phá", causeType: "memory" });
    causes.push({ trait: "curiosity", delta: d, cause: "Ham học hỏi, khám phá thế giới", causeType: "memory" });
  }

  /* ── 2. Cảm xúc kéo dài ảnh hưởng tính cách ── */
  if (emotion) {
    if (emotion.anger > 70) {
      const d = -0.035;
      deltas.kindness += d;
      causes.push({ trait: "kindness", delta: d, cause: `Tức giận cao (${emotion.anger}/100) kéo dài → lạnh lùng hơn`, causeType: "emotion" });
    }
    if (emotion.confidence > 70) {
      const d = 0.03;
      deltas.bravery += d;
      causes.push({ trait: "bravery", delta: d, cause: `Tự tin cao (${emotion.confidence}/100) → dũng cảm hơn`, causeType: "emotion" });
    }
    if (emotion.stress > 70) {
      const d = -0.03;
      deltas.curiosity += d;
      causes.push({ trait: "curiosity", delta: d, cause: `Căng thẳng cao (${emotion.stress}/100) → mất tò mò`, causeType: "emotion" });
    }
    if (emotion.happiness > 75) {
      const d = 0.02;
      deltas.kindness += d;
      causes.push({ trait: "kindness", delta: d, cause: `Hạnh phúc cao (${emotion.happiness}/100) → tốt bụng hơn`, causeType: "emotion" });
    }
    if (emotion.sadness > 70) {
      const d = 0.02;
      deltas.intelligence += d;
      causes.push({ trait: "intelligence", delta: d, cause: `Buồn bã (${emotion.sadness}/100) → suy nghĩ sâu hơn`, causeType: "emotion" });
    }
    if (emotion.fear > 70) {
      const d = -0.025;
      deltas.bravery += d;
      causes.push({ trait: "bravery", delta: d, cause: `Sợ hãi cao (${emotion.fear}/100) → mất đi sự dũng cảm`, causeType: "emotion" });
    }
  }

  /* ── 3. Quan hệ xã hội ── */
  const enemies = relationships.filter(r => r.relationshipScore <= -20).length;
  const allies  = relationships.filter(r => r.relationshipScore >= 50).length;

  if (enemies >= 3) {
    const d = -0.02;
    deltas.kindness += d;
    causes.push({ trait: "kindness", delta: d, cause: `Có ${enemies} kẻ thù → mất tin tưởng`, causeType: "relationship" });
  }
  if (allies >= 2) {
    const d = 0.015;
    deltas.kindness += d;
    deltas.bravery += 0.01;
    causes.push({ trait: "kindness", delta: d, cause: `Có ${allies} đồng minh → thêm tin tưởng`, causeType: "relationship" });
    causes.push({ trait: "bravery", delta: 0.01, cause: `Có ${allies} đồng minh → dũng cảm hơn khi có hậu thuẫn`, causeType: "relationship" });
  }

  /* ── 4. Áp dụng delta và lưu lịch sử ── */
  const anyChange = Object.values(deltas).some(d => Math.abs(d) > 0.005);
  if (!anyChange) return { changed: false, deltas, journals: [] };

  const newKindness    = clamp(personality.kindness    + deltas.kindness);
  const newGreed       = clamp(personality.greed       + deltas.greed);
  const newBravery     = clamp(personality.bravery     + deltas.bravery);
  const newIntelligence= clamp(personality.intelligence+ deltas.intelligence);
  const newCuriosity   = clamp(personality.curiosity   + deltas.curiosity);

  await db.update(npcPersonalities)
    .set({ kindness: newKindness, greed: newGreed, bravery: newBravery, intelligence: newIntelligence, curiosity: newCuriosity })
    .where(eq(npcPersonalities.npcCoreId, npcId));

  // Snapshot lịch sử
  await db.insert(npcPersonalityHistory).values({
    npcCoreId: npcId,
    kindness: newKindness,
    greed: newGreed,
    bravery: newBravery,
    intelligence: newIntelligence,
    curiosity: newCuriosity,
  });

  // Giữ tối đa 100 snapshots
  const snapshots = await db.select({ id: npcPersonalityHistory.id })
    .from(npcPersonalityHistory)
    .where(eq(npcPersonalityHistory.npcCoreId, npcId))
    .orderBy(desc(npcPersonalityHistory.createdAt));
  if (snapshots.length > 100) {
    for (const s of snapshots.slice(100)) {
      await db.delete(npcPersonalityHistory).where(eq(npcPersonalityHistory.id, s.id));
    }
  }

  // Ghi nhật ký
  const journals: string[] = [];
  for (const c of causes) {
    if (Math.abs(c.delta) < 0.005) continue;
    const journal = makeJournal(npc.name, c.trait, c.delta, c.cause);
    journals.push(journal);
    await db.insert(npcPersonalityLogs).values({
      npcCoreId: npcId,
      trait: c.trait,
      delta: c.delta,
      cause: c.cause,
      causeType: c.causeType,
      journal,
    });
  }

  // Giữ tối đa 200 logs
  const logs = await db.select({ id: npcPersonalityLogs.id })
    .from(npcPersonalityLogs)
    .where(eq(npcPersonalityLogs.npcCoreId, npcId))
    .orderBy(desc(npcPersonalityLogs.createdAt));
  if (logs.length > 200) {
    for (const l of logs.slice(200)) {
      await db.delete(npcPersonalityLogs).where(eq(npcPersonalityLogs.id, l.id));
    }
  }

  return { changed: true, deltas, journals };
}

/* ════════════════════════════════════════
   POST /api/personality-evolution/tick/:worldSlug
   Tiến hóa toàn bộ NPC trong một thế giới (chạy mỗi 5 tick)
════════════════════════════════════════ */
router.post("/api/personality-evolution/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const npcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    if (npcs.length === 0) {
      return res.json({ message: "Không có NPC", evolved: 0, journals: [] });
    }

    const allJournals: string[] = [];
    let evolvedCount = 0;

    for (const npc of npcs) {
      const result = await evolveNpcPersonality(npc.id);
      if (result.changed) {
        evolvedCount++;
        allJournals.push(...result.journals);
      }
    }

    return res.json({
      message: `Đã tiến hóa tính cách ${evolvedCount}/${npcs.length} NPC`,
      evolved: evolvedCount,
      journals: allJournals.slice(0, 30),
    });
  } catch (err) {
    console.error("[personalityEvolution] tick:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST /api/personality-evolution/evolve/:npcId
   Tiến hóa một NPC cụ thể
════════════════════════════════════════ */
router.post("/api/personality-evolution/evolve/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params;
    const result = await evolveNpcPersonality(npcId);
    return res.json(result);
  } catch (err) {
    console.error("[personalityEvolution] evolve:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET /api/personality-evolution/:npcId
   Lấy lịch sử tính cách + nhật ký của một NPC
════════════════════════════════════════ */
router.get("/api/personality-evolution/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params;

    const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
    if (!npc) return res.status(404).json({ message: "Không tìm thấy NPC" });

    const [personality] = await db.select().from(npcPersonalities)
      .where(eq(npcPersonalities.npcCoreId, npcId));

    const history = await db.select().from(npcPersonalityHistory)
      .where(eq(npcPersonalityHistory.npcCoreId, npcId))
      .orderBy(desc(npcPersonalityHistory.createdAt))
      .limit(50);

    const logs = await db.select().from(npcPersonalityLogs)
      .where(eq(npcPersonalityLogs.npcCoreId, npcId))
      .orderBy(desc(npcPersonalityLogs.createdAt))
      .limit(50);

    return res.json({ npc, personality, history: history.reverse(), logs });
  } catch (err) {
    console.error("[personalityEvolution] get:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET /api/personality-evolution/dashboard/:worldSlug
   Dashboard tổng quan tất cả NPC trong thế giới
════════════════════════════════════════ */
router.get("/api/personality-evolution/dashboard/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;

    const npcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)))
      .limit(50);

    const result = await Promise.all(npcs.map(async (npc) => {
      const [personality] = await db.select().from(npcPersonalities)
        .where(eq(npcPersonalities.npcCoreId, npc.id));

      const recentLogs = await db.select().from(npcPersonalityLogs)
        .where(eq(npcPersonalityLogs.npcCoreId, npc.id))
        .orderBy(desc(npcPersonalityLogs.createdAt))
        .limit(5);

      const history = await db.select().from(npcPersonalityHistory)
        .where(eq(npcPersonalityHistory.npcCoreId, npc.id))
        .orderBy(npcPersonalityHistory.createdAt)
        .limit(10);

      return { npc, personality: personality ?? null, recentLogs, history };
    }));

    // Nhật ký gần nhất toàn thế giới
    const worldJournals = await db.select({
      id: npcPersonalityLogs.id,
      journal: npcPersonalityLogs.journal,
      trait: npcPersonalityLogs.trait,
      delta: npcPersonalityLogs.delta,
      cause: npcPersonalityLogs.cause,
      causeType: npcPersonalityLogs.causeType,
      createdAt: npcPersonalityLogs.createdAt,
      npcCoreId: npcPersonalityLogs.npcCoreId,
    }).from(npcPersonalityLogs)
      .orderBy(desc(npcPersonalityLogs.createdAt))
      .limit(30);

    // Join NPC names vào journals
    const npcMap = new Map(npcs.map(n => [n.id, n.name]));
    const journalsWithNames = worldJournals.map(j => ({
      ...j,
      npcName: npcMap.get(j.npcCoreId) ?? "Ẩn danh",
    }));

    return res.json({ npcs: result, journals: journalsWithNames });
  } catch (err) {
    console.error("[personalityEvolution] dashboard:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
