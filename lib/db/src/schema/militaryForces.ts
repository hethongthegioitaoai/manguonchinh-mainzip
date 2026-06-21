import { pgTable, uuid, varchar, integer, real, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { npcGovernments } from "./npcGovernment";
import { territories } from "./territories";
import { npcCores } from "./npcCore";

/* Phase 63A — recentPositions shape */
export type ArmyPosition = { x: number; y: number; tick: number };

/* Phase 63A — state machine */
export type ArmyMovementStatus = "idle" | "moving" | "arrived" | "sieging";

export const militaryForces = pgTable("military_forces", {
  id:              uuid("id").primaryKey().defaultRandom(),
  governmentId:    uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  territoryId:     uuid("territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  armyName:        varchar("army_name", { length: 128 }).notNull().default("Quân Đội"),
  totalSoldiers:   integer("total_soldiers").notNull().default(0),
  morale:          real("morale").notNull().default(70),
  trainingLevel:   real("training_level").notNull().default(1),
  supplyLevel:     real("supply_level").notNull().default(100),
  militaryPower:   real("military_power").notNull().default(0),

  /* ── Phase 63A: Logical Movement ── */
  currentTerritoryId: uuid("current_territory_id").references(() => territories.id, { onDelete: "set null" }),
  targetTerritoryId:  uuid("target_territory_id").references(() => territories.id, { onDelete: "set null" }),
  movementProgress:   real("movement_progress").notNull().default(0),
  movementStatus:     varchar("movement_status", { length: 16 }).notNull().default("idle"),
  recentPositions:    jsonb("recent_positions").$type<ArmyPosition[]>().default([]),

  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("military_forces_territory_id_idx").on(t.territoryId),
  index("military_forces_government_id_idx").on(t.governmentId),
]);

export const militaryMemories = pgTable("military_memories", {
  id:        uuid("id").primaryKey().defaultRandom(),
  npcId:     uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  armyId:    uuid("army_id").references(() => militaryForces.id, { onDelete: "set null" }),
  content:   text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MilitaryForce  = typeof militaryForces.$inferSelect;
export type InsertMilitary = typeof militaryForces.$inferInsert;
export type MilitaryMemory = typeof militaryMemories.$inferSelect;
