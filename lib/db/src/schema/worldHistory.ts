import { pgTable, uuid, varchar, integer, text, json, timestamp, index } from "drizzle-orm/pg-core";

export const worldHistory = pgTable("world_history", {
  id:          uuid("id").primaryKey().defaultRandom(),
  worldSlug:   varchar("world_slug",  { length: 64 }).notNull(),
  tick:        integer("tick").notNull().default(0),
  eventType:   varchar("event_type",  { length: 64 }).notNull(),
  title:       varchar("title",       { length: 256 }).notNull(),
  description: text("description").notNull().default(""),
  actors:      json("actors").$type<{ factions?: string[]; territories?: string[]; npcs?: string[] }>().default({}),
  createdAt:   timestamp("created_at").defaultNow(),
}, (t) => ({
  worldTickIdx:    index("world_history_world_tick_idx").on(t.worldSlug, t.tick),
  worldEventIdx:   index("world_history_world_event_idx").on(t.worldSlug, t.eventType),
}));

export type WorldHistory    = typeof worldHistory.$inferSelect;
export type InsertWorldHistory = typeof worldHistory.$inferInsert;
