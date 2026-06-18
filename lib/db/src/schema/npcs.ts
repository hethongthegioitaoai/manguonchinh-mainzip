import { pgTable, varchar, uuid, timestamp, text, boolean, jsonb, integer } from "drizzle-orm/pg-core";

export const npcs = pgTable("npcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("merchant"),
  goals: jsonb("goals").notNull().default([]),
  personality: text("personality").notNull().default(""),
  currentState: jsonb("current_state").notNull().default({}),
  lastTickAt: timestamp("last_tick_at"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NPC = typeof npcs.$inferSelect;
export type InsertNPC = typeof npcs.$inferInsert;
