import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";

export const stressTestRuns = pgTable("stress_test_runs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:        varchar("world_slug", { length: 64 }).notNull(),
  worldName:        varchar("world_name", { length: 128 }).notNull().default(""),
  ticksRequested:   integer("ticks_requested").notNull(),
  ticksCompleted:   integer("ticks_completed").notNull().default(0),
  status:           varchar("status", { length: 16 }).notNull().default("running"),
  durationMs:       integer("duration_ms"),

  initPopulation:   integer("init_population").notNull().default(0),
  initEconomy:      real("init_economy").notNull().default(0),
  finalPopulation:  integer("final_population"),
  finalEconomy:     real("final_economy"),
  finalGdp:         real("final_gdp"),
  finalTotalAssets: real("final_total_assets"),

  totalFamilies:    integer("total_families").notNull().default(0),
  totalFactions:    integer("total_factions").notNull().default(0),
  totalGovernments: integer("total_governments").notNull().default(0),
  totalWars:        integer("total_wars").notNull().default(0),
  totalElections:   integer("total_elections").notNull().default(0),
  avgUnemployment:  real("avg_unemployment").notNull().default(0),
  avgMortality:     real("avg_mortality").notNull().default(0),

  warnings:         jsonb("warnings").$type<string[]>().default([]),
  initialState:     jsonb("initial_state").$type<Record<string, any>>().default({}),
  finalState:       jsonb("final_state").$type<Record<string, any>>().default({}),

  startedAt:        timestamp("started_at").defaultNow().notNull(),
  completedAt:      timestamp("completed_at"),
});

export const stressTestSnapshots = pgTable("stress_test_snapshots", {
  id:               uuid("id").primaryKey().defaultRandom(),
  runId:            uuid("run_id").notNull().references(() => stressTestRuns.id, { onDelete: "cascade" }),
  tickNumber:       integer("tick_number").notNull(),
  population:       integer("population").notNull(),
  economyScore:     real("economy_score").notNull(),
  gdp:              real("gdp").notNull(),
  totalAssets:      real("total_assets").notNull(),
  unemploymentRate: real("unemployment_rate").notNull(),
  mortalityRate:    real("mortality_rate").notNull(),
  avgMood:          real("avg_mood").notNull(),
  stability:        real("stability").notNull(),
  majorEventType:   varchar("major_event_type", { length: 64 }),
  majorEventName:   varchar("major_event_name", { length: 256 }),
  snapshotAt:       timestamp("snapshot_at").defaultNow().notNull(),
});

export const stressTestReports = pgTable("stress_test_reports", {
  id:              uuid("id").primaryKey().defaultRandom(),
  runId:           uuid("run_id").notNull().references(() => stressTestRuns.id, { onDelete: "cascade" }),
  tickNumber:      integer("tick_number").notNull(),
  milestone:       integer("milestone").notNull(),
  worldStatus:     varchar("world_status", { length: 32 }).notNull().default("stable"),
  strongestNation: jsonb("strongest_nation").$type<Record<string, any>>().default({}),
  strongestFamily: jsonb("strongest_family").$type<Record<string, any>>().default({}),
  richestNpc:      jsonb("richest_npc").$type<Record<string, any>>().default({}),
  longestLeader:   jsonb("longest_leader").$type<Record<string, any>>().default({}),
  metrics:         jsonb("metrics").$type<Record<string, any>>().default({}),
  anomalies:       jsonb("anomalies").$type<string[]>().default([]),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const stressTestReplay = pgTable("stress_test_replay", {
  id:          uuid("id").primaryKey().defaultRandom(),
  runId:       uuid("run_id").notNull().references(() => stressTestRuns.id, { onDelete: "cascade" }),
  tickNumber:  integer("tick_number").notNull(),
  eventType:   varchar("event_type", { length: 64 }).notNull(),
  eventName:   varchar("event_name", { length: 256 }).notNull(),
  category:    varchar("category", { length: 32 }).notNull().default("event"),
  impact:      jsonb("impact").$type<Record<string, any>>().default({}),
  description: text("description").notNull().default(""),
  recordedAt:  timestamp("recorded_at").defaultNow().notNull(),
});

export type StressTestRun      = typeof stressTestRuns.$inferSelect;
export type StressTestSnapshot = typeof stressTestSnapshots.$inferSelect;
export type StressTestReport   = typeof stressTestReports.$inferSelect;
export type StressTestReplay   = typeof stressTestReplay.$inferSelect;
