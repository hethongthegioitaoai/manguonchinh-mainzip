import { pgTable, varchar, integer, uuid, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const factions = pgTable("factions", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").default(""),
  alignment: varchar("alignment", { length: 32 }).notNull().default("neutral"),
  bonusStats: jsonb("bonus_stats").notNull().default({}),
  icon: varchar("icon", { length: 16 }).notNull().default("⚑"),
  color: varchar("color", { length: 32 }).notNull().default("#00ffff"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const characterFaction = pgTable("character_faction", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  factionId: uuid("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" }),
  reputation: integer("reputation").notNull().default(0),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export type Faction = typeof factions.$inferSelect;
export type InsertFaction = typeof factions.$inferInsert;
export type CharacterFaction = typeof characterFaction.$inferSelect;
export type InsertCharacterFaction = typeof characterFaction.$inferInsert;
