import { pgTable, uuid, varchar, integer, text, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { territories } from "./territories";

export const npcCores = pgTable("npc_cores", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  age: integer("age").notNull().default(25),
  occupation: varchar("occupation", { length: 64 }).notNull().default("Dân Thường"),
  money: integer("money").notNull().default(100),
  energy: integer("energy").notNull().default(100),
  hunger: integer("hunger").notNull().default(0),
  happiness: integer("happiness").notNull().default(70),
  currentGoal: text("current_goal"),
  lifeStage: varchar("life_stage", { length: 16 }).notNull().default("adult"),
  tickCount: integer("tick_count").notNull().default(0),
  active: integer("active").notNull().default(1),
  lastTickAt: timestamp("last_tick_at"),
  createdAt: timestamp("created_at").defaultNow(),
  territoryId: uuid("territory_id").references(() => territories.id, { onDelete: "set null" }),
});

export const npcPersonalities = pgTable("npc_personalities", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  kindness: real("kindness").notNull().default(0.5),
  greed: real("greed").notNull().default(0.5),
  bravery: real("bravery").notNull().default(0.5),
  intelligence: real("intelligence").notNull().default(0.5),
  curiosity: real("curiosity").notNull().default(0.5),
});

export const npcCoreMemories = pgTable("npc_core_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  importance: integer("importance").notNull().default(1),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const npcRelationships = pgTable("npc_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcAId: uuid("npc_a_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  npcBId: uuid("npc_b_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  relationshipScore: integer("relationship_score").notNull().default(0),
  relationshipType: varchar("relationship_type", { length: 32 }).notNull().default("người lạ"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const npcJobs = pgTable("npc_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  jobType: varchar("job_type", { length: 64 }).notNull().default("thương nhân"),
  salary: integer("salary").notNull().default(20),
  skillLevel: real("skill_level").notNull().default(0.5),
});

export const npcInventory = pgTable("npc_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  itemName: varchar("item_name", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
});

export const npcTransactions = pgTable("npc_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: integer("amount").notNull().default(0),
  transactionType: varchar("transaction_type", { length: 16 }).notNull().default("earn"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const worldMarket = pgTable("world_market", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  itemName: varchar("item_name", { length: 64 }).notNull(),
  currentPrice: integer("current_price").notNull().default(8),
  totalSupply: integer("total_supply").notNull().default(0),
  totalDemand: integer("total_demand").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const marketOrders = pgTable("market_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcId: uuid("npc_id").references(() => npcCores.id, { onDelete: "cascade" }),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  itemName: varchar("item_name", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  orderType: varchar("order_type", { length: 8 }).notNull().default("mua"),
  price: integer("price").notNull().default(8),
  status: varchar("status", { length: 16 }).notNull().default("filled"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const npcPersonalityHistory = pgTable("npc_personality_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  kindness: real("kindness").notNull(),
  greed: real("greed").notNull(),
  bravery: real("bravery").notNull(),
  intelligence: real("intelligence").notNull(),
  curiosity: real("curiosity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const npcPersonalityLogs = pgTable("npc_personality_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  npcCoreId: uuid("npc_core_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  trait: varchar("trait", { length: 32 }).notNull(),
  delta: real("delta").notNull(),
  cause: text("cause").notNull(),
  causeType: varchar("cause_type", { length: 32 }).notNull().default("memory"),
  journal: text("journal").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NpcCore = typeof npcCores.$inferSelect;
export type InsertNpcCore = typeof npcCores.$inferInsert;
export type NpcPersonality = typeof npcPersonalities.$inferSelect;
export type NpcCoreMemory = typeof npcCoreMemories.$inferSelect;
export type NpcRelationship = typeof npcRelationships.$inferSelect;
export type NpcJob = typeof npcJobs.$inferSelect;
export type NpcInventoryItem = typeof npcInventory.$inferSelect;
export type NpcTransaction = typeof npcTransactions.$inferSelect;
export type NpcPersonalityHistory = typeof npcPersonalityHistory.$inferSelect;
export type NpcPersonalityLog = typeof npcPersonalityLogs.$inferSelect;
