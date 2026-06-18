import {
  pgTable, uuid, varchar, text, jsonb, timestamp,
  integer, real, boolean,
} from "drizzle-orm/pg-core";
import { characters } from "./characters";
import { users } from "./auth";
import { territories } from "./territories";

/* ─────────────────────────────────────────────────
   PLAYER AGENT — core entity extending characters
───────────────────────────────────────────────── */
export const playerAgents = pgTable("player_agents", {
  id:              uuid("id").primaryKey().defaultRandom(),
  characterId:     uuid("character_id").notNull().unique().references(() => characters.id, { onDelete: "cascade" }),
  userId:          varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  worldSlug:       varchar("world_slug", { length: 64 }).notNull(),
  currentTerritoryId: uuid("current_territory_id").references(() => territories.id, { onDelete: "set null" }),

  // Economy
  gold:            integer("gold").notNull().default(500),
  totalAssets:     integer("total_assets").notNull().default(0),

  // Social standing
  reputation:      integer("reputation").notNull().default(0),
  reputationTitle: varchar("reputation_title", { length: 64 }).notNull().default("Lữ Khách"),
  fame:            integer("fame").notNull().default(0),

  // Status
  occupation:      varchar("occupation", { length: 64 }).notNull().default("Phiêu Lưu Gia"),
  politicalRank:   varchar("political_rank", { length: 64 }),
  militaryRank:    varchar("military_rank", { length: 64 }),

  isActive:        boolean("is_active").notNull().default(true),
  lastActiveAt:    timestamp("last_active_at").defaultNow(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER RELATIONSHIPS — với NPC và người chơi khác
───────────────────────────────────────────────── */
export const playerRelationships = pgTable("player_relationships", {
  id:              uuid("id").primaryKey().defaultRandom(),
  characterId:     uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  targetType:      varchar("target_type", { length: 8 }).notNull().default("npc"),   // "npc" | "player"
  targetId:        varchar("target_id", { length: 128 }).notNull(),
  targetName:      varchar("target_name", { length: 128 }).notNull().default(""),
  score:           integer("score").notNull().default(0),
  relationType:    varchar("relation_type", { length: 32 }).notNull().default("stranger"),
  notes:           text("notes").default(""),
  lastInteractAt:  timestamp("last_interact_at").defaultNow(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER FAMILY
───────────────────────────────────────────────── */
export const playerFamily = pgTable("player_family", {
  id:          uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  relType:     varchar("rel_type", { length: 16 }).notNull(),   // "spouse"|"child"|"parent"|"sibling"
  targetType:  varchar("target_type", { length: 8 }).notNull().default("npc"),
  targetId:    varchar("target_id", { length: 128 }).notNull(),
  targetName:  varchar("target_name", { length: 128 }).notNull().default(""),
  familyName:  varchar("family_name", { length: 64 }),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER FACTION MEMBERSHIPS
───────────────────────────────────────────────── */
export const playerFactionMemberships = pgTable("player_faction_memberships", {
  id:           uuid("id").primaryKey().defaultRandom(),
  characterId:  uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  factionId:    varchar("faction_id", { length: 128 }).notNull(),
  factionName:  varchar("faction_name", { length: 128 }).notNull().default(""),
  factionType:  varchar("faction_type", { length: 32 }).notNull().default("guild"),
  role:         varchar("role", { length: 32 }).notNull().default("member"),
  contribution: integer("contribution").notNull().default(0),
  joinedAt:     timestamp("joined_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER BUSINESSES
───────────────────────────────────────────────── */
export const playerBusinesses = pgTable("player_businesses", {
  id:             uuid("id").primaryKey().defaultRandom(),
  characterId:    uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  worldSlug:      varchar("world_slug", { length: 64 }).notNull(),
  name:           varchar("name", { length: 128 }).notNull(),
  type:           varchar("type", { length: 32 }).notNull().default("shop"),
  level:          integer("level").notNull().default(1),
  capitalInvested: integer("capital_invested").notNull().default(0),
  incomePerTick:  integer("income_per_tick").notNull().default(10),
  totalEarned:    integer("total_earned").notNull().default(0),
  status:         varchar("status", { length: 16 }).notNull().default("open"),
  employees:      integer("employees").notNull().default(0),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER ELECTION CANDIDACIES
───────────────────────────────────────────────── */
export const playerElectionCandidacies = pgTable("player_election_candidacies", {
  id:             uuid("id").primaryKey().defaultRandom(),
  characterId:    uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  electionId:     varchar("election_id", { length: 128 }).notNull(),
  worldSlug:      varchar("world_slug", { length: 64 }).notNull(),
  electionType:   varchar("election_type", { length: 64 }).notNull().default(""),
  platform:       text("platform").default(""),
  campaignScore:  integer("campaign_score").notNull().default(0),
  votes:          integer("votes").notNull().default(0),
  status:         varchar("status", { length: 16 }).notNull().default("running"),
  result:         varchar("result", { length: 16 }),
  registeredAt:   timestamp("registered_at").defaultNow().notNull(),
  resolvedAt:     timestamp("resolved_at"),
});

/* ─────────────────────────────────────────────────
   PLAYER WAR PARTICIPATIONS
───────────────────────────────────────────────── */
export const playerWarParticipations = pgTable("player_war_participations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  characterId:   uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  warId:         varchar("war_id", { length: 128 }).notNull(),
  worldSlug:     varchar("world_slug", { length: 64 }).notNull(),
  side:          varchar("side", { length: 16 }).notNull().default("attacker"),
  kills:         integer("kills").notNull().default(0),
  deaths:        integer("deaths").notNull().default(0),
  contribution:  integer("contribution").notNull().default(0),
  goldEarned:    integer("gold_earned").notNull().default(0),
  repEarned:     integer("rep_earned").notNull().default(0),
  status:        varchar("status", { length: 16 }).notNull().default("active"),
  joinedAt:      timestamp("joined_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER TRADE HISTORY
───────────────────────────────────────────────── */
export const playerTradeHistory = pgTable("player_trade_history", {
  id:           uuid("id").primaryKey().defaultRandom(),
  characterId:  uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  worldSlug:    varchar("world_slug", { length: 64 }).notNull(),
  tradeType:    varchar("trade_type", { length: 16 }).notNull().default("buy"),
  itemName:     varchar("item_name", { length: 128 }).notNull().default(""),
  quantity:     integer("quantity").notNull().default(1),
  unitPrice:    integer("unit_price").notNull().default(0),
  totalPrice:   integer("total_price").notNull().default(0),
  counterparty: varchar("counterparty", { length: 128 }).default(""),
  counterType:  varchar("counter_type", { length: 8 }).default("market"),
  tradedAt:     timestamp("traded_at").defaultNow().notNull(),
});

/* ─────────────────────────────────────────────────
   PLAYER ACTIVITY LOG
───────────────────────────────────────────────── */
export const playerActivityLog = pgTable("player_activity_log", {
  id:          uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  actionType:  varchar("action_type", { length: 32 }).notNull(),
  summary:     text("summary").notNull().default(""),
  impact:      jsonb("impact").$type<Record<string, any>>().default({}),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type PlayerAgent                = typeof playerAgents.$inferSelect;
export type PlayerRelationship         = typeof playerRelationships.$inferSelect;
export type PlayerFamily               = typeof playerFamily.$inferSelect;
export type PlayerFactionMembership    = typeof playerFactionMemberships.$inferSelect;
export type PlayerBusiness             = typeof playerBusinesses.$inferSelect;
export type PlayerElectionCandidacy    = typeof playerElectionCandidacies.$inferSelect;
export type PlayerWarParticipation     = typeof playerWarParticipations.$inferSelect;
export type PlayerTradeHistory         = typeof playerTradeHistory.$inferSelect;
export type PlayerActivityLog          = typeof playerActivityLog.$inferSelect;
