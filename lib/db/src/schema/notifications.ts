import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  icon: text("icon").notNull().default("🔔"),
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
