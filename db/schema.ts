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
  },
  (table) => ({
    fingerprintIndex: index('contact_requests_fingerprint_idx').on(table.fingerprintHash),
    tokenIndex: uniqueIndex('contact_requests_token_idx').on(table.tokenHash),
    ipCreatedIndex: index('contact_requests_ip_created_idx').on(table.ipHash, table.createdAt),
  }),
);

export type ContactRequestRow = typeof contactRequests.$inferSelect;
export type NewContactRequestRow = typeof contactRequests.$inferInsert;
