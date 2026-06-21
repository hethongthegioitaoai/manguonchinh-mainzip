import { pgTable, uuid, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { npcCores } from "./npcCore";

export const npcFactions = pgTable("npc_factions", {
  id:             uuid("id").primaryKey().defaultRandom(),
  worldSlug:      varchar("world_slug", { length: 64 }).notNull(),
  name:           varchar("name", { length: 128 }).notNull(),
  type:           varchar("type", { length: 32 }).notNull().default("merchant_guild"),
  leaderNpcId:    uuid("leader_npc_id").references(() => npcCores.id, { onDelete: "set null" }),
  treasury:       integer("treasury").notNull().default(0),
  reputation:     integer("reputation").notNull().default(50),
  influence:      integer("influence").notNull().default(0),
  militaryPower:  integer("military_power").notNull().default(0),
  createdAt:      timestamp("created_at").defaultNow(),
  updatedAt:      timestamp("updated_at").defaultNow(),
});

export const npcFactionMembers = pgTable("npc_faction_members", {
  id:        uuid("id").primaryKey().defaultRandom(),
  factionId: uuid("faction_id").notNull().references(() => npcFactions.id, { onDelete: "cascade" }),
  npcId:     uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  role:      varchar("role", { length: 32 }).notNull().default("member"),
  joinedAt:  timestamp("joined_at").defaultNow(),
});

export const npcFactionMemories = pgTable("npc_faction_memories", {
  id:        uuid("id").primaryKey().defaultRandom(),
  npcId:     uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  factionId: uuid("faction_id").references(() => npcFactions.id, { onDelete: "set null" }),
  content:   text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcFaction = typeof npcFactions.$inferSelect;
export type InsertNpcFaction = typeof npcFactions.$inferInsert;
export type NpcFactionMember = typeof npcFactionMembers.$inferSelect;
export type NpcFactionMemory = typeof npcFactionMemories.$inferSelect;
