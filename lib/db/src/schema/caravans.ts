import { pgTable, uuid, text, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";

export const caravans = pgTable("caravans", {
  id:          uuid("id").primaryKey().defaultRandom(),
  leaderId:    text("leader_id").notNull(),
  leaderName:  text("leader_name").notNull(),
  worldSlug:   text("world_slug").notNull(),
  fromWorld:   text("from_world").notNull(),
  toWorld:     text("to_world").notNull(),
  cargo:       jsonb("cargo").notNull().default([]),
  guards:      integer("guards").notNull().default(0),
  status:      text("status").notNull().default("traveling"),
  route:       text("route").notNull().default(""),
  aiNarrative: text("ai_narrative"),
  goldReward:  integer("gold_reward").notNull().default(0),
  riskLevel:   integer("risk_level").notNull().default(0),
  departedAt:  timestamp("departed_at", { withTimezone: true }).defaultNow(),
  arrivesAt:   timestamp("arrives_at", { withTimezone: true }),
  arrivedAt:   timestamp("arrived_at", { withTimezone: true }),
  raidedAt:    timestamp("raided_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const caravanRaids = pgTable("caravan_raids", {
  id:          uuid("id").primaryKey().defaultRandom(),
  caravanId:   uuid("caravan_id").notNull().references(() => caravans.id),
  raiderId:    text("raider_id").notNull(),
  raiderName:  text("raider_name").notNull(),
  success:     integer("success").notNull().default(0),
  loot:        jsonb("loot").notNull().default([]),
  battleLog:   text("battle_log"),
  raidedAt:    timestamp("raided_at", { withTimezone: true }).defaultNow(),
});
