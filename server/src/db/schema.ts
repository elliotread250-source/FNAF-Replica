import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uuid, check } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull().unique(),
    usernameDisplay: text('username_display').notNull(),
    displayName: text('display_name').notNull(),
    email: text('email').unique(),
    passwordHash: text('password_hash'),
    isGuest: boolean('is_guest').notNull().default(false),
    fazTokens: integer('faz_tokens').notNull().default(0),
    stars: integer('stars').notNull().default(0),
    equipped: jsonb('equipped').$type<Record<string, string>>().notNull().default({}),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    displayNameChangedAt: timestamp('display_name_changed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('faz_tokens_nonneg', sql`${t.fazTokens} >= 0`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

export const passwordResets = pgTable('password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const userCosmetics = pgTable(
  'user_cosmetics',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cosmeticId: text('cosmetic_id').notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cosmeticId] })],
);

export const progress = pgTable(
  'progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    highestNight: integer('highest_night').notNull().default(0),
    presetsBeaten: text('presets_beaten').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mode] })],
);

export const achievements = pgTable(
  'achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

export const stats = pgTable('stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nightsPlayed: integer('nights_played').notNull().default(0),
  nightsSurvived: integer('nights_survived').notNull().default(0),
  deaths: integer('deaths').notNull().default(0),
  deathsBy: jsonb('deaths_by').$type<Record<string, number>>().notNull().default({}),
  cameraChecks: integer('camera_checks').notNull().default(0),
  doorsClosed: integer('doors_closed').notNull().default(0),
  powerUsedTotal: real('power_used_total').notNull().default(0),
  showtimeKills: integer('showtime_kills').notNull().default(0),
  showtimeWinsAsPuppeteer: integer('showtime_wins_as_puppeteer').notNull().default(0),
  playtimeSeconds: integer('playtime_seconds').notNull().default(0),
  skinChanges: integer('skin_changes').notNull().default(0),
});

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mode: text('mode').notNull(),
    night: integer('night').notNull(),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    customAi: jsonb('custom_ai'),
    playerCount: integer('player_count').notNull(),
    result: text('result').notNull(),
    endedAtHour: integer('ended_at_hour').notNull(),
    powerLeft: real('power_left'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('matches_ended_idx').on(t.endedAt)],
);

export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    station: text('station').notNull(),
    survived: boolean('survived').notNull(),
    killedBy: text('killed_by'),
    deathHour: integer('death_hour'),
    tokensEarned: integer('tokens_earned').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.station] }), index('match_players_user_idx').on(t.userId)],
);

export const archiveUnlocks = pgTable(
  'archive_unlocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    itemId: text('item_id').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })],
);
