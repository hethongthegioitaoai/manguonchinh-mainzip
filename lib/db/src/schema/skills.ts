import { pgTable, varchar, timestamp, uuid } from "drizzle-orm/pg-core";
import { characters } from "./characters";

export const characterSkills = pgTable("character_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  skillId: varchar("skill_id", { length: 64 }).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export type CharacterSkill = typeof characterSkills.$inferSelect;
export type InsertCharacterSkill = typeof characterSkills.$inferInsert;
