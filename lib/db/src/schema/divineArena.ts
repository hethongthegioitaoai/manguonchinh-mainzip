import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const divineArenaMatches = pgTable("divine_arena_matches", {
  id:              uuid("id").primaryKey().defaultRandom(),
  challengerId:    text("challenger_id").notNull(),
  challengerName:  text("challenger_name").notNull(),
  challengerWorld: text("challenger_world").notNull(),
  defenderId:      text("defender_id").notNull(),
  defenderName:    text("defender_name").notNull(),
  defenderWorld:   text("defender_world").notNull(),
  ruleSet:         text("rule_set").notNull(),
  winnerId:        text("winner_id"),
  winnerName:      text("winner_name"),
  aiNarrative:     text("ai_narrative"),
  expReward:       integer("exp_reward").notNull().default(0),
  goldReward:      integer("gold_reward").notNull().default(0),
  matchedAt:       timestamp("matched_at", { withTimezone: true }).defaultNow(),
  completedAt:     timestamp("completed_at", { withTimezone: true }),
});

export const divineArenaRankings = pgTable("divine_arena_rankings", {
  id:            uuid("id").primaryKey().defaultRandom(),
  characterId:   text("character_id").notNull(),
  characterName: text("character_name").notNull(),
  worldSlug:     text("world_slug").notNull(),
  wins:          integer("wins").notNull().default(0),
  losses:        integer("losses").notNull().default(0),
  divinePoints:  integer("divine_points").notNull().default(0),
  tier:          text("tier").notNull().default("bronze"),
  rank:          integer("rank").notNull().default(9999),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
