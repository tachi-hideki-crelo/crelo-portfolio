import { readFileSync, writeFileSync } from 'node:fs';

import { renderHeadersFile } from '../security-headers.ts';

// Regenerate public/_headers from security-headers.ts. With `--check`, only
// verify the committed file is current and exit non-zero if it is stale.
const target = new URL('../public/_headers', import.meta.url);
const expected = renderHeadersFile();

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== expected) {
    console.error('public/_headers is out of date with security-headers.ts; run `npm run sync:headers`.');
    process.exit(1);
  }
  console.log('public/_headers matches security-headers.ts');
} else {
  writeFileSync(target, expected);
  console.log('public/_headers synced from security-headers.ts');
}
