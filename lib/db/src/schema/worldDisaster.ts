import { pgTable, uuid, varchar, timestamp, text, jsonb, integer } from "drizzle-orm/pg-core";

export const worldDisasters = pgTable("world_disasters", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull(),
  eventType:    varchar("event_type", { length: 16 }).notNull().default("disaster"),
  eventName:    varchar("event_name", { length: 200 }).notNull(),
  severity:     varchar("severity", { length: 20 }).notNull().default("minor"),
  description:  text("description").notNull().default(""),
  aiNarrative:  text("ai_narrative").default(""),
  effect:       jsonb("effect").$type<Record<string, any>>().default({}),
  prayerCount:  integer("prayer_count").notNull().default(0),
  prayerPower:  integer("prayer_power").notNull().default(0),
  status:       varchar("status", { length: 16 }).notNull().default("active"),
  resolvedBy:   varchar("resolved_by", { length: 20 }),
  startedAt:    timestamp("started_at").defaultNow().notNull(),
  endsAt:       timestamp("ends_at").notNull(),
});

export const disasterPrayers = pgTable("disaster_prayers", {
  id:           uuid("id").primaryKey().defaultRandom(),
  disasterId:   uuid("disaster_id").notNull().references(() => worldDisasters.id, { onDelete: "cascade" }),
  characterId:  uuid("character_id").notNull(),
  characterName: varchar("character_name", { length: 100 }).notNull().default(""),
  prayerText:   text("prayer_text").default(""),
  prayerPower:  integer("prayer_power").notNull().default(10),
  prayedAt:     timestamp("prayed_at").defaultNow().notNull(),
});

export type WorldDisaster = typeof worldDisasters.$inferSelect;
export type DisasterPrayer = typeof disasterPrayers.$inferSelect;
