import { pgTable, uuid, varchar, timestamp, text, integer, real } from "drizzle-orm/pg-core";

export const bankAccounts = pgTable("bank_accounts", {
  id:               uuid("id").primaryKey().defaultRandom(),
  characterId:      uuid("character_id").notNull().unique(),
  characterName:    varchar("character_name", { length: 100 }).notNull().default(""),
  worldSlug:        varchar("world_slug", { length: 100 }).notNull(),
  balance:          integer("balance").notNull().default(0),
  totalDeposited:   integer("total_deposited").notNull().default(0),
  totalWithdrawn:   integer("total_withdrawn").notNull().default(0),
  openedAt:         timestamp("opened_at").defaultNow().notNull(),
  lastInterestAt:   timestamp("last_interest_at").defaultNow().notNull(),
});

export const bankLoans = pgTable("bank_loans", {
  id:             uuid("id").primaryKey().defaultRandom(),
  characterId:    uuid("character_id").notNull(),
  worldSlug:      varchar("world_slug", { length: 100 }).notNull(),
  principal:      integer("principal").notNull(),
  interestRate:   real("interest_rate").notNull().default(0.05),
  totalOwed:      integer("total_owed").notNull(),
  dueAt:          timestamp("due_at").notNull(),
  status:         varchar("status", { length: 16 }).notNull().default("active"),
  takenAt:        timestamp("taken_at").defaultNow().notNull(),
  paidAt:         timestamp("paid_at"),
});

export const bankTransfers = pgTable("bank_transfers", {
  id:             uuid("id").primaryKey().defaultRandom(),
  fromCharId:     uuid("from_char_id").notNull(),
  toCharId:       uuid("to_char_id").notNull(),
  amount:         integer("amount").notNull(),
  fromCurrency:   varchar("from_currency", { length: 50 }).notNull().default("Gold"),
  toCurrency:     varchar("to_currency", { length: 50 }).notNull().default("Gold"),
  exchangeRate:   real("exchange_rate").notNull().default(1.0),
  fee:            integer("fee").notNull().default(0),
  note:           text("note").default(""),
  transferredAt:  timestamp("transferred_at").defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type BankLoan = typeof bankLoans.$inferSelect;
export type BankTransfer = typeof bankTransfers.$inferSelect;
