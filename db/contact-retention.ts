/** D1 stores only keyed hashes and delivery status, never inquiry bodies. */
export const CONTACT_METADATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function contactMetadataCutoff(now: number): number {
  if (!Number.isFinite(now) || now < CONTACT_METADATA_RETENTION_MS) {
    throw new RangeError('Invalid contact cleanup time');
  }
  return now - CONTACT_METADATA_RETENTION_MS;
}

const CONTACT_RETENTION_FAILURE_MESSAGE = 'Contact metadata cleanup failed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccessfulD1Result(value: unknown): value is D1Result {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.results)) {
    return false;
  }

  const meta = value.meta;
  return (
    isRecord(meta) &&
    typeof meta.changes === 'number' &&
    Number.isInteger(meta.changes) &&
    meta.changes >= 0
  );
}

async function runContactCleanupDelete(
  database: D1Database,
  query: string,
  value: number,
): Promise<void> {
  try {
    const result = await database.prepare(query).bind(value).run();
    if (!isSuccessfulD1Result(result)) {
      throw new Error(CONTACT_RETENTION_FAILURE_MESSAGE);
    }
  } catch {
    // Do not expose the SQL statement or a provider error that may contain it.
    throw new Error(CONTACT_RETENTION_FAILURE_MESSAGE);
  }
}

export async function pruneContactMetadata(database: D1Database, now: number): Promise<void> {
  await runContactCleanupDelete(
    database,
    'DELETE FROM contact_requests WHERE created_at < ?',
    contactMetadataCutoff(now),
  );
  await runContactCleanupDelete(
    database,
    'DELETE FROM contact_turnstile_rate_limits WHERE expires_at <= ?',
    now,
  );
}
