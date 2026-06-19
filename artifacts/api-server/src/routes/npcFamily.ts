import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { npcCores, npcPersonalities, npcRelationships, npcFamilies, npcFamilyMemories, npcCoreMemories } from "@workspace/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

const router = Router();

/* ── helpers ── */
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ════════════════════════════════════════
   GET family record for an NPC
   Returns: family + spouse/father/mother/children info
════════════════════════════════════════ */
router.get("/npc-family/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;

    const [family] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcId));

    const memories = await db.select()
      .from(npcFamilyMemories)
      .where(eq(npcFamilyMemories.npcId, npcId))
      .orderBy(desc(npcFamilyMemories.createdAt))
      .limit(20);

    if (!family) return res.json({ family: null, spouse: null, father: null, mother: null, children: [], memories });

    // Resolve member details
    async function getNpc(id: string | null | undefined) {
      if (!id) return null;
      const [npc] = await db.select({ id: npcCores.id, name: npcCores.name, occupation: npcCores.occupation, age: npcCores.age, happiness: npcCores.happiness })
        .from(npcCores).where(eq(npcCores.id, id));
      return npc ?? null;
    }

    const [spouse, father, mother] = await Promise.all([
      getNpc(family.spouseId),
      getNpc(family.fatherId),
      getNpc(family.motherId),
    ]);

    // Children: any NPC whose fatherId or motherId = this npcId
    const childRecords = await db.select()
      .from(npcFamilies)
      .where(or(eq(npcFamilies.fatherId, npcId), eq(npcFamilies.motherId, npcId)));

    const children = await Promise.all(
      childRecords.map((c) => getNpc(c.npcId))
    );

    return res.json({
      family,
      spouse,
      father,
      mother,
      children: children.filter(Boolean),
      memories,
    });
  } catch (err) {
    console.error("[npcFamily] GET:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST form a partnership (marriage)
   Requires: friendship > 70, happiness > 50
════════════════════════════════════════ */
router.post("/npc-family/form-partner", isAuthenticated, async (req, res) => {
  try {
    const { npcAId, npcBId } = req.body as { npcAId: string; npcBId: string };
    if (!npcAId || !npcBId || npcAId === npcBId)
      return res.status(400).json({ message: "Cần 2 NPC khác nhau" });

    const [npcA] = await db.select().from(npcCores).where(eq(npcCores.id, npcAId));
    const [npcB] = await db.select().from(npcCores).where(eq(npcCores.id, npcBId));
    if (!npcA || !npcB) return res.status(404).json({ message: "Không tìm thấy NPC" });

    // Check happiness threshold
    if (npcA.happiness < 50) return res.status(400).json({ message: `${npcA.name} chưa đủ hạnh phúc (cần > 50)` });
    if (npcB.happiness < 50) return res.status(400).json({ message: `${npcB.name} chưa đủ hạnh phúc (cần > 50)` });

    // Check friendship score > 70
    const [idA, idB] = npcAId < npcBId ? [npcAId, npcBId] : [npcBId, npcAId];
    const [rel] = await db.select().from(npcRelationships)
      .where(and(eq(npcRelationships.npcAId, idA), eq(npcRelationships.npcBId, idB)));

    if (!rel || rel.relationshipScore <= 70)
      return res.status(400).json({ message: `Tình bạn chưa đủ sâu (cần điểm quan hệ > 70, hiện tại: ${rel?.relationshipScore ?? 0})` });

    // Check not already partnered
    const [existingA] = await db.select().from(npcFamilies)
      .where(and(eq(npcFamilies.npcId, npcAId)));
    const [existingB] = await db.select().from(npcFamilies)
      .where(and(eq(npcFamilies.npcId, npcBId)));

    if (existingA?.spouseId) return res.status(400).json({ message: `${npcA.name} đã có đôi rồi` });
    if (existingB?.spouseId) return res.status(400).json({ message: `${npcB.name} đã có đôi rồi` });

    // Generate family name
    const familyName = `Gia Tộc ${npcA.name.split(" ").pop()}-${npcB.name.split(" ").pop()}`;

    // Upsert family records for both NPCs
    async function upsertFamily(npcId: string, spouseId: string) {
      const [existing] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcId));
      if (existing) {
        await db.update(npcFamilies).set({ spouseId, familyName, updatedAt: new Date() }).where(eq(npcFamilies.id, existing.id));
      } else {
        await db.insert(npcFamilies).values({ npcId, spouseId, familyName });
      }
    }

    await upsertFamily(npcAId, npcBId);
    await upsertFamily(npcBId, npcAId);

    // Store family memories for both
    const memA = `Kết đôi với ${npcB.name}. Một khởi đầu mới đầy hy vọng.`;
    const memB = `Kết đôi với ${npcA.name}. Trái tim rộn ràng hạnh phúc.`;
    await db.insert(npcFamilyMemories).values([
      { npcId: npcAId, content: memA },
      { npcId: npcBId, content: memB },
    ]);

    // Also store in core memories
    await db.insert(npcCoreMemories).values([
      { npcCoreId: npcAId, event: memA, importance: 5 },
      { npcCoreId: npcBId, event: memB, importance: 5 },
    ]);

    return res.json({ message: `${npcA.name} và ${npcB.name} đã kết thành đôi! ${familyName} ra đời.`, familyName });
  } catch (err) {
    console.error("[npcFamily] form-partner:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST set parent-child link
   Body: { childId, fatherId?, motherId? }
════════════════════════════════════════ */
router.post("/npc-family/set-parent", isAuthenticated, async (req, res) => {
  try {
    const { childId, fatherId, motherId } = req.body as { childId: string; fatherId?: string; motherId?: string };
    if (!childId) return res.status(400).json({ message: "Thiếu childId" });

    const [existing] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, childId));
    const updates: Partial<typeof npcFamilies.$inferInsert> = { updatedAt: new Date() };
    if (fatherId !== undefined) updates.fatherId = fatherId || null;
    if (motherId !== undefined) updates.motherId = motherId || null;

    if (existing) {
      await db.update(npcFamilies).set(updates).where(eq(npcFamilies.id, existing.id));
    } else {
      await db.insert(npcFamilies).values({ npcId: childId, fatherId: fatherId ?? null, motherId: motherId ?? null });
    }

    // Store memory
    if (fatherId) {
      const [father] = await db.select().from(npcCores).where(eq(npcCores.id, fatherId));
      const [child] = await db.select().from(npcCores).where(eq(npcCores.id, childId));
      if (father && child) {
        const mem = `Nhận ra ${child.name} là con ruột của mình.`;
        await db.insert(npcFamilyMemories).values({ npcId: fatherId, content: mem });
        await db.insert(npcCoreMemories).values({ npcCoreId: fatherId, event: mem, importance: 5 });
      }
    }

    return res.json({ message: "Đã cập nhật liên kết cha mẹ - con cái" });
  } catch (err) {
    console.error("[npcFamily] set-parent:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST auto-check + form partnerships
   Scans world for NPC pairs with friendship>70 + happiness>50
════════════════════════════════════════ */
router.post("/npc-family/auto-match/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
    if (npcs.length < 2) return res.json({ formed: 0, message: "Không đủ NPC" });

    const rels = await db.select().from(npcRelationships);
    let formed = 0;
    const formed_pairs: string[] = [];

    for (const rel of rels) {
      if (rel.relationshipScore <= 70) continue;

      const npcA = npcs.find((n) => n.id === rel.npcAId);
      const npcB = npcs.find((n) => n.id === rel.npcBId);
      if (!npcA || !npcB) continue;
      if (npcA.happiness < 50 || npcB.happiness < 50) continue;

      // Check not already partnered
      const [famA] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcA.id));
      const [famB] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcB.id));
      if (famA?.spouseId || famB?.spouseId) continue;

      const familyName = `Gia Tộc ${npcA.name.split(" ").pop()}-${npcB.name.split(" ").pop()}`;

      async function upsertFam(npcId: string, spouseId: string) {
        const [ex] = await db.select().from(npcFamilies).where(eq(npcFamilies.npcId, npcId));
        if (ex) {
          await db.update(npcFamilies).set({ spouseId, familyName, updatedAt: new Date() }).where(eq(npcFamilies.id, ex.id));
        } else {
          await db.insert(npcFamilies).values({ npcId, spouseId, familyName });
        }
      }

      await upsertFam(npcA.id, npcB.id);
      await upsertFam(npcB.id, npcA.id);

      const memA = `Kết đôi với ${npcB.name}. ${familyName} ra đời.`;
      const memB = `Kết đôi với ${npcA.name}. ${familyName} ra đời.`;
      await db.insert(npcFamilyMemories).values([
        { npcId: npcA.id, content: memA },
        { npcId: npcB.id, content: memB },
      ]);
      await db.insert(npcCoreMemories).values([
        { npcCoreId: npcA.id, event: memA, importance: 5 },
        { npcCoreId: npcB.id, event: memB, importance: 5 },
      ]);

      formed++;
      formed_pairs.push(`${npcA.name} + ${npcB.name}`);
      if (formed >= 3) break;
    }

    return res.json({ formed, pairs: formed_pairs, message: formed > 0 ? `Đã ghép đôi ${formed} cặp` : "Không có cặp nào đủ điều kiện" });
  } catch (err) {
    console.error("[npcFamily] auto-match:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
