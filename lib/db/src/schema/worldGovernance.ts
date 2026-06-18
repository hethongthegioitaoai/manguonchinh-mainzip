import { pgTable, uuid, varchar, timestamp, text, jsonb, integer, boolean } from "drizzle-orm/pg-core";

export const worldConstitution = pgTable("world_constitution", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull().unique(),
  laws:         jsonb("laws").$type<Array<{ id: string; title: string; content: string; effect: string; addedAt: string }>>().default([]),
  taxPolicy:    jsonb("tax_policy").$type<{ rate: number; target: string; description: string }>().default({ rate: 10, target: "commerce", description: "Thuế thương mại tiêu chuẩn" }),
  entryPolicy:  varchar("entry_policy", { length: 50 }).notNull().default("open"),
  tradePolicy:  varchar("trade_policy", { length: 50 }).notNull().default("free"),
  warPolicy:    varchar("war_policy", { length: 50 }).notNull().default("defensive"),
  stability:    integer("stability").notNull().default(75),
  lastAmended:  timestamp("last_amended"),
  amendedBy:    varchar("amended_by", { length: 128 }),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const worldCouncil = pgTable("world_council", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull(),
  characterId:  uuid("character_id").notNull(),
  characterName: varchar("character_name", { length: 100 }).notNull().default(""),
  role:         varchar("role", { length: 50 }).notNull().default("citizen_rep"),
  votingPower:  integer("voting_power").notNull().default(1),
  appointedBy:  varchar("appointed_by", { length: 128 }),
  appointedAt:  timestamp("appointed_at").defaultNow().notNull(),
});

export const worldVotes = pgTable("world_votes", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:        varchar("world_slug", { length: 100 }).notNull(),
  proposedBy:       varchar("proposed_by", { length: 128 }).notNull(),
  proposerName:     varchar("proposer_name", { length: 100 }).notNull().default(""),
  proposalType:     varchar("proposal_type", { length: 50 }).notNull(),
  proposalTitle:    varchar("proposal_title", { length: 200 }).notNull().default(""),
  proposalContent:  text("proposal_content").notNull().default(""),
  votesFor:         integer("votes_for").notNull().default(0),
  votesAgainst:     integer("votes_against").notNull().default(0),
  status:           varchar("status", { length: 20 }).notNull().default("open"),
  executedAt:       timestamp("executed_at"),
  expiresAt:        timestamp("expires_at").notNull(),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  voters:           jsonb("voters").$type<string[]>().default([]),
});

export const worldDecrees = pgTable("world_decrees", {
  id:             uuid("id").primaryKey().defaultRandom(),
  worldSlug:      varchar("world_slug", { length: 100 }).notNull(),
  issuedBy:       varchar("issued_by", { length: 128 }).notNull(),
  issuerName:     varchar("issuer_name", { length: 100 }).notNull().default(""),
  decreeName:     varchar("decree_name", { length: 200 }).notNull(),
  decreeContent:  text("decree_content").notNull().default(""),
  loreText:       text("lore_text").default(""),
  effect:         jsonb("effect").$type<Record<string, any>>().default({}),
  stabilityDelta: integer("stability_delta").notNull().default(0),
  issuedAt:       timestamp("issued_at").defaultNow().notNull(),
  expiresAt:      timestamp("expires_at"),
  isActive:       boolean("is_active").notNull().default(true),
});

export type WorldConstitution = typeof worldConstitution.$inferSelect;
export type WorldCouncil = typeof worldCouncil.$inferSelect;
export type WorldVote = typeof worldVotes.$inferSelect;
export type WorldDecree = typeof worldDecrees.$inferSelect;
