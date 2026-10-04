/** D1 stores only keyed hashes and delivery status, never inquiry bodies. */
export const CONTACT_METADATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function contactMetadataCutoff(now: number): number {
  if (!Number.isFinite(now) || now < CONTACT_METADATA_RETENTION_MS) {
    throw new RangeError('Invalid contact cleanup time');
  }
  return now - CONTACT_METADATA_RETENTION_MS;
}

export async function pruneContactMetadata(database: D1Database, now: number): Promise<void> {
  await database
    .prepare('DELETE FROM contact_requests WHERE created_at < ?')
    .bind(contactMetadataCutoff(now))
    .run();
}
