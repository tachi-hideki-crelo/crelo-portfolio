import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const contactRequests = sqliteTable(
  'contact_requests',
  {
    requestId: text('request_id').primaryKey(),
    fingerprintHash: text('fingerprint_hash').notNull(),
    emailHash: text('email_hash').notNull(),
    ipHash: text('ip_hash').notNull(),
    tokenHash: text('token_hash').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'rejected', 'failed'] }).notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
    retryAttempts: integer('retry_attempts', { mode: 'number' }).notNull().default(0),
  },
  (table) => ({
    fingerprintIndex: index('contact_requests_fingerprint_idx').on(table.fingerprintHash),
    tokenIndex: uniqueIndex('contact_requests_token_idx').on(table.tokenHash),
    ipCreatedIndex: index('contact_requests_ip_created_idx').on(table.ipHash, table.createdAt),
    createdAtIndex: index('contact_requests_created_at_idx').on(table.createdAt),
  }),
);

/**
 * Short-lived, IP-keyed Turnstile preflight counters. The IP is already an
 * HMAC in the application layer; no raw address or inquiry fields are stored.
 */
export const contactTurnstileRateLimits = sqliteTable(
  'contact_turnstile_rate_limits',
  {
    ipHash: text('ip_hash').primaryKey(),
    windowStartedAt: integer('window_started_at', { mode: 'number' }).notNull(),
    requestCount: integer('request_count', { mode: 'number' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  },
  (table) => ({
    expiresAtIndex: index('contact_turnstile_rate_limits_expires_idx').on(table.expiresAt),
  }),
);

export type ContactRequestRow = typeof contactRequests.$inferSelect;
export type NewContactRequestRow = typeof contactRequests.$inferInsert;
