export type ContentAssetKind = 'image' | 'video' | 'captions';

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'ogv', 'webm']);

function extensionOf(value: string): string {
  const filename = value.slice(value.lastIndexOf('/') + 1);
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export function isAllowedContentAssetExtension(value: string, kind: ContentAssetKind): boolean {
  const extension = extensionOf(value);
  if (kind === 'image') return IMAGE_EXTENSIONS.has(extension);
  if (kind === 'video') return VIDEO_EXTENSIONS.has(extension);
  return extension === 'vtt';
}

export function allowedContentAssetExtensions(kind: ContentAssetKind): readonly string[] {
  if (kind === 'image') return [...IMAGE_EXTENSIONS];
  if (kind === 'video') return [...VIDEO_EXTENSIONS];
  return ['vtt'];
}
