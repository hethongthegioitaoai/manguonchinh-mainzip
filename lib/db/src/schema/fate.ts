import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const fateEvents = pgTable("fate_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  fateNumber: integer("fate_number").notNull(),
  eventType: varchar("event_type", { length: 16 }).notNull(), // "cat" | "hung" | "trung_binh"
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  effect: jsonb("effect").notNull().default({}), // { expBonus, goldBonus, dropBoostPct, critBoostPct, expPenalty, ... }
  duration: integer("duration_hours").notNull().default(4),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fateReadings = pgTable("fate_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  fateNumber: integer("fate_number").notNull(),
  hexagram: varchar("hexagram", { length: 8 }).notNull(), // ☰☱☲☳☴☵☶☷
  hexagramName: varchar("hexagram_name", { length: 64 }).notNull(),
  reading: text("reading").notNull(),
  advice: text("advice").notNull(),
  luckyElement: varchar("lucky_element", { length: 32 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FateEvent = typeof fateEvents.$inferSelect;
export type FateReading = typeof fateReadings.$inferSelect;
