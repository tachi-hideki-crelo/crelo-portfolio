import type { SelfBuiltTool, SelfBuiltToolAccent } from '../../lib/types';

export type SelfBuiltToolValidationResult = {
  ok: boolean;
  errors: string[];
};

const ACCENTS: readonly SelfBuiltToolAccent[] = ['mint', 'cyan', 'amber', 'violet'];
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_THUMBNAIL = /^\/assets\/lab\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

export const selfBuiltTools: readonly SelfBuiltTool[] = [
  {
    id: 'tool-slot-1',
    order: 1,
    title: 'clipmory',
    category: 'PERSONAL LAB / CLIPBOARD',
    summary: 'コピーしたテキスト・リンク・画像・ファイルを履歴としてまとめるコピペツール。検索や「よく使う」項目から必要な内容を見つけ、繰り返し使う情報を手軽に呼び出せます。',
    tags: ['コピー履歴', '検索', 'よく使う'],
    accent: ACCENTS[0],
    status: 'published',
    slug: 'clipmory',
    thumbnailSrc: '/assets/lab/clipmory-demo.jpg',
    thumbnailAlt: 'clipmoryの画面。コピーしたテキスト・リンク・画像・ファイルの履歴カードと検索欄が表示されている。',
    detail: {
      overview: 'コピーしたテキスト・リンク・画像・ファイルを履歴としてまとめ、検索や「よく使う」項目から必要な内容を呼び出せるコピペツールです。',
      problem: 'コピーした内容が別の操作で流れてしまうと、同じ情報を探し直したり、もう一度コピーしたりする手間が生じます。',
      approach: 'テキスト・リンク・画像・ファイルを同じ履歴画面に並べ、検索と「よく使う」導線から必要な内容へ戻れる構成にしています。',
      features: ['テキスト・リンク・画像・ファイルの履歴表示', '履歴の検索', 'よく使う項目へのアクセス'],
      technologies: [],
    },
  },
  {
    id: 'tool-slot-2',
    order: 2,
    title: 'kotoseto',
    category: 'PERSONAL LAB / TASK MANAGEMENT',
    summary: 'タスク・スケジュール・チームの進捗をひとつの画面で確認できるタスク管理ツール。プロジェクトごとのタスク一覧やカレンダー、チャットをまとめ、日々の作業と情報共有を支えます。',
    tags: ['タスク一覧', 'カレンダー', 'チャット'],
    accent: ACCENTS[1],
    status: 'published',
    slug: 'kotoseto',
    thumbnailSrc: '/assets/lab/kotoseto-demo.jpg',
    thumbnailAlt: 'kotosetoの画面。タスク一覧、カレンダー、チャットタブと、担当者・優先度・期限・進捗の情報が表示されている。',
    detail: {
      overview: 'タスク、スケジュール、チームの進捗をひとつの画面で確認できるタスク管理ツールです。',
      problem: 'タスク、予定、チーム内の会話が別々になると、作業状況や次の対応を確認するための往復が増えます。',
      approach: 'タスク一覧、カレンダー、チャットを同じ画面にまとめ、担当者・優先度・期限・進捗を確認できる構成にしています。',
      features: ['プロジェクトごとのタスク一覧', 'カレンダーによるスケジュール確認', 'チャットによるチーム共有', '担当者・優先度・期限・進捗の表示'],
      technologies: [],
    },
  },
];

export function isValidSelfBuiltToolSlug(value: string): boolean {
  return SAFE_SLUG.test(value);
}

export function isValidLabThumbnailPath(value: string): boolean {
  return SAFE_THUMBNAIL.test(value) && !value.includes('..') && !value.includes('//');
}

export function validateSelfBuiltTools(tools: readonly SelfBuiltTool[]): SelfBuiltToolValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  const slugs = new Set<string>();

  tools.forEach((tool, index) => {
    const label = `selfBuiltTools[${index}]`;
    if (!tool.id.trim() || ids.has(tool.id)) errors.push(`${label}.id must be non-empty and unique`);
    ids.add(tool.id);
    if (!Number.isInteger(tool.order) || tool.order < 1 || orders.has(tool.order)) errors.push(`${label}.order must be a unique positive integer`);
    orders.add(tool.order);

    if ((tool.thumbnailSrc === null) !== (tool.thumbnailAlt === null)) {
      errors.push(`${label}.thumbnailSrc and thumbnailAlt must be set together`);
    }
    if (tool.thumbnailSrc && !isValidLabThumbnailPath(tool.thumbnailSrc)) {
      errors.push(`${label}.thumbnailSrc must use a safe local /assets/lab image path`);
    }
    if (tool.thumbnailAlt !== null && !tool.thumbnailAlt.trim()) errors.push(`${label}.thumbnailAlt must not be empty`);

    if (tool.status === 'placeholder') {
      if (tool.slug !== null || tool.detail !== null) errors.push(`${label} placeholder entries cannot expose a slug or detail`);
      return;
    }

    if (!tool.slug || !isValidSelfBuiltToolSlug(tool.slug)) errors.push(`${label}.slug must be a safe lowercase slug`);
    if (tool.slug && slugs.has(tool.slug)) errors.push(`${label}.slug must be unique`);
    if (tool.slug) slugs.add(tool.slug);
    if (!tool.detail) errors.push(`${label}.detail is required for published entries`);
    if (!tool.title.trim() || tool.title === '名称準備中') errors.push(`${label}.title must be final before publishing`);
    if (!tool.summary.trim()) errors.push(`${label}.summary is required for published entries`);
  });

  return { ok: errors.length === 0, errors };
}

export function getPublishedSelfBuiltTools(tools: readonly SelfBuiltTool[] = selfBuiltTools): readonly SelfBuiltTool[] {
  return tools.filter((tool) => tool.status === 'published' && tool.slug && tool.detail);
}

export function getPublishedSelfBuiltTool(slug: string, tools: readonly SelfBuiltTool[] = selfBuiltTools): SelfBuiltTool | undefined {
  return getPublishedSelfBuiltTools(tools).find((tool) => tool.slug === slug);
}
