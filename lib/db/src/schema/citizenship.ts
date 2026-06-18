import { pgTable, uuid, varchar, timestamp, text, integer, boolean } from "drizzle-orm/pg-core";

export const citizenships = pgTable("citizenships", {
  id:              uuid("id").primaryKey().defaultRandom(),
  characterId:     uuid("character_id").notNull(),
  characterName:   varchar("character_name", { length: 100 }),
  userId:          varchar("user_id", { length: 100 }).notNull(),
  worldSlug:       varchar("world_slug", { length: 100 }).notNull(),
  worldName:       varchar("world_name", { length: 200 }),
  status:          varchar("status", { length: 20 }).notNull().default("pending"),
  applicationNote: text("application_note").default(""),
  approvalNote:    text("approval_note").default(""),
  annualTax:       integer("annual_tax").notNull().default(200),
  appliedAt:       timestamp("applied_at").defaultNow().notNull(),
  approvedAt:      timestamp("approved_at"),
  taxPaidAt:       timestamp("tax_paid_at"),
  revokedAt:       timestamp("revoked_at"),
});

export const citizenshipBenefits = pgTable("citizenship_benefits", {
  worldSlug:          varchar("world_slug", { length: 100 }).primaryKey(),
  tradeTaxDiscount:   integer("trade_tax_discount").notNull().default(20),
  voteEligible:       boolean("vote_eligible").notNull().default(true),
  eventNotify:        boolean("event_notify").notNull().default(true),
  maxCitizens:        integer("max_citizens").notNull().default(50),
  annualTaxAmount:    integer("annual_tax_amount").notNull().default(200),
  welcomeMessage:     text("welcome_message").default(""),
  updatedAt:          timestamp("updated_at").defaultNow(),
});

export type Citizenship = typeof citizenships.$inferSelect;
export type CitizenshipBenefit = typeof citizenshipBenefits.$inferSelect;
