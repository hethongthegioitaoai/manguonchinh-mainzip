import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, real } from "drizzle-orm/pg-core";

export const cosmicEntities = pgTable("cosmic_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
  entityType: varchar("entity_type", { length: 24 }).notNull().default("world"),
  entityName: varchar("entity_name", { length: 128 }).notNull(),
  tier: integer("tier").notNull().default(1),
  powerScore: integer("power_score").notNull().default(0),
  population: integer("population").notNull().default(0),
  wealth: integer("wealth").notNull().default(0),
  influenceRadius: real("influence_radius").notNull().default(1.0),
  parentEntityId: uuid("parent_entity_id"),
  childEntities: jsonb("child_entities").notNull().default([]),
  ascendedAt: timestamp("ascended_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cosmicEvents = pgTable("cosmic_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull().references(() => cosmicEntities.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 24 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull().default(""),
  aiNarrative: text("ai_narrative").notNull().default(""),
  participants: jsonb("participants").notNull().default([]),
  outcome: jsonb("outcome").notNull().default({}),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export const cosmicRankings = pgTable("cosmic_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull().references(() => cosmicEntities.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 24 }).notNull(),
  rank: integer("rank").notNull().default(0),
  powerScore: integer("power_score").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const COSMIC_TIERS = {
  1: "world",
  2: "star_domain",
  3: "galaxy",
  4: "universe",
  5: "cosmos",
} as const;

export const COSMIC_TIER_NAMES: Record<number, string> = {
  1: "THẾ GIỚI",
  2: "TINH VỰC",
  3: "NGÂN HÀ",
  4: "THIÊN HÀ",
  5: "VŨ TRỤ",
};

export type CosmicEntity = typeof cosmicEntities.$inferSelect;
export type CosmicEvent = typeof cosmicEvents.$inferSelect;
export type CosmicRanking = typeof cosmicRankings.$inferSelect;
