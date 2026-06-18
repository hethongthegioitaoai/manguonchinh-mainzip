import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  territories,
  npcFactions,
  npcGovernments,
  worldWars,
  playerAgents,
  armyMovements,
  customWorlds,
} from "@workspace/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

const router = Router();

const FACTION_PALETTE = [
  "#22d3ee", "#a855f7", "#ef4444", "#f97316",
  "#22c55e", "#eab308", "#ec4899", "#3b82f6",
  "#14b8a6", "#f43f5e", "#8b5cf6", "#84cc16",
];

function factionColor(id: string | null | undefined): string {
  if (!id) return "#374151";
  const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return FACTION_PALETTE[sum % FACTION_PALETTE.length];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ──────────────────────────────────────────────────────
   GET /world-map/player/me — current user's active agent
────────────────────────────────────────────────────── */
router.get("/world-map/player/me", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).claims?.sub;
    const agents = await db
      .select({
        id: playerAgents.id,
        characterId: playerAgents.characterId,
        worldSlug: playerAgents.worldSlug,
        currentTerritoryId: playerAgents.currentTerritoryId,
        occupation: playerAgents.occupation,
        reputation: playerAgents.reputation,
        gold: playerAgents.gold,
      })
      .from(playerAgents)
      .where(and(eq(playerAgents.userId, userId), eq(playerAgents.isActive, true)))
      .limit(5);
    res.json(agents);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ──────────────────────────────────────────────────────
   GET /world-map/:worldSlug — full map data
────────────────────────────────────────────────────── */
router.get("/world-map/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db
      .select({
        id: territories.id,
        worldSlug: territories.worldSlug,
        name: territories.name,
        type: territories.type,
        x: territories.x,
        y: territories.y,
        terrain: territories.terrain,
        population: territories.population,
        prosperity: territories.prosperity,
        security: territories.security,
        ownerFactionId: territories.ownerFactionId,
        factionName: npcFactions.name,
        factionType: npcFactions.type,
        govType: npcGovernments.govType,
        govTreasury: npcGovernments.treasury,
        govApproval: npcGovernments.approvalRate,
        govId: npcGovernments.id,
      })
      .from(territories)
      .leftJoin(npcFactions, eq(territories.ownerFactionId, npcFactions.id))
      .leftJoin(npcGovernments, eq(npcGovernments.territoryId, territories.id))
      .where(eq(territories.worldSlug, worldSlug))
      .orderBy(territories.name);

    const territoriesWithColor = terrs.map((t) => ({
      ...t,
      factionColor: factionColor(t.ownerFactionId),
    }));

    const wars = await db
      .select()
      .from(worldWars)
      .where(
        and(
          or(
            eq(worldWars.attackerWorldSlug, worldSlug),
            eq(worldWars.defenderWorldSlug, worldSlug),
          ),
          eq(worldWars.status, "active"),
        ),
      )
      .limit(10);

    const players = await db
      .select({
        id: playerAgents.id,
        userId: playerAgents.userId,
        characterId: playerAgents.characterId,
        currentTerritoryId: playerAgents.currentTerritoryId,
        occupation: playerAgents.occupation,
        reputation: playerAgents.reputation,
      })
      .from(playerAgents)
      .where(
        and(eq(playerAgents.worldSlug, worldSlug), eq(playerAgents.isActive, true)),
      )
      .limit(50);

    const armies = await db
      .select()
      .from(armyMovements)
      .where(
        and(
          eq(armyMovements.worldSlug, worldSlug),
          eq(armyMovements.status, "moving"),
        ),
      )
      .orderBy(desc(armyMovements.startedAt))
      .limit(20);

    res.json({ territories: territoriesWithColor, wars, players, armies });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ──────────────────────────────────────────────────────
   POST /world-map/:worldSlug/seed — generate x,y,terrain
────────────────────────────────────────────────────── */
router.post("/world-map/:worldSlug/seed", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const terrs = await db
      .select()
      .from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    if (terrs.length === 0)
      return res.status(404).json({ error: "Không có lãnh thổ nào" });

    const N = terrs.length;
    const cols = Math.ceil(Math.sqrt(N * 1.6));
    const rows = Math.ceil(N / cols);
    const TERRAINS = [
      "plains", "plains", "plains", "forest",
      "mountain", "desert", "swamp", "sea",
    ] as const;

    for (let i = 0; i < terrs.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseX = 8 + (col / Math.max(1, cols - 1)) * 84;
      const baseY = 8 + (row / Math.max(1, rows - 1)) * 84;
      const x = clamp(Math.round(baseX + (Math.random() - 0.5) * 14), 5, 95);
      const y = clamp(Math.round(baseY + (Math.random() - 0.5) * 14), 5, 95);
      const terrain = TERRAINS[Math.floor(Math.random() * TERRAINS.length)];

      await db
        .update(territories)
        .set({ x, y, terrain })
        .where(eq(territories.id, terrs[i].id));
    }

    res.json({ seeded: terrs.length, message: `Đã tạo vị trí cho ${terrs.length} lãnh thổ` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ──────────────────────────────────────────────────────
   GET /world-map/territory/:id — territory detail
────────────────────────────────────────────────────── */
router.get("/world-map/territory/:id", isAuthenticated, async (req, res) => {
  try {
    const [territory] = await db
      .select({
        id: territories.id,
        worldSlug: territories.worldSlug,
        name: territories.name,
        type: territories.type,
        x: territories.x,
        y: territories.y,
        terrain: territories.terrain,
        population: territories.population,
        prosperity: territories.prosperity,
        security: territories.security,
        ownerFactionId: territories.ownerFactionId,
        factionName: npcFactions.name,
        govId: npcGovernments.id,
        govType: npcGovernments.govType,
        govTreasury: npcGovernments.treasury,
        govApproval: npcGovernments.approvalRate,
        taxRate: npcGovernments.taxRate,
      })
      .from(territories)
      .leftJoin(npcFactions, eq(territories.ownerFactionId, npcFactions.id))
      .leftJoin(npcGovernments, eq(npcGovernments.territoryId, territories.id))
      .where(eq(territories.id, req.params.id as string));

    if (!territory) return res.status(404).json({ error: "Lãnh thổ không tồn tại" });

    res.json({ ...territory, factionColor: factionColor(territory.ownerFactionId) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ──────────────────────────────────────────────────────
   POST /world-map/player/move — move player to territory
────────────────────────────────────────────────────── */
router.post("/world-map/player/move", isAuthenticated, async (req, res) => {
  try {
    const { characterId, toTerritoryId } = req.body;
    const userId = (req.user as any).claims?.sub;

    const [agent] = await db
      .select()
      .from(playerAgents)
      .where(
        and(eq(playerAgents.characterId, characterId), eq(playerAgents.userId, userId)),
      );

    if (!agent) return res.status(404).json({ error: "Không tìm thấy Player Agent" });

    const [territory] = await db
      .select()
      .from(territories)
      .where(
        and(
          eq(territories.id, toTerritoryId),
          eq(territories.worldSlug, agent.worldSlug),
        ),
      );

    if (!territory)
      return res.status(404).json({ error: "Lãnh thổ không tồn tại hoặc khác thế giới" });

    await db
      .update(playerAgents)
      .set({ currentTerritoryId: toTerritoryId, updatedAt: new Date() })
      .where(eq(playerAgents.id, agent.id));

    res.json({ success: true, territory: { id: territory.id, name: territory.name } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ──────────────────────────────────────────────────────
   GET /world-map/:worldSlug/armies — active army movements
────────────────────────────────────────────────────── */
router.get("/world-map/:worldSlug/armies", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const armies = await db
      .select()
      .from(armyMovements)
      .where(
        and(
          eq(armyMovements.worldSlug, worldSlug),
          eq(armyMovements.status, "moving"),
        ),
      )
      .orderBy(desc(armyMovements.startedAt))
      .limit(20);
    res.json(armies);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
