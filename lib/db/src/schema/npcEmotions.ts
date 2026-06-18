import { pgTable, uuid, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcEmotions = pgTable("npc_emotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }).unique(),
  happiness: integer("happiness").notNull().default(50),
  anger: integer("anger").notNull().default(10),
  fear: integer("fear").notNull().default(10),
  sadness: integer("sadness").notNull().default(10),
  confidence: integer("confidence").notNull().default(50),
  stress: integer("stress").notNull().default(20),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const npcEmotionLogs = pgTable("npc_emotion_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  emotionType: varchar("emotion_type", { length: 32 }).notNull(),
  delta: integer("delta").notNull().default(0),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcEmotion = typeof npcEmotions.$inferSelect;
export type InsertNpcEmotion = typeof npcEmotions.$inferInsert;
export type NpcEmotionLog = typeof npcEmotionLogs.$inferSelect;
