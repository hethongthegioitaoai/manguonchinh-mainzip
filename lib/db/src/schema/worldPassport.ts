import { pgTable, uuid, varchar, integer, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const worldPassports = pgTable("world_passports", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  requestNote: text("request_note").notNull().default(""),
  creatorNote: text("creator_note").notNull().default(""),
  entryCount: integer("entry_count").notNull().default(0),
  bannedAt: timestamp("banned_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const worldEntryLog = pgTable("world_entry_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
  reason: varchar("reason", { length: 128 }).notNull().default("visit"),
});

export type WorldPassport = typeof worldPassports.$inferSelect;
export type WorldEntryLog = typeof worldEntryLog.$inferSelect;
