import { pgTable, uuid, varchar, timestamp, text, jsonb, boolean } from "drizzle-orm/pg-core";

export const worldWeather = pgTable("world_weather", {
  id:           uuid("id").primaryKey().defaultRandom(),
  worldSlug:    varchar("world_slug", { length: 100 }).notNull(),
  weatherType:  varchar("weather_type", { length: 30 }).notNull(),
  weatherName:  varchar("weather_name", { length: 200 }).notNull(),
  intensity:    varchar("intensity", { length: 16 }).notNull().default("moderate"),
  description:  text("description").notNull().default(""),
  aiNarrative:  text("ai_narrative").default(""),
  effects:      jsonb("effects").$type<{ expMult: number; goldMult: number; harvestMult: number; battleMult: number }>().default({ expMult: 1, goldMult: 1, harvestMult: 1, battleMult: 1 }),
  isActive:     boolean("is_active").notNull().default(true),
  startsAt:     timestamp("starts_at").defaultNow().notNull(),
  endsAt:       timestamp("ends_at").notNull(),
  generatedAt:  timestamp("generated_at").defaultNow().notNull(),
});

export type WorldWeather = typeof worldWeather.$inferSelect;
