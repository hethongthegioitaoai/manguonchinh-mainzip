import { pgTable, varchar, timestamp, jsonb, uuid, integer } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const worlds = pgTable("worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  worldId: uuid("world_id").references(() => worlds.id),
  name: varchar("name", { length: 64 }).notNull(),
  stats: jsonb("stats").notNull().default({}),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type World = typeof worlds.$inferSelect;
export type InsertWorld = typeof worlds.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;
