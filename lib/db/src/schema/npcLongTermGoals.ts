import { pgTable, uuid, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcLongTermGoals = pgTable("npc_long_term_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  goalType: varchar("goal_type", { length: 64 }).notNull(),
  targetValue: integer("target_value").notNull().default(1000),
  progress: integer("progress").notNull().default(0),
  priority: integer("priority").notNull().default(1),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NpcLongTermGoal = typeof npcLongTermGoals.$inferSelect;
export type InsertNpcLongTermGoal = typeof npcLongTermGoals.$inferInsert;
