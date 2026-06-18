import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";

export const worldSimState = pgTable("world_sim_state", {
  id:             uuid("id").primaryKey().defaultRandom(),
  worldSlug:      varchar("world_slug", { length: 64 }).notNull().unique(),
  worldName:      varchar("world_name", { length: 128 }).notNull().default(""),
  theme:          varchar("theme", { length: 256 }).notNull().default(""),
  population:     integer("population").notNull().default(1000),
  economyScore:   real("economy_score").notNull().default(50),
  avgMood:        real("avg_mood").notNull().default(60),
  stability:      real("stability").notNull().default(70),
  totalTicks:     integer("total_ticks").notNull().default(0),
  lastTickAt:     timestamp("last_tick_at").defaultNow().notNull(),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const worldSimLog = pgTable("world_sim_log", {
  id:              uuid("id").primaryKey().defaultRandom(),
  worldSlug:       varchar("world_slug", { length: 64 }).notNull(),
  tickNumber:      integer("tick_number").notNull().default(0),
  eventType:       varchar("event_type", { length: 32 }).notNull().default("tick"),
  eventName:       varchar("event_name", { length: 200 }).notNull().default(""),
  summary:         text("summary").notNull().default(""),
  aiNarrative:     text("ai_narrative").default(""),
  deltaPopulation: integer("delta_population").notNull().default(0),
  deltaEconomy:    real("delta_economy").notNull().default(0),
  deltaMood:       real("delta_mood").notNull().default(0),
  deltaStability:  real("delta_stability").notNull().default(0),
  happenedAt:      timestamp("happened_at").defaultNow().notNull(),
});

export type WorldSimState = typeof worldSimState.$inferSelect;
export type WorldSimLog = typeof worldSimLog.$inferSelect;
