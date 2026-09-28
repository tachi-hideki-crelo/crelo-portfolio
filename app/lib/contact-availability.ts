import { hasContactRuntimeConfig, type ContactRuntimeEnv } from './contact-handler.ts';
import { inspectPrivacy } from './content-gate.ts';
import type { SiteContent } from './types.ts';

export function isContactAvailable(
  env: ContactRuntimeEnv,
  hasStore: boolean,
  content: SiteContent,
): boolean {
  return (
    hasStore &&
    inspectPrivacy(content).length === 0 &&
    typeof content.contactEmail === 'string' &&
    env.CONTACT_TO_EMAIL?.toLowerCase() === content.contactEmail.toLowerCase() &&
    hasContactRuntimeConfig(env) &&
    Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())
  );
}
