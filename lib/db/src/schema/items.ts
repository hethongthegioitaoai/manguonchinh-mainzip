import { pgTable, varchar, integer, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  description: varchar("description", { length: 256 }).notNull(),
  icon: varchar("icon", { length: 8 }).notNull(),
  bonusStats: jsonb("bonus_stats").notNull().default({}),
});

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
  equippedSlot: varchar("equipped_slot", { length: 32 }),
  acquiredAt: timestamp("acquired_at").defaultNow(),
});

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;
