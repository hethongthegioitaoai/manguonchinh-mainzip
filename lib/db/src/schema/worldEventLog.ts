import { pgTable, uuid, varchar, integer, jsonb, bigint, timestamp, index } from "drizzle-orm/pg-core";

export const worldEventLog = pgTable("world_event_log", {
  id:        uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  tick:      integer("tick").notNull().default(0),
  event:     varchar("event", { length: 64 }).notNull(),
  payload:   jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  ts:        bigint("ts", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  worldTickIdx:    index("world_event_log_world_tick_idx").on(t.worldSlug, t.tick),
  worldTsIdx:      index("world_event_log_world_ts_idx").on(t.worldSlug, t.ts),
  worldEventTsIdx: index("world_event_log_world_event_ts_idx").on(t.worldSlug, t.event, t.ts),
}));

export type WorldEventLogRow    = typeof worldEventLog.$inferSelect;
export type InsertWorldEventLog = typeof worldEventLog.$inferInsert;
