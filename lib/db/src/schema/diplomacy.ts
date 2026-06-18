import { pgTable, uuid, varchar, timestamp, text, jsonb, integer } from "drizzle-orm/pg-core";

export const worldRelations = pgTable("world_relations", {
  id:              uuid("id").primaryKey().defaultRandom(),
  worldSlugA:      varchar("world_slug_a", { length: 100 }).notNull(),
  worldSlugB:      varchar("world_slug_b", { length: 100 }).notNull(),
  status:          varchar("status", { length: 32 }).notNull().default("neutral"),
  treatiesDetails: jsonb("treaties_details").$type<Record<string, any>>().default({}),
  establishedAt:   timestamp("established_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const diplomacyEvents = pgTable("diplomacy_events", {
  id:             uuid("id").primaryKey().defaultRandom(),
  fromWorldSlug:  varchar("from_world_slug", { length: 100 }).notNull(),
  toWorldSlug:    varchar("to_world_slug", { length: 100 }).notNull(),
  eventType:      varchar("event_type", { length: 32 }).notNull(),
  content:        text("content").notNull().default(""),
  proposedByUserId: varchar("proposed_by_user_id", { length: 128 }),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const worldEmbassies = pgTable("world_embassies", {
  id:                uuid("id").primaryKey().defaultRandom(),
  homeWorldSlug:     varchar("home_world_slug", { length: 100 }).notNull(),
  hostWorldSlug:     varchar("host_world_slug", { length: 100 }).notNull(),
  ambassadorCharId:  uuid("ambassador_char_id"),
  ambassadorName:    varchar("ambassador_name", { length: 100 }).default(""),
  status:            varchar("status", { length: 32 }).notNull().default("active"),
  establishedAt:     timestamp("established_at").defaultNow().notNull(),
});

export type WorldRelation = typeof worldRelations.$inferSelect;
export type DiplomacyEvent = typeof diplomacyEvents.$inferSelect;
export type WorldEmbassy = typeof worldEmbassies.$inferSelect;
