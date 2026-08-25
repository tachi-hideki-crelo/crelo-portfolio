import { and, eq, gt, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { contactRequests } from './schema.ts';

export const CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000;
export const CONTACT_RATE_LIMIT = 5;
export const TURNSTILE_TOKEN_WINDOW_MS = 5 * 60 * 1000;
export const CONTACT_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

export type ContactStore = {
  reserve(input: ContactReservationInput): Promise<ContactReservationResult>;
  updateStatus(requestId: string, status: 'sent' | 'rejected' | 'failed', now: number): Promise<void>;
};

export type ContactConflictProbe = {
  tokenExists: boolean;
  fingerprintExists: boolean;
};

export type ContactDuplicateCandidate = {
  status: 'pending' | 'sent' | 'rejected' | 'failed';
  createdAt: number;
};

export function hasRecentContactDuplicate(
  candidates: readonly ContactDuplicateCandidate[],
  now: number,
): boolean {
  return candidates.some((candidate) => {
    const age = now - candidate.createdAt;
    // A fingerprint is a duplicate for the same bounded window regardless of
    // delivery outcome. After the window, the person may start a new inquiry;
    // treating `sent`/`pending` as permanent duplicates would block that.
    return age >= 0 && age <= CONTACT_DUPLICATE_WINDOW_MS;
  });
}

export function isContactRateLimited(
  candidates: readonly Pick<ContactDuplicateCandidate, 'createdAt'>[],
  now: number,
): boolean {
  return candidates.filter((candidate) => candidate.createdAt > now - CONTACT_RATE_WINDOW_MS).length >= CONTACT_RATE_LIMIT;
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

  return {
    async reserve(input) {
      const existingRequest = await db
        .select({ requestId: contactRequests.requestId, status: contactRequests.status })
        .from(contactRequests)
        .where(eq(contactRequests.requestId, input.requestId))
        .limit(1);
      const requestRow = existingRequest[0];
      if (requestRow?.status === 'sent') return { kind: 'already_sent' };
      if (requestRow && (requestRow.status === 'pending' || requestRow.status === 'failed')) {
        // A retry may arrive with a fresh token, but a token already reserved
        // by another request must never be converted into an internal D1 500.
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

        try {
          await db
            .update(contactRequests)
            .set({
              fingerprintHash: input.fingerprintHash,
              emailHash: input.emailHash,
              ipHash: input.ipHash,
              tokenHash: input.tokenHash,
              status: 'pending',
              createdAt: input.now,
              updatedAt: input.now,
              expiresAt: input.now + TURNSTILE_TOKEN_WINDOW_MS,
            })
            .where(eq(contactRequests.requestId, input.requestId));
        } catch {
          // The preflight is only advisory under concurrency. Re-read the
          // unique token key so a race is still classified deterministically.
          const racedToken = await db
            .select({ requestId: contactRequests.requestId })
            .from(contactRequests)
            .where(
              and(
                eq(contactRequests.tokenHash, input.tokenHash),
                ne(contactRequests.requestId, input.requestId),
              ),
            )
            .limit(1);
          if (racedToken.length > 0) return { kind: 'token_reused' };
          throw new Error('contact retry update failed');
        }
        return { kind: 'reserved' };
      }

      const token = await db
        .select({ requestId: contactRequests.requestId, status: contactRequests.status })
        .from(contactRequests)
        .where(eq(contactRequests.tokenHash, input.tokenHash))
        .limit(1);
      if (token.length > 0) return { kind: 'token_reused' };

      const duplicateCandidates = await db
        .select({
          requestId: contactRequests.requestId,
          status: contactRequests.status,
          createdAt: contactRequests.createdAt,
        })
        .from(contactRequests)
        .where(eq(contactRequests.fingerprintHash, input.fingerprintHash))
        .limit(50);
      const hasRecentDuplicate = hasRecentContactDuplicate(duplicateCandidates, input.now);
      if (hasRecentDuplicate) return { kind: 'duplicate' };

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

      try {
        await db.insert(contactRequests).values({
          requestId: input.requestId,
          fingerprintHash: input.fingerprintHash,
          emailHash: input.emailHash,
          ipHash: input.ipHash,
          tokenHash: input.tokenHash,
          status: 'pending',
          createdAt: input.now,
          updatedAt: input.now,
          expiresAt: input.now + TURNSTILE_TOKEN_WINDOW_MS,
        });
      } catch {
        // The requestId and token unique constraints make retries safe even
        // when concurrent requests pass the read checks above.
        const existingToken = await db
          .select({ requestId: contactRequests.requestId })
          .from(contactRequests)
          .where(eq(contactRequests.tokenHash, input.tokenHash))
          .limit(1);
        const existingFingerprint = await db
          .select({ requestId: contactRequests.requestId })
          .from(contactRequests)
          .where(eq(contactRequests.fingerprintHash, input.fingerprintHash))
          .limit(1);
        const conflict = classifyContactConflict({
          tokenExists: existingToken.length > 0,
          fingerprintExists: existingFingerprint.length > 0,
        });
        if (conflict) return conflict;
        throw new Error('contact reservation failed');
      }

      return { kind: 'reserved' };
    },

    async updateStatus(requestId, status, now) {
      await db
        .update(contactRequests)
        .set({ status, updatedAt: now })
        .where(eq(contactRequests.requestId, requestId));
    },
  };
}
