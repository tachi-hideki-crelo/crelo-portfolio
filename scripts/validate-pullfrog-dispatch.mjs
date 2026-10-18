import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This limits accidental or injected automation requests. It is not an
// authentication check: GitHub workflow permissions and Pullfrog's runner-proof
// validation remain the authority for repository/credential access.
export function assertPullfrogReviewDispatch(source) {
  if (typeof source !== 'string' || source.length === 0 || Buffer.byteLength(source, 'utf8') > 65_536) {
    throw new Error('Pullfrog requires a bounded review dispatch payload');
  }

  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error('Pullfrog requires a JSON review dispatch payload');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || payload['~pullfrog'] !== true || !['pr-created', 'pr-re-review'].includes(payload.type)
    || typeof payload.prompt !== 'string' || typeof payload.version !== 'string') {
    throw new Error('This workflow accepts Pullfrog PR reviews only');
  }

  const event = payload.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)
    || event.is_pr !== true || !Number.isSafeInteger(event.issue_number) || event.issue_number < 1) {
    throw new Error('A valid PR review context is required');
  }

  const triggers = payload.type === 'pr-created'
    ? ['pull_request_opened', 'pull_request_ready_for_review', 'pull_request_review_requested']
    : ['pull_request_synchronize'];
  if (!triggers.includes(event.trigger)) {
    throw new Error('The review type and PR event must match');
  }

  if (payload.xrepo !== undefined || payload.xrepoGrant !== undefined) {
    throw new Error('Cross-repository access is not enabled for this review workflow');
  }

  // The existing account uses ChatGPT/Codex, not new API keys or a paid router.
  if (payload.model !== undefined && (
    typeof payload.model !== 'string' || !/^openai\/[a-z0-9][a-z0-9._-]*$/.test(payload.model)
  )) {
    throw new Error('Only the existing OpenAI subscription route is allowed');
  }

  return payload;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Never print the prompt, PR body, credential, or a parser's raw error.
  try {
    assertPullfrogReviewDispatch(process.env.PULLFROG_DISPATCH);
    console.log('Pullfrog review dispatch: pass');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Pullfrog review dispatch rejected');
    process.exitCode = 1;
  }
}
