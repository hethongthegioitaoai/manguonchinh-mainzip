import { pgTable, varchar, uuid, timestamp, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const customWorlds = pgTable("custom_worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  genre: varchar("genre", { length: 32 }).notNull().default("fantasy"),
  rules: text("rules").notNull().default(""),
  description: text("description").notNull().default(""),
  lore: text("lore").notNull().default(""),
  bossData: jsonb("boss_data").notNull().default([]),
  factionData: jsonb("faction_data").notNull().default([]),
  npcData: jsonb("npc_data").notNull().default([]),
  createdBy: varchar("created_by").references(() => users.id),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CustomWorld = typeof customWorlds.$inferSelect;
export type InsertCustomWorld = typeof customWorlds.$inferInsert;
