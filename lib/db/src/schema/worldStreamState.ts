import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const worldStreamState = pgTable("world_stream_state", {
  worldSlug:    varchar("world_slug", { length: 64 }).primaryKey(),
  lastTickSent: integer("last_tick_sent").notNull().default(0),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export type WorldStreamState = typeof worldStreamState.$inferSelect;
export type InsertWorldStreamState = typeof worldStreamState.$inferInsert;
