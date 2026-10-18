import { writeFileSync } from 'node:fs';

import { renderHeadersFile } from '../security-headers.ts';

// Regenerate public/_headers from security-headers.ts.
writeFileSync(new URL('../public/_headers', import.meta.url), renderHeadersFile());
console.log('public/_headers synced from security-headers.ts');
