import { pgTable, uuid, varchar, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { npcGovernments } from "./npcGovernment";
import { territories } from "./territories";
import { npcCores } from "./npcCore";

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
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

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
