import { pgTable, varchar, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import { items } from "./items";

export const marketPrices = pgTable("market_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  basePrice: integer("base_price").notNull().default(100),
  currentPrice: integer("current_price").notNull().default(100),
  supplyLevel: varchar("supply_level", { length: 16 }).notNull().default("normal"),
  demandLevel: varchar("demand_level", { length: 16 }).notNull().default("normal"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MarketPrice = typeof marketPrices.$inferSelect;
export type InsertMarketPrice = typeof marketPrices.$inferInsert;
