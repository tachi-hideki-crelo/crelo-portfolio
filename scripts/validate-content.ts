import { resolve } from 'node:path';

import { assertProductionContent, validateProductionContent } from '../app/lib/content-gate.ts';
import { caseStudies, siteContent } from '../app/lib/content.ts';
import { validatePublicContentAssets } from './validate-public-assets.ts';

const isProduction = process.argv.includes('--production') || process.env.CONTENT_MODE === 'production';

if (!isProduction) {
  console.log('CONTENT_MODE=preview: five unapproved, empty case-study slots are allowed.');
  process.exit(0);
}

const result = validateProductionContent(undefined, undefined, undefined, { requireHttps: true });
if (result.ok) {
  const assets = validatePublicContentAssets(caseStudies, siteContent, resolve(process.cwd(), 'public'));
  if (!assets.ok) {
    console.error(`PRODUCTION_ASSET_GATE_FAILED\n${assets.errors.map((error) => `- ${error}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Production content gate passed.');
  process.exit(0);
}

try {
  assertProductionContent(undefined, undefined, undefined, { requireHttps: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PRODUCTION_CONTENT_GATE_FAILED');
}
process.exit(1);
