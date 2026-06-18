import { Router } from "express";
import { db } from "@workspace/db";
import {
  diplomaticRelations, diplomaticTreaties, diplomaticMemories,
  npcGovernments, territories,
} from "@workspace/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { broadcastUnity } from "../lib/unityWs.js";

const router = Router();

const RELATION_TYPES = [
  { id: "đồng_minh",   label: "Đồng Minh",   color: "#22c55e", icon: "🟢", minScore:  70 },
  { id: "thân_thiện",  label: "Thân Thiện",   color: "#06b6d4", icon: "🔵", minScore:  30 },
  { id: "trung_lập",   label: "Trung Lập",    color: "#9ca3af", icon: "⚪", minScore: -10 },
  { id: "căng_thẳng",  label: "Căng Thẳng",   color: "#f59e0b", icon: "🟡", minScore: -40 },
  { id: "thù_địch",    label: "Thù Địch",     color: "#ef4444", icon: "🔴", minScore: -70 },
  { id: "chiến_tranh", label: "Chiến Tranh",  color: "#7f1d1d", icon: "☠️", minScore: -101},
] as const;

const TREATY_TYPES = [
  { id: "liên_minh",        label: "Liên Minh",       icon: "🤝", scoreBonus: 30 },
  { id: "thương_mại",       label: "Thương Mại",       icon: "📦", scoreBonus: 15 },
  { id: "viện_trợ",         label: "Viện Trợ",         icon: "🎁", scoreBonus: 20 },
  { id: "phòng_thủ_chung",  label: "Phòng Thủ Chung", icon: "🛡️", scoreBonus: 25 },
  { id: "đình_chiến",       label: "Đình Chiến",       icon: "🏳️", scoreBonus: 10 },
] as const;

const ACTIONS = [
  { id: "gửi_viện_trợ",       label: "Gửi Viện Trợ",           icon: "🎁", scoreChange: +20, color: "#22c55e" },
  { id: "đề_nghị_liên_minh",  label: "Đề Nghị Liên Minh",      icon: "🤝", scoreChange: +15, color: "#06b6d4" },
  { id: "ký_thương_mại",      label: "Ký Hiệp Ước Thương Mại", icon: "📦", scoreChange: +10, color: "#a855f7" },
  { id: "áp_đặt_cấm_vận",    label: "Áp Đặt Cấm Vận",         icon: "🚫", scoreChange: -30, color: "#f59e0b" },
  { id: "nhượng_lãnh_thổ",   label: "Yêu Cầu Nhượng Đất",     icon: "🗺️", scoreChange: -40, color: "#ef4444" },
  { id: "tuyên_chiến",        label: "Tuyên Chiến",             icon: "⚔️", scoreChange: -50, color: "#7f1d1d" },
] as const;

function getRelationType(score: number): string {
  for (let i = RELATION_TYPES.length - 1; i >= 0; i--) {
    if (score >= RELATION_TYPES[i].minScore) return RELATION_TYPES[i].id;
  }
  return "chiến_tranh";
}

async function addMemory(
  governmentId: string, targetGovId: string | null,
  event: string, scoreChange: number
) {
  await db.insert(diplomaticMemories).values({ governmentId, targetGovId, event, scoreChange });
}

async function getOrCreateRelation(govAId: string, govBId: string) {
  const [a, b] = govAId < govBId ? [govAId, govBId] : [govBId, govAId];
  const existing = await db.select().from(diplomaticRelations)
    .where(and(eq(diplomaticRelations.governmentAId, a), eq(diplomaticRelations.governmentBId, b))).limit(1);
  if (existing.length > 0) return existing[0];
  const [rel] = await db.insert(diplomaticRelations).values({
    governmentAId: a, governmentBId: b, relationScore: 0, relationType: "trung_lập",
  }).returning();
  return rel;
}

/* GET /api/npc-diplomacy */
router.get("/api/npc-diplomacy", async (_req, res) => {
  try {
    const govs    = await db.select().from(npcGovernments).limit(50);
    const rels    = await db.select().from(diplomaticRelations).orderBy(desc(diplomaticRelations.updatedAt)).limit(100);
    const treats  = await db.select().from(diplomaticTreaties).where(eq(diplomaticTreaties.status, "active")).limit(50);
    const mems    = await db.select().from(diplomaticMemories).orderBy(desc(diplomaticMemories.createdAt)).limit(50);

    /* Stats */
    const totalRels    = rels.length;
    const alliances    = rels.filter(r => r.relationType === "đồng_minh").length;
    const wars         = rels.filter(r => r.relationType === "chiến_tranh").length;
    const activeTreats = treats.length;

    res.json({
      governments: govs, relations: rels, treaties: treats, memories: mems,
      stats: { totalRels, alliances, wars, activeTreats, totalGovs: govs.length },
      relationTypes: RELATION_TYPES, treatyTypes: TREATY_TYPES, actions: ACTIONS,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/* POST /api/npc-diplomacy/init — sinh quan hệ ban đầu giữa tất cả chính phủ */
router.post("/api/npc-diplomacy/init", async (_req, res) => {
  try {
    const govs = await db.select().from(npcGovernments).limit(20);
    if (govs.length < 2) return res.status(400).json({ error: "Cần ít nhất 2 chính phủ NPC" });

    let created = 0;
    for (let i = 0; i < govs.length; i++) {
      for (let j = i + 1; j < govs.length; j++) {
        const a = govs[i].id < govs[j].id ? govs[i].id : govs[j].id;
        const b = a === govs[i].id ? govs[j].id : govs[i].id;
        const existing = await db.select().from(diplomaticRelations)
          .where(and(eq(diplomaticRelations.governmentAId, a), eq(diplomaticRelations.governmentBId, b))).limit(1);
        if (existing.length === 0) {
          /* Mô phỏng quan hệ dựa trên loại chính phủ */
          const sameType = govs[i].govType === govs[j].govType;
          const base = sameType ? 15 : -5;
          const score = Math.max(-100, Math.min(100, base + Math.floor(Math.random() * 41) - 20));
          await db.insert(diplomaticRelations).values({
            governmentAId: a, governmentBId: b,
            relationScore: score, relationType: getRelationType(score),
          });
          /* Ký ức ban đầu */
          await addMemory(a, b, `📜 Thiết lập quan hệ ngoại giao ban đầu. Điểm: ${score > 0 ? "+" : ""}${score}.`, score);
          created++;
        }
      }
    }
    res.json({ message: `Khởi tạo ${created} quan hệ ngoại giao giữa ${govs.length} chính phủ!`, created });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/* POST /api/npc-diplomacy/action */
router.post("/api/npc-diplomacy/action", async (req, res) => {
  try {
    const { governmentAId, governmentBId, action } = req.body as {
      governmentAId?: string; governmentBId?: string; action?: string;
    };
    if (!governmentAId || !governmentBId || !action) return res.status(400).json({ error: "Thiếu thông tin" });

    const actionMeta = ACTIONS.find(a => a.id === action);
    if (!actionMeta) return res.status(400).json({ error: "Hành động không hợp lệ" });

    const [govA] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, governmentAId)).limit(1);
    const [govB] = await db.select().from(npcGovernments).where(eq(npcGovernments.id, governmentBId)).limit(1);
    if (!govA || !govB) return res.status(404).json({ error: "Chính phủ không tồn tại" });

    const rel = await getOrCreateRelation(governmentAId, governmentBId);
    const newScore = Math.max(-100, Math.min(100, rel.relationScore + actionMeta.scoreChange));
    const newType  = getRelationType(newScore);

    const [a, b] = governmentAId < governmentBId ? [governmentAId, governmentBId] : [governmentBId, governmentAId];
    await db.update(diplomaticRelations)
      .set({ relationScore: newScore, relationType: newType, updatedAt: new Date() })
      .where(and(eq(diplomaticRelations.governmentAId, a), eq(diplomaticRelations.governmentBId, b)));

    await addMemory(governmentAId, governmentBId, `${actionMeta.icon} ${actionMeta.label} đối với ${govB.govType}.`, actionMeta.scoreChange);
    await addMemory(governmentBId, governmentAId, `${actionMeta.icon} ${govA.govType} đã thực hiện: ${actionMeta.label}.`, 0);

    /* Auto-treaty */
    let treaty = null;
    if (["đề_nghị_liên_minh", "ký_thương_mại", "đình_chiến"].includes(action) && actionMeta.scoreChange > 0) {
      const treatyType = action === "đề_nghị_liên_minh" ? "liên_minh"
        : action === "ký_thương_mại" ? "thương_mại" : "đình_chiến";
      const endDate = new Date(); endDate.setDate(endDate.getDate() + 30);
      const [t] = await db.insert(diplomaticTreaties).values({
        governmentAId: a, governmentBId: b, treatyType, status: "active", endDate,
      }).returning();
      treaty = t;
    }
    if (action === "tuyên_chiến") {
      await db.update(diplomaticTreaties).set({ status: "cancelled" })
        .where(and(
          or(and(eq(diplomaticTreaties.governmentAId, a), eq(diplomaticTreaties.governmentBId, b))),
          eq(diplomaticTreaties.status, "active")
        ));
    }

    /* Unity realtime broadcast — resolve territory worldSlug from government */
    try {
      const [terrA] = await db
        .select({ worldSlug: territories.worldSlug })
        .from(territories)
        .where(eq(territories.id, govA.territoryId))
        .limit(1);
      if (terrA) {
        broadcastUnity({
          type: "diplomacy",
          worldSlug: terrA.worldSlug,
          govA: govA.govType,
          govB: govB.govType,
          action: `${actionMeta.icon} ${actionMeta.label}`,
          relation: newType,
        });
      }
    } catch {}

    const scoreStr = newScore > 0 ? `+${newScore}` : `${newScore}`;
    res.json({
      message: `${actionMeta.icon} ${actionMeta.label} thành công! Điểm quan hệ: ${scoreStr} (${newType.replace("_"," ")})`,
      newScore, newType, treaty,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/* POST /api/npc-diplomacy/ai-tick — AI tự điều chỉnh quan hệ */
router.post("/api/npc-diplomacy/ai-tick", async (_req, res) => {
  try {
    const rels = await db.select().from(diplomaticRelations).limit(50);
    let adjusted = 0;

    for (const rel of rels) {
      const tradeDrift     = Math.floor(Math.random() * 11) - 5;
      const territoryDrift = Math.floor(Math.random() * 7) - 4;
      const factionDrift   = Math.floor(Math.random() * 5) - 2;
      const drift = tradeDrift + territoryDrift + factionDrift;
      if (drift === 0) continue;

      const newScore = Math.max(-100, Math.min(100, rel.relationScore + drift));
      const newType  = getRelationType(newScore);
      await db.update(diplomaticRelations)
        .set({ relationScore: newScore, relationType: newType, updatedAt: new Date() })
        .where(eq(diplomaticRelations.id, rel.id));

      if (Math.abs(drift) >= 5) {
        const reason = tradeDrift > 2 ? "thương mại phát triển thuận lợi"
          : territoryDrift < -2 ? "tranh chấp lãnh thổ leo thang"
          : factionDrift < 0 ? "khác biệt phe phái"
          : "viện trợ lương thực";
        await addMemory(rel.governmentAId, rel.governmentBId,
          `🤖 AI: Quan hệ thay đổi do ${reason}. Điểm: ${drift > 0 ? "+" : ""}${drift}.`, drift);
      }
      adjusted++;
    }

    res.json({ message: `AI đã tự động điều chỉnh ${adjusted} quan hệ ngoại giao.`, adjusted });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/* GET /api/npc-diplomacy/memory/:govId */
router.get("/api/npc-diplomacy/memory/:govId", async (req, res) => {
  try {
    const mems = await db.select().from(diplomaticMemories)
      .where(eq(diplomaticMemories.governmentId, req.params.govId))
      .orderBy(desc(diplomaticMemories.createdAt)).limit(30);
    res.json(mems);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
