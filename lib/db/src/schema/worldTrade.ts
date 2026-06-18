import { pgTable, uuid, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { characters } from "./characters";
import { items } from "./items";

export const worldTradeListings = pgTable("world_trade_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerCharacterId: uuid("seller_character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  fromWorldSlug: varchar("from_world_slug", { length: 64 }).notNull(),
  toWorldSlug: varchar("to_world_slug", { length: 64 }).notNull().default("any"),
  itemId: uuid("item_id").notNull().references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
  priceGold: integer("price_gold").notNull().default(100),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const worldTradeHistory = pgTable("world_trade_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => worldTradeListings.id),
  buyerCharacterId: uuid("buyer_character_id").notNull().references(() => characters.id),
  renamedItemName: varchar("renamed_item_name", { length: 128 }).notNull().default(""),
  soldAt: timestamp("sold_at").defaultNow().notNull(),
  priceGold: integer("price_gold").notNull(),
});

export type WorldTradeListing = typeof worldTradeListings.$inferSelect;
export type WorldTradeHistory = typeof worldTradeHistory.$inferSelect;
