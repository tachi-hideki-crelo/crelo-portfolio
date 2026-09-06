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
      labelSuffix: '',
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
      labelSuffix: '',
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
  {
    ...privateCaseStudy('decision-lens', 2),
    title: 'ECサイト構築',
    role: 'サービス選定から独自開発まで',
    detail: {
      projectName: '事業規模・予算に応じた最適なECサイト構築・開発',
      overview: 'クライアントのビジネスフェーズや商品特性、予算感に合わせて最適な構築手法を提案・実装。BASEやカラーミーショップ、Shopifyなどの主要プラットフォーム選定から初期設定・デザインカスタマイズまで対応。さらに、既存のプラットフォームでは実現できない独自の会員システムや複雑な受発注フロー、専用機能が求められる場合には、ゼロからの完全独自開発（フルスクラッチ）にも対応しています。',
      outcomesLabel: '効果',
      labelSuffix: '',
      outcomes: [
        {
          title: '初期投資・運用コストの最適化',
          description: 'ツールありきではなく事業フェーズに合わせた最適な基盤を選択したことで、無駄な開発費用・月額ランニングコストを大幅に抑制。',
        },
        {
          title: '購入率（CVR）を高めるUI/UX設計',
          description: 'モバイル最適化や直感的な購入フロー、AIを活用した商品説明文・ビジュアルの最適化により、離脱を防ぎ購買転換率を向上。',
        },
        {
          title: '運用の自動化・属人化解消',
          description: '決済連携、在庫管理、発送連絡などのバックオフィス業務を効率化し、少人数でも無理なくEC運営が回る仕組みを構築。',
        },
      ],
    },
    approved: true,
    approvedAt: '2026-09-06',
    media: [
      {
        src: '/assets/cases/ec-site-preview.mp4',
        alt: 'ECサイト構築の一覧用プレビュー',
        kind: 'video',
        role: 'preview',
        approved: true,
        approvedAt: '2026-09-06',
        poster: '/assets/cases/ec-site-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
      {
        src: '/assets/cases/ec-site-feature.mp4',
        alt: 'ECサイト構築の詳細動画',
        kind: 'video',
        role: 'full',
        approved: true,
        approvedAt: '2026-09-06',
        poster: '/assets/cases/ec-site-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
    ],
  },
  {
    ...privateCaseStudy('ops-interface', 3),
    title: 'Webサイト構築',
    role: '集客・成約・業務効率化まで',
    detail: {
      projectName: 'ビジネスの目的に合わせたWebサイト制作・システム構築',
      overview: '単なる「会社案内」にとどまらず、集客・成約・業務効率化のハブとして機能するWebサイトを構築。WordPressを用いた迅速なCMS構築はもちろん、パフォーマンスやセキュリティ、特殊なUI/UXが求められるプロジェクトでは、モダンな技術スタックを用いたゼロベースでの完全独自開発（フルスクラッチ）にも対応。スパム対策や自動返信、通知連携を含めた「問い合わせ機能の実装」や、現場スタッフが手軽に運用できる「お知らせ・コンテンツ管理システム」など、多様なニーズに合わせた柔軟なカスタマイズを提供しました。',
      outcomesLabel: '効果',
      labelSuffix: '',
      outcomes: [
        {
          title: '内製化による運用コスト削減',
          description: '管理画面から直感的に更新できる仕組みを整えたことで、軽微な修正やニュース発信の外注コストとタイムラグをゼロ化。',
        },
        {
          title: '問い合わせ率（CVR）の向上',
          description: 'ユーザーが迷わない導線設計と入力負荷を軽減したフォーム実装により、Webサイト経由の問い合わせ・相談獲得数が増加。',
        },
        {
          title: '高速表示とマルチデバイス最適化',
          description: '表示速度の高速化とモバイルファースト設計により、SEO評価およびユーザーの直帰率改善に寄与。',
        },
      ],
    },
    approved: true,
    approvedAt: '2026-09-06',
    media: [
      {
        src: '/assets/cases/web-site-preview.mp4',
        alt: 'Webサイト構築の一覧用プレビュー',
        kind: 'video',
        role: 'preview',
        approved: true,
        approvedAt: '2026-09-06',
        poster: '/assets/cases/web-site-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
      {
        src: '/assets/cases/web-site-feature.mp4',
        alt: 'Webサイト構築の詳細動画',
        kind: 'video',
        role: 'full',
        approved: true,
        approvedAt: '2026-09-06',
        poster: '/assets/cases/web-site-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
    ],
  },
  {
    ...privateCaseStudy('delivery-orbit', 4),
    title: '業務のDX化',
    role: '受発注・製造・原価管理を一元化',
    detail: {
      projectName: '受発注・製造・原価管理を一元化する「業務データ統合基盤」の構築およびDX推進',
      overview: 'アナログな手作業や紙文化が残る受発注・製造・原価管理フローを抜本的に見直し、データ蓄積から取り込み、集計・出力までをワンストップで連携する業務基盤を設計・開発。',
      outcomesLabel: '効果',
      labelSuffix: '',
      outcomes: [
        {
          title: '転記作業のゼロ化と人的ミスの撲滅',
          description: 'FAXからの注文手入力や確認作業にかかる膨大な時間を削減し、入力ミス・注文漏れ・伝達ミスを大幅に抑制。',
        },
        {
          title: '発注・仕込み業務の効率化とロス削減',
          description: '注文データに連動して必要な食材・資材数が即座に可視化されるため、過不足のない発注と仕込みが可能になり、食品・資材ロスを低減。',
        },
        {
          title: '原価・利益のリアルタイム可視化',
          description: '従来は見えづらかった日々の実績原価や月間予測がタイムリーに把握できるようになり、迅速な経営判断とコストコントロールを実現。',
        },
      ],
    },
    approved: true,
    approvedAt: '2026-09-06',
    media: [
      {
        src: '/assets/cases/business-dx-dashboard.jpg',
        alt: '受注管理、製造進捗、在庫状況、原価推移を一元表示したサンプル管理画面',
        kind: 'image',
        approved: true,
        approvedAt: '2026-09-06',
        width: 1280,
        height: 720,
      },
    ],
  },
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
