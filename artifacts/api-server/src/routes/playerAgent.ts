import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  playerAgents, playerRelationships, playerFamily,
  playerFactionMemberships, playerBusinesses,
  playerElectionCandidacies, playerWarParticipations,
  playerTradeHistory, playerActivityLog,
  characters, users,
  npcCores, npcPersonalities, npcRelationships,
  npcFactions, npcFactionMembers,
  worldWars, warContributions,
  elections, electionCandidates,
  marketPrices, inventory, items,
  bankAccounts, bankTransfers,
  factions, characterFaction,
  worldSimState,
} from "@workspace/db/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

/* ─── helpers ─── */
function scoreToRelationType(score: number): string {
  if (score >= 80)  return "thân thiết";
  if (score >= 40)  return "bạn bè";
  if (score >= 10)  return "quen biết";
  if (score >= -10) return "người lạ";
  if (score >= -40) return "lạnh nhạt";
  if (score >= -70) return "thù địch";
  return "kẻ thù";
}

function repToTitle(rep: number): string {
  if (rep >= 10000) return "Huyền Thoại";
  if (rep >= 5000)  return "Anh Hùng";
  if (rep >= 2000)  return "Hiệp Sĩ";
  if (rep >= 1000)  return "Thủ Lĩnh";
  if (rep >= 500)   return "Chiến Binh";
  if (rep >= 200)   return "Phiêu Khách";
  if (rep >= 50)    return "Lữ Hành";
  return "Lữ Khách";
}

async function logActivity(
  characterId: string,
  actionType: string,
  summary: string,
  impact: Record<string, any> = {}
) {
  await db.insert(playerActivityLog).values({ characterId, actionType, summary, impact });
}

async function getOrInitAgent(characterId: string, userId: string) {
  let [agent] = await db.select().from(playerAgents)
    .where(eq(playerAgents.characterId, characterId));
  if (!agent) {
    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char) return null;
    const initGold = (char.stats as any)?.gold ?? 500;
    const worldSlug = (char.stats as any)?.world_slug ?? "unknown";
    [agent] = await db.insert(playerAgents).values({
      characterId, userId,
      worldSlug,
      gold: initGold,
      totalAssets: initGold,
    }).returning();
  }
  return agent;
}

/* ══════════════════════════════════════════════════════
   GET /api/player-agent/:characterId
   Hồ sơ đầy đủ người chơi
══════════════════════════════════════════════════════ */
router.get("/player-agent/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ error: "Character không tồn tại" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Không thể khởi tạo agent" });

    const [relationships, familyRows, factionMems, businesses,
           elections_, warParts, tradeLog, activityLog] = await Promise.all([
      db.select().from(playerRelationships).where(eq(playerRelationships.characterId, characterId))
        .orderBy(desc(playerRelationships.score)).limit(30),
      db.select().from(playerFamily).where(eq(playerFamily.characterId, characterId)),
      db.select().from(playerFactionMemberships).where(eq(playerFactionMemberships.characterId, characterId)),
      db.select().from(playerBusinesses).where(eq(playerBusinesses.characterId, characterId))
        .orderBy(desc(playerBusinesses.createdAt)),
      db.select().from(playerElectionCandidacies).where(eq(playerElectionCandidacies.characterId, characterId))
        .orderBy(desc(playerElectionCandidacies.registeredAt)).limit(10),
      db.select().from(playerWarParticipations).where(eq(playerWarParticipations.characterId, characterId))
        .orderBy(desc(playerWarParticipations.joinedAt)).limit(10),
      db.select().from(playerTradeHistory).where(eq(playerTradeHistory.characterId, characterId))
        .orderBy(desc(playerTradeHistory.tradedAt)).limit(20),
      db.select().from(playerActivityLog).where(eq(playerActivityLog.characterId, characterId))
        .orderBy(desc(playerActivityLog.createdAt)).limit(20),
    ]);

    // Bank account
    const [bank] = await db.select().from(bankAccounts).where(eq(bankAccounts.characterId, characterId));

    // Passive income from businesses
    const passiveIncome = businesses
      .filter(b => b.status === "open")
      .reduce((sum, b) => sum + b.incomePerTick, 0);

    // Wars won/lost
    const totalKills = warParts.reduce((s, w) => s + w.kills, 0);
    const totalDeaths = warParts.reduce((s, w) => s + w.deaths, 0);

    res.json({
      character: char,
      agent,
      bank: bank ?? null,
      passiveIncome,
      relationships,
      family: familyRows,
      factions: factionMems,
      businesses,
      elections: elections_,
      wars: { participations: warParts, totalKills, totalDeaths },
      recentTrades: tradeLog,
      activityLog,
      summary: {
        totalAssets:     agent.totalAssets,
        gold:            agent.gold,
        bankBalance:     bank?.balance ?? 0,
        reputation:      agent.reputation,
        reputationTitle: repToTitle(agent.reputation),
        businessCount:   businesses.filter(b => b.status === "open").length,
        factionCount:    factionMems.length,
        alliesCount:     relationships.filter(r => r.score >= 40).length,
        enemiesCount:    relationships.filter(r => r.score < -40).length,
        warCount:        warParts.length,
        electionCount:   elections_.length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/init
   Khởi tạo Player Agent từ character có sẵn
══════════════════════════════════════════════════════ */
router.post("/player-agent/init", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.body as { characterId: string };
    const userId = req.userId;
    if (!characterId) return res.status(400).json({ error: "characterId là bắt buộc" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ error: "Character không tồn tại hoặc không thuộc về bạn" });

    const agent = await getOrInitAgent(characterId, userId);
    await logActivity(characterId, "init", `Khởi tạo Player Agent cho ${char.name}`);

    res.json({ ok: true, agent });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/talk/:npcId
   Nói chuyện với NPC — ghi nhớ quan hệ tự động
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/talk/:npcId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId, npcId } = req.params;
    const { message } = req.body as { message: string };
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [npc] = await db.select().from(npcCores).where(eq(npcCores.id, npcId));
    if (!npc) return res.status(404).json({ error: "NPC không tồn tại" });

    // Lấy / tạo quan hệ
    let [rel] = await db.select().from(playerRelationships)
      .where(and(eq(playerRelationships.characterId, characterId), eq(playerRelationships.targetId, npcId)));

    const relDelta = Math.floor(Math.random() * 5) - 1; // -1 đến +3 mỗi lần nói chuyện
    if (rel) {
      const newScore = Math.max(-100, Math.min(100, rel.score + relDelta));
      [rel] = await db.update(playerRelationships)
        .set({ score: newScore, relationType: scoreToRelationType(newScore), lastInteractAt: new Date() })
        .where(eq(playerRelationships.id, rel.id))
        .returning();
    } else {
      [rel] = await db.insert(playerRelationships).values({
        characterId, targetType: "npc", targetId: npcId,
        targetName: npc.name, score: relDelta,
        relationType: scoreToRelationType(relDelta),
      }).returning();
    }

    // Cập nhật npc_relationships (hệ thống hiện tại)
    const [existingNpcRel] = await db.select().from(npcRelationships)
      .where(or(
        and(eq(npcRelationships.npcAId, npcId), eq(npcRelationships.npcBId, characterId as any)),
        and(eq(npcRelationships.npcAId, characterId as any), eq(npcRelationships.npcBId, npcId)),
      )).limit(1);

    if (!existingNpcRel) {
      try {
        await db.execute(sql`
          INSERT INTO npc_relationships (id, npc_a_id, npc_b_id, relationship_score, relationship_type)
          VALUES (gen_random_uuid(), ${npcId}, ${characterId}, ${relDelta}, ${scoreToRelationType(relDelta)})
          ON CONFLICT DO NOTHING
        `);
      } catch {}
    }

    await logActivity(characterId, "talk", `Nói chuyện với NPC ${npc.name}`, {
      npcId, npcName: npc.name, relDelta, newScore: rel.score,
    });

    res.json({
      ok: true,
      npc: { id: npc.id, name: npc.name, occupation: npc.occupation },
      relationship: rel,
      hint: `Hãy sử dụng /api/npc-dialogue/:npcId/chat để trò chuyện AI với playerId=${characterId}`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/trade
   Giao dịch với thị trường hoặc NPC
══════════════════════════════════════════════════════ */
const tradeSchema = z.object({
  tradeType:    z.enum(["buy", "sell"]),
  itemName:     z.string().min(1),
  quantity:     z.number().int().min(1),
  unitPrice:    z.number().int().min(1),
  counterparty: z.string().optional(),
  counterType:  z.enum(["market", "npc", "player"]).optional(),
});

router.post("/player-agent/:characterId/trade", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;
    const parsed = tradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { tradeType, itemName, quantity, unitPrice, counterparty, counterType } = parsed.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Agent không tồn tại" });

    const totalPrice = quantity * unitPrice;

    if (tradeType === "buy") {
      if (agent.gold < totalPrice)
        return res.status(400).json({ error: `Không đủ tiền. Cần ${totalPrice} gold, có ${agent.gold}` });
      await db.update(playerAgents)
        .set({ gold: agent.gold - totalPrice, totalAssets: agent.totalAssets + Math.floor(totalPrice * 0.8), updatedAt: new Date() })
        .where(eq(playerAgents.characterId, characterId));
    } else {
      await db.update(playerAgents)
        .set({ gold: agent.gold + totalPrice, totalAssets: Math.max(0, agent.totalAssets - Math.floor(totalPrice * 0.8)), updatedAt: new Date() })
        .where(eq(playerAgents.characterId, characterId));
    }

    // Cập nhật gold trong characters.stats
    const statsGold = ((char.stats as any)?.gold ?? 500);
    const newStatsGold = tradeType === "buy" ? statsGold - totalPrice : statsGold + totalPrice;
    await db.update(characters)
      .set({ stats: { ...(char.stats as any), gold: Math.max(0, newStatsGold) } })
      .where(eq(characters.id, characterId));

    const [trade] = await db.insert(playerTradeHistory).values({
      characterId, worldSlug: agent.worldSlug, tradeType,
      itemName, quantity, unitPrice, totalPrice,
      counterparty: counterparty ?? "Chợ", counterType: counterType ?? "market",
    }).returning();

    // Nếu giao dịch với NPC thì cải thiện quan hệ
    if (counterType === "npc" && counterparty) {
      const [rel] = await db.select().from(playerRelationships)
        .where(and(eq(playerRelationships.characterId, characterId), eq(playerRelationships.targetId, counterparty)));
      if (rel) {
        const newScore = Math.min(100, rel.score + 3);
        await db.update(playerRelationships)
          .set({ score: newScore, relationType: scoreToRelationType(newScore), lastInteractAt: new Date() })
          .where(eq(playerRelationships.id, rel.id));
      }
    }

    await logActivity(characterId, "trade",
      `${tradeType === "buy" ? "Mua" : "Bán"} ${quantity}x ${itemName} với giá ${totalPrice} gold`,
      { tradeType, itemName, quantity, totalPrice },
    );

    res.json({ ok: true, trade, newGold: tradeType === "buy" ? agent.gold - totalPrice : agent.gold + totalPrice });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/run-for-election
   Tranh cử vào chính quyền NPC
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/run-for-election", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const { electionId, platform, worldSlug } = req.body as {
      electionId: string; platform: string; worldSlug: string;
    };
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Agent không tồn tại" });

    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    if (!election) return res.status(404).json({ error: "Bầu cử không tồn tại" });
    if (election.status !== "open") return res.status(400).json({ error: "Bầu cử đã kết thúc" });

    // Kiểm tra đã đăng ký chưa
    const [existing] = await db.select().from(playerElectionCandidacies)
      .where(and(eq(playerElectionCandidacies.characterId, characterId), eq(playerElectionCandidacies.electionId, electionId)));
    if (existing) return res.status(400).json({ error: "Đã đăng ký tranh cử rồi" });

    // Campaign score dựa trên reputation và level
    const campaignScore = Math.max(10, Math.min(100,
      Math.floor(agent.reputation / 20) + (char.level ?? 1) * 5 + Math.floor(Math.random() * 20)
    ));

    const [candidacy] = await db.insert(playerElectionCandidacies).values({
      characterId, electionId, worldSlug: worldSlug ?? agent.worldSlug,
      electionType: election.electionType, platform: platform ?? "",
      campaignScore, status: "running",
    }).returning();

    // Cập nhật reputation
    await db.update(playerAgents)
      .set({ reputation: agent.reputation + 25, reputationTitle: repToTitle(agent.reputation + 25), updatedAt: new Date() })
      .where(eq(playerAgents.characterId, characterId));

    await logActivity(characterId, "election", `Đăng ký tranh cử: ${election.electionType}`, {
      electionId, campaignScore,
    });

    res.json({ ok: true, candidacy, campaignScore });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/join-war/:warId
   Tham gia chiến tranh
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/join-war/:warId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId, warId } = req.params;
    const { side = "attacker" } = req.body as { side?: "attacker" | "defender" };
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [war] = await db.select().from(worldWars).where(eq(worldWars.id, warId));
    if (!war) return res.status(404).json({ error: "Chiến tranh không tồn tại" });
    if (war.status !== "active") return res.status(400).json({ error: "Chiến tranh đã kết thúc" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Agent không tồn tại" });

    // Kiểm tra đã tham gia chưa
    const [existing] = await db.select().from(playerWarParticipations)
      .where(and(eq(playerWarParticipations.characterId, characterId), eq(playerWarParticipations.warId, warId)));
    if (existing) return res.status(400).json({ error: "Đã tham gia chiến tranh này rồi" });

    // Simulate combat result
    const level = char.level ?? 1;
    const kills    = Math.floor(Math.random() * level * 3) + 1;
    const deaths   = Math.floor(Math.random() * 2);
    const contrib  = kills * 10 + (deaths === 0 ? 20 : 0);
    const goldEarned = kills * 15 + Math.floor(Math.random() * 50);
    const repEarned  = kills * 5 + contrib;

    const [participation] = await db.insert(playerWarParticipations).values({
      characterId, warId, worldSlug: agent.worldSlug, side,
      kills, deaths, contribution: contrib, goldEarned, repEarned, status: "active",
    }).returning();

    // Cập nhật war_contributions (hệ thống hiện tại)
    await db.insert(warContributions).values({
      warId, characterId, characterName: char.name,
      worldSlug: agent.worldSlug, pvpKills: kills, pvpDeaths: deaths, contribution: contrib,
    });

    // Cập nhật gold + reputation
    const newGold = agent.gold + goldEarned;
    const newRep  = agent.reputation + repEarned;
    await db.update(playerAgents)
      .set({ gold: newGold, reputation: newRep, reputationTitle: repToTitle(newRep),
             totalAssets: agent.totalAssets + goldEarned, updatedAt: new Date() })
      .where(eq(playerAgents.characterId, characterId));

    await db.update(characters)
      .set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) + goldEarned } })
      .where(eq(characters.id, characterId));

    await logActivity(characterId, "war",
      `Tham chiến: ${war.attackerWorldName} vs ${war.defenderWorldName} — Tiêu diệt ${kills}, Thu được ${goldEarned} gold`,
      { warId, kills, deaths, goldEarned, repEarned },
    );

    res.json({ ok: true, participation, result: { kills, deaths, goldEarned, repEarned, contrib } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/found-business
   Thành lập doanh nghiệp
══════════════════════════════════════════════════════ */
const businessSchema = z.object({
  name:    z.string().min(2).max(128),
  type:    z.enum(["shop", "farm", "workshop", "inn", "guild", "bank", "trade_post", "mine"]),
  capital: z.number().int().min(100),
});

const BUSINESS_INCOME: Record<string, number> = {
  shop: 20, farm: 15, workshop: 25, inn: 30, guild: 40, bank: 50, trade_post: 35, mine: 22,
};

router.post("/player-agent/:characterId/found-business", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { name, type, capital } = parsed.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Agent không tồn tại" });

    if (agent.gold < capital) return res.status(400).json({ error: `Không đủ vốn. Cần ${capital} gold, có ${agent.gold}` });

    const baseIncome = BUSINESS_INCOME[type] ?? 20;
    const incomePerTick = Math.floor(baseIncome * (1 + capital / 1000));
    const employees    = Math.floor(capital / 200);

    const [business] = await db.insert(playerBusinesses).values({
      characterId, worldSlug: agent.worldSlug, name, type,
      capitalInvested: capital, incomePerTick, employees,
    }).returning();

    const newGold   = agent.gold - capital;
    const newAssets = agent.totalAssets + Math.floor(capital * 0.9);
    await db.update(playerAgents)
      .set({ gold: newGold, totalAssets: newAssets,
             reputation: agent.reputation + 30, reputationTitle: repToTitle(agent.reputation + 30),
             updatedAt: new Date() })
      .where(eq(playerAgents.characterId, characterId));

    await db.update(characters)
      .set({ stats: { ...(char.stats as any), gold: Math.max(0, ((char.stats as any)?.gold ?? 0) - capital) } })
      .where(eq(characters.id, characterId));

    await logActivity(characterId, "business",
      `Thành lập doanh nghiệp "${name}" (${type}), vốn ${capital} gold, thu nhập ${incomePerTick}/tick`,
      { businessId: business.id, type, capital, incomePerTick },
    );

    res.json({ ok: true, business, newGold, incomePerTick });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/join-faction/:factionId
   Gia nhập phe phái
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/join-faction/:factionId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId, factionId } = req.params;
    const { role = "member", factionSource = "npc" } = req.body as { role?: string; factionSource?: "npc" | "player" };
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    // Tìm faction (NPC hoặc player faction)
    let factionName = "";
    let factionType = "guild";
    if (factionSource === "npc") {
      const [f] = await db.select().from(npcFactions).where(eq(npcFactions.id, factionId));
      if (!f) return res.status(404).json({ error: "Phe phái không tồn tại" });
      factionName = f.name; factionType = f.type;
    } else {
      const [f] = await db.select().from(factions).where(eq(factions.id, factionId));
      if (!f) return res.status(404).json({ error: "Phe phái không tồn tại" });
      factionName = f.name; factionType = f.alignment ?? "neutral";
    }

    const [existing] = await db.select().from(playerFactionMemberships)
      .where(and(eq(playerFactionMemberships.characterId, characterId), eq(playerFactionMemberships.factionId, factionId)));
    if (existing) return res.status(400).json({ error: "Đã là thành viên rồi" });

    const [mem] = await db.insert(playerFactionMemberships).values({
      characterId, factionId, factionName, factionType, role,
    }).returning();

    // Sync với character_faction nếu là player faction
    if (factionSource === "player") {
      try {
        await db.insert(characterFaction).values({ characterId, factionId: factionId }).onConflictDoNothing();
      } catch {}
    }

    const agent = await getOrInitAgent(characterId, userId);
    if (agent) {
      await db.update(playerAgents)
        .set({ reputation: agent.reputation + 15, reputationTitle: repToTitle(agent.reputation + 15), updatedAt: new Date() })
        .where(eq(playerAgents.characterId, characterId));
    }

    await logActivity(characterId, "faction", `Gia nhập phe phái "${factionName}" với vai trò ${role}`,
      { factionId, factionName, role });

    res.json({ ok: true, membership: mem });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/add-family
   Thêm thành viên gia đình
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/add-family", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const { relType, targetId, targetName, targetType = "npc", familyName } = req.body as {
      relType: string; targetId: string; targetName: string; targetType?: string; familyName?: string;
    };
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const [existing] = await db.select().from(playerFamily)
      .where(and(eq(playerFamily.characterId, characterId), eq(playerFamily.targetId, targetId)));
    if (existing) return res.status(400).json({ error: "Đã có quan hệ gia đình này rồi" });

    const [member] = await db.insert(playerFamily).values({
      characterId, relType, targetId, targetName, targetType, familyName,
    }).returning();

    await logActivity(characterId, "family", `Thêm ${relType}: ${targetName}`, { relType, targetId, targetName });

    res.json({ ok: true, member });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   POST /api/player-agent/:characterId/collect-income
   Thu nhập từ doanh nghiệp
══════════════════════════════════════════════════════ */
router.post("/player-agent/:characterId/collect-income", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "Agent không tồn tại" });

    const openBizs = await db.select().from(playerBusinesses)
      .where(and(eq(playerBusinesses.characterId, characterId), eq(playerBusinesses.status, "open")));

    if (openBizs.length === 0) return res.json({ ok: true, totalIncome: 0, message: "Không có doanh nghiệp nào đang hoạt động" });

    let totalIncome = 0;
    for (const biz of openBizs) {
      const income = biz.incomePerTick;
      totalIncome += income;
      await db.update(playerBusinesses)
        .set({ totalEarned: biz.totalEarned + income, updatedAt: new Date() })
        .where(eq(playerBusinesses.id, biz.id));
    }

    const newGold = agent.gold + totalIncome;
    await db.update(playerAgents)
      .set({ gold: newGold, totalAssets: agent.totalAssets + totalIncome, updatedAt: new Date() })
      .where(eq(playerAgents.characterId, characterId));

    await db.update(characters)
      .set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) + totalIncome } })
      .where(eq(characters.id, characterId));

    await logActivity(characterId, "income", `Thu nhập từ ${openBizs.length} doanh nghiệp: +${totalIncome} gold`, { totalIncome });

    res.json({ ok: true, totalIncome, newGold, businesses: openBizs.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   GET /api/player-agent/:characterId/world-context
   Ngữ cảnh thế giới dành cho người chơi
══════════════════════════════════════════════════════ */
router.get("/player-agent/:characterId/world-context", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "" });

    const worldSlug = agent.worldSlug || (char.stats as any)?.world_slug;

    const [simState, activeWars, openElections, npcList] = await Promise.all([
      worldSlug ? db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug)).limit(1) : Promise.resolve([]),
      db.select().from(worldWars).where(eq(worldWars.status, "active")).limit(5),
      db.select().from(elections).where(eq(elections.status, "open")).limit(5),
      worldSlug ? db.select({ id: npcCores.id, name: npcCores.name, occupation: npcCores.occupation, money: npcCores.money })
        .from(npcCores).where(eq(npcCores.worldSlug, worldSlug)).limit(20) : Promise.resolve([]),
    ]);

    res.json({
      worldState:   simState[0] ?? null,
      activeWars,
      openElections,
      npcsNearby:   npcList,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   PATCH /api/player-agent/:characterId
   Cập nhật thông tin agent
══════════════════════════════════════════════════════ */
router.patch("/player-agent/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.userId;
    const { occupation, politicalRank, militaryRank } = req.body as {
      occupation?: string; politicalRank?: string; militaryRank?: string;
    };

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const agent = await getOrInitAgent(characterId, userId);
    if (!agent) return res.status(404).json({ error: "" });

    const updates: Partial<typeof playerAgents.$inferInsert> = { updatedAt: new Date() };
    if (occupation)    updates.occupation    = occupation;
    if (politicalRank) updates.politicalRank = politicalRank;
    if (militaryRank)  updates.militaryRank  = militaryRank;

    const [updated] = await db.update(playerAgents).set(updates)
      .where(eq(playerAgents.characterId, characterId)).returning();

    res.json({ ok: true, agent: updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   GET /api/player-agent/list
   Danh sách agent của user hiện tại
══════════════════════════════════════════════════════ */
router.get("/player-agent/list", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.userId;
    const agents = await db.select({
      agentId:         playerAgents.id,
      characterId:     playerAgents.characterId,
      worldSlug:       playerAgents.worldSlug,
      gold:            playerAgents.gold,
      totalAssets:     playerAgents.totalAssets,
      reputation:      playerAgents.reputation,
      reputationTitle: playerAgents.reputationTitle,
      occupation:      playerAgents.occupation,
      isActive:        playerAgents.isActive,
      characterName:   characters.name,
      characterLevel:  characters.level,
      lastActiveAt:    playerAgents.lastActiveAt,
    })
    .from(playerAgents)
    .innerJoin(characters, eq(playerAgents.characterId, characters.id))
    .where(eq(playerAgents.userId, userId))
    .orderBy(desc(playerAgents.lastActiveAt));

    res.json(agents);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
