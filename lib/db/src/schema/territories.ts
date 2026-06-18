import { pgTable, uuid, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { npcFactions } from "./npcFactions";

export const territories = pgTable("territories", {
  id:              uuid("id").primaryKey().defaultRandom(),
  worldSlug:       varchar("world_slug", { length: 64 }).notNull(),
  name:            varchar("name", { length: 128 }).notNull(),
  type:            varchar("type", { length: 32 }).notNull().default("village"),
  ownerFactionId:  uuid("owner_faction_id").references(() => npcFactions.id, { onDelete: "set null" }),
  population:      integer("population").notNull().default(0),
  prosperity:      integer("prosperity").notNull().default(50),
  security:        integer("security").notNull().default(50),
  lastHarvestAt:   timestamp("last_harvest_at"),
  createdAt:       timestamp("created_at").defaultNow(),
  updatedAt:       timestamp("updated_at").defaultNow(),
});

export const territoryResources = pgTable("territory_resources", {
  id:          uuid("id").primaryKey().defaultRandom(),
  territoryId: uuid("territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  amount:      integer("amount").notNull().default(0),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const territoryLogs = pgTable("territory_logs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  territoryId: uuid("territory_id").notNull().references(() => territories.id, { onDelete: "cascade" }),
  event:       text("event").notNull(),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type Territory = typeof territories.$inferSelect;
export type InsertTerritory = typeof territories.$inferInsert;
export type TerritoryResource = typeof territoryResources.$inferSelect;
export type TerritoryLog = typeof territoryLogs.$inferSelect;
