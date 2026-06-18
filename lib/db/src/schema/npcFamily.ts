import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcFamilies = pgTable("npc_family", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId:      uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  spouseId:   uuid("spouse_id").references(() => npcCores.id, { onDelete: "set null" }),
  fatherId:   uuid("father_id").references(() => npcCores.id, { onDelete: "set null" }),
  motherId:   uuid("mother_id").references(() => npcCores.id, { onDelete: "set null" }),
  familyName: varchar("family_name", { length: 64 }),
  createdAt:  timestamp("created_at").defaultNow(),
  updatedAt:  timestamp("updated_at").defaultNow(),
});

export const npcFamilyMemories = pgTable("npc_family_memories", {
  id:        uuid("id").primaryKey().defaultRandom(),
  npcId:     uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  content:   text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const npcBirths = pgTable("npc_births", {
  id:        uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  childId:   uuid("child_id").references(() => npcCores.id, { onDelete: "set null" }),
  fatherId:  uuid("father_id").references(() => npcCores.id, { onDelete: "set null" }),
  motherId:  uuid("mother_id").references(() => npcCores.id, { onDelete: "set null" }),
  childName: varchar("child_name", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcFamily = typeof npcFamilies.$inferSelect;
export type InsertNpcFamily = typeof npcFamilies.$inferInsert;
export type NpcFamilyMemory = typeof npcFamilyMemories.$inferSelect;
export type NpcBirth = typeof npcBirths.$inferSelect;
