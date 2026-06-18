import { pgTable, uuid, varchar, integer, numeric, timestamp, text } from "drizzle-orm/pg-core";

export const worldCurrencies = pgTable("world_currencies", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  worldSlug:         varchar("world_slug", { length: 100 }).notNull().unique(),
  worldName:         varchar("world_name", { length: 200 }).notNull().default(""),
  currencyName:      varchar("currency_name", { length: 100 }).notNull(),
  currencySymbol:    varchar("currency_symbol", { length: 20 }).notNull(),
  currencyLore:      text("currency_lore").default(""),
  exchangeRateToGold: numeric("exchange_rate_to_gold", { precision: 10, scale: 4 }).notNull().default("1.0000"),
  totalSupply:       integer("total_supply").notNull().default(1000000),
  reserveGold:       integer("reserve_gold").notNull().default(0),
  volume24h:         integer("volume_24h").notNull().default(0),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
});

export const worldTreasury = pgTable("world_treasury", {
  id:               uuid("id").primaryKey().defaultRandom(),
  worldSlug:       varchar("world_slug", { length: 100 }).notNull().unique(),
  balance:         integer("balance").notNull().default(0),
  taxRate:         integer("tax_rate").notNull().default(5),
  totalRevenue:    integer("total_revenue").notNull().default(0),
  totalExpenditure: integer("total_expenditure").notNull().default(0),
  lastUpdated:     timestamp("last_updated").defaultNow().notNull(),
});

export const currencyExchanges = pgTable("currency_exchanges", {
  id:              uuid("id").primaryKey().defaultRandom(),
  fromWorldSlug:  varchar("from_world_slug", { length: 100 }).notNull(),
  toWorldSlug:    varchar("to_world_slug", { length: 100 }).notNull(),
  fromAmount:     integer("from_amount").notNull(),
  toAmount:       integer("to_amount").notNull(),
  rate:           numeric("rate", { precision: 12, scale: 6 }).notNull(),
  feeGold:        integer("fee_gold").notNull().default(0),
  executedByCharId: uuid("executed_by_char_id"),
  executorName:   varchar("executor_name", { length: 100 }).default(""),
  executedAt:     timestamp("executed_at").defaultNow().notNull(),
});
