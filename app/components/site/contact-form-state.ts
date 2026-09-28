export type ContactSubmissionFields = {
  name: string;
  company: string;
  email: string;
  inquiryType: string;
  message: string;
};

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

/**
 * Mirrors the server-side fingerprint inputs after their harmless text
 * normalization. This key never leaves the browser; it only decides whether
 * a retry may reuse the same idempotency key.
 */
export function buildContactSubmissionKey(fields: ContactSubmissionFields): string {
  return JSON.stringify([
    normalize(fields.name),
    normalize(fields.company),
    normalize(fields.email).toLowerCase(),
    fields.inquiryType,
    normalize(fields.message),
  ]);
}

export function hasContactSubmissionChanged(
  submittedKey: string | null,
  fields: ContactSubmissionFields,
): boolean {
  return submittedKey !== null && submittedKey !== buildContactSubmissionKey(fields);
}
