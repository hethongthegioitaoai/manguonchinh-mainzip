import { pgTable, uuid, varchar, integer, real, jsonb, timestamp, text } from "drizzle-orm/pg-core";
import { customWorlds } from "./customWorlds";

export const worldPopulationLog = pgTable("world_population_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  npcCount: integer("npc_count").notNull().default(0),
  playerCount: integer("player_count").notNull().default(0),
  totalGold: integer("total_gold").notNull().default(0),
  avgLevel: real("avg_level").notNull().default(1),
  activeEvents: integer("active_events").notNull().default(0),
  karmaScore: integer("karma_score").notNull().default(50),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const worldAutoEvents = pgTable("world_auto_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 32 }).notNull().default("npc_conflict"),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  triggeredBy: varchar("triggered_by", { length: 32 }).notNull().default("ai_autonomous"),
  effect: jsonb("effect").notNull().default({}),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
});

export type WorldPopulationLog = typeof worldPopulationLog.$inferSelect;
export type WorldAutoEvent = typeof worldAutoEvents.$inferSelect;
