import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  isAllowedContentAssetExtension,
  type ContentAssetKind,
} from '../app/lib/content-assets.ts';
import type { CaseStudy, SelfBuiltTool, SiteContent } from '../app/lib/types.ts';

export type PublicAssetValidationResult = {
  ok: boolean;
  errors: string[];
};

type AssetCheck = {
  label: string;
  src: string;
  kind: ContentAssetKind;
  directory: 'assets/cases' | 'assets/lab' | 'assets/profile';
};

function isWithinDirectory(candidate: string, directory: string): boolean {
  const relativePath = relative(directory, candidate);
  return relativePath === '' || (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function resolveAssetInsidePublicDirectory(
  src: string,
  publicRoot: string,
  directory: AssetCheck['directory'],
): { resolved: string; directory: string } | undefined {
  const root = resolve(publicRoot);
  const allowedDirectory = resolve(root, directory);
  const resolved = resolve(root, src.replace(/^\//, ''));
  if (!isWithinDirectory(resolved, allowedDirectory)) return undefined;

  try {
    // A symlinked directory can otherwise escape the lexical path check.
    const realRoot = realpathSync(root);
    const realDirectory = realpathSync(allowedDirectory);
    if (!isWithinDirectory(realDirectory, realRoot)) return undefined;
  } catch {
    // Keep the lexical result so a missing file gets the stable "does not
    // exist" error below. Existing symlink escapes are rejected above.
  }
  try {
    // Resolve the final file separately. A missing file is reported below;
    // an existing symlink that escapes the designated directory is rejected.
    const realDirectory = realpathSync(allowedDirectory);
    const realResolved = realpathSync(resolved);
    if (!isWithinDirectory(realResolved, realDirectory)) return undefined;
  } catch {
    // The regular-file check below reports a missing path without exposing an
    // OS exception or filesystem details.
  }
  return { resolved, directory: allowedDirectory };
}

function validateAssetFile(
  check: AssetCheck,
  publicRoot: string,
): string[] {
  const errors: string[] = [];
  if (!isAllowedContentAssetExtension(check.src, check.kind)) {
    errors.push(`${check.label} has an invalid ${check.kind} extension`);
    return errors;
  }
  const resolved = resolveAssetInsidePublicDirectory(check.src, publicRoot, check.directory);
  if (!resolved) {
    errors.push(`${check.label} resolves outside public/${check.directory}`);
    return errors;
  }
  try {
    if (!lstatSync(resolved.resolved).isFile()) {
      errors.push(`${check.label} must resolve to a regular file`);
    }
  } catch {
    errors.push(`${check.label} file does not exist under public/${check.directory}`);
  }
  return errors;
}

function mediaChecks(caseStudy: CaseStudy, mediaIndex: number): AssetCheck[] {
  const prefix = `caseStudies[${caseStudy.slug}].media[${mediaIndex}]`;
  const media = caseStudy.media[mediaIndex];
  if (media.kind === 'image') {
    return [{ label: `${prefix}.src`, src: media.src, kind: 'image', directory: 'assets/cases' }];
  }
  return [
    { label: `${prefix}.src`, src: media.src, kind: 'video', directory: 'assets/cases' },
    ...(media.poster ? [{ label: `${prefix}.poster`, src: media.poster, kind: 'image' as const, directory: 'assets/cases' as const }] : []),
    ...(media.captionsSrc ? [{ label: `${prefix}.captionsSrc`, src: media.captionsSrc, kind: 'captions' as const, directory: 'assets/cases' as const }] : []),
  ];
}

export function validatePublicContentAssets(
  records: readonly CaseStudy[],
  content: SiteContent,
  publicRoot: string,
): PublicAssetValidationResult {
  const checks: AssetCheck[] = [];
  if (content.profile.portraitSrc) {
    checks.push({
      label: 'profile.portraitSrc',
      src: content.profile.portraitSrc,
      kind: 'image',
      directory: 'assets/profile',
    });
  }
  records.forEach((caseStudy) => {
    caseStudy.media.forEach((_, mediaIndex) => {
      checks.push(...mediaChecks(caseStudy, mediaIndex));
    });
  });

  const errors = checks.flatMap((check) => validateAssetFile(check, publicRoot));
  return { ok: errors.length === 0, errors };
}

export function validateSelfBuiltToolAssets(
  tools: readonly SelfBuiltTool[],
  publicRoot: string,
): PublicAssetValidationResult {
  const checks = tools.flatMap((tool): AssetCheck[] => tool.thumbnailSrc ? [{
    label: `selfBuiltTools[${tool.id}].thumbnailSrc`,
    src: tool.thumbnailSrc,
    kind: 'image',
    directory: 'assets/lab',
  }] : []);
  const errors = checks.flatMap((check) => validateAssetFile(check, publicRoot));
  return { ok: errors.length === 0, errors };
}
