import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { npcs } from "./npcs";

export const divineActions = pgTable("divine_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  creatorUserId: varchar("creator_user_id", { length: 255 }).notNull(),
  actionType: varchar("action_type", { length: 32 }).notNull().default("intervene"),
  targetNpcId: uuid("target_npc_id").references(() => npcs.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  aiEffect: text("ai_effect").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const npcPrayers = pgTable("npc_prayers", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcs.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  prayerContent: text("prayer_content").notNull(),
  answered: boolean("answered").notNull().default(false),
  answerContent: text("answer_content").notNull().default(""),
  answeredAt: timestamp("answered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DivineAction = typeof divineActions.$inferSelect;
export type NpcPrayer = typeof npcPrayers.$inferSelect;
