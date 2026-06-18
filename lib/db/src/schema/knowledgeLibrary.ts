import { pgTable, uuid, text, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";

export const knowledgeEntries = pgTable("knowledge_entries", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    text("world_slug").notNull(),
  title:        text("title").notNull(),
  category:     text("category").notNull().default("history"),
  content:      text("content").notNull(),
  aiGenerated:  integer("ai_generated").notNull().default(0),
  discoveredBy: text("discovered_by"),
  rarity:       text("rarity").notNull().default("common"),
  unlockCost:   integer("unlock_cost").notNull().default(0),
  timesStudied: integer("times_studied").notNull().default(0),
  tags:         jsonb("tags").notNull().default([]),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const playerResearch = pgTable("player_research", {
  id:           uuid("id").primaryKey().defaultRandom(),
  characterId:  text("character_id").notNull(),
  entryId:      uuid("entry_id").notNull().references(() => knowledgeEntries.id),
  studiedAt:    timestamp("studied_at", { withTimezone: true }).defaultNow(),
  bonusUnlocked: text("bonus_unlocked"),
});
