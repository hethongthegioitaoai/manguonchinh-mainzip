import { pgTable, uuid, varchar, timestamp, text, jsonb } from "drizzle-orm/pg-core";

export const worldThemes = pgTable("world_themes", {
  id:            uuid("id").primaryKey().defaultRandom(),
  worldSlug:     varchar("world_slug", { length: 100 }).notNull().unique(),
  themeInput:    text("theme_input").notNull().default(""),
  themeName:     varchar("theme_name", { length: 200 }).notNull().default(""),
  themeStyle:    varchar("theme_style", { length: 100 }).notNull().default("custom"),
  geography:     jsonb("geography").$type<Record<string, any>>().default({}),
  history:       text("history").default(""),
  economy:       jsonb("economy").$type<Record<string, any>>().default({}),
  military:      jsonb("military").$type<Record<string, any>>().default({}),
  culture:       jsonb("culture").$type<Record<string, any>>().default({}),
  uniqueItems:   jsonb("unique_items").$type<any[]>().default([]),
  uniqueQuests:  jsonb("unique_quests").$type<any[]>().default([]),
  currencyName:  varchar("currency_name", { length: 100 }).default(""),
  currencySymbol: varchar("currency_symbol", { length: 20 }).default(""),
  npcTitles:     jsonb("npc_titles").$type<string[]>().default([]),
  enemyTypes:    jsonb("enemy_types").$type<string[]>().default([]),
  generatedAt:   timestamp("generated_at").defaultNow().notNull(),
});

export type WorldTheme = typeof worldThemes.$inferSelect;
