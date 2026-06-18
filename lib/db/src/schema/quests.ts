import { pgTable, varchar, integer, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  expReward: integer("exp_reward").notNull().default(50),
  questType: varchar("quest_type", { length: 32 }).notNull().default("daily"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = typeof quests.$inferInsert;
