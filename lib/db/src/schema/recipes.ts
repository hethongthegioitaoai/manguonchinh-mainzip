import { pgTable, varchar, uuid, timestamp, integer, text, jsonb } from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  worldSlug: varchar("world_slug", { length: 32 }).notNull(),
  description: text("description").notNull().default(""),
  icon: varchar("icon", { length: 8 }).notNull().default("⚗️"),
  materials: jsonb("materials").$type<{ name: string; quantity: number; rarity: string }[]>().notNull(),
  resultItem: varchar("result_item", { length: 128 }).notNull(),
  resultRarity: varchar("result_rarity", { length: 16 }).notNull().default("common"),
  resultIcon: varchar("result_icon", { length: 8 }).notNull().default("📦"),
  requiredLevel: integer("required_level").notNull().default(1),
  expReward: integer("exp_reward").notNull().default(30),
  tier: varchar("tier", { length: 16 }).notNull().default("basic"),
  category: varchar("category", { length: 32 }).notNull().default("weapon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Recipe = typeof recipes.$inferSelect;
