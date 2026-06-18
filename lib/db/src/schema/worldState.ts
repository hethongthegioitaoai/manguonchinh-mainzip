import { pgTable, varchar, jsonb, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const worldState = pgTable("world_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  key: varchar("key", { length: 128 }).notNull(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const worldResources = pgTable("world_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull().default(100),
  maxQuantity: integer("max_quantity").notNull().default(100),
  regenRatePerHour: integer("regen_rate_per_hour").notNull().default(10),
  lastRegenAt: timestamp("last_regen_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type WorldState = typeof worldState.$inferSelect;
export type InsertWorldState = typeof worldState.$inferInsert;
export type WorldResource = typeof worldResources.$inferSelect;
export type InsertWorldResource = typeof worldResources.$inferInsert;
