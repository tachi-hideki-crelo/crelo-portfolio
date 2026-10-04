import siteWorker from 'vinext/server/app-router-entry';
import { pruneContactMetadata } from './db/contact-retention.ts';

/** The site and the daily retention job share one Worker and one D1 binding. */
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return siteWorker.fetch(request, env, ctx);
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
