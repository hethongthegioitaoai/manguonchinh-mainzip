import { pgTable, varchar, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import { characters } from "./characters";
import { items } from "./items";

export const auctionListings = pgTable("auction_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerCharId: uuid("seller_char_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => items.id),
  itemName: varchar("item_name", { length: 128 }).notNull(),
  itemIcon: varchar("item_icon", { length: 8 }).notNull(),
  itemRarity: varchar("item_rarity", { length: 16 }).notNull().default("common"),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  startBid: integer("start_bid").notNull(),
  currentBid: integer("current_bid").notNull(),
  currentBidderId: uuid("current_bidder_id").references(() => characters.id),
  buyoutPrice: integer("buyout_price"),
  quantity: integer("quantity").notNull().default(1),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auctionBids = pgTable("auction_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  auctionId: uuid("auction_id").notNull().references(() => auctionListings.id, { onDelete: "cascade" }),
  bidderCharId: uuid("bidder_char_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  bidAmount: integer("bid_amount").notNull(),
  bidAt: timestamp("bid_at").defaultNow(),
});

export type AuctionListing = typeof auctionListings.$inferSelect;
export type AuctionBid = typeof auctionBids.$inferSelect;
