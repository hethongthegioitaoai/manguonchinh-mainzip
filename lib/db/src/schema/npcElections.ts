import { pgTable, uuid, varchar, integer, text, timestamp, real } from "drizzle-orm/pg-core";
import { npcGovernments } from "./npcGovernment";
import { npcCores } from "./npcCore";
import { npcFactions } from "./npcFactions";

export const elections = pgTable("elections", {
  id:            uuid("id").primaryKey().defaultRandom(),
  governmentId:  uuid("government_id").notNull().references(() => npcGovernments.id, { onDelete: "cascade" }),
  electionType:  varchar("election_type", { length: 64 }).notNull().default("bầu_thị_trưởng"),
  status:        varchar("status", { length: 20 }).notNull().default("open"),
  startTick:     integer("start_tick").notNull().default(0),
  endTick:       integer("end_tick").notNull().default(0),
  totalVotes:    integer("total_votes").notNull().default(0),
  turnout:       real("turnout").notNull().default(0),
  winnerNpcId:   uuid("winner_npc_id").references(() => npcCores.id, { onDelete: "set null" }),
  winnerName:    varchar("winner_name", { length: 128 }).notNull().default(""),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  resolvedAt:    timestamp("resolved_at"),
});

export const electionCandidates = pgTable("election_candidates", {
  id:            uuid("id").primaryKey().defaultRandom(),
  electionId:    uuid("election_id").notNull().references(() => elections.id, { onDelete: "cascade" }),
  npcId:         uuid("npc_id").notNull().references(() => npcCores.id, { onDelete: "cascade" }),
  factionId:     uuid("faction_id").references(() => npcFactions.id, { onDelete: "set null" }),
  campaignScore: integer("campaign_score").notNull().default(0),
  totalVotes:    integer("total_votes").notNull().default(0),
  isIncumbent:   integer("is_incumbent").notNull().default(0),
});

export type Election          = typeof elections.$inferSelect;
export type ElectionCandidate = typeof electionCandidates.$inferSelect;
