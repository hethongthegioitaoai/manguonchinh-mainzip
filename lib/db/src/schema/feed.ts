import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const storyPosts = pgTable("story_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  worldSlug: varchar("world_slug", { length: 64 }).notNull(),
  authorName: varchar("author_name", { length: 128 }).notNull(),
  authorSystem: varchar("author_system", { length: 64 }).notNull().default(""),
  authorLevel: integer("author_level").notNull().default(1),
  content: text("content").notNull(),
  postType: varchar("post_type", { length: 32 }).notNull().default("manual"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postLikes = pgTable("post_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => storyPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StoryPost = typeof storyPosts.$inferSelect;
export type PostLike = typeof postLikes.$inferSelect;
