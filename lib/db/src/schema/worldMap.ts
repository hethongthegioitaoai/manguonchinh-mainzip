import { pgTable, uuid, varchar, integer, real, timestamp } from "drizzle-orm/pg-core";
import { territories } from "./territories";
import { worldWars } from "./worldWar";
import { npcFactions } from "./npcFactions";

export const armyMovements = pgTable("army_movements", {
  id:              uuid("id").primaryKey().defaultRandom(),
  worldSlug:       varchar("world_slug", { length: 64 }).notNull(),
  warId:           uuid("war_id").references(() => worldWars.id, { onDelete: "cascade" }),
  fromTerritoryId: uuid("from_territory_id").references(() => territories.id, { onDelete: "cascade" }),
  toTerritoryId:   uuid("to_territory_id").references(() => territories.id, { onDelete: "cascade" }),
  attackerSlug:    varchar("attacker_slug", { length: 64 }).notNull().default(""),
  armySize:        integer("army_size").notNull().default(100),
  factionId:       uuid("faction_id").references(() => npcFactions.id, { onDelete: "set null" }),
  status:          varchar("status", { length: 16 }).notNull().default("moving"),
  progress:        real("progress").notNull().default(0),
  startedAt:       timestamp("started_at").defaultNow().notNull(),
  arrivesAt:       timestamp("arrives_at").notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export type ArmyMovement = typeof armyMovements.$inferSelect;
