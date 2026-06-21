import { pgTable, varchar, uuid, timestamp, text, integer, jsonb, index } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const characterMemories = pgTable("character_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  memoryType: varchar("memory_type", { length: 32 }).notNull().default("event"),
  content: text("content").notNull(),
  importance: integer("importance").notNull().default(1),
  worldSlug: varchar("world_slug", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const npcMemories = pgTable("npc_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcKey: varchar("npc_key", { length: 128 }).notNull(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  relationship: integer("relationship").notNull().default(0),
  lastInteraction: timestamp("last_interaction").defaultNow(),
  notes: text("notes").default(""),
}, (t) => ({
  characterIdx:    index("npc_memories_character_idx").on(t.characterId),
  npcKeyIdx:       index("npc_memories_npc_key_idx").on(t.npcKey),
}));

export const worldMemories = pgTable("world_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull().default("event"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  happenedAt: timestamp("happened_at").defaultNow(),
});

export type CharacterMemory = typeof characterMemories.$inferSelect;
export type InsertCharacterMemory = typeof characterMemories.$inferInsert;
export type NpcMemory = typeof npcMemories.$inferSelect;
export type WorldMemory = typeof worldMemories.$inferSelect;
