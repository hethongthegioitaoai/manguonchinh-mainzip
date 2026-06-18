import { Router } from "express";
import { db } from "@workspace/db";
import {
  npcCores, npcEmotions, territories, npcFactions,
  npcGovernments, militaryForces, worldWars, armyMovements,
  playerAgents, characters,
  npcBirths, elections, diplomaticMemories,
  worldEvents,
} from "@workspace/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/replitAuth.js";

const router = Router();

// ─── Unity-ready DTO types ────────────────────────────────────────────────

export interface Pos { x: number; y: number }

export interface NpcDTO {
  id: string;
  name: string;
  pos: Pos | null;       // territory coordinates
  territoryId: string | null;
  state: "idle" | "working" | "moving" | "fighting" | "hungry" | "dead";
  action: string;        // currentGoal
  emotion: string;       // dominant emotion name
  occupation: string;
  age: number;
}

export interface TerritoryDTO {
  id: string;
  name: string;
  type: string;
  pos: Pos;
  terrain: string;
  owner: string | null;  // faction name
  pop: number;
  pros: number;          // prosperity 0-100
  sec: number;           // security 0-100
}

export interface GovDTO {
  id: string;
  name: string;          // territory name
  type: string;
  treasury: number;
  approval: number;
  taxRate: number;
  leader: string | null; // leader NPC name
  army: { soldiers: number; power: number } | null;
}

export interface WarDTO {
  id: string;
  attacker: string;
  defender: string;
  status: string;
  scoreA: number;
  scoreD: number;
  startedAt: string;
}

export interface ArmyDTO {
  id: string;
  name: string;
  fromId: string | null;
  toId: string | null;
  size: number;
  progress: number;      // 0.0 – 1.0
  status: string;
}

export interface PlayerDTO {
  id: string;
  name: string;
  pos: Pos | null;
  territoryId: string | null;
  occupation: string;
  worldSlug: string;
}

export interface WorldSnapshotDTO {
  worldSlug: string;
  ts: number;
  npcs: NpcDTO[];
  territories: TerritoryDTO[];
  govs: GovDTO[];
  wars: WarDTO[];
  armies: ArmyDTO[];
  players: PlayerDTO[];
}

export interface WorldEventDTO {
  id: string;
  worldSlug: string;
  type: string;
  title: string;
  summary: string;
  ts: string;
}

// ─── Helper: dominant emotion ─────────────────────────────────────────────

function dominantEmotion(e: {
  happiness: number; anger: number; fear: number;
  sadness: number; confidence: number; stress: number;
} | null): string {
  if (!e) return "neutral";
  const scores: [string, number][] = [
    ["happy", e.happiness], ["angry", e.anger], ["afraid", e.fear],
    ["sad", e.sadness], ["confident", e.confidence], ["stressed", e.stress],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

// ─── Helper: NPC state ────────────────────────────────────────────────────

function npcState(npc: { energy: number; hunger: number; active: number; currentGoal: string | null }): NpcDTO["state"] {
  if (npc.active === 0) return "dead";
  if (npc.hunger > 80) return "hungry";
  if (npc.energy < 20) return "idle";
  const goal = npc.currentGoal?.toLowerCase() ?? "";
  if (goal.includes("đánh") || goal.includes("chiến") || goal.includes("tấn")) return "fighting";
  if (goal.includes("di") || goal.includes("đi") || goal.includes("chuyển")) return "moving";
  if (goal) return "working";
  return "idle";
}

// ─── GET /api/unity/world-state/:worldSlug ────────────────────────────────

router.get("/unity/world-state/:worldSlug", isAuthenticated, async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;

  try {
    // ① NPC cores + emotions (single join query)
    const npcRows = await db
      .select({
        id:           npcCores.id,
        name:         npcCores.name,
        age:          npcCores.age,
        occupation:   npcCores.occupation,
        energy:       npcCores.energy,
        hunger:       npcCores.hunger,
        active:       npcCores.active,
        currentGoal:  npcCores.currentGoal,
        // emotions
        happiness:    npcEmotions.happiness,
        anger:        npcEmotions.anger,
        fear:         npcEmotions.fear,
        sadness:      npcEmotions.sadness,
        confidence:   npcEmotions.confidence,
        stress:       npcEmotions.stress,
      })
      .from(npcCores)
      .leftJoin(npcEmotions, eq(npcEmotions.npcId, npcCores.id))
      .where(eq(npcCores.worldSlug, worldSlug))
      .limit(500);

    // ② Territories with faction name
    const terrRows = await db
      .select({
        id:            territories.id,
        name:          territories.name,
        type:          territories.type,
        x:             territories.x,
        y:             territories.y,
        terrain:       territories.terrain,
        population:    territories.population,
        prosperity:    territories.prosperity,
        security:      territories.security,
        ownerFactionId: territories.ownerFactionId,
        factionName:   npcFactions.name,
      })
      .from(territories)
      .leftJoin(npcFactions, eq(npcFactions.id, territories.ownerFactionId))
      .where(eq(territories.worldSlug, worldSlug));

    // Build territory position map for NPC lookup
    const terrPosMap = new Map<string, Pos>();
    for (const t of terrRows) terrPosMap.set(t.id, { x: t.x, y: t.y });

    // ③ Governments with territory name + leader NPC name
    const govRows = await db
      .select({
        id:           npcGovernments.id,
        govType:      npcGovernments.govType,
        treasury:     npcGovernments.treasury,
        approvalRate: npcGovernments.approvalRate,
        taxRate:      npcGovernments.taxRate,
        leaderNpcId:  npcGovernments.leaderNpcId,
        terrName:     territories.name,
        leaderName:   npcCores.name,
        // military
        soldiers:     militaryForces.totalSoldiers,
        power:        militaryForces.militaryPower,
      })
      .from(npcGovernments)
      .innerJoin(territories, eq(territories.id, npcGovernments.territoryId))
      .leftJoin(npcCores, eq(npcCores.id, npcGovernments.leaderNpcId))
      .leftJoin(militaryForces, eq(militaryForces.governmentId, npcGovernments.id))
      .where(eq(territories.worldSlug, worldSlug));

    // ④ Active wars involving this world
    const warRows = await db
      .select()
      .from(worldWars)
      .where(
        sql`(${worldWars.attackerWorldSlug} = ${worldSlug} OR ${worldWars.defenderWorldSlug} = ${worldSlug})
            AND ${worldWars.status} = 'active'`
      );

    // ⑤ Active army movements
    const armyRows = await db
      .select()
      .from(armyMovements)
      .where(
        and(
          eq(armyMovements.worldSlug, worldSlug),
          eq(armyMovements.status, "moving")
        )
      );

    // ⑥ Player agents in this world
    const playerRows = await db
      .select({
        id:          playerAgents.id,
        worldSlug:   playerAgents.worldSlug,
        occupation:  playerAgents.occupation,
        territoryId: playerAgents.currentTerritoryId,
        charName:    characters.name,
      })
      .from(playerAgents)
      .innerJoin(characters, eq(characters.id, playerAgents.characterId))
      .where(eq(playerAgents.worldSlug, worldSlug));

    // ─── Assemble DTOs ────────────────────────────────────────────────────

    const npcDTOs: NpcDTO[] = npcRows.map((n) => ({
      id:          n.id,
      name:        n.name,
      pos:         null,  // NPC positions via territory if linked; extended in future
      territoryId: null,
      state:       npcState(n),
      action:      n.currentGoal ?? "idle",
      emotion:     dominantEmotion(
        n.happiness != null
          ? { happiness: n.happiness, anger: n.anger!, fear: n.fear!, sadness: n.sadness!, confidence: n.confidence!, stress: n.stress! }
          : null
      ),
      occupation:  n.occupation,
      age:         n.age,
    }));

    const terrDTOs: TerritoryDTO[] = terrRows.map((t) => ({
      id:      t.id,
      name:    t.name,
      type:    t.type,
      pos:     { x: t.x, y: t.y },
      terrain: t.terrain,
      owner:   t.factionName ?? null,
      pop:     t.population,
      pros:    t.prosperity,
      sec:     t.security,
    }));

    const govDTOs: GovDTO[] = govRows.map((g) => ({
      id:       g.id,
      name:     g.terrName,
      type:     g.govType,
      treasury: g.treasury,
      approval: g.approvalRate,
      taxRate:  g.taxRate,
      leader:   g.leaderName ?? null,
      army:     g.soldiers != null ? { soldiers: g.soldiers, power: Math.round(g.power ?? 0) } : null,
    }));

    const warDTOs: WarDTO[] = warRows.map((w) => ({
      id:        w.id,
      attacker:  w.attackerWorldName,
      defender:  w.defenderWorldName,
      status:    w.status,
      scoreA:    w.attackerScore,
      scoreD:    w.defenderScore,
      startedAt: w.declaredAt.toISOString(),
    }));

    const armyDTOs: ArmyDTO[] = armyRows.map((a) => ({
      id:       a.id,
      name:     `Army-${a.id.slice(0, 6)}`,
      fromId:   a.fromTerritoryId,
      toId:     a.toTerritoryId,
      size:     a.armySize,
      progress: a.progress,
      status:   a.status,
    }));

    const playerDTOs: PlayerDTO[] = playerRows.map((p) => ({
      id:          p.id,
      name:        p.charName,
      pos:         p.territoryId ? (terrPosMap.get(p.territoryId) ?? null) : null,
      territoryId: p.territoryId,
      occupation:  p.occupation,
      worldSlug:   p.worldSlug,
    }));

    const snapshot: WorldSnapshotDTO = {
      worldSlug,
      ts:          Date.now(),
      npcs:        npcDTOs,
      territories: terrDTOs,
      govs:        govDTOs,
      wars:        warDTOs,
      armies:      armyDTOs,
      players:     playerDTOs,
    };

    res.json(snapshot);
  } catch (err) {
    console.error("[Unity] world-state error:", err);
    res.status(500).json({ error: "Failed to fetch world state" });
  }
});

// ─── GET /api/unity/world-events/:worldSlug ───────────────────────────────

router.get("/unity/world-events/:worldSlug", isAuthenticated, async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  try {
    const baseQuery = db
      .select({
        id:          worldEvents.id,
        worldSlug:   worldEvents.worldSlug,
        title:       worldEvents.title,
        description: worldEvents.description,
        eventType:   worldEvents.type,
        createdAt:   worldEvents.createdAt,
      })
      .from(worldEvents)
      .where(
        since
          ? and(eq(worldEvents.worldSlug, worldSlug), gte(worldEvents.createdAt, since))
          : eq(worldEvents.worldSlug, worldSlug)
      )
      .orderBy(desc(worldEvents.createdAt))
      .limit(limit);

    const rows = await baseQuery;

    // Pull recent NPC births
    const birthRows = await db
      .select({
        id:        npcBirths.id,
        worldSlug: npcBirths.worldSlug,
        childName: npcBirths.childName,
        createdAt: npcBirths.createdAt,
      })
      .from(npcBirths)
      .where(
        since
          ? and(eq(npcBirths.worldSlug, worldSlug), gte(npcBirths.createdAt, since))
          : eq(npcBirths.worldSlug, worldSlug)
      )
      .orderBy(desc(npcBirths.createdAt))
      .limit(20);

    // Pull recent elections resolved
    const electionRows = await db
      .select({
        id:          elections.id,
        electionType: elections.electionType,
        winnerName:  elections.winnerName,
        resolvedAt:  elections.resolvedAt,
        govId:       elections.governmentId,
      })
      .from(elections)
      .where(
        since
          ? gte(elections.resolvedAt, since)
          : sql`${elections.resolvedAt} IS NOT NULL`
      )
      .orderBy(desc(elections.resolvedAt))
      .limit(10);

    // Pull recent diplomacy memories
    const diplomacyRows = await db
      .select({
        id:        diplomaticMemories.id,
        govId:     diplomaticMemories.governmentId,
        event:     diplomaticMemories.event,
        createdAt: diplomaticMemories.createdAt,
      })
      .from(diplomaticMemories)
      .orderBy(desc(diplomaticMemories.createdAt))
      .limit(10);

    // Assemble events
    const events: WorldEventDTO[] = [
      ...rows.map((r: any) => ({
        id:        String(r.id),
        worldSlug: r.worldSlug,
        type:      r.type ?? "world_event",
        title:     r.title,
        summary:   r.description?.slice(0, 120) ?? "",
        ts:        r.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...birthRows.map((b) => ({
        id:        b.id,
        worldSlug: b.worldSlug,
        type:      "birth",
        title:     `Chào đời: ${b.childName}`,
        summary:   `NPC mới ${b.childName} được sinh ra`,
        ts:        b.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...electionRows.map((e) => ({
        id:        e.id,
        worldSlug,
        type:      "election",
        title:     `Bầu cử: ${e.winnerName} đắc cử`,
        summary:   `${e.electionType} — ${e.winnerName} trở thành lãnh đạo mới`,
        ts:        e.resolvedAt?.toISOString() ?? new Date().toISOString(),
      })),
      ...diplomacyRows.map((d) => ({
        id:        d.id,
        worldSlug,
        type:      "diplomacy",
        title:     "Sự kiện ngoại giao",
        summary:   d.event.slice(0, 120),
        ts:        d.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit);

    res.json({ worldSlug, ts: Date.now(), count: events.length, events });
  } catch (err) {
    console.error("[Unity] world-events error:", err);
    res.status(500).json({ error: "Failed to fetch world events" });
  }
});

// ─── GET /api/unity/ws-info ───────────────────────────────────────────────

router.get("/unity/ws-info", (_req, res) => {
  res.json({
    endpoint:  "/ws/unity",
    protocol:  "ws",
    subscribe: { type: "subscribe", worlds: ["<worldSlug>"] },
    events:    ["npc_move", "battle", "election", "diplomacy", "birth", "death", "war_start", "war_end", "world_tick"],
    note:      "Send { type: 'subscribe', worlds: [...] } after connect to start receiving events",
    eventSchemas: {
      battle: {
        description: "Kết thúc trận chiến — player vs NPC hoặc lãnh thổ. Broadcast cho tất cả world liên quan.",
        fields: {
          required: {
            type:             "\"battle\"",
            worldSlug:        "string — world ID",
            battleId:         "string — UUID trận đấu",
            winner:           "string — ID hoặc \"draw\"",
            loser:            "string — ID hoặc \"draw\"",
            winnerName:       "string — tên bên thắng",
            loserName:        "string — tên bên thua",
            expGained:        "number — EXP nhận được",
            goldReward:       "number — vàng thưởng (0 nếu không có)",
            territoryChanged: "boolean — lãnh thổ đổi chủ không",
            timestamp:        "string — ISO 8601",
          },
          playerAgent: {
            note:      "Chỉ có khi battle liên quan Player Agent",
            playerId:  "string — userId của player",
            playerWon: "boolean",
            levelUp:   "boolean — có lên cấp không",
          },
          territoryWar: {
            note:          "Chỉ có khi battle là chiến tranh lãnh thổ",
            territoryId:   "string",
            territoryName: "string",
            captured:      "boolean",
          },
        },
        examples: [
          {
            type:             "battle",
            worldSlug:        "tu-tien",
            battleId:         "a1b2c3d4-...",
            winner:           "<charId>",
            loser:            "enemy",
            winnerName:       "Thiên Kiếm Đạo Nhân",
            loserName:        "Thạch Hổ Yêu",
            expGained:        450,
            goldReward:       0,
            territoryChanged: false,
            timestamp:        "2026-06-18T17:30:00.000Z",
            playerId:         "<userId>",
            playerWon:        true,
            levelUp:          false,
          },
          {
            type:             "battle",
            worldSlug:        "cyberpunk",
            battleId:         "e5f6g7h8-...",
            winner:           "<charId>",
            loser:            "enemy",
            winnerName:       "Đế Quốc Phương Bắc",
            loserName:        "Liên Minh Cảng Biển",
            expGained:        450,
            goldReward:       1200,
            territoryChanged: true,
            timestamp:        "2026-06-18T18:00:00.000Z",
            territoryId:      "<territoryId>",
            territoryName:    "Cảng Thương Mại Alpha",
            captured:         true,
          },
        ],
      },
    },
  });
});

export default router;
