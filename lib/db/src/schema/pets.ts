import { pgTable, varchar, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const pets = pgTable("pets", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 64 }).notNull(),
  species: varchar("species", { length: 64 }).notNull(),
  icon: varchar("icon", { length: 8 }).notNull(),
  worldSlug: varchar("world_slug", { length: 32 }).notNull(),
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"),
  tier: integer("tier").notNull().default(1),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  bondLevel: integer("bond_level").notNull().default(0),
  skills: jsonb("skills").$type<{
    expBonus: number;
    goldBonus: number;
    critBonus: number;
    hpBonus: number;
  }>().notNull().default({ expBonus: 0, goldBonus: 0, critBonus: 0, hpBonus: 0 }),
  isActive: integer("is_active").notNull().default(0),
  lastFedAt: timestamp("last_fed_at"),
  lastSummonedAt: timestamp("last_summoned_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Pet = typeof pets.$inferSelect;
export type InsertPet = typeof pets.$inferInsert;
