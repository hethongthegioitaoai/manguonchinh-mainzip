import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { npcCores, npcCoreMemories, npcPersonalities, npcRelationships } from "@workspace/db/schema";
import { npcFamilies, npcFamilyMemories, npcBirths } from "@workspace/db/schema";
import { eq, desc, and, isNotNull, count, sql } from "drizzle-orm";
import { broadcastUnity } from "../lib/unityWs.js";

const router = Router();

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getLifeStage(age: number): string {
  if (age <= 12) return "child";
  if (age <= 17) return "teenager";
  if (age <= 59) return "adult";
  return "elder";
}

function getLifeStageName(stage: string): string {
  const map: Record<string, string> = { child: "Trẻ Em", teenager: "Thiếu Niên", adult: "Trưởng Thành", elder: "Trưởng Lão" };
  return map[stage] ?? stage;
}

const CHILD_NAMES = [
  "Minh", "Lan", "Hùng", "Mai", "Tuấn", "Hoa", "Đức", "Nga", "Khang", "Linh",
  "Bảo", "Trang", "Nhân", "Yến", "Thành", "Hằng", "Quân", "Thuý", "Phú", "Lệ",
  "Kiệt", "Nhi", "Dũng", "Oanh", "Hải", "Trúc", "Long", "Phượng", "Toàn", "Hiền",
  "Sơn", "Vân", "Cường", "Thảo", "Tiến", "Ngọc", "Việt", "Diệu", "Lâm", "Hạnh",
];

/* ════════════════════════════════════════
   GET /api/npc-population/:worldSlug
   Population stats + age distribution + births
════════════════════════════════════════ */
router.get("/npc-population/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const allNpcs = await db.select({
      id: npcCores.id,
      name: npcCores.name,
      age: npcCores.age,
      lifeStage: npcCores.lifeStage,
      occupation: npcCores.occupation,
      happiness: npcCores.happiness,
      active: npcCores.active,
    }).from(npcCores).where(eq(npcCores.worldSlug, worldSlug));

    const totalPopulation = allNpcs.filter(n => n.active === 1).length;

    const ageDist = { child: 0, teenager: 0, adult: 0, elder: 0 };
    for (const npc of allNpcs.filter(n => n.active === 1)) {
      const stage = npc.lifeStage as keyof typeof ageDist;
      if (stage in ageDist) ageDist[stage]++;
    }

    const recentBirths = await db.select().from(npcBirths)
      .where(eq(npcBirths.worldSlug, worldSlug))
      .orderBy(desc(npcBirths.createdAt))
      .limit(10);

    const birthsWithNames = await Promise.all(recentBirths.map(async (b) => {
      const [father] = b.fatherId ? await db.select({ name: npcCores.name }).from(npcCores).where(eq(npcCores.id, b.fatherId)) : [null];
      const [mother] = b.motherId ? await db.select({ name: npcCores.name }).from(npcCores).where(eq(npcCores.id, b.motherId)) : [null];
      return { ...b, fatherName: father?.name ?? "Không rõ", motherName: mother?.name ?? "Không rõ" };
    }));

    const totalBirths = await db.select({ cnt: count() }).from(npcBirths).where(eq(npcBirths.worldSlug, worldSlug));

    return res.json({
      totalPopulation,
      totalBirths: totalBirths[0]?.cnt ?? 0,
      ageDist,
      recentBirths: birthsWithNames,
      allNpcs: allNpcs.filter(n => n.active === 1),
    });
  } catch (err) { console.error("[npcPop] stats:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

/* ════════════════════════════════════════
   POST /api/npc-population/run-aging/:worldSlug
   Manual trigger: age all NPCs + attempt births
════════════════════════════════════════ */
router.post("/npc-population/run-aging/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    let aged = 0, promoted = 0;

    for (const npc of npcs) {
      const newTickCount = (npc.tickCount ?? 0) + 1;
      let newAge = npc.age;
      if (newTickCount % 5 === 0) {
        newAge = Math.min(npc.age + 1, 120);
        aged++;
      }
      const newStage = getLifeStage(newAge);
      const stageChanged = newStage !== npc.lifeStage;
      if (stageChanged) promoted++;

      await db.update(npcCores).set({
        age: newAge,
        lifeStage: newStage,
        tickCount: newTickCount,
      }).where(eq(npcCores.id, npc.id));

      if (stageChanged) {
        const stageLabel = getLifeStageName(newStage);
        await db.insert(npcCoreMemories).values({ npcCoreId: npc.id, event: `${npc.name} bước vào giai đoạn ${stageLabel} (tuổi ${newAge})`, importance: 4 });
      }
    }

    // Birth pass — find married couples
    const births: string[] = [];
    const allFamilies = await db.select().from(npcFamilies)
      .where(and(isNotNull(npcFamilies.spouseId)));

    const processed = new Set<string>();
    for (const family of allFamilies) {
      if (!family.spouseId) continue;
      const pairKey = [family.npcId, family.spouseId].sort().join("|");
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const [npcA] = await db.select().from(npcCores).where(eq(npcCores.id, family.npcId));
      const [npcB] = await db.select().from(npcCores).where(eq(npcCores.id, family.spouseId));
      if (!npcA || !npcB) continue;
      if (npcA.worldSlug !== worldSlug || npcB.worldSlug !== worldSlug) continue;
      if (npcA.lifeStage !== "adult" && npcA.lifeStage !== "elder") continue;
      if (npcB.lifeStage !== "adult" && npcB.lifeStage !== "elder") continue;
      if (npcA.happiness < 60 || npcB.happiness < 60) continue;

      const [rel] = await db.select().from(npcRelationships)
        .where(and(eq(npcRelationships.npcAId, npcA.id), eq(npcRelationships.npcBId, npcB.id)))
        .limit(1);
      const relScore = rel?.relationshipScore ?? 0;
      if (relScore < 75) continue;

      // 15% chance of birth per aging run
      if (Math.random() > 0.15) continue;

      // Create child NPC
      const [pA] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npcA.id));
      const [pB] = await db.select().from(npcPersonalities).where(eq(npcPersonalities.npcCoreId, npcB.id));
      const familyName = family.familyName ?? npcA.name.split(" ").pop() ?? "Vô Danh";
      const childGivenName = CHILD_NAMES[rand(0, CHILD_NAMES.length - 1)];
      const childName = `${childGivenName} ${familyName}`;

      function mutate(v: number) { return clamp(v + (Math.random() - 0.5) * 0.3, 0, 1); }
      const childKindness    = pA && pB ? mutate((pA.kindness + pB.kindness) / 2) : 0.5;
      const childGreed       = pA && pB ? mutate((pA.greed + pB.greed) / 2) : 0.5;
      const childBravery     = pA && pB ? mutate((pA.bravery + pB.bravery) / 2) : 0.5;
      const childIntelligence = pA && pB ? mutate((pA.intelligence + pB.intelligence) / 2) : 0.5;
      const childCuriosity   = pA && pB ? mutate((pA.curiosity + pB.curiosity) / 2) : 0.5;

      const [newNpc] = await db.insert(npcCores).values({
        worldSlug,
        name: childName,
        age: 0,
        lifeStage: "child",
        occupation: "Trẻ Em",
        money: 0,
        energy: 100,
        hunger: 20,
        happiness: 90,
        active: 1,
      }).returning();

      await db.insert(npcPersonalities).values({
        npcCoreId: newNpc.id,
        kindness: childKindness,
        greed: childGreed,
        bravery: childBravery,
        intelligence: childIntelligence,
        curiosity: childCuriosity,
      });

      await db.insert(npcFamilies).values({
        npcId: newNpc.id,
        fatherId: npcA.id,
        motherId: npcB.id,
        familyName,
      });

      await db.insert(npcBirths).values({
        worldSlug,
        childId: newNpc.id,
        fatherId: npcA.id,
        motherId: npcB.id,
        childName,
      });

      const memA = `${npcA.name} có con mới: ${childName} ra đời!`;
      const memB = `${npcB.name} có con mới: ${childName} ra đời!`;
      await db.insert(npcFamilyMemories).values({ npcId: npcA.id, content: memA });
      await db.insert(npcFamilyMemories).values({ npcId: npcB.id, content: memB });
      await db.insert(npcCoreMemories).values({ npcCoreId: npcA.id, event: memA, importance: 5 });
      await db.insert(npcCoreMemories).values({ npcCoreId: npcB.id, event: memB, importance: 5 });

      births.push(childName);

      /* Unity realtime broadcast */
      broadcastUnity({
        type: "birth",
        worldSlug,
        npcId: newNpc.id,
        name: childName,
        parentName: npcA.name,
        pos: null,
      });
    }

    return res.json({ aged, promoted, births, message: `Già hoá ${aged} NPC, ${births.length} trẻ sơ sinh mới` });
  } catch (err) { console.error("[npcPop] aging:", err); return res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
