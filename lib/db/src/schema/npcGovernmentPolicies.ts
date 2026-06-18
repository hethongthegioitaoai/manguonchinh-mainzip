import { pgTable, uuid, varchar, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { npcGovernments } from "./npcGovernment";

export const governmentPolicies = pgTable("government_policies", {
  id:               uuid("id").primaryKey().defaultRandom(),
  name:             varchar("name", { length: 128 }).notNull(),
  category:         varchar("category", { length: 64 }).notNull().default("kinh_tế"),
  description:      text("description").notNull().default(""),
  effects:          jsonb("effects").$type<{
    taxAdjust:         number;
    approvalAdjust:    number;
    foodAdjust:        number;
    securityAdjust:    number;
    prosperityAdjust:  number;
    tradeAdjust:       number;
    treasuryCostPerTick: number;
  }>().notNull().default({
    taxAdjust: 0, approvalAdjust: 0, foodAdjust: 0,
    securityAdjust: 0, prosperityAdjust: 0, tradeAdjust: 0,
    treasuryCostPerTick: 0,
  }),
  isDefault:        integer("is_default").notNull().default(1),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const governmentActivePolicies = pgTable("government_active_policies", {
  id:           uuid("id").primaryKey().defaultRandom(),
  governmentId: uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  policyId:     uuid("policy_id").notNull().references(() => governmentPolicies.id, { onDelete: "cascade" }),
  activatedAt:  timestamp("activated_at").defaultNow().notNull(),
});

export const governmentPolicyHistory = pgTable("government_policy_history", {
  id:            uuid("id").primaryKey().defaultRandom(),
  governmentId:  uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  policyId:      uuid("policy_id").notNull().references(() => governmentPolicies.id, { onDelete: "cascade" }),
  policyName:    varchar("policy_name", { length: 128 }).notNull().default(""),
  leaderName:    varchar("leader_name", { length: 128 }).notNull().default("Không rõ"),
  action:        varchar("action", { length: 16 }).notNull().default("activate"),
  activatedAt:   timestamp("activated_at").notNull(),
  deactivatedAt: timestamp("deactivated_at"),
});

export type GovernmentPolicy        = typeof governmentPolicies.$inferSelect;
export type GovernmentActivePolicy  = typeof governmentActivePolicies.$inferSelect;
export type GovernmentPolicyHistory = typeof governmentPolicyHistory.$inferSelect;
