import { pgTable, varchar, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const characterTitles = pgTable("character_titles", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  titleKey: varchar("title_key", { length: 64 }).notNull(),
  equipped: boolean("equipped").notNull().default(false),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export type CharacterTitle = typeof characterTitles.$inferSelect;
