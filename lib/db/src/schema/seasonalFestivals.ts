import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const seasonalFestivals = pgTable("seasonal_festivals", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:        text("world_slug").notNull(),
  season:           text("season").notNull(),
  festivalName:     text("festival_name").notNull(),
  theme:            text("theme").notNull(),
  startDate:        timestamp("start_date", { withTimezone: true }).defaultNow(),
  endDate:          timestamp("end_date", { withTimezone: true }),
  rewards:          jsonb("rewards").notNull().default([]),
  aiNarrative:      text("ai_narrative"),
  quests:           jsonb("quests").notNull().default([]),
  participantCount: integer("participant_count").notNull().default(0),
  isActive:         integer("is_active").notNull().default(1),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const festivalParticipations = pgTable("festival_participations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  festivalId:    uuid("festival_id").notNull().references(() => seasonalFestivals.id),
  characterId:   text("character_id").notNull(),
  characterName: text("character_name"),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  rewardsClaimed: integer("rewards_claimed").notNull().default(0),
  score:         integer("score").notNull().default(0),
  joinedAt:      timestamp("joined_at", { withTimezone: true }).defaultNow(),
});
