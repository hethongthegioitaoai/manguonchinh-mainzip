import { pgTable, varchar, uuid, timestamp, integer, boolean, text } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const clanWars = pgTable("clan_wars", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId1: uuid("guild_id_1").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  guildId2: uuid("guild_id_2").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  guildName1: varchar("guild_name_1", { length: 128 }).notNull(),
  guildName2: varchar("guild_name_2", { length: 128 }).notNull(),
  score1: integer("score_1").notNull().default(0),
  score2: integer("score_2").notNull().default(0),
  active: boolean("active").notNull().default(true),
  winnerId: uuid("winner_id"),
  startAt: timestamp("start_at").defaultNow(),
  endAt: timestamp("end_at"),
  rewardDistributed: boolean("reward_distributed").notNull().default(false),
  note: text("note"),
});

export type ClanWar = typeof clanWars.$inferSelect;
export type InsertClanWar = typeof clanWars.$inferInsert;
