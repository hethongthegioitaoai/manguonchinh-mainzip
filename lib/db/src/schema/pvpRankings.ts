import { pgTable, varchar, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const pvpRankings = pgTable("pvp_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().unique().references(() => characters.id, { onDelete: "cascade" }),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  ratingPoints: integer("rating_points").notNull().default(1000),
  currentStreak: integer("current_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  tier: varchar("tier", { length: 32 }).notNull().default("bronze"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PvpRanking = typeof pvpRankings.$inferSelect;
export type InsertPvpRanking = typeof pvpRankings.$inferInsert;
