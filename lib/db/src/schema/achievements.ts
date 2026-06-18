import { pgTable, varchar, uuid, timestamp, integer, text, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 8 }).notNull().default("🏅"),
  category: varchar("category", { length: 32 }).notNull().default("general"),
  xpReward: integer("xp_reward").notNull().default(50),
  condition: varchar("condition", { length: 128 }).notNull().default(""),
});

export const characterAchievements = pgTable("character_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  achievementKey: varchar("achievement_key", { length: 64 }).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export type Achievement = typeof achievements.$inferSelect;
export type CharacterAchievement = typeof characterAchievements.$inferSelect;
