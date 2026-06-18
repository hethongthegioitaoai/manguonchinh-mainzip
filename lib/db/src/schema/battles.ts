import { pgTable, varchar, integer, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const battles = pgTable("battles", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  enemyName: varchar("enemy_name", { length: 128 }).notNull(),
  enemyLevel: integer("enemy_level").notNull(),
  battleMode: varchar("battle_mode", { length: 32 }).notNull(),
  result: varchar("result", { length: 16 }),
  expGained: integer("exp_gained").notNull().default(0),
  hpLeft: integer("hp_left"),
  duration: integer("duration"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Battle = typeof battles.$inferSelect;
export type InsertBattle = typeof battles.$inferInsert;
