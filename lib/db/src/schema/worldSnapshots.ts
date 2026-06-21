import { pgTable, uuid, varchar, integer, json, timestamp, index } from "drizzle-orm/pg-core";

export interface SnapshotTerritory {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  terrain: string;
  status: string;
  population: number;
  prosperity: number;
  security: number;
  ownerFactionId: string | null;
  ownerFactionName: string | null;
  militaryPower: number;
  foodSupply: number;
}

export interface SnapshotFaction {
  id: string;
  name: string;
  type: string;
  influence: number;
  treasury: number;
  militaryPower: number;
  territoryCount: number;
}

export interface SnapshotArmy {
  id: string;
  name: string;
  territoryId: string;
  soldiers: number;
  power: number;
  morale: number;
  supply: number;
}

export interface WorldSnapshotAggregates {
  populationTotal: number;
  activeCount: number;
  ruinsCount: number;
  factionCount: number;
  armyCount: number;
  avgFoodSupply: number;
  avgProsperity: number;
  avgSecurity: number;
  totalMilitaryPower: number;
}

export interface WorldSnapshotData {
  tick: number;
  territories: SnapshotTerritory[];
  factions: SnapshotFaction[];
  armies: SnapshotArmy[];
  aggregates?: WorldSnapshotAggregates;
}

export const worldSnapshots = pgTable("world_snapshots", {
  id:        uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  tick:      integer("tick").notNull(),
  data:      json("data").$type<WorldSnapshotData>().notNull().default({} as WorldSnapshotData),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  worldTickIdx: index("world_snapshots_world_tick_idx").on(t.worldSlug, t.tick),
}));

export type WorldSnapshot       = typeof worldSnapshots.$inferSelect;
export type InsertWorldSnapshot = typeof worldSnapshots.$inferInsert;
