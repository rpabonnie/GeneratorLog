import { pgTable, serial, varchar, timestamp, integer, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  oauthProvider: varchar('oauth_provider', { length: 50 }),
  oauthId: varchar('oauth_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const generators = pgTable('generators', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  oilChangeMonths: integer('oil_change_months').notNull().default(6),
  oilChangeHours: doublePrecision('oil_change_hours').notNull().default(100),
  totalHours: doublePrecision('total_hours').notNull().default(0),
  lastOilChangeDate: timestamp('last_oil_change_date'),
  lastOilChangeHours: doublePrecision('last_oil_change_hours').default(0),
  isRunning: boolean('is_running').notNull().default(false),
  currentStartTime: timestamp('current_start_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageLogs = pgTable('usage_logs', {
  id: serial('id').primaryKey(),
  generatorId: integer('generator_id').notNull().references(() => generators.id),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  durationHours: doublePrecision('duration_hours'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  hint: varchar('hint', { length: 4 }).notNull(),
  name: varchar('name', { length: 255 }),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
