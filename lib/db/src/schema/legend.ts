import { pgTable, uuid, varchar, timestamp, text, integer, jsonb } from "drizzle-orm/pg-core";

export const legends = pgTable("legends", {
  id:            uuid("id").primaryKey().defaultRandom(),
  characterId:   uuid("character_id").notNull(),
  characterName: varchar("character_name", { length: 100 }).notNull(),
  userId:        varchar("user_id", { length: 100 }).notNull(),
  worldSlug:     varchar("world_slug", { length: 100 }).notNull(),
  worldName:     varchar("world_name", { length: 200 }).notNull(),
  system:        varchar("system", { length: 100 }).notNull().default("Bất Tử"),
  level:         integer("level").notNull().default(1),
  legendTitle:   varchar("legend_title", { length: 200 }).notNull(),
  epicStory:     text("epic_story").notNull(),
  achievements:  jsonb("achievements").default([]),
  stats:         jsonb("stats").default({}),
  votes:         integer("votes").notNull().default(0),
  viewed:        integer("viewed").notNull().default(0),
  inducedAt:     timestamp("induced_at").defaultNow().notNull(),
});

export const legendVotes = pgTable("legend_votes", {
  id:         uuid("id").primaryKey().defaultRandom(),
  legendId:   uuid("legend_id").notNull(),
  userId:     varchar("user_id", { length: 100 }).notNull(),
  votedAt:    timestamp("voted_at").defaultNow().notNull(),
});

export type Legend = typeof legends.$inferSelect;
export type LegendVote = typeof legendVotes.$inferSelect;
