import { pgTable, uuid, varchar, timestamp, text, integer } from "drizzle-orm/pg-core";

export const worldUniqueSkills = pgTable("world_unique_skills", {
  id:            uuid("id").primaryKey().defaultRandom(),
  worldSlug:     varchar("world_slug", { length: 100 }).notNull(),
  skillName:     varchar("skill_name", { length: 200 }).notNull(),
  skillDesc:     text("skill_desc").default(""),
  buffType:      varchar("buff_type", { length: 50 }).notNull().default("exp_bonus"),
  buffValue:     integer("buff_value").notNull().default(10),
  requiredLevel: integer("required_level").notNull().default(5),
  learnCost:     integer("learn_cost").notNull().default(300),
  learners:      integer("learners").notNull().default(0),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export const characterWorldSkills = pgTable("character_world_skills", {
  id:           uuid("id").primaryKey().defaultRandom(),
  characterId:  uuid("character_id").notNull(),
  userId:       varchar("user_id", { length: 100 }).notNull(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull(),
  skillId:      uuid("skill_id").notNull(),
  skillName:    varchar("skill_name", { length: 200 }).notNull(),
  buffType:     varchar("buff_type", { length: 50 }).notNull(),
  buffValue:    integer("buff_value").notNull().default(10),
  level:        integer("level").notNull().default(1),
  learnedAt:    timestamp("learned_at").defaultNow().notNull(),
});

export type WorldUniqueSkill = typeof worldUniqueSkills.$inferSelect;
export type CharacterWorldSkill = typeof characterWorldSkills.$inferSelect;
