import { pgTable, uuid, varchar, timestamp, text, jsonb, integer } from "drizzle-orm/pg-core";

export const worldWars = pgTable("world_wars", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  attackerWorldSlug:   varchar("attacker_world_slug", { length: 100 }).notNull(),
  defenderWorldSlug:   varchar("defender_world_slug", { length: 100 }).notNull(),
  attackerWorldName:   varchar("attacker_world_name", { length: 200 }).notNull().default(""),
  defenderWorldName:   varchar("defender_world_name", { length: 200 }).notNull().default(""),
  declaredByUserId:    varchar("declared_by_user_id", { length: 128 }).notNull(),
  warReason:           text("war_reason").notNull().default(""),
  attackerScore:       integer("attacker_score").notNull().default(0),
  defenderScore:       integer("defender_score").notNull().default(0),
  status:              varchar("status", { length: 16 }).notNull().default("active"),
  winnerId:            varchar("winner_id", { length: 100 }),
  territory:           jsonb("territory").$type<Record<string, any>>().default({}),
  warBulletin:         text("war_bulletin").default(""),
  lastBulletinAt:      timestamp("last_bulletin_at"),
  declaredAt:          timestamp("declared_at").defaultNow().notNull(),
  endsAt:              timestamp("ends_at").notNull(),
});

export const warContributions = pgTable("war_contributions", {
  id:            uuid("id").primaryKey().defaultRandom(),
  warId:         uuid("war_id").notNull().references(() => worldWars.id, { onDelete: "cascade" }),
  characterId:   uuid("character_id").notNull(),
  characterName: varchar("character_name", { length: 100 }).notNull().default(""),
  worldSlug:     varchar("world_slug", { length: 100 }).notNull(),
  pvpKills:      integer("pvp_kills").notNull().default(0),
  pvpDeaths:     integer("pvp_deaths").notNull().default(0),
  contribution:  integer("contribution").notNull().default(0),
  recordedAt:    timestamp("recorded_at").defaultNow().notNull(),
});

export type WorldWar = typeof worldWars.$inferSelect;
export type WarContribution = typeof warContributions.$inferSelect;
