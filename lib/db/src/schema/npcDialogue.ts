import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcDialogueSessions = pgTable("npc_dialogue_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  playerId: varchar("player_id", { length: 128 }).notNull().default("guest"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const npcDialogueMemories = pgTable("npc_dialogue_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  playerId: varchar("player_id", { length: 128 }).notNull().default("guest"),
  content: text("content").notNull(),
  significance: varchar("significance", { length: 32 }).notNull().default("neutral"),
  relatedMessage: text("related_message").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcDialogueSession = typeof npcDialogueSessions.$inferSelect;
export type NpcDialogueMemory = typeof npcDialogueMemories.$inferSelect;
export type DialogueMessage = { role: "player" | "npc"; content: string; timestamp: string };
