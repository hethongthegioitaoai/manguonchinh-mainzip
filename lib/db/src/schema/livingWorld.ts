import { pgTable, uuid, varchar, text, jsonb, timestamp, real, integer } from "drizzle-orm/pg-core";
import { customWorlds } from "./customWorlds";
import { npcs } from "./npcs";

export const npcLives = pgTable("npc_lives", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().unique().references(() => npcs.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  occupation: varchar("occupation", { length: 64 }).notNull().default(""),
  familyMembers: jsonb("family_members").notNull().default([]),
  dailyRoutine: jsonb("daily_routine").notNull().default([]),
  currentGoal: text("current_goal").notNull().default(""),
  mood: varchar("mood", { length: 16 }).notNull().default("neutral"),
  wealthLevel: varchar("wealth_level", { length: 16 }).notNull().default("middle"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const worldCulture = pgTable("world_culture", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().unique().references(() => customWorlds.slug, { onDelete: "cascade" }),
  festivals: jsonb("festivals").notNull().default([]),
  taboos: jsonb("taboos").notNull().default([]),
  traditions: jsonb("traditions").notNull().default([]),
  myths: jsonb("myths").notNull().default([]),
  commonPhrases: jsonb("common_phrases").notNull().default([]),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const worldEconomyState = pgTable("world_economy_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull().default({}),
  inflationRate: real("inflation_rate").notNull().default(0),
  unemploymentRate: real("unemployment_rate").notNull().default(10),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type NpcLife = typeof npcLives.$inferSelect;
export type WorldCulture = typeof worldCulture.$inferSelect;
export type WorldEconomyState = typeof worldEconomyState.$inferSelect;
