import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const isekaiRecords = pgTable("isekai_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  fromCharacterId: uuid("from_character_id").references(() => characters.id, { onDelete: "set null" }),
  fromWorldSlug: varchar("from_world_slug", { length: 64 }).notNull(),
  toWorldSlug: varchar("to_world_slug", { length: 64 }).notNull(),
  isekaiName: varchar("isekai_name", { length: 64 }).notNull(),
  isekaiClass: varchar("isekai_class", { length: 64 }).notNull(),
  openingNarrative: text("opening_narrative").notNull(),
  systemGrant: text("system_grant").notNull().default(""),
  systemAbility: varchar("system_ability", { length: 128 }).notNull().default(""),
  worldReaction: text("world_reaction").notNull().default(""),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IsekaiRecord = typeof isekaiRecords.$inferSelect;
