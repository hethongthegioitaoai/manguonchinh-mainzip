import { pgTable, uuid, varchar, timestamp, text, jsonb, integer, boolean } from "drizzle-orm/pg-core";

export const tournaments = pgTable("tournaments", {
  id:               uuid("id").primaryKey().defaultRandom(),
  season:           integer("season").notNull().default(1),
  status:           varchar("status", { length: 16 }).notNull().default("registration"),
  bracket:          jsonb("bracket").$type<Record<string, any>>().default({}),
  prizePool:        integer("prize_pool").notNull().default(0),
  participantCount: integer("participant_count").notNull().default(0),
  maxParticipants:  integer("max_participants").notNull().default(16),
  winnerId:         uuid("winner_id"),
  winnerName:       varchar("winner_name", { length: 100 }),
  startAt:          timestamp("start_at").notNull(),
  endAt:            timestamp("end_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tournamentId:   uuid("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  characterId:    uuid("character_id").notNull(),
  characterName:  varchar("character_name", { length: 100 }).notNull(),
  worldSlug:      varchar("world_slug", { length: 100 }).notNull(),
  seed:           integer("seed"),
  isEliminated:   boolean("is_eliminated").notNull().default(false),
  registeredAt:   timestamp("registered_at").defaultNow().notNull(),
});

export const tournamentMatches = pgTable("tournament_matches", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tournamentId:   uuid("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  round:          integer("round").notNull(),
  matchIndex:     integer("match_index").notNull(),
  char1Id:        uuid("char1_id"),
  char1Name:      varchar("char1_name", { length: 100 }),
  char2Id:        uuid("char2_id"),
  char2Name:      varchar("char2_name", { length: 100 }),
  winnerId:       uuid("winner_id"),
  winnerName:     varchar("winner_name", { length: 100 }),
  battleLog:      jsonb("battle_log").$type<any[]>().default([]),
  aiCommentary:   text("ai_commentary").default(""),
  status:         varchar("status", { length: 16 }).notNull().default("pending"),
  foughtAt:       timestamp("fought_at"),
});

export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
