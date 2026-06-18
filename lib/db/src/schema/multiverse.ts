import { pgTable, varchar, uuid, timestamp, text, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { characters } from "./characters";

export const crossWorldEvents = pgTable("cross_world_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 32 }).notNull().default("portal"),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  affectedWorlds: jsonb("affected_worlds").notNull().default([]),
  active: boolean("active").notNull().default(true),
  startAt: timestamp("start_at").defaultNow(),
  endAt: timestamp("end_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const characterWorldTravel = pgTable("character_world_travel", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fromWorld: varchar("from_world", { length: 64 }).notNull(),
  toWorld: varchar("to_world", { length: 64 }).notNull(),
  traveledAt: timestamp("traveled_at").defaultNow(),
  reason: text("reason").notNull().default(""),
});

export type CrossWorldEvent = typeof crossWorldEvents.$inferSelect;
export type InsertCrossWorldEvent = typeof crossWorldEvents.$inferInsert;
export type CharacterWorldTravel = typeof characterWorldTravel.$inferSelect;
export type InsertCharacterWorldTravel = typeof characterWorldTravel.$inferInsert;
