import { createD1ContactStore } from '../../../db/contact-store.ts';
import {
  handleContactRequest,
  type ContactRuntimeEnv,
} from '../../lib/contact-handler.ts';
import { createDefaultContactLogger } from '../../lib/contact-logger.ts';

type WorkerRuntimeEnv = ContactRuntimeEnv & { DB?: D1Database };

async function getRuntimeEnv(): Promise<WorkerRuntimeEnv> {
  // The local Node preview uses process.env. Cloudflare Sites injects the
  // binding through cloudflare:workers at request time.
  if (typeof process !== 'undefined' && process.env.SITE_ORIGIN) {
    return process.env as WorkerRuntimeEnv;
  }
  try {
    const worker = await import('cloudflare:workers');
    return worker.env as unknown as WorkerRuntimeEnv;
  } catch {
    return (typeof process !== 'undefined' ? process.env : {}) as WorkerRuntimeEnv;
  }
}

export async function POST(request: Request): Promise<Response> {
  const runtimeEnv = await getRuntimeEnv();
  const store = runtimeEnv.DB ? createD1ContactStore(runtimeEnv.DB) : undefined;
  return handleContactRequest(request, {
    env: runtimeEnv,
    store,
    logger: createDefaultContactLogger(),
  });
}
