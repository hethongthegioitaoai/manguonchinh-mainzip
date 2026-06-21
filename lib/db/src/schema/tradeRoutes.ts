import { pgTable, uuid, varchar, integer, boolean, text, timestamp, index } from "drizzle-orm/pg-core";
import { territories } from "./territories";

export const tradeRoutes = pgTable("trade_routes", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  worldSlug:             varchar("world_slug", { length: 64 }).notNull(),
  sourceTerritoryId:     uuid("source_territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  destinationTerritoryId: uuid("destination_territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  item:                  varchar("item", { length: 64 }).notNull(),
  amount:                integer("amount").notNull().default(10),
  active:                boolean("active").notNull().default(true),
  disrupted:             boolean("disrupted").notNull().default(false),
  totalTicksActive:      integer("total_ticks_active").notNull().default(0),
  totalTransferred:      integer("total_transferred").notNull().default(0),
  createdAt:             timestamp("created_at").defaultNow(),
  updatedAt:             timestamp("updated_at").defaultNow(),
}, (t) => ({
  worldSlugIdx:  index("trade_routes_world_slug_idx").on(t.worldSlug),
  sourceIdx:     index("trade_routes_source_idx").on(t.sourceTerritoryId),
  destIdx:       index("trade_routes_dest_idx").on(t.destinationTerritoryId),
}));

export const tradeRouteHistory = pgTable("trade_route_history", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tradeRouteId: uuid("trade_route_id").references(() => tradeRoutes.id, { onDelete: "cascade" }),
  worldSlug:    varchar("world_slug", { length: 64 }).notNull(),
  eventType:    varchar("event_type", { length: 64 }).notNull(),
  description:  text("description").notNull().default(""),
  tick:         integer("tick").notNull().default(0),
  createdAt:    timestamp("created_at").defaultNow(),
}, (t) => ({
  worldSlugIdx: index("trade_route_history_world_slug_idx").on(t.worldSlug),
  routeIdx:     index("trade_route_history_route_idx").on(t.tradeRouteId),
}));

export type TradeRoute = typeof tradeRoutes.$inferSelect;
export type InsertTradeRoute = typeof tradeRoutes.$inferInsert;
export type TradeRouteHistory = typeof tradeRouteHistory.$inferSelect;
