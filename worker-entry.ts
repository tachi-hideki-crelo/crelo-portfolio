import siteWorker from 'vinext/server/app-router-entry';
import { pruneContactMetadata } from './db/contact-retention.ts';
import { isCanonicalRequest, withNoindexHeader } from './app/lib/public-host.ts';

/** The site and the daily retention job share one Worker and one D1 binding. */
export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await siteWorker.fetch(request, env, ctx);
    if (isCanonicalRequest(request.url, env.SITE_ORIGIN)) return response;

    // The workers.dev fallback remains reachable, but only the custom domain
    // may be indexed after a production build.
    return withNoindexHeader(response);
  },
  async scheduled(controller: ScheduledController, env: Cloudflare.Env) {
    try {
      await pruneContactMetadata(env.DB, controller.scheduledTime);
    } catch {
      // A fixed event is enough to investigate a failed job without logging
      // a customer's inquiry, token, or other private input.
      console.error('contact.retention_cleanup_failed');
      throw new Error('contact retention cleanup failed');
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
