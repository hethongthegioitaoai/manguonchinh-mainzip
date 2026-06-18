import { pgTable, uuid, varchar, timestamp, text, integer, boolean, real } from "drizzle-orm/pg-core";

export const landPlots = pgTable("land_plots", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:        varchar("world_slug", { length: 100 }).notNull(),
  plotName:         varchar("plot_name", { length: 200 }).notNull(),
  plotType:         varchar("plot_type", { length: 20 }).notNull().default("farmland"),
  tier:             integer("tier").notNull().default(1),
  ownerId:          varchar("owner_id", { length: 100 }),
  ownerCharId:      uuid("owner_char_id"),
  ownerCharName:    varchar("owner_char_name", { length: 100 }),
  baseIncome:       integer("base_income").notNull().default(5),
  upgradeLevel:     integer("upgrade_level").notNull().default(1),
  purchasePrice:    integer("purchase_price").notNull(),
  lastCollectedAt:  timestamp("last_collected_at").defaultNow(),
  purchasedAt:      timestamp("purchased_at"),
  isForSale:        boolean("is_for_sale").notNull().default(true),
  salePrice:        integer("sale_price"),
  description:      text("description").default(""),
});

export const landTransactions = pgTable("land_transactions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  plotId:          uuid("plot_id").notNull().references(() => landPlots.id, { onDelete: "cascade" }),
  fromCharId:      uuid("from_char_id"),
  toCharId:        uuid("to_char_id"),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(),
  amount:          integer("amount").notNull().default(0),
  notes:           text("notes").default(""),
  transactionAt:   timestamp("transaction_at").defaultNow().notNull(),
});

export type LandPlot = typeof landPlots.$inferSelect;
export type LandTransaction = typeof landTransactions.$inferSelect;
