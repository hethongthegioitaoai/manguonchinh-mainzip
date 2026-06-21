import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  militaryForces, militaryMemories,
  npcGovernments, npcGovernmentLogs,
  territories,
  npcCores,
  governmentActivePolicies, governmentPolicies,
} from "@workspace/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const SPECIAL_OCCUPATIONS = [
  "Thủ Lĩnh", "Lãnh Đạo", "Vua", "Thị Trưởng", "Thống Đốc",
  "Thương Nhân Trưởng", "Thầy Thuốc", "Tu Sĩ", "Đạo Sư",
];

function calcMilitaryPower(soldiers: number, morale: number, training: number, supply: number): number {
  const moraleF  = morale / 100;
  const trainF   = training / 10;
  const supplyF  = supply / 100;
  return Math.round(soldiers * moraleF * trainF * supplyF * 10);
}

/* ════════════════════════════════════════
   GET /api/military/:worldSlug
════════════════════════════════════════ */
router.get("/military/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ armies: [], summary: null });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));
    const govIds = govs.map(g => g.id);
    if (govIds.length === 0) return res.json({ armies: [], summary: null });

    const armies = await db.select().from(militaryForces)
      .where(inArray(militaryForces.governmentId, govIds))
      .orderBy(desc(militaryForces.militaryPower));

    const enriched = armies.map(a => {
      const gov  = govs.find(g => g.id === a.governmentId) ?? null;
      const terr = terrs.find(t => t.id === a.territoryId) ?? null;
      return { ...a, government: gov, territory: terr };
    });

    const memories = armies.length > 0
      ? await db.select().from(militaryMemories)
          .where(inArray(militaryMemories.armyId, armies.map(a => a.id)))
          .orderBy(desc(militaryMemories.createdAt)).limit(30)
      : [];

    const summary = {
      totalArmies:   armies.length,
      totalSoldiers: armies.reduce((s, a) => s + a.totalSoldiers, 0),
      avgMorale:     armies.length ? armies.reduce((s, a) => s + a.morale, 0) / armies.length : 0,
      avgTraining:   armies.length ? armies.reduce((s, a) => s + a.trainingLevel, 0) / armies.length : 0,
      avgSupply:     armies.length ? armies.reduce((s, a) => s + a.supplyLevel, 0) / armies.length : 0,
      totalPower:    armies.reduce((s, a) => s + a.militaryPower, 0),
    };

    return res.json({ armies: enriched, summary, memories });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/establish/:worldSlug
   Tạo quân đội cho các chính phủ chưa có
════════════════════════════════════════ */
router.post("/military/establish/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ created: 0, message: "Chưa có lãnh thổ" });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ created: 0, message: "Chưa có chính phủ" });

    const existing = await db.select({ gId: militaryForces.governmentId }).from(militaryForces)
      .where(inArray(militaryForces.governmentId, govs.map(g => g.id)));
    const existingGovIds = new Set(existing.map(e => e.gId));

    const ARMY_NAMES: Record<string, string[]> = {
      cultivation: ["Thiên Kiếm Vệ", "Ngọc Long Quân", "Huyền Thiết Đội", "Phong Lôi Vệ"],
      cyberpunk:   ["Đội Xung Kích Alpha", "Lực Lượng Neon", "Quân Đoàn Thép", "Vệ Binh Cyber"],
      wasteland:   ["Đội Bão Cát", "Quân Hoang Mạc", "Vệ Binh Sắt Rỉ", "Lữ Đoàn Xương Khô"],
    };
    const names = ARMY_NAMES[worldSlug] ?? ARMY_NAMES.cultivation;

    let created = 0;
    for (const gov of govs) {
      if (existingGovIds.has(gov.id)) continue;
      const terr = terrs.find(t => t.id === gov.territoryId);
      if (!terr) continue;
      const soldiers = rand(20, 80);
      const morale   = rand(50, 85);
      const training = parseFloat((rand(10, 40) / 10).toFixed(1));
      const supply   = rand(60, 100);
      const power    = calcMilitaryPower(soldiers, morale, training, supply);
      const armyName = names[created % names.length];
      await db.insert(militaryForces).values({
        governmentId: gov.id,
        territoryId:  terr.id,
        armyName,
        totalSoldiers: soldiers,
        morale,
        trainingLevel: training,
        supplyLevel:   supply,
        militaryPower: power,
      });
      await db.insert(npcGovernmentLogs).values({
        governmentId: gov.id,
        event: `Thành lập quân đội "${armyName}" — ${soldiers} chiến binh`,
      });
      created++;
    }

    return res.json({ created, message: `Đã thành lập ${created} quân đội mới` });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/recruit/:worldSlug
   Tuyển quân từ NPC đủ điều kiện
════════════════════════════════════════ */
router.post("/military/recruit/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const terrIds = terrs.map(t => t.id);
    if (terrIds.length === 0) return res.json({ totalRecruited: 0, message: "Chưa có lãnh thổ" });

    const govs = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ totalRecruited: 0, message: "Chưa có chính phủ" });

    const armies = await db.select().from(militaryForces)
      .where(inArray(militaryForces.governmentId, govs.map(g => g.id)));
    if (armies.length === 0) return res.json({ totalRecruited: 0, message: "Chưa thành lập quân đội" });

    const allNpcs = await db.select().from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug));

    const eligibleNpcs = allNpcs.filter(npc =>
      npc.age >= 18 &&
      npc.energy >= 50 &&
      npc.hunger < 70 &&
      !SPECIAL_OCCUPATIONS.some(o => npc.occupation.includes(o))
    );

    const activePolicies = await db.select({
      policyName: governmentPolicies.name,
      effects: governmentPolicies.effects,
    }).from(governmentActivePolicies)
      .innerJoin(governmentPolicies, eq(governmentActivePolicies.policyId, governmentPolicies.id))
      .where(inArray(governmentActivePolicies.governmentId, govs.map(g => g.id)));

    const hasMilitaryExpansion = activePolicies.some(p =>
      p.policyName.toLowerCase().includes("quân sự") || p.policyName.toLowerCase().includes("military")
    );
    const baseRate = hasMilitaryExpansion ? 0.18 : 0.10;

    let totalRecruited = 0;
    const memoriesToInsert: { npcId: string; armyId: string; content: string }[] = [];

    for (const army of armies) {
      const gov = govs.find(g => g.id === army.governmentId);
      const terr = terrs.find(t => t.id === army.territoryId);

      /* ── Bước 2: Recruitment gate — treasury + prosperity + population ── */
      if (!gov || gov.treasury < 50) continue;
      if (!terr || terr.prosperity <= 30 || terr.population <= 20) continue;

      // Tuyển chậm hơn khi thịnh vượng thấp
      const prosperityMult = terr.prosperity < 50 ? 0.4 : terr.prosperity < 70 ? 0.7 : 1.0;
      const recruited = Math.floor(eligibleNpcs.length * (baseRate + Math.random() * 0.05) * prosperityMult);
      if (recruited === 0) continue;

      const newSoldiers = army.totalSoldiers + recruited;
      const newPower    = calcMilitaryPower(newSoldiers, army.morale, army.trainingLevel, army.supplyLevel);
      const cost        = recruited * 10;

      await db.update(militaryForces)
        .set({ totalSoldiers: newSoldiers, militaryPower: newPower, updatedAt: new Date() })
        .where(eq(militaryForces.id, army.id));
      await db.update(npcGovernments)
        .set({ treasury: gov.treasury - cost, updatedAt: new Date() })
        .where(eq(npcGovernments.id, gov.id));
      await db.insert(npcGovernmentLogs).values({
        governmentId: gov.id,
        event: `Tuyển thêm ${recruited} chiến binh — chi phí ${cost} vàng`,
      });

      const chosenNpcs = eligibleNpcs.slice(0, recruited);
      for (const npc of chosenNpcs) {
        memoriesToInsert.push({ npcId: npc.id, armyId: army.id, content: `Gia nhập quân đội ${army.armyName}.` });
      }

      totalRecruited += recruited;
    }

    if (memoriesToInsert.length > 0) {
      await db.insert(militaryMemories).values(memoriesToInsert);
    }

    return res.json({ totalRecruited, message: `Tuyển được ${totalRecruited} chiến binh mới` });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/train/:worldSlug
   Huấn luyện quân đội — tăng training_level + military_power, tiêu ngân quỹ
════════════════════════════════════════ */
router.post("/military/train/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const govs  = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrs.map(t => t.id)));
    const armies = await db.select().from(militaryForces)
      .where(inArray(militaryForces.governmentId, govs.map(g => g.id)));

    let trained = 0;
    const memories: { npcId?: string; armyId: string; content: string }[] = [];

    for (const army of armies) {
      const gov = govs.find(g => g.id === army.governmentId);
      if (!gov) continue;

      const trainingCost = Math.max(10, Math.floor(army.totalSoldiers * 0.5));
      if (gov.treasury < trainingCost) {
        memories.push({ armyId: army.id, content: `Thiếu ngân sách huấn luyện — quân đội ${army.armyName} bị bỏ qua.` });
        continue;
      }

      const newTraining = parseFloat(clamp(army.trainingLevel + 0.1 + Math.random() * 0.1, 1, 10).toFixed(2));
      const newPower    = calcMilitaryPower(army.totalSoldiers, army.morale, newTraining, army.supplyLevel);

      await db.update(militaryForces)
        .set({ trainingLevel: newTraining, militaryPower: newPower, updatedAt: new Date() })
        .where(eq(militaryForces.id, army.id));
      await db.update(npcGovernments)
        .set({ treasury: gov.treasury - trainingCost, updatedAt: new Date() })
        .where(eq(npcGovernments.id, gov.id));
      await db.insert(npcGovernmentLogs).values({
        governmentId: gov.id,
        event: `Huấn luyện ${army.armyName} — cấp độ ${newTraining.toFixed(1)}, chi phí ${trainingCost} vàng`,
      });

      memories.push({ armyId: army.id, content: `Hoàn thành đợt huấn luyện — trình độ đạt ${newTraining.toFixed(1)}/10.` });
      trained++;
    }

    if (memories.length > 0) {
      const npcList = await db.select({ id: npcCores.id }).from(npcCores)
        .where(eq(npcCores.worldSlug, worldSlug)).limit(20);
      for (const m of memories) {
        if (!m.npcId && npcList.length > 0) {
          const randomNpc = npcList[rand(0, npcList.length - 1)];
          await db.insert(militaryMemories).values({ npcId: randomNpc.id, armyId: m.armyId, content: m.content });
        }
      }
    }

    return res.json({ trained, message: `Đã huấn luyện ${trained} quân đội` });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/supply/:worldSlug
   Tiếp tế quân đội — tiêu thực phẩm/ngân sách, ảnh hưởng morale + power
════════════════════════════════════════ */
router.post("/military/supply/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const govs  = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrs.map(t => t.id)));
    const armies = await db.select().from(militaryForces)
      .where(inArray(militaryForces.governmentId, govs.map(g => g.id)));

    let supplied = 0;
    let starved  = 0;
    const mems: { armyId: string; content: string }[] = [];

    for (const army of armies) {
      const gov = govs.find(g => g.id === army.governmentId);
      if (!gov) continue;

      const foodCost   = Math.max(5, Math.floor(army.totalSoldiers * 0.3));
      const budgetCost = Math.max(5, Math.floor(army.totalSoldiers * 0.2));
      const canSupply  = gov.treasury >= budgetCost + foodCost;

      let newMorale  = army.morale;
      let newSupply  = army.supplyLevel;
      let newPower   = army.militaryPower;

      if (canSupply) {
        newSupply  = clamp(newSupply  + rand(5, 15), 0, 100);
        newMorale  = clamp(newMorale  + rand(2, 8),  0, 100);
        newPower   = calcMilitaryPower(army.totalSoldiers, newMorale, army.trainingLevel, newSupply);
        await db.update(npcGovernments)
          .set({ treasury: gov.treasury - (foodCost + budgetCost), updatedAt: new Date() })
          .where(eq(npcGovernments.id, gov.id));
        mems.push({ armyId: army.id, content: `Nhận đầy đủ lương thực và ngân sách tiếp tế.` });
        supplied++;
      } else {
        newSupply  = clamp(newSupply  - rand(10, 25), 0, 100);
        newMorale  = clamp(newMorale  - rand(5, 15),  0, 100);
        newPower   = calcMilitaryPower(army.totalSoldiers, newMorale, army.trainingLevel, newSupply);
        await db.insert(npcGovernmentLogs).values({
          governmentId: gov.id,
          event: `${army.armyName} thiếu tiếp tế — tinh thần giảm mạnh`,
        });
        mems.push({ armyId: army.id, content: `Thiếu lương thực quân sự — tinh thần suy giảm nghiêm trọng.` });
        starved++;

        /* ── Bước 1: Army supply/morale → Territory security ── */
        const terr = terrs.find(t => t.id === army.territoryId);
        if (terr) {
          let secDelta = 0;
          if (newSupply < 20) secDelta -= rand(1, 3);   // thiếu lương trầm trọng
          if (newMorale < 30) secDelta -= rand(1, 2);   // tinh thần sụp đổ
          if (secDelta < 0) {
            const newSec = clamp(terr.security + secDelta, 0, 100);
            await db.update(territories)
              .set({ security: Math.round(newSec), updatedAt: new Date() })
              .where(eq(territories.id, terr.id));
            await db.insert(npcGovernmentLogs).values({
              governmentId: gov.id,
              event: `An ninh ${terr.name} giảm ${Math.abs(secDelta).toFixed(1)} điểm do quân đội thiếu tiếp tế`,
            });
          }
        }
      }

      await db.update(militaryForces)
        .set({ morale: newMorale, supplyLevel: newSupply, militaryPower: newPower, updatedAt: new Date() })
        .where(eq(militaryForces.id, army.id));
    }

    const npcList = await db.select({ id: npcCores.id }).from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug)).limit(30);
    for (const m of mems) {
      if (npcList.length > 0) {
        const npc = npcList[rand(0, npcList.length - 1)];
        await db.insert(militaryMemories).values({ npcId: npc.id, armyId: m.armyId, content: m.content });
      }
    }

    return res.json({ supplied, starved, message: `Tiếp tế: ${supplied} thành công, ${starved} thiếu thốn` });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/tick/:worldSlug
   Full tick: recruit → train → supply (gọi từ world simulation)
════════════════════════════════════════ */
router.post("/military/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const base = `${req.protocol}://${req.get("host")}`;
    const headers = { Cookie: req.headers.cookie ?? "", "Content-Type": "application/json" };

    const [recruits, train, supply] = await Promise.all([
      fetch(`${base}/api/military/recruit/${worldSlug}`,  { method: "POST", headers }).then(r => r.json()),
      fetch(`${base}/api/military/train/${worldSlug}`,    { method: "POST", headers }).then(r => r.json()),
      fetch(`${base}/api/military/supply/${worldSlug}`,   { method: "POST", headers }).then(r => r.json()),
    ]);

    return res.json({ recruits, train, supply, message: "Tick quân đội hoàn tất" });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/* ════════════════════════════════════════
   POST /api/military/ai-decision/:worldSlug
   AI chính phủ điều chỉnh chiến lược quân sự
════════════════════════════════════════ */
router.post("/military/ai-decision/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const govs  = await db.select().from(npcGovernments)
      .where(inArray(npcGovernments.territoryId, terrs.map(t => t.id)));
    const armies = await db.select().from(militaryForces)
      .where(inArray(militaryForces.governmentId, govs.map(g => g.id)));

    if (armies.length === 0) return res.json({ decisions: [], message: "Chưa có quân đội" });

    const avgPower  = armies.reduce((s, a) => s + a.militaryPower, 0) / armies.length;
    const avgMorale = armies.reduce((s, a) => s + a.morale, 0) / armies.length;
    const avgSupply = armies.reduce((s, a) => s + a.supplyLevel, 0) / armies.length;
    const totalGov  = govs.reduce((s, g) => s + g.treasury, 0);
    const avgApproval = govs.reduce((s, g) => s + g.approvalRate, 0) / govs.length;

    const prompt = `Bạn là AI cố vấn quân sự của thế giới ảo "${worldSlug}".

Tình trạng hiện tại:
- Sức mạnh quân sự trung bình: ${avgPower.toFixed(0)}
- Tinh thần trung bình: ${avgMorale.toFixed(0)}%
- Mức tiếp tế trung bình: ${avgSupply.toFixed(0)}%
- Ngân sách chính phủ tổng: ${totalGov} vàng
- Tỷ lệ ủng hộ chính phủ: ${avgApproval.toFixed(0)}%

Đưa ra đúng 3 quyết định chiến lược quân sự ngắn gọn (mỗi quyết định 1 câu, tiếng Việt).
Định dạng JSON: {"decisions": ["...", "...", "..."]}`;

    let decisions: string[] = [];
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = JSON.parse(text.replace(/```json|```/g, "").trim());
      decisions = json.decisions ?? [];
    } catch {
      if (avgSupply < 40) decisions.push("Ưu tiên tiếp tế lương thực và ngân sách cho quân đội đang thiếu thốn.");
      if (avgMorale < 50) decisions.push("Tăng cường phúc lợi và nghỉ dưỡng để khôi phục tinh thần chiến đấu.");
      if (totalGov < 500) decisions.push("Cắt giảm tuyển quân mới, tập trung nguồn lực vào đội quân hiện tại.");
      else decisions.push("Mở rộng tuyển quân để tăng cường phòng thủ lãnh thổ.");
      if (avgApproval > 70) decisions.push("Điều kiện thuận lợi để tăng cường huấn luyện và nâng cấp trang bị.");
    }

    for (const gov of govs) {
      await db.insert(npcGovernmentLogs).values({
        governmentId: gov.id,
        event: `AI Quân Sự: ${decisions[0] ?? "Duy trì hiện trạng"}`,
      });
    }

    return res.json({ decisions, context: { avgPower, avgMorale, avgSupply, totalGov, avgApproval } });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
