import { resolve } from 'node:path';

import { assertProductionContent, validateProductionContent } from '../app/lib/content-gate.ts';
import { caseStudies, siteContent } from '../app/lib/content.ts';
import { validateWebTemplateGalleryConfig, webTemplateGallery } from '../app/components/site/web-template-gallery-data.ts';
import { selfBuiltTools, validateSelfBuiltTools } from '../app/components/site/self-development-data.ts';
import { validatePublicContentAssets, validateSelfBuiltToolAssets } from './validate-public-assets.ts';

const isProduction = process.argv.includes('--production') || process.env.CONTENT_MODE === 'production';

const templateGalleryResult = validateWebTemplateGalleryConfig(webTemplateGallery);
if (!templateGalleryResult.ok) {
  console.error(`WEB_TEMPLATE_GALLERY_GATE_FAILED\n${templateGalleryResult.errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}

const selfBuiltToolsResult = validateSelfBuiltTools(selfBuiltTools);
if (!selfBuiltToolsResult.ok) {
  console.error(`SELF_BUILT_TOOLS_GATE_FAILED\n${selfBuiltToolsResult.errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}

const selfBuiltToolAssets = validateSelfBuiltToolAssets(selfBuiltTools, resolve(process.cwd(), 'public'));
if (!selfBuiltToolAssets.ok) {
  console.error(`SELF_BUILT_TOOL_ASSET_GATE_FAILED\n${selfBuiltToolAssets.errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}

if (!isProduction) {
  const approvedPreviewCases = caseStudies.filter((caseStudy) => caseStudy.approved);
  if (approvedPreviewCases.length > 0) {
    const assets = validatePublicContentAssets(approvedPreviewCases, siteContent, resolve(process.cwd(), 'public'));
    if (!assets.ok) {
      console.error(`PREVIEW_ASSET_GATE_FAILED\n${assets.errors.map((error) => `- ${error}`).join('\n')}`);
      process.exit(1);
    }
  }
  console.log('CONTENT_MODE=preview: unapproved case-study slots remain redacted; approved preview assets validated.');
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
