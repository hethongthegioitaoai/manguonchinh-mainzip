import { pgTable, uuid, varchar, timestamp, text, integer, boolean } from "drizzle-orm/pg-core";

export const bounties = pgTable("bounties", {
  id:              uuid("id").primaryKey().defaultRandom(),
  postedByCharId:  uuid("posted_by_char_id").notNull(),
  postedByName:    varchar("posted_by_name", { length: 100 }).notNull().default(""),
  targetCharId:    uuid("target_char_id").notNull(),
  targetCharName:  varchar("target_char_name", { length: 100 }).notNull().default(""),
  targetWorldSlug: varchar("target_world_slug", { length: 100 }).notNull(),
  reward:          integer("reward").notNull(),
  reason:          text("reason").default(""),
  status:          varchar("status", { length: 16 }).notNull().default("active"),
  claimedByCharId: uuid("claimed_by_char_id"),
  claimedByName:   varchar("claimed_by_name", { length: 100 }),
  postedAt:        timestamp("posted_at").defaultNow().notNull(),
  expiresAt:       timestamp("expires_at").notNull(),
  claimedAt:       timestamp("claimed_at"),
});

export const bountyClaims = pgTable("bounty_claims", {
  id:            uuid("id").primaryKey().defaultRandom(),
  bountyId:      uuid("bounty_id").notNull().references(() => bounties.id, { onDelete: "cascade" }),
  claimerCharId: uuid("claimer_char_id").notNull(),
  claimerName:   varchar("claimer_name", { length: 100 }).notNull().default(""),
  battleId:      uuid("battle_id"),
  note:          text("note").default(""),
  status:        varchar("status", { length: 16 }).notNull().default("pending"),
  claimedAt:     timestamp("claimed_at").defaultNow().notNull(),
  approvedAt:    timestamp("approved_at"),
});

export type Bounty = typeof bounties.$inferSelect;
export type BountyClaim = typeof bountyClaims.$inferSelect;
