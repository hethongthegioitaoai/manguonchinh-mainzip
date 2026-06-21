import { pgTable, uuid, varchar, integer, text, json, timestamp } from "drizzle-orm/pg-core";

export const worldHistory = pgTable("world_history", {
  id:          uuid("id").primaryKey().defaultRandom(),
  worldSlug:   varchar("world_slug",  { length: 64 }).notNull(),
  tick:        integer("tick").notNull().default(0),
  eventType:   varchar("event_type",  { length: 64 }).notNull(),
  title:       varchar("title",       { length: 256 }).notNull(),
  description: text("description").notNull().default(""),
  actors:      json("actors").$type<{ factions?: string[]; territories?: string[]; npcs?: string[] }>().default({}),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type WorldHistory    = typeof worldHistory.$inferSelect;
export type InsertWorldHistory = typeof worldHistory.$inferInsert;
