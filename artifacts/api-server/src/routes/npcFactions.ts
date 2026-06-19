import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcRelationships, npcCoreMemories,
  npcFactions, npcFactionMembers, npcFactionMemories,
} from "@workspace/db/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const FACTION_TYPE_LABELS: Record<string, string> = {
  merchant_guild:  "Hội Thương Nhân",
  farming_clan:    "Tộc Nông Dân",
  military_order:  "Đoàn Quân Sự",
  criminal_group:  "Băng Nhóm Tội Phạm",
  noble_house:     "Nhà Quý Tộc",
};

const FACTION_TYPE_ICONS: Record<string, string> = {
  merchant_guild:  "💰",
  farming_clan:    "🌾",
  military_order:  "⚔️",
  criminal_group:  "🗡️",
  noble_house:     "👑",
};

/* occupation → eligible faction types */
function occupationToFactionTypes(occupation: string): string[] {
  const o = occupation.toLowerCase();
  if (o.includes("thương") || o.includes("buôn") || o.includes("chủ")) return ["merchant_guild"];
  if (o.includes("nông") || o.includes("dân") || o.includes("thợ")) return ["farming_clan", "merchant_guild"];
  if (o.includes("kiếm") || o.includes("vệ") || o.includes("sát") || o.includes("quân")) return ["military_order"];
  if (o.includes("hacker") || o.includes("tình báo") || o.includes("trộm")) return ["criminal_group"];
  if (o.includes("hoàng") || o.includes("vương") || o.includes("quý")) return ["noble_house"];
  return ["merchant_guild", "farming_clan"];
}

/* generate faction name based on type */
function generateFactionName(type: string, worldSlug: string): string {
  const names: Record<string, string[]> = {
    merchant_guild:  ["Hội Thương Mại Vàng", "Liên Minh Buôn Bán", "Hiệp Hội Thương Nhân", "Bang Đổi Chác"],
    farming_clan:    ["Tộc Đất Cằn", "Gia Tộc Thảo Nguyên", "Clan Lúa Vàng", "Tộc Mùa Gặt"],
    military_order:  ["Đoàn Kiếm Sĩ Bóng Đêm", "Binh Đoàn Sắt", "Hội Chiến Binh", "Đoàn Hộ Vệ"],
    criminal_group:  ["Băng Bóng Tối", "Hội Dao Ngầm", "Tổ Chức Bóng Ma", "Băng Hắc Ám"],
    noble_house:     ["Nhà Cao Quý Phương Bắc", "Gia Tộc Hoàng Kim", "Dòng Dõi Cổ Đại", "Nhà Vương Tộc"],
  };
  const pool = names[type] ?? names["merchant_guild"];
  return pool[rand(0, pool.length - 1)];
}

/* ════════════════════════════════════════
   GET /api/npc-factions/:worldSlug
   All factions with members + leader info
════════════════════════════════════════ */
router.get("/npc-factions/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const factions = await db.select().from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug)).orderBy(desc(npcFactions.treasury));

    const result = await Promise.all(factions.map(async (f) => {
      const members = await db
        .select({ id: npcFactionMembers.id, npcId: npcFactionMembers.npcId, role: npcFactionMembers.role, name: npcCores.name, occupation: npcCores.occupation, money: npcCores.money, happiness: npcCores.happiness })
        .from(npcFactionMembers)
        .innerJoin(npcCores, eq(npcFactionMembers.npcId, npcCores.id))
        .where(eq(npcFactionMembers.factionId, f.id));

      let leader = null;
      if (f.leaderNpcId) {
        const [l] = await db.select({ id: npcCores.id, name: npcCores.name, occupation: npcCores.occupation, money: npcCores.money }).from(npcCores).where(eq(npcCores.id, f.leaderNpcId));
        leader = l ?? null;
      }

      const memories = await db.select().from(npcFactionMemories).where(eq(npcFactionMemories.factionId, f.id)).orderBy(desc(npcFactionMemories.createdAt)).limit(10);

      return { ...f, members, leader, memories, typeLabel: FACTION_TYPE_LABELS[f.type] ?? f.type, typeIcon: FACTION_TYPE_ICONS[f.type] ?? "🏛️" };
    }));

    return res.json({ factions: result });
  } catch (err) {
    console.error("[npc-factions] GET error:", err);
    return res.status(500).json({ error: "Lỗi tải hội nhóm" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-factions/auto-form/:worldSlug
   Auto-form factions from NPC relationships:
   - 3+ NPCs with relationship > 70
   - same profession OR same family
════════════════════════════════════════ */
router.post("/npc-factions/auto-form/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    /* Load all active adult NPCs in this world */
    const npcs = await db.select().from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    if (npcs.length < 3) {
      return res.json({ formed: 0, message: "Chưa đủ NPC để thành lập hội nhóm (cần ít nhất 3)" });
    }

    /* Load all strong relationships (score > 70) for this world */
    const allNpcIds = npcs.map(n => n.id);
    const strongRels = await db.select()
      .from(npcRelationships)
      .where(
        and(
          sql`${npcRelationships.relationshipScore} > 70`,
          or(
            inArray(npcRelationships.npcAId, allNpcIds),
            inArray(npcRelationships.npcBId, allNpcIds)
          )
        )
      );

    /* Group NPCs by shared profession (simplified) */
    function jobGroup(occupation: string): string {
      const o = occupation.toLowerCase();
      if (o.includes("thương") || o.includes("buôn")) return "merchant";
      if (o.includes("nông") || o.includes("ngư") || o.includes("dân")) return "farmer";
      if (o.includes("kiếm") || o.includes("vệ") || o.includes("sát") || o.includes("quân")) return "warrior";
      if (o.includes("hacker") || o.includes("tình báo")) return "rogue";
      if (o.includes("thợ") || o.includes("dược")) return "artisan";
      return "misc";
    }

    /* Build adjacency: npcId → set of strongly-related npcIds in same job */
    const adjMap = new Map<string, Set<string>>();
    for (const npc of npcs) { adjMap.set(npc.id, new Set()); }

    for (const rel of strongRels) {
      const npcA = npcs.find(n => n.id === rel.npcAId);
      const npcB = npcs.find(n => n.id === rel.npcBId);
      if (!npcA || !npcB) continue;
      if (jobGroup(npcA.occupation) === jobGroup(npcB.occupation)) {
        adjMap.get(npcA.id)?.add(npcB.id);
        adjMap.get(npcB.id)?.add(npcA.id);
      }
    }

    /* Find connected components of size ≥ 3 */
    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const npc of npcs) {
      if (visited.has(npc.id)) continue;
      const queue = [npc.id];
      const cluster: string[] = [];
      while (queue.length) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        cluster.push(cur);
        adjMap.get(cur)?.forEach(nb => { if (!visited.has(nb)) queue.push(nb); });
      }
      if (cluster.length >= 3) clusters.push(cluster);
    }

    if (clusters.length === 0) {
      return res.json({ formed: 0, message: "Chưa có nhóm NPC đủ điều kiện (cần 3+ NPC quan hệ > 70 cùng nghề)" });
    }

    /* Check existing members to avoid double-joining */
    const existingMemberRows = allNpcIds.length
      ? await db.select({ npcId: npcFactionMembers.npcId }).from(npcFactionMembers).where(inArray(npcFactionMembers.npcId, allNpcIds))
      : [];
    const existingMemberIds = new Set(existingMemberRows.map(r => r.npcId));

    let formed = 0;

    for (const cluster of clusters) {
      /* Skip if all members already in a faction */
      const newMembers = cluster.filter(id => !existingMemberIds.has(id));
      if (newMembers.length < 3) continue;

      const leaderNpcs = newMembers.map(id => npcs.find(n => n.id === id)!).filter(Boolean);

      /* Determine faction type from majority job */
      const jobCounts: Record<string, number> = {};
      for (const n of leaderNpcs) {
        const jg = jobGroup(n.occupation);
        jobCounts[jg] = (jobCounts[jg] ?? 0) + 1;
      }
      const majorityJob = Object.entries(jobCounts).sort((a, b) => b[1] - a[1])[0][0];
      const jobToType: Record<string, string> = {
        merchant: "merchant_guild", farmer: "farming_clan", warrior: "military_order",
        rogue: "criminal_group", artisan: "farming_clan", misc: "merchant_guild",
      };
      const factionType = jobToType[majorityJob] ?? "merchant_guild";

      /* Elect leader: highest money + most connections */
      const scored = leaderNpcs.map(n => ({
        id: n.id,
        score: n.money + (adjMap.get(n.id)?.size ?? 0) * 10,
      }));
      scored.sort((a, b) => b.score - a.score);
      const leaderId = scored[0].id;

      const factionName = generateFactionName(factionType, worldSlug);

      /* Create faction */
      const [newFaction] = await db.insert(npcFactions).values({
        worldSlug,
        name: factionName,
        type: factionType,
        leaderNpcId: leaderId,
        treasury: 0,
        reputation: 50,
      }).returning();

      /* Add members */
      for (const memberId of newMembers) {
        await db.insert(npcFactionMembers).values({
          factionId: newFaction.id,
          npcId: memberId,
          role: memberId === leaderId ? "leader" : "member",
        });
        existingMemberIds.add(memberId);

        /* Write NPC memory */
        const npc = npcs.find(n => n.id === memberId)!;
        const memContent = memberId === leaderId
          ? `Được bầu làm thủ lĩnh của ${factionName} (${FACTION_TYPE_LABELS[factionType]}).`
          : `Gia nhập ${factionName} (${FACTION_TYPE_LABELS[factionType]}).`;

        await db.insert(npcCoreMemories).values({ npcCoreId: memberId, event: memContent, importance: 3 });
        await db.insert(npcFactionMemories).values({ npcId: memberId, factionId: newFaction.id, content: memContent });
      }

      /* Faction memory */
      const leaderNpc = npcs.find(n => n.id === leaderId);
      await db.insert(npcFactionMemories).values({
        npcId: leaderId,
        factionId: newFaction.id,
        content: `${factionName} được thành lập với ${newMembers.length} thành viên. Thủ lĩnh: ${leaderNpc?.name ?? "Không rõ"}.`,
      });

      formed++;
    }

    return res.json({ formed, message: `Đã thành lập ${formed} hội nhóm mới từ ${clusters.length} cụm NPC đủ điều kiện.` });
  } catch (err) {
    console.error("[npc-factions] auto-form error:", err);
    return res.status(500).json({ error: "Lỗi tự động thành lập hội nhóm" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-factions/collect-tribute/:worldSlug
   Members contribute income → treasury grows
════════════════════════════════════════ */
router.post("/npc-factions/collect-tribute/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const factions = await db.select().from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug));
    if (factions.length === 0) return res.json({ collected: 0, message: "Chưa có hội nhóm nào" });

    let totalCollected = 0;
    const results: { name: string; contribution: number }[] = [];

    for (const faction of factions) {
      const members = await db
        .select({ npcId: npcFactionMembers.npcId, money: npcCores.money })
        .from(npcFactionMembers)
        .innerJoin(npcCores, eq(npcFactionMembers.npcId, npcCores.id))
        .where(eq(npcFactionMembers.factionId, faction.id));

      let contribution = 0;
      for (const member of members) {
        const tithe = Math.floor(member.money * 0.05); /* 5% of wealth */
        if (tithe > 0) {
          contribution += tithe;
          await db.update(npcCores).set({ money: member.money - tithe }).where(eq(npcCores.id, member.npcId));
        }
      }

      if (contribution > 0) {
        await db.update(npcFactions)
          .set({ treasury: faction.treasury + contribution, updatedAt: new Date() })
          .where(eq(npcFactions.id, faction.id));

        await db.insert(npcFactionMemories).values({
          npcId: faction.leaderNpcId!,
          factionId: faction.id,
          content: `Quỹ hội nhóm ${faction.name} nhận được ${contribution} vàng đóng góp từ thành viên.`,
        });

        totalCollected += contribution;
        results.push({ name: faction.name, contribution });
      }
    }

    return res.json({ collected: totalCollected, factions: results, message: `Thu ${totalCollected} vàng từ ${results.length} hội nhóm.` });
  } catch (err) {
    console.error("[npc-factions] collect-tribute error:", err);
    return res.status(500).json({ error: "Lỗi thu phí hội nhóm" });
  }
});

export default router;
