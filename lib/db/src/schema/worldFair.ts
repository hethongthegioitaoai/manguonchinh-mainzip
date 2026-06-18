import { pgTable, uuid, varchar, timestamp, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const worldFairs = pgTable("world_fairs", {
  id:             uuid("id").primaryKey().defaultRandom(),
  season:         integer("season").notNull().default(1),
  status:         varchar("status", { length: 20 }).notNull().default("active"),
  theme:          varchar("theme", { length: 200 }).notNull().default("Hội Chợ Liên Thế Giới"),
  description:    text("description").default(""),
  startAt:        timestamp("start_at").defaultNow().notNull(),
  endsAt:         timestamp("ends_at").notNull(),
  totalVisits:    integer("total_visits").notNull().default(0),
  prizePot:       integer("prize_pot").notNull().default(0),
  winnerWorldSlug: varchar("winner_world_slug", { length: 100 }),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const fairBooths = pgTable("fair_booths", {
  id:              uuid("id").primaryKey().defaultRandom(),
  fairId:          uuid("fair_id").notNull().references(() => worldFairs.id, { onDelete: "cascade" }),
  worldSlug:       varchar("world_slug", { length: 100 }).notNull(),
  worldName:       varchar("world_name", { length: 200 }).notNull(),
  boothName:       varchar("booth_name", { length: 200 }).notNull(),
  description:     text("description").default(""),
  aiNarrative:     text("ai_narrative").default(""),
  specialItems:    jsonb("special_items").default([]),
  entryFee:        integer("entry_fee").notNull().default(0),
  votes:           integer("votes").notNull().default(0),
  visits:          integer("visits").notNull().default(0),
  featured:        boolean("featured").notNull().default(false),
  ownerId:         varchar("owner_id", { length: 100 }),
  ownerName:       varchar("owner_name", { length: 100 }),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export const fairVisits = pgTable("fair_visits", {
  id:            uuid("id").primaryKey().defaultRandom(),
  fairId:        uuid("fair_id").notNull(),
  boothId:       uuid("booth_id").notNull(),
  characterId:   uuid("character_id").notNull(),
  userId:        varchar("user_id", { length: 100 }).notNull(),
  goldSpent:     integer("gold_spent").notNull().default(0),
  voted:         boolean("voted").notNull().default(false),
  visitedAt:     timestamp("visited_at").defaultNow().notNull(),
});

export type WorldFair = typeof worldFairs.$inferSelect;
export type FairBooth = typeof fairBooths.$inferSelect;
export type FairVisit = typeof fairVisits.$inferSelect;
