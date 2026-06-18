import { pgTable, varchar, uuid, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const dailyLogins = pgTable("daily_logins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  loginDate: date("login_date").notNull(),
  streak: integer("streak").notNull().default(1),
  rewardClaimed: boolean("reward_claimed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DailyLogin = typeof dailyLogins.$inferSelect;
export type InsertDailyLogin = typeof dailyLogins.$inferInsert;
