import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { customWorlds } from "./customWorlds";

export const worldFrameworks = pgTable("world_frameworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().unique().references(() => customWorlds.slug),
  theme: text("theme").notNull(),
  progressionSystem: jsonb("progression_system").notNull().default({}),
  currency: jsonb("currency").notNull().default({}),
  socialClasses: jsonb("social_classes").notNull().default([]),
  geography: jsonb("geography").notNull().default([]),
  terminology: jsonb("terminology").notNull().default({}),
  loreRules: text("lore_rules").notNull().default(""),
  atmosphereColor: varchar("atmosphere_color", { length: 16 }).default("#06b6d4"),
  tagline: varchar("tagline", { length: 128 }).default(""),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const worldLoreEntries = pgTable("world_lore_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull().references(() => customWorlds.slug),
  category: varchar("category", { length: 32 }).notNull().default("history"),
  title: varchar("title", { length: 128 }).notNull(),
  content: text("content").notNull(),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type WorldFramework = typeof worldFrameworks.$inferSelect;
export type InsertWorldFramework = typeof worldFrameworks.$inferInsert;
export type WorldLoreEntry = typeof worldLoreEntries.$inferSelect;
export type InsertWorldLoreEntry = typeof worldLoreEntries.$inferInsert;
