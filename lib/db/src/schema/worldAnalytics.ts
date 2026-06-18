import { pgTable, uuid, varchar, integer, text, timestamp, real, jsonb } from "drizzle-orm/pg-core";

export const worldNpcEvents = pgTable("world_npc_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  worldSlug:   varchar("world_slug", { length: 64 }).notNull(),
  eventType:   varchar("event_type", { length: 32 }).notNull(),
  title:       varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull().default(""),
  actorName:   varchar("actor_name", { length: 128 }),
  actorId:     uuid("actor_id"),
  targetName:  varchar("target_name", { length: 128 }),
  targetId:    uuid("target_id"),
  metadata:    jsonb("metadata").$type<Record<string, unknown>>().default({}),
  worldYear:   integer("world_year").notNull().default(1),
  worldTick:   integer("world_tick").notNull().default(0),
  importance:  integer("importance").notNull().default(1),
  createdAt:   timestamp("created_at").defaultNow(),
});

export const worldStatSnapshots = pgTable("world_stat_snapshots", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:        varchar("world_slug", { length: 64 }).notNull(),
  worldYear:        integer("world_year").notNull().default(1),
  worldTick:        integer("world_tick").notNull().default(0),
  population:       integer("population").notNull().default(0),
  familyCount:      integer("family_count").notNull().default(0),
  factionCount:     integer("faction_count").notNull().default(0),
  governmentCount:  integer("government_count").notNull().default(0),
  electionCount:    integer("election_count").notNull().default(0),
  warCount:         integer("war_count").notNull().default(0),
  gdp:              integer("gdp").notNull().default(0),
  totalWealth:      integer("total_wealth").notNull().default(0),
  avgHappiness:     real("avg_happiness").notNull().default(50),
  inequalityIndex:  real("inequality_index").notNull().default(0),
  createdAt:        timestamp("created_at").defaultNow(),
});

export const worldChronicles = pgTable("world_chronicles", {
  id:          uuid("id").primaryKey().defaultRandom(),
  worldSlug:   varchar("world_slug", { length: 64 }).notNull(),
  worldYear:   integer("world_year").notNull().default(1),
  worldTick:   integer("world_tick").notNull().default(0),
  title:       varchar("title", { length: 256 }).notNull(),
  content:     text("content").notNull(),
  highlights:  jsonb("highlights").$type<string[]>().default([]),
  importance:  integer("importance").notNull().default(1),
  createdAt:   timestamp("created_at").defaultNow(),
});

export type WorldNpcEvent     = typeof worldNpcEvents.$inferSelect;
export type InsertWorldNpcEvent = typeof worldNpcEvents.$inferInsert;
export type WorldStatSnapshot  = typeof worldStatSnapshots.$inferSelect;
export type WorldChronicle     = typeof worldChronicles.$inferSelect;
