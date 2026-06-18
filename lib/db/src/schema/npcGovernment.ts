import { pgTable, uuid, varchar, integer, text, timestamp, real } from "drizzle-orm/pg-core";
import { territories } from "./territories";
import { npcCores } from "./npcCore";

export const npcGovernments = pgTable("npc_governments", {
  id:           uuid("id").primaryKey().defaultRandom(),
  territoryId:  uuid("territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  govType:      varchar("gov_type", { length: 64 }).notNull().default("village_council"),
  leaderNpcId:  uuid("leader_npc_id").references(() => npcCores.id, { onDelete: "set null" }),
  treasury:     integer("treasury").notNull().default(0),
  approvalRate: real("approval_rate").notNull().default(50),
  taxRate:      real("tax_rate").notNull().default(10),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const npcGovernmentLogs = pgTable("npc_government_logs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  governmentId: uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  event:        text("event").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type NpcGovernment = typeof npcGovernments.$inferSelect;
export type InsertNpcGovernment = typeof npcGovernments.$inferInsert;
export type NpcGovernmentLog = typeof npcGovernmentLogs.$inferSelect;
