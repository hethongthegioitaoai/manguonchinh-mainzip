import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { customWorlds } from "./customWorlds";

export const userWorldSlots = pgTable("user_world_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 128 }).notNull().unique(),
  maxWorlds: integer("max_worlds").notNull().default(1),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const worldPortals = pgTable("world_portals", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromWorldSlug: varchar("from_world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  toWorldSlug: varchar("to_world_slug", { length: 64 }).notNull().references(() => customWorlds.slug, { onDelete: "cascade" }),
  portalName: varchar("portal_name", { length: 128 }).notNull(),
  portalType: varchar("portal_type", { length: 16 }).notNull().default("owner_only"),
  travelCost: integer("travel_cost").notNull().default(0),
  aiNarrative: text("ai_narrative").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const starDomains = pgTable("star_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull().unique(),
  domainName: varchar("domain_name", { length: 128 }).notNull(),
  worldSlugs: jsonb("world_slugs").notNull().default([]),
  domainLevel: integer("domain_level").notNull().default(1),
  totalPopulation: integer("total_population").notNull().default(0),
  totalWealth: integer("total_wealth").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserWorldSlot = typeof userWorldSlots.$inferSelect;
export type WorldPortal = typeof worldPortals.$inferSelect;
export type StarDomain = typeof starDomains.$inferSelect;
