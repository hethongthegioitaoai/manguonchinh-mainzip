import { pgTable, uuid, varchar, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";
import { npcLongTermGoals } from "./npcLongTermGoals";

export const npcPlans = pgTable("npc_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id").references(() => npcLongTermGoals.id, { onDelete: "set null" }),
  currentStep: integer("current_step").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("đang_thực_hiện"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const npcPlanSteps = pgTable("npc_plan_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => npcPlans.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull().default(0),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  target: text("target").notNull(),
  completed: boolean("completed").notNull().default(false),
});

export type NpcPlan = typeof npcPlans.$inferSelect;
export type InsertNpcPlan = typeof npcPlans.$inferInsert;
export type NpcPlanStep = typeof npcPlanSteps.$inferSelect;
export type InsertNpcPlanStep = typeof npcPlanSteps.$inferInsert;
