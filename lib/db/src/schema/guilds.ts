import { pgTable, varchar, integer, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { characters } from "./characters";

export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  leaderId: uuid("leader_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  description: text("description").default(""),
  tag: varchar("tag", { length: 8 }).default(""),
  memberCount: integer("member_count").notNull().default(1),
  totalExp: integer("total_exp").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guildMembers = pgTable("guild_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: uuid("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export type Guild = typeof guilds.$inferSelect;
export type InsertGuild = typeof guilds.$inferInsert;
export type GuildMember = typeof guildMembers.$inferSelect;
export type InsertGuildMember = typeof guildMembers.$inferInsert;
