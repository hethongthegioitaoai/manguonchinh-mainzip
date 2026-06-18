import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { npcGovernments } from "./npcGovernment";

export const diplomaticRelations = pgTable("diplomatic_relations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  governmentAId: uuid("government_a_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  governmentBId: uuid("government_b_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  relationScore: integer("relation_score").notNull().default(0),
  relationType:  text("relation_type").notNull().default("trung_lập"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const diplomaticTreaties = pgTable("diplomatic_treaties", {
  id:            uuid("id").primaryKey().defaultRandom(),
  governmentAId: uuid("government_a_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  governmentBId: uuid("government_b_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  treatyType:    text("treaty_type").notNull(),
  startDate:     timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
  endDate:       timestamp("end_date", { withTimezone: true }),
  status:        text("status").notNull().default("active"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const diplomaticMemories = pgTable("diplomatic_memories", {
  id:           uuid("id").primaryKey().defaultRandom(),
  governmentId: uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  targetGovId:  uuid("target_gov_id").references(() => npcGovernments.id, { onDelete: "set null" }),
  event:        text("event").notNull(),
  scoreChange:  integer("score_change").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
