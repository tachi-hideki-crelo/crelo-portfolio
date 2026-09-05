import type { CaseStudy, SiteContent } from './types.ts';
import { CASE_STUDY_SLUGS } from './types.ts';

export const HERO_COPY = {
  title: 'Forward Deployed Engineer',
  discipline: 'Business × AI × Software',
  lead: '課題整理から設計・開発・導入まで。',
  statement: '事業の課題を、技術で解決します。',
} as const;

const CASE_APPROVAL_DATE = '2026-09-04';

function privateCaseStudy(slug: (typeof CASE_STUDY_SLUGS)[number], index: number): CaseStudy {
  return {
    slug,
    displayOrder: index + 1,
    title: null,
    industry: null,
    periodLabel: null,
    challenge: null,
    constraints: [],
    role: null,
    discovery: null,
    design: null,
    implementation: null,
    rollout: null,
    qualitativeOutcome: null,
    detail: null,
    technologies: [],
    tags: [],
    theme: ['mint', 'cyan', 'violet', 'amber', 'rose'][index],
    approved: false,
    approvedAt: null,
    media: [],
  };
}

/**
 * Only explicitly approved cases are populated. The remaining slots stay
 * empty so no industry, outcome, or media is invented for them.
 */
export const caseStudies: readonly CaseStudy[] = [
  {
    ...privateCaseStudy('field-signal', 0),
    title: '宣伝動画の制作',
    role: 'AIを用いた動画の作成',
    detail: {
      projectName: 'AIフル活用によるプロモーション動画の企画・制作・実装',
      overview: '企画・絵コンテ作成・ビジュアル生成・動画化・BGM/ナレーション付与までを一気通貫でAIワークフロー化。従来の映像制作に比べ、制作コストとリードタイムを大幅に圧縮しながら、高品質な宣伝動画を構築しました。',
      outcomesLabel: '成果',
      outcomes: [
        {
          title: '制作コスト削減',
          description: '従来の外注実写・アニメーション制作と比較し、コストを大幅に削減',
        },
        {
          title: '短納期納品',
          description: '企画から完成まで最短数日での高速デプロイを実現',
        },
        {
          title: '柔軟なPDCA',
          description: '素材の差し替えやABテスト用パターンの量産が容易になり、広告・LP運用の改善スピードが向上',
        },
      ],
    },
    approved: true,
    approvedAt: CASE_APPROVAL_DATE,
    media: [
      {
        src: '/assets/cases/ai-promo-preview.mp4',
        alt: '宣伝動画の制作の一覧用プレビュー',
        kind: 'video',
        role: 'preview',
        approved: true,
        approvedAt: CASE_APPROVAL_DATE,
        poster: '/assets/cases/ai-promo-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
      {
        src: '/assets/cases/ai-promo-feature.mp4',
        alt: '宣伝動画の制作の本編',
        kind: 'video',
        role: 'full',
        approved: true,
        approvedAt: CASE_APPROVAL_DATE,
        poster: '/assets/cases/ai-promo-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
    ],
  },
  {
    ...privateCaseStudy('workflow-atlas', 1),
    title: 'チラシのデザイン制作',
    role: '印刷依頼代行まで対応',
    detail: {
      projectName: 'オフライン集客・成約率を最大化する販促チラシ／リーフレット制作・印刷代行',
      overview: 'ターゲット層や配布目的に合わせ、ペルソナ設計からキャッチコピー考案、ビジュアル作成、印刷所への入稿手配までを一貫して担当。標準的なA4片面・両面チラシはもちろん、情報量の多い3つ折りパンフレットなど、用途に応じた最適な判型・折り加工に幅広く対応しました。オフラインからオンラインへの動線構築も含めて設計・制作を行っています。',
      outcomesLabel: '効果',
      outcomes: [
        {
          title: '用途に合わせた最適フォーマットの提供',
          description: '卓上置き、ポスティング、対面手渡しなど、配布シーンに最も適した形状（両面・3つ折り等）を選択し、受取手の可読性・保存性を向上。',
        },
        {
          title: '事業主の負担軽減',
          description: '印刷会社ごとの仕様確認・トンボ付け・色調確認などの専門的な入稿工程を代行し、納品まで安心・スムーズに完了。',
        },
        {
          title: 'Web動線とのシームレスな統合',
          description: 'チラシ内のQRコードやキャンペーン導線を精緻に配置し、紙から自社Webサイトや公式LINEへの登録率向上に寄与。',
        },
      ],
    },
    approved: true,
    approvedAt: '2026-09-05',
    media: [
      {
        src: '/assets/cases/flyer-design-print.jpg',
        alt: 'コーヒー商品の両面チラシデザイン',
        kind: 'image',
        approved: true,
        approvedAt: '2026-09-05',
        width: 800,
        height: 565,
      },
    ],
  },
  ...CASE_STUDY_SLUGS.slice(2).map((slug, index) => privateCaseStudy(slug, index + 2)),
];

export const siteContent: SiteContent = {
  profile: {
    name: '舘 秀樹',
    portraitSrc: '/assets/profile/hideki-tachi.webp',
    portraitAlt: '舘 秀樹のプロフィール写真',
    career: 'ただ創造するだけでなく、「なぜそうするのか」\n論理、根拠、設計思想をもって形にします。',
    approved: true,
    approvedAt: '2026-09-03',
  },
  privacy: {
    operator: null,
    version: null,
    effectiveDate: null,
    collectedItems: [],
    purposes: [],
    retentionPeriod: null,
    processors: null,
    overseasTransfer: null,
    rightsContact: null,
  },
  contactEmail: null,
};
