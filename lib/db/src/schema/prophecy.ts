import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const prophecies = pgTable("prophecies", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  content: text("content").notNull(),
  hiddenCondition: text("hidden_condition").notNull().default(""),
  clue: text("clue").notNull().default(""),
  reward: jsonb("reward").notNull().default({ exp: 500, gold: 200, title: "Kẻ Giải Mã Tiên Tri" }),
  isActive: boolean("is_active").notNull().default(true),
  fulfilledAt: timestamp("fulfilled_at"),
  fulfilledBy: uuid("fulfilled_by").references(() => characters.id, { onDelete: "set null" }),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const prophecyClaims = pgTable("prophecy_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  prophecyId: uuid("prophecy_id").notNull().references(() => prophecies.id, { onDelete: "cascade" }),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  proof: text("proof").notNull(),
  score: integer("score").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  judgedAt: timestamp("judged_at"),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

export type Prophecy = typeof prophecies.$inferSelect;
export type ProphecyClaim = typeof prophecyClaims.$inferSelect;
