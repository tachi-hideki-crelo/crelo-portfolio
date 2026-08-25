declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    SITE_ORIGIN: string;
    CONTACT_TO_EMAIL: string;
    CONTACT_FROM_EMAIL: string;
    RESEND_API_KEY: string;
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: string;
    TURNSTILE_SECRET_KEY: string;
    CONTACT_HASH_SECRET: string;
  }
}
