import { pgTable, uuid, varchar, timestamp, text, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const expeditions = pgTable("expeditions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull(),
  worldName:    varchar("world_name", { length: 200 }).notNull(),
  leaderId:     varchar("leader_id", { length: 100 }).notNull(),
  leaderName:   varchar("leader_name", { length: 100 }).notNull(),
  title:        varchar("title", { length: 200 }).notNull().default("Thám Hiểm Chưa Đặt Tên"),
  description:  text("description").default(""),
  status:       varchar("status", { length: 20 }).notNull().default("recruiting"),
  maxMembers:   integer("max_members").notNull().default(4),
  members:      jsonb("members").default([]),
  mapData:      jsonb("map_data").default([]),
  currentStep:  integer("current_step").notNull().default(0),
  totalSteps:   integer("total_steps").notNull().default(8),
  loot:         jsonb("loot").default([]),
  goldReward:   integer("gold_reward").notNull().default(0),
  expReward:    integer("exp_reward").notNull().default(0),
  difficulty:   varchar("difficulty", { length: 20 }).notNull().default("normal"),
  nextStepAt:   timestamp("next_step_at"),
  startedAt:    timestamp("started_at"),
  endedAt:      timestamp("ended_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const expeditionEvents = pgTable("expedition_events", {
  id:            uuid("id").primaryKey().defaultRandom(),
  expeditionId:  uuid("expedition_id").notNull(),
  step:          integer("step").notNull(),
  eventType:     varchar("event_type", { length: 30 }).notNull(),
  title:         varchar("title", { length: 200 }).notNull(),
  description:   text("description").default(""),
  outcome:       jsonb("outcome").default({}),
  goldChange:    integer("gold_change").notNull().default(0),
  expChange:     integer("exp_change").notNull().default(0),
  hpChange:      integer("hp_change").notNull().default(0),
  success:       boolean("success").notNull().default(true),
  resolvedAt:    timestamp("resolved_at").defaultNow().notNull(),
});

export type Expedition = typeof expeditions.$inferSelect;
export type ExpeditionEvent = typeof expeditionEvents.$inferSelect;
