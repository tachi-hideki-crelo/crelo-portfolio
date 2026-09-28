import type { ContactRuntimeEnv } from './contact-handler.ts';

export type WorkerContactRuntimeEnv = ContactRuntimeEnv & { DB?: D1Database };

/**
 * The Worker binding is authoritative: process.env can contain text secrets
 * under nodejs_compat, but it does not contain the D1 binding.
 */
export async function getContactRuntimeEnv(): Promise<WorkerContactRuntimeEnv> {
  try {
    const worker = await import('cloudflare:workers');
    return worker.env as unknown as WorkerContactRuntimeEnv;
  } catch {
    return (typeof process !== 'undefined' ? process.env : {}) as WorkerContactRuntimeEnv;
  }
}
