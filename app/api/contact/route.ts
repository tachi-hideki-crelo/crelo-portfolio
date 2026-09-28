import { createD1ContactStore } from '../../../db/contact-store.ts';
import { isContactAvailable } from '../../lib/contact-availability.ts';
import { siteContent } from '../../lib/content.ts';
import {
  handleContactRequest,
} from '../../lib/contact-handler.ts';
import { createDefaultContactLogger } from '../../lib/contact-logger.ts';
import { getContactRuntimeEnv } from '../../lib/contact-runtime.ts';

export async function POST(request: Request): Promise<Response> {
  const runtimeEnv = await getContactRuntimeEnv();
  const store = runtimeEnv.DB ? createD1ContactStore(runtimeEnv.DB) : undefined;
  return handleContactRequest(request, {
    env: runtimeEnv,
    store,
    contactAvailable: isContactAvailable(runtimeEnv, Boolean(store), siteContent),
    logger: createDefaultContactLogger(),
  });
}
