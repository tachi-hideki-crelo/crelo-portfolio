import { and, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { contactRequests } from './schema.ts';

export const CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;
export const CONTACT_RATE_LIMIT = 5;
export const TURNSTILE_TOKEN_WINDOW_MS = 5 * 60 * 1000;
export const CONTACT_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_CONTACT_RETRY_ATTEMPTS = 5;
export const CONTACT_TURNSTILE_RATE_WINDOW_MS = 60 * 1000;
export const CONTACT_TURNSTILE_RATE_LIMIT = 20;

export type ContactReservationInput = {
  requestId: string;
  fingerprintHash: string;
  emailHash: string;
  ipHash: string;
  tokenHash: string;
  now: number;
};

export type ContactReservationResult =
  | { kind: 'reserved' }
  | { kind: 'duplicate' }
  | { kind: 'token_reused' }
  | { kind: 'rate_limited' }
  | { kind: 'already_sent' };

export type ContactTurnstileAttemptInput = {
  ipHash: string;
  now: number;
};

export type ContactTurnstileAttemptResult =
  | { kind: 'allowed' }
  | { kind: 'rate_limited' };

export type ContactStore = {
  reserveTurnstileAttempt(input: ContactTurnstileAttemptInput): Promise<ContactTurnstileAttemptResult>;
  reserve(input: ContactReservationInput): Promise<ContactReservationResult>;
  updateStatus(
    requestId: string,
    status: 'sent' | 'rejected' | 'failed',
    now: number,
    expectedTokenHash: string,
  ): Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readD1MutationChanges(
  value: unknown,
  failureMessage: string,
  incompleteMessage: string,
): number {
  if (!isRecord(value) || value.success !== true) {
    throw new Error(failureMessage);
  }

  const meta = value.meta;
  const changes = isRecord(meta) ? meta.changes : undefined;
  if (typeof changes !== 'number' || !Number.isInteger(changes) || changes < 0) {
    throw new Error(incompleteMessage);
  }
  return changes;
}

export type ContactConflictProbe = {
  tokenExists: boolean;
  fingerprintExists: boolean;
};

export type ContactDuplicateCandidate = {
  status: 'pending' | 'sent' | 'rejected' | 'failed';
  createdAt: number;
};

export function matchesContactRequestFingerprint(
  existingFingerprintHash: string,
  retryFingerprintHash: string,
): boolean {
  return existingFingerprintHash === retryFingerprintHash;
}

export function hasRecentContactDuplicate(
  candidates: readonly ContactDuplicateCandidate[],
  now: number,
): boolean {
  return candidates.some((candidate) => {
    const age = now - candidate.createdAt;
    // A fingerprint is a duplicate for the same bounded window regardless of
    // delivery outcome. After the window, the person may start a new inquiry;
    // treating `sent`/`pending` as permanent duplicates would block that.
    return age <= CONTACT_DUPLICATE_WINDOW_MS;
  });
}

export function isContactRateLimited(
  candidates: readonly Pick<ContactDuplicateCandidate, 'createdAt'>[],
  now: number,
): boolean {
  return candidates.filter(
    (candidate) => candidate.createdAt > now - CONTACT_RATE_WINDOW_MS,
  ).length >= CONTACT_RATE_LIMIT;
}

/**
 * Converts a uniqueness race into a public reservation result. Keeping this
 * policy pure makes the ordering contract testable without a live D1 binding.
 * A token collision wins over a fingerprint collision because Turnstile
 * tokens are single-use, even when two submissions share a fingerprint.
 */
export function classifyContactConflict(
  probe: ContactConflictProbe,
): Extract<ContactReservationResult, { kind: 'duplicate' | 'token_reused' }> | undefined {
  if (probe.tokenExists) return { kind: 'token_reused' };
  if (probe.fingerprintExists) return { kind: 'duplicate' };
  return undefined;
}

export function createD1ContactStore(database: D1Database): ContactStore {
  const db = drizzle(database);
  const contactRequestsTable = sql.identifier('contact_requests');
  const contactTurnstileRateLimitsTable = sql.identifier('contact_turnstile_rate_limits');

  function getTurnstileWindowStart(now: number): number {
    if (!Number.isFinite(now) || now < 0) throw new RangeError('Invalid Turnstile rate time');
    return Math.floor(now / CONTACT_TURNSTILE_RATE_WINDOW_MS) * CONTACT_TURNSTILE_RATE_WINDOW_MS;
  }

  async function findFreshReservationConflict(input: ContactReservationInput): Promise<ContactReservationResult | undefined> {
    const request = await db
      .select({
        status: contactRequests.status,
        fingerprintHash: contactRequests.fingerprintHash,
      })
      .from(contactRequests)
      .where(eq(contactRequests.requestId, input.requestId))
      .limit(1);
    // Another fresh caller may have inserted and delivered after our first
    // read. A sent row only acknowledges this caller's immutable inquiry.
    if (request[0] && !matchesContactRequestFingerprint(request[0].fingerprintHash, input.fingerprintHash)) {
      return { kind: 'duplicate' };
    }
    if (request[0]?.status === 'sent') return { kind: 'already_sent' };
    if (request.length > 0) return { kind: 'duplicate' };

    const token = await db
      .select({ requestId: contactRequests.requestId })
      .from(contactRequests)
      .where(eq(contactRequests.tokenHash, input.tokenHash))
      .limit(1);
    if (token.length > 0) return { kind: 'token_reused' };

    const duplicateCandidates = await db
      .select({
        status: contactRequests.status,
        createdAt: contactRequests.createdAt,
      })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.fingerprintHash, input.fingerprintHash),
          gte(contactRequests.createdAt, input.now - CONTACT_DUPLICATE_WINDOW_MS),
        ),
      )
      .limit(1);
    if (hasRecentContactDuplicate(duplicateCandidates, input.now)) return { kind: 'duplicate' };

    const recent = await db
      .select({ createdAt: contactRequests.createdAt })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.ipHash, input.ipHash),
          gt(contactRequests.createdAt, input.now - CONTACT_RATE_WINDOW_MS),
        ),
      )
      .limit(CONTACT_RATE_LIMIT);
    if (isContactRateLimited(recent, input.now)) return { kind: 'rate_limited' };
    return undefined;
  }

  async function findRetryReservationConflict(
    input: ContactReservationInput,
  ): Promise<ContactReservationResult | undefined> {
    const token = await db
      .select({ requestId: contactRequests.requestId })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.tokenHash, input.tokenHash),
          ne(contactRequests.requestId, input.requestId),
        ),
      )
      .limit(1);
    if (token.length > 0) return { kind: 'token_reused' };

    const duplicateCandidates = await db
      .select({
        status: contactRequests.status,
        createdAt: contactRequests.createdAt,
      })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.fingerprintHash, input.fingerprintHash),
          ne(contactRequests.requestId, input.requestId),
          gte(contactRequests.createdAt, input.now - CONTACT_DUPLICATE_WINDOW_MS),
        ),
      )
      .limit(1);
    if (hasRecentContactDuplicate(duplicateCandidates, input.now)) return { kind: 'duplicate' };

    const recent = await db
      .select({ createdAt: contactRequests.createdAt })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.ipHash, input.ipHash),
          gt(contactRequests.createdAt, input.now - CONTACT_RATE_WINDOW_MS),
        ),
      )
      .limit(CONTACT_RATE_LIMIT);
    if (isContactRateLimited(recent, input.now)) return { kind: 'rate_limited' };

    const current = await db
      .select({
        status: contactRequests.status,
        fingerprintHash: contactRequests.fingerprintHash,
        retryAttempts: contactRequests.retryAttempts,
        updatedAt: contactRequests.updatedAt,
      })
      .from(contactRequests)
      .where(eq(contactRequests.requestId, input.requestId))
      .limit(1);
    if (current[0]?.status === 'sent') return { kind: 'already_sent' };
    if (current[0] && !matchesContactRequestFingerprint(current[0].fingerprintHash, input.fingerprintHash)) {
      return { kind: 'duplicate' };
    }
    if (current[0]?.retryAttempts >= MAX_CONTACT_RETRY_ATTEMPTS) return { kind: 'rate_limited' };
    if (current[0]?.updatedAt >= input.now) return { kind: 'duplicate' };
    return undefined;
  }

  return {
    async reserveTurnstileAttempt(input) {
      const windowStartedAt = getTurnstileWindowStart(input.now);
      const expiresAt = windowStartedAt + CONTACT_TURNSTILE_RATE_WINDOW_MS;
      let reservation: unknown;
      try {
        reservation = await db.run(sql`
          INSERT INTO ${contactTurnstileRateLimitsTable} (
            "ip_hash",
            "window_started_at",
            "request_count",
            "expires_at"
          )
          VALUES (
            ${input.ipHash},
            ${windowStartedAt},
            1,
            ${expiresAt}
          )
          ON CONFLICT ("ip_hash") DO UPDATE SET
            "window_started_at" = excluded."window_started_at",
            "request_count" = CASE
              WHEN ${contactTurnstileRateLimitsTable}."window_started_at" < excluded."window_started_at"
                THEN 1
              WHEN ${contactTurnstileRateLimitsTable}."window_started_at" = excluded."window_started_at"
                AND ${contactTurnstileRateLimitsTable}."expires_at" = excluded."expires_at"
                THEN ${contactTurnstileRateLimitsTable}."request_count" + 1
              ELSE 1
            END,
            "expires_at" = excluded."expires_at"
          WHERE ${contactTurnstileRateLimitsTable}."window_started_at" < excluded."window_started_at"
            OR (
              ${contactTurnstileRateLimitsTable}."window_started_at" = excluded."window_started_at"
              AND ${contactTurnstileRateLimitsTable}."expires_at" = excluded."expires_at"
              AND ${contactTurnstileRateLimitsTable}."request_count" < ${CONTACT_TURNSTILE_RATE_LIMIT}
            )
        `);
      } catch {
        throw new Error('Turnstile rate counter update failed');
      }
      const changes = readD1MutationChanges(
        reservation,
        'Turnstile rate counter update failed',
        'Turnstile rate counter result was incomplete',
      );
      return changes > 0
        ? { kind: 'allowed' }
        : { kind: 'rate_limited' };
    },
    async reserve(input) {
      const existingRequest = await db
        .select({
          requestId: contactRequests.requestId,
          status: contactRequests.status,
          fingerprintHash: contactRequests.fingerprintHash,
          tokenHash: contactRequests.tokenHash,
          retryAttempts: contactRequests.retryAttempts,
          updatedAt: contactRequests.updatedAt,
        })
        .from(contactRequests)
        .where(eq(contactRequests.requestId, input.requestId))
        .limit(1);
      const requestRow = existingRequest[0];
      // A request ID is the identity of one immutable inquiry. Reusing it for
      // changed content could otherwise show a false success for the new text,
      // while Resend replays the original idempotent email.
      if (requestRow && !matchesContactRequestFingerprint(requestRow.fingerprintHash, input.fingerprintHash)) {
        return { kind: 'duplicate' };
      }
      if (requestRow?.status === 'sent') return { kind: 'already_sent' };
      if (requestRow && (requestRow.status === 'pending' || requestRow.status === 'failed')) {
        const conflictingToken = await db
          .select({ requestId: contactRequests.requestId })
          .from(contactRequests)
          .where(
            and(
              eq(contactRequests.tokenHash, input.tokenHash),
              ne(contactRequests.requestId, input.requestId),
            ),
          )
          .limit(1);
        if (conflictingToken.length > 0) return { kind: 'token_reused' };
        if (requestRow.retryAttempts >= MAX_CONTACT_RETRY_ATTEMPTS) return { kind: 'rate_limited' };

        let retry: unknown;
        try {
          retry = await db.run(sql`
            UPDATE ${contactRequestsTable}
            SET
              "fingerprint_hash" = ${input.fingerprintHash},
              "email_hash" = ${input.emailHash},
              "ip_hash" = ${input.ipHash},
              "token_hash" = ${input.tokenHash},
              "status" = 'pending',
              "created_at" = ${input.now},
              "updated_at" = ${input.now},
              "expires_at" = ${input.now + TURNSTILE_TOKEN_WINDOW_MS},
              "retry_attempts" = "retry_attempts" + 1
            WHERE
              "request_id" = ${input.requestId}
              AND "fingerprint_hash" = ${input.fingerprintHash}
              AND "status" IN ('pending', 'failed')
              AND "token_hash" = ${requestRow.tokenHash}
              AND "retry_attempts" = ${requestRow.retryAttempts}
              AND "updated_at" = ${requestRow.updatedAt}
              AND "updated_at" < ${input.now}
              AND "retry_attempts" < ${MAX_CONTACT_RETRY_ATTEMPTS}
              AND NOT EXISTS (
                SELECT 1
                FROM ${contactRequestsTable} AS token_conflict
                WHERE token_conflict."token_hash" = ${input.tokenHash}
                  AND token_conflict."request_id" <> ${input.requestId}
              )
              AND NOT EXISTS (
                SELECT 1
                FROM ${contactRequestsTable} AS duplicate
                WHERE duplicate."request_id" <> ${input.requestId}
                  AND duplicate."fingerprint_hash" = ${input.fingerprintHash}
                  AND duplicate."created_at" >= ${input.now - CONTACT_DUPLICATE_WINDOW_MS}
              )
              AND (
                SELECT COUNT(*)
                FROM ${contactRequestsTable} AS recent
                WHERE recent."ip_hash" = ${input.ipHash}
                  AND recent."created_at" > ${input.now - CONTACT_RATE_WINDOW_MS}
              ) < ${CONTACT_RATE_LIMIT}
          `);
        } catch {
          try {
            const conflict = await findRetryReservationConflict(input);
            if (conflict) return conflict;
          } catch {
            throw new Error('contact retry update failed');
          }
          throw new Error('contact retry update failed');
        }
        if (
          readD1MutationChanges(
            retry,
            'contact retry update failed',
            'contact retry update result was incomplete',
          ) > 0
        ) return { kind: 'reserved' };
        const conflict = await findRetryReservationConflict(input);
        if (conflict) return conflict;
        throw new Error('contact retry reservation rejected');
      }

      let reservation: unknown;
      try {
        reservation = await db.run(sql`
          INSERT INTO ${contactRequestsTable} (
            "request_id",
            "fingerprint_hash",
            "email_hash",
            "ip_hash",
            "token_hash",
            "status",
            "created_at",
            "updated_at",
            "expires_at",
            "retry_attempts"
          )
          SELECT
            ${input.requestId},
            ${input.fingerprintHash},
            ${input.emailHash},
            ${input.ipHash},
            ${input.tokenHash},
            'pending',
            ${input.now},
            ${input.now},
            ${input.now + TURNSTILE_TOKEN_WINDOW_MS},
            0
          WHERE NOT EXISTS (
            SELECT 1
            FROM ${contactRequestsTable} AS duplicate
            WHERE duplicate."fingerprint_hash" = ${input.fingerprintHash}
              AND duplicate."created_at" >= ${input.now - CONTACT_DUPLICATE_WINDOW_MS}
          )
          AND (
            SELECT COUNT(*)
            FROM ${contactRequestsTable} AS recent
            WHERE recent."ip_hash" = ${input.ipHash}
              AND recent."created_at" > ${input.now - CONTACT_RATE_WINDOW_MS}
          ) < ${CONTACT_RATE_LIMIT}
        `);
      } catch {
        try {
          const conflict = await findFreshReservationConflict(input);
          if (conflict) return conflict;
        } catch {
          throw new Error('contact reservation failed');
        }
        throw new Error('contact reservation failed');
      }

      if (
        readD1MutationChanges(
          reservation,
          'contact reservation failed',
          'contact reservation result was incomplete',
        ) > 0
      ) return { kind: 'reserved' };

      const conflict = await findFreshReservationConflict(input);
      if (conflict) return conflict;
      throw new Error('contact reservation rejected');
    },

    async updateStatus(requestId, status, now, expectedTokenHash) {
      const allowedStatuses = status === 'sent'
        ? inArray(contactRequests.status, ['pending', 'failed'])
        : eq(contactRequests.status, 'pending');
      // Resend uses requestId as the idempotency key, and reserve() rejects a
      // changed fingerprint for an existing requestId. A successful delivery
      // from any token therefore closes the same immutable inquiry; a stale
      // failure must still be fenced to the token that was reserved for it.
      const tokenCondition = status === 'sent'
        ? undefined
        : eq(contactRequests.tokenHash, expectedTokenHash);
      let result: unknown;
      try {
        result = await db
          .update(contactRequests)
          .set({
            status,
            updatedAt: status === 'sent'
              ? sql`CASE WHEN ${contactRequests.updatedAt} > ${now} THEN ${contactRequests.updatedAt} ELSE ${now} END`
              : now,
          })
          .where(and(
            eq(contactRequests.requestId, requestId),
            allowedStatuses,
            tokenCondition,
          ));
      } catch {
        throw new Error('contact status update failed');
      }
      readD1MutationChanges(
        result,
        'contact status update failed',
        'contact status update result was incomplete',
      );
    },
  };
}
