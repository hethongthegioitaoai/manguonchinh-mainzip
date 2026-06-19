import { Router } from "express";
import { db } from "@workspace/db";
import {
  npcCores, npcFamilies, npcFactions, territories, npcGovernments,
  elections, worldWars, npcJobs,
  worldNpcEvents, worldStatSnapshots, worldChronicles,
} from "@workspace/db/schema";
import { eq, sql, desc, and, or, count, sum, avg } from "drizzle-orm";

const router = Router();

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */

function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) numerator += (2 * (i + 1) - n - 1) * sorted[i];
  return Math.abs(numerator / (n * total));
}

function worldYearFromTick(tick: number) { return Math.floor(tick / 365) + 1; }

async function getLiveStats(worldSlug: string) {
  const [npcs, families, factions, govs, elecs, wars, jobs] = await Promise.all([
    db.select({
      count: count(),
      totalWealth: sum(npcCores.money),
      avgHappiness: avg(npcCores.happiness),
    }).from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1))),

    db.select({ familyName: npcFamilies.familyName }).from(npcFamilies)
      .innerJoin(npcCores, eq(npcFamilies.npcId, npcCores.id))
      .where(eq(npcCores.worldSlug, worldSlug)),

    db.select({ count: count() }).from(npcFactions).where(eq(npcFactions.worldSlug, worldSlug)),

    db.select({ count: count() }).from(npcGovernments)
      .innerJoin(territories, eq(npcGovernments.territoryId, territories.id))
      .where(eq(territories.worldSlug, worldSlug)),

    db.select({ count: count() }).from(elections)
      .innerJoin(npcGovernments, eq(elections.governmentId, npcGovernments.id))
      .innerJoin(territories, eq(npcGovernments.territoryId, territories.id))
      .where(eq(territories.worldSlug, worldSlug)),

    db.select({ count: count() }).from(worldWars)
      .where(or(eq(worldWars.attackerWorldSlug, worldSlug), eq(worldWars.defenderWorldSlug, worldSlug))),

    db.select({ gdp: sum(npcJobs.salary) }).from(npcJobs)
      .innerJoin(npcCores, eq(npcJobs.npcCoreId, npcCores.id))
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1))),
  ]);

  // Gini from wealth distribution
  const wealthList = await db.select({ money: npcCores.money })
    .from(npcCores)
    .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));
  const gini = giniCoefficient(wealthList.map(w => w.money ?? 0));

  const uniqueFamilies = new Set(families.map(f => f.familyName).filter(Boolean)).size;

  const tickResult = await db.select({ tick: npcCores.tickCount })
    .from(npcCores)
    .where(eq(npcCores.worldSlug, worldSlug))
    .orderBy(desc(npcCores.tickCount))
    .limit(1);
  const maxTick = tickResult[0]?.tick ?? 0;

  return {
    population:      Number(npcs[0]?.count ?? 0),
    familyCount:     uniqueFamilies,
    factionCount:    Number(factions[0]?.count ?? 0),
    governmentCount: Number(govs[0]?.count ?? 0),
    electionCount:   Number(elecs[0]?.count ?? 0),
    warCount:        Number(wars[0]?.count ?? 0),
    gdp:             Number(jobs[0]?.gdp ?? 0),
    totalWealth:     Number(npcs[0]?.totalWealth ?? 0),
    avgHappiness:    Math.round(Number(npcs[0]?.avgHappiness ?? 50)),
    inequalityIndex: Math.round(gini * 100) / 100,
    worldYear:       worldYearFromTick(maxTick),
    worldTick:       maxTick,
  };
}

/* ══════════════════════════════════════════════
   CIVILIZATION METRICS
══════════════════════════════════════════════ */
async function getCivilizationMetrics(worldSlug: string, stats: Awaited<ReturnType<typeof getLiveStats>>) {
  const snaps = await db.select()
    .from(worldStatSnapshots)
    .where(eq(worldStatSnapshots.worldSlug, worldSlug))
    .orderBy(desc(worldStatSnapshots.createdAt))
    .limit(5);

  const prev = snaps[1];
  const popGrowth  = prev ? ((stats.population - prev.population) / Math.max(1, prev.population)) * 100 : 0;
  const econGrowth = prev ? ((stats.gdp - prev.gdp) / Math.max(1, prev.gdp)) * 100 : 0;

  const govs = await db.select({ approval: npcGovernments.approvalRate })
    .from(npcGovernments)
    .innerJoin(territories, eq(npcGovernments.territoryId, territories.id))
    .where(eq(territories.worldSlug, worldSlug));
  const avgApproval = govs.length > 0
    ? govs.reduce((s, g) => s + (g.approval ?? 50), 0) / govs.length
    : 50;

  const warRate = Math.min(100, (stats.warCount / Math.max(1, stats.population)) * 5000);

  return {
    politicalStability: Math.round(avgApproval),
    populationGrowth:   Math.round(popGrowth * 10) / 10,
    economicGrowth:     Math.round(econGrowth * 10) / 10,
    warLevel:           Math.round(warRate),
    happinessIndex:     stats.avgHappiness,
    inequalityScore:    Math.round(stats.inequalityIndex * 100),
    overallScore:       Math.round(
      (avgApproval * 0.2 + stats.avgHappiness * 0.3 + (100 - warRate) * 0.2 + (100 - stats.inequalityIndex * 100) * 0.3)
    ),
  };
}

/* ══════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════ */

// GET /api/world-analytics/stats/:worldSlug
router.get("/world-analytics/stats/:worldSlug", async (req, res) => {
  try {
    const stats = await getLiveStats(req.params.worldSlug);
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/civilization/:worldSlug
router.get("/world-analytics/civilization/:worldSlug", async (req, res) => {
  try {
    const stats = await getLiveStats(req.params.worldSlug);
    const metrics = await getCivilizationMetrics(req.params.worldSlug, stats);
    res.json(metrics);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/timeline/:worldSlug
router.get("/world-analytics/timeline/:worldSlug", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const events = await db.select()
      .from(worldNpcEvents)
      .where(eq(worldNpcEvents.worldSlug, req.params.worldSlug))
      .orderBy(desc(worldNpcEvents.createdAt))
      .limit(limit);
    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/chronicle/:worldSlug
router.get("/world-analytics/chronicle/:worldSlug", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    const chronicles = await db.select()
      .from(worldChronicles)
      .where(eq(worldChronicles.worldSlug, req.params.worldSlug))
      .orderBy(desc(worldChronicles.worldYear))
      .limit(limit);
    res.json(chronicles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/dynasties/:worldSlug
router.get("/world-analytics/dynasties/:worldSlug", async (req, res) => {
  try {
    // Get all NPCs in world with family names
    const rows = await db
      .select({
        familyName: npcFamilies.familyName,
        npcId: npcCores.id,
        npcName: npcCores.name,
        money: npcCores.money,
        age: npcCores.age,
        occupation: npcCores.occupation,
        happiness: npcCores.happiness,
        tickCount: npcCores.tickCount,
      })
      .from(npcFamilies)
      .innerJoin(npcCores, eq(npcFamilies.npcId, npcCores.id))
      .where(and(eq(npcCores.worldSlug, req.params.worldSlug), eq(npcCores.active, 1)));

    // Group by family name
    const dynastyMap = new Map<string, {
      name: string;
      members: typeof rows;
      totalWealth: number;
      avgHappiness: number;
      maxAge: number;
      oldestMember: string;
      richestMember: string;
      maxWealth: number;
    }>();

    for (const row of rows) {
      const fname = row.familyName ?? "Vô Danh";
      if (!dynastyMap.has(fname)) {
        dynastyMap.set(fname, {
          name: fname,
          members: [],
          totalWealth: 0,
          avgHappiness: 0,
          maxAge: 0,
          oldestMember: "",
          richestMember: "",
          maxWealth: 0,
        });
      }
      const d = dynastyMap.get(fname)!;
      d.members.push(row);
      d.totalWealth += row.money ?? 0;
      if ((row.age ?? 0) > d.maxAge) { d.maxAge = row.age ?? 0; d.oldestMember = row.npcName; }
      if ((row.money ?? 0) > d.maxWealth) { d.maxWealth = row.money ?? 0; d.richestMember = row.npcName; }
    }

    const dynasties = Array.from(dynastyMap.values()).map(d => ({
      name: d.name,
      memberCount: d.members.length,
      totalWealth: d.totalWealth,
      avgHappiness: Math.round(d.members.reduce((s, m) => s + (m.happiness ?? 50), 0) / d.members.length),
      oldestMember: d.oldestMember,
      richestMember: d.richestMember,
      maxAge: d.maxAge,
      occupations: [...new Set(d.members.map(m => m.occupation))].slice(0, 3),
    }));

    dynasties.sort((a, b) => b.totalWealth - a.totalWealth);
    res.json(dynasties);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/snapshots/:worldSlug
router.get("/world-analytics/snapshots/:worldSlug", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 30);
    const snaps = await db.select()
      .from(worldStatSnapshots)
      .where(eq(worldStatSnapshots.worldSlug, req.params.worldSlug))
      .orderBy(worldStatSnapshots.createdAt)
      .limit(limit);
    res.json(snaps);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/world-analytics/snapshot/:worldSlug — take snapshot + auto-chronicle
router.post("/world-analytics/snapshot/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const stats = await getLiveStats(worldSlug);

    const [snap] = await db.insert(worldStatSnapshots).values({
      worldSlug,
      worldYear: stats.worldYear,
      worldTick: stats.worldTick,
      population: stats.population,
      familyCount: stats.familyCount,
      factionCount: stats.factionCount,
      governmentCount: stats.governmentCount,
      electionCount: stats.electionCount,
      warCount: stats.warCount,
      gdp: stats.gdp,
      totalWealth: stats.totalWealth,
      avgHappiness: stats.avgHappiness,
      inequalityIndex: stats.inequalityIndex,
    }).returning();

    // Auto-generate chronicle entry
    const prevSnaps = await db.select()
      .from(worldStatSnapshots)
      .where(eq(worldStatSnapshots.worldSlug, worldSlug))
      .orderBy(desc(worldStatSnapshots.createdAt))
      .limit(3);

    const highlights: string[] = [];
    const prev = prevSnaps[1];

    if (prev) {
      const popDiff = stats.population - prev.population;
      if (Math.abs(popDiff) >= 2) highlights.push(popDiff > 0 ? `Dân số tăng thêm ${popDiff} người` : `Dân số giảm ${Math.abs(popDiff)} người`);
      const wealthDiff = stats.totalWealth - prev.totalWealth;
      if (Math.abs(wealthDiff) >= 500) highlights.push(wealthDiff > 0 ? `Kinh tế thịnh vượng, tổng tài sản tăng ${wealthDiff.toLocaleString()} vàng` : `Kinh tế suy thoái, mất ${Math.abs(wealthDiff).toLocaleString()} vàng`);
      const facDiff = stats.factionCount - prev.factionCount;
      if (facDiff > 0) highlights.push(`${facDiff} hội nhóm mới được thành lập`);
      const warDiff = stats.warCount - prev.warCount;
      if (warDiff > 0) highlights.push(`${warDiff} cuộc chiến mới bùng nổ`);
    }

    const content = generateChronicleContent(stats, highlights);

    const [chronicle] = await db.insert(worldChronicles).values({
      worldSlug,
      worldYear: stats.worldYear,
      worldTick: stats.worldTick,
      title: `Năm ${stats.worldYear}: Biên Niên Sử`,
      content,
      highlights,
      importance: highlights.length,
    }).returning();

    res.json({ snapshot: snap, chronicle, stats });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function generateChronicleContent(stats: Awaited<ReturnType<typeof getLiveStats>>, highlights: string[]) {
  const parts: string[] = [];

  if (stats.population === 0) {
    parts.push(`Năm ${stats.worldYear}: Thế giới còn hoang sơ, chưa có linh hồn nào đặt chân đến.`);
  } else {
    parts.push(`Năm ${stats.worldYear}: Thế giới có ${stats.population} sinh linh sinh sống.`);
    if (stats.familyCount > 0) parts.push(`${stats.familyCount} gia tộc đang duy trì huyết thống.`);
    if (stats.factionCount > 0) parts.push(`${stats.factionCount} hội nhóm hùng cứ một phương.`);
    if (stats.governmentCount > 0) parts.push(`${stats.governmentCount} chính quyền cai trị lãnh thổ.`);
    if (stats.warCount > 0) parts.push(`${stats.warCount} cuộc xung đột đang diễn ra.`);
    if (stats.totalWealth > 0) parts.push(`Tổng tài sản toàn thế giới đạt ${stats.totalWealth.toLocaleString()} vàng.`);
    if (stats.inequalityIndex > 0.5) parts.push(`Bất bình đẳng ở mức cao — kẻ giàu ngày càng giàu hơn.`);
    else if (stats.inequalityIndex < 0.2) parts.push(`Của cải phân phối tương đối công bằng giữa các cư dân.`);
    if (stats.avgHappiness >= 75) parts.push(`Nhân dân sống trong thái bình và hạnh phúc.`);
    else if (stats.avgHappiness < 40) parts.push(`Tinh thần của dân chúng sa sút trầm trọng.`);
    if (highlights.length > 0) {
      parts.push("\nSự kiện đáng chú ý:");
      highlights.forEach(h => parts.push(`• ${h}.`));
    }
  }

  return parts.join(" ");
}

// POST /api/world-analytics/event/:worldSlug — log a timeline event
router.post("/world-analytics/event/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { eventType, title, description, actorName, actorId, targetName, targetId, metadata, worldYear, worldTick, importance } = req.body;

    if (!eventType || !title) return res.status(400).json({ error: "Cần eventType và title" });

    const [ev] = await db.insert(worldNpcEvents).values({
      worldSlug,
      eventType,
      title,
      description: description ?? "",
      actorName,
      actorId,
      targetName,
      targetId,
      metadata: metadata ?? {},
      worldYear: worldYear ?? 1,
      worldTick: worldTick ?? 0,
      importance: importance ?? 1,
    }).returning();

    res.json(ev);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/world-analytics/overview/:worldSlug — all data in one call
router.get("/world-analytics/overview/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const [stats, events, chronicles, dynastiesRaw] = await Promise.all([
      getLiveStats(worldSlug),
      db.select().from(worldNpcEvents).where(eq(worldNpcEvents.worldSlug, worldSlug))
        .orderBy(desc(worldNpcEvents.createdAt)).limit(20),
      db.select().from(worldChronicles).where(eq(worldChronicles.worldSlug, worldSlug))
        .orderBy(desc(worldChronicles.worldYear)).limit(10),
      db.select({
        familyName: npcFamilies.familyName,
        money: npcCores.money,
        age: npcCores.age,
        npcName: npcCores.name,
      }).from(npcFamilies)
        .innerJoin(npcCores, eq(npcFamilies.npcId, npcCores.id))
        .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1))),
    ]);

    // Compute dynasty rankings
    const dMap = new Map<string, { total: number; count: number; oldest: number; richestName: string; maxMoney: number }>();
    for (const r of dynastiesRaw) {
      const k = r.familyName ?? "Vô Danh";
      if (!dMap.has(k)) dMap.set(k, { total: 0, count: 0, oldest: 0, richestName: r.npcName, maxMoney: 0 });
      const d = dMap.get(k)!;
      d.total += r.money ?? 0;
      d.count++;
      if ((r.age ?? 0) > d.oldest) d.oldest = r.age ?? 0;
      if ((r.money ?? 0) > d.maxMoney) { d.maxMoney = r.money ?? 0; d.richestName = r.npcName; }
    }
    const topDynasties = Array.from(dMap.entries())
      .map(([name, d]) => ({ name, totalWealth: d.total, memberCount: d.count, richestMember: d.richestName }))
      .sort((a, b) => b.totalWealth - a.totalWealth)
      .slice(0, 5);

    const metrics = await getCivilizationMetrics(worldSlug, stats);

    res.json({ stats, events, chronicles, topDynasties, metrics });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
