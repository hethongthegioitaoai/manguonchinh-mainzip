import { pgTable, varchar, uuid, timestamp, integer, text, jsonb, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const dungeons = pgTable("dungeons", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(),
  difficulty: varchar("difficulty", { length: 16 }).notNull().default("normal"),
  floors: integer("floors").notNull().default(5),
  minLevel: integer("min_level").notNull().default(1),
  floorEnemyScale: integer("floor_enemy_scale").notNull().default(10),
  rewardMultiplier: integer("reward_multiplier").notNull().default(1),
  icon: varchar("icon", { length: 8 }).notNull().default("🏰"),
});

export const dungeonRuns = pgTable("dungeon_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  dungeonId: uuid("dungeon_id").notNull().references(() => dungeons.id),
  currentFloor: integer("current_floor").notNull().default(1),
  hpRemaining: integer("hp_remaining").notNull().default(100),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  loot: jsonb("loot").$type<{ floor: number; itemName: string; rarity: string; icon: string }[]>().default([]),
  totalExpGained: integer("total_exp_gained").notNull().default(0),
  completedFloors: integer("completed_floors").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export type Dungeon = typeof dungeons.$inferSelect;
export type DungeonRun = typeof dungeonRuns.$inferSelect;
export type InsertDungeonRun = typeof dungeonRuns.$inferInsert;
