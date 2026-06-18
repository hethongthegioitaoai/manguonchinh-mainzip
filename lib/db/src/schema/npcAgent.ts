import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcAgentLogs = pgTable("npc_agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  trigger: varchar("trigger", { length: 32 }).notNull().default("manual"),
  decisionType: varchar("decision_type", { length: 64 }).notNull().default("none"),
  promptSummary: text("prompt_summary").notNull().default(""),
  reasoningSummary: text("reasoning_summary").notNull().default(""),
  decision: jsonb("decision").notNull().default({}),
  confidence: real("confidence").notNull().default(0),
  actionTaken: boolean("action_taken").notNull().default(false),
  generatedBy: varchar("generated_by", { length: 16 }).notNull().default("rule-based"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcAgentLog = typeof npcAgentLogs.$inferSelect;

export type AgentDecision = {
  type: string;
  params: Record<string, unknown>;
  reasoning: string;
  explanation: string;
  confidence: number;
};
