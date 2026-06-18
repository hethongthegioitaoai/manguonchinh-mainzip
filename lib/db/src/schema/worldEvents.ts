import { pgTable, varchar, integer, uuid, timestamp, text, boolean } from "drizzle-orm/pg-core";

export const worldEvents = pgTable("world_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull().default("event"),
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  startAt: timestamp("start_at").defaultNow(),
  endAt: timestamp("end_at"),
  active: boolean("active").notNull().default(true),
  triggeredBy: varchar("triggered_by", { length: 32 }).notNull().default("ai"),
  karmaEffect: integer("karma_effect").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type WorldEvent = typeof worldEvents.$inferSelect;
export type InsertWorldEvent = typeof worldEvents.$inferInsert;
