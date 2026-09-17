export const WEB_TEMPLATE_ACCENTS = ['mint', 'cyan', 'amber', 'violet', 'rose'] as const;

export type WebTemplateAccent = (typeof WEB_TEMPLATE_ACCENTS)[number];

export type WebTemplate = {
  id: string;
  order: number;
  title: string;
  accent: WebTemplateAccent;
  url: string | null;
  thumbnailSrc: string | null;
  thumbnailAlt: string | null;
  category: string;
  tagline: string;
  description: string;
  traits: string;
  fit: string;
  videoSrc: string | null;
};

export type WebTemplateGalleryConfig = {
  galleryUrl: string | null;
  templates: readonly WebTemplate[];
};

/**
 * Keep every external destination in this data object. The rendering layer
 * only receives the result of the pure HTTPS validation helpers below, so a
 * future URL change cannot accidentally create an unsafe external link.
 */
export const webTemplateGallery: WebTemplateGalleryConfig = {
  galleryUrl: 'https://template-gallery.crelo.dev/',
  templates: [
    { id: '01', order: 1, title: 'モダン', accent: 'mint', url: 'https://template-gallery.crelo.dev/templates/modern/', thumbnailSrc: '/assets/templates/01.jpg', thumbnailAlt: 'ModernデザインのSaaS提案画面', category: 'BtoB / SaaS', tagline: '知的で静かな先進性。', description: '余白とセリフ体で、複雑なサービスを落ち着いて理解できる順番に整えます。', traits: '静かな信頼 / 余白 / 編集的', fit: 'BtoB SaaS・新規事業・コンサルティング', videoSrc: null },
    { id: '02', order: 2, title: 'プレミアム', accent: 'cyan', url: 'https://template-gallery.crelo.dev/templates/premium/', thumbnailSrc: '/assets/templates/02.jpg', thumbnailAlt: 'Premiumデザインの高級ホテル提案画面', category: 'Hospitality / Luxury', tagline: '体験の格を、言葉より先に伝える。', description: '大きな写真とゆっくりした間で、価格ではなく滞在や商品の価値を印象づけます。', traits: '上質 / 写真主役 / 余韻', fit: '高級ホテル・不動産・ラグジュアリーブランド', videoSrc: null },
    { id: '03', order: 3, title: 'マテリアル', accent: 'amber', url: 'https://template-gallery.crelo.dev/templates/material/', thumbnailSrc: '/assets/templates/03.jpg', thumbnailAlt: 'Materialデザインの教育アプリ提案画面', category: 'Education / Product', tagline: '親しみやすく、迷わせない。', description: '明快な階層と動きのある面表現で、機能や学習フローを直感的に伝えます。', traits: '明快 / 親しみ / 操作性', fit: '教育・アプリ・生活サービス・公共サービス', videoSrc: null },
    { id: '04', order: 4, title: 'エディトリアル', accent: 'violet', url: 'https://template-gallery.crelo.dev/templates/editorial/', thumbnailSrc: '/assets/templates/04.jpg', thumbnailAlt: 'Editorialデザインの建築スタジオ画面', category: 'Architecture / Studio', tagline: '思想を、読み進めたくなる形へ。', description: '雑誌のような組版と写真のリズムで、実績の背景や設計思想まで深く伝えます。', traits: '知性 / 読み物 / 大胆な組版', fit: '建築・クリエイティブスタジオ・研究・文化事業', videoSrc: null },
    { id: '05', order: 5, title: 'ペーパー', accent: 'rose', url: 'https://template-gallery.crelo.dev/templates/paper/', thumbnailSrc: '/assets/templates/05.jpg', thumbnailAlt: 'Paperデザインの書籍編集提案画面', category: 'Publishing / Craft', tagline: '丁寧さと手触りを感じさせる。', description: '紙面を思わせる静かな質感で、言葉、素材、制作工程へのこだわりを届けます。', traits: '誠実 / 手仕事 / 温度感', fit: '出版・工芸・食品・地域ブランド・記念事業', videoSrc: null },
    { id: '06', order: 6, title: 'レトロ', accent: 'mint', url: 'https://template-gallery.crelo.dev/templates/retro/', thumbnailSrc: '/assets/templates/06.jpg', thumbnailAlt: 'Retroデザインのダイナー画面', category: 'Food / Lifestyle', tagline: '懐かしさで、ブランドとの距離を縮める。', description: '記憶にある色や書体を現代的に再構成し、親しみと楽しさを同時につくります。', traits: '親近感 / 懐かしさ / 楽しさ', fit: '飲食・観光・ライフスタイル・周年企画', videoSrc: null },
    { id: '07', order: 7, title: 'ベントー', accent: 'cyan', url: 'https://template-gallery.crelo.dev/templates/bento/', thumbnailSrc: '/assets/templates/07.jpg', thumbnailAlt: 'Bentoデザインの採用サイト画面', category: 'Recruit / Culture', tagline: '多い情報を、楽しく見渡せる。', description: '大小のブロックで人、文化、数字を整理し、情報量が多くても軽快に読ませます。', traits: '活気 / モジュール / 情報整理', fit: '採用・組織紹介・コミュニティ・複合サービス', videoSrc: null },
    { id: '08', order: 8, title: 'ブルータリズム', accent: 'amber', url: 'https://template-gallery.crelo.dev/templates/brutalism/', thumbnailSrc: '/assets/templates/08.jpg', thumbnailAlt: 'Brutalismデザインのアート企画画面', category: 'Art / Culture', tagline: '整えすぎず、姿勢を正面から示す。', description: '太い境界線と生々しい組版で、企画の意志、反骨性、現場の熱を強く残します。', traits: '挑発的 / 生々しさ / 強い主張', fit: 'アート・音楽・イベント・若者向けブランド', videoSrc: null },
    { id: '09', order: 9, title: 'ネオン', accent: 'violet', url: 'https://template-gallery.crelo.dev/templates/neon/', thumbnailSrc: '/assets/templates/09.jpg', thumbnailAlt: 'Neonデザインのナイトイベント画面', category: 'Music / Night Event', tagline: '熱量と高揚感を、一瞬で伝える。', description: '暗い画面に発光色と動きを集中させ、日時、出演者、会場への期待を高めます。', traits: '高揚感 / 発光 / スピード', fit: '音楽・ゲーム・ナイトイベント・テックイベント', videoSrc: null },
    { id: '10', order: 10, title: 'グラスモーフィズム', accent: 'rose', url: 'https://template-gallery.crelo.dev/templates/glassmorphism/', thumbnailSrc: '/assets/templates/10.jpg', thumbnailAlt: 'Glassmorphismデザインのウェルネス提案画面', category: 'Wellness / Beauty', tagline: '透明感と奥行きで、心地よさを伝える。', description: '透ける層、柔らかな光、ゆっくりした動きで、清潔感とリラックスした空気をつくります。', traits: '透明感 / 癒し / 軽やかさ', fit: '美容・ウェルネス・医療・高機能プロダクト', videoSrc: null },
    { id: '11', order: 11, title: 'エンタープライズ', accent: 'mint', url: 'https://template-gallery.crelo.dev/templates/enterprise/', thumbnailSrc: '/assets/templates/11.jpg', thumbnailAlt: 'Enterpriseデザインのクラウド運用画面', category: 'Cloud / Infrastructure', tagline: '複雑さを、運用できる安心感へ。', description: '高密度な情報と監視画面の文法で、大規模な仕組みを扱える専門性と堅牢性を示します。', traits: '専門性 / 高密度 / 堅牢', fit: 'クラウド・セキュリティ・金融・業務基盤', videoSrc: null },
    { id: '12', order: 12, title: 'イマーシブ', accent: 'cyan', url: 'https://template-gallery.crelo.dev/templates/immersive/', thumbnailSrc: '/assets/templates/12.jpg', thumbnailAlt: 'Immersiveデザインの体験型企画画面', category: 'Exhibition / Experience', tagline: 'スクロールそのものを、体験に変える。', description: '章立て、色面、動きの連続で、展示を巡るようにコンテンツを探索させます。', traits: '没入 / 探索 / ストーリー', fit: '展示・ミュージアム・空間演出・体験型企画', videoSrc: null },
    { id: '13', order: 13, title: 'シネマティック', accent: 'amber', url: 'https://template-gallery.crelo.dev/templates/yunoa/', thumbnailSrc: '/assets/templates/13.webp', thumbnailAlt: 'ユノアと残響の塔。水彩で描かれた荒廃した世界と遠くの塔', category: 'Animation / Film', tagline: '物語の世界へ、足を踏み入れる。', description: '『ユノアと残響の塔』。水彩の風景、森が開くスクロール、光と風の演出で、映画の世界を旅する宣伝LPです。', traits: '映画的 / 水彩 / スクロール演出', fit: '映画・アニメーション・ゲーム・物語のあるブランド', videoSrc: null },
    { id: '14', order: 14, title: 'NOCTARIA', accent: 'violet', url: 'https://template-gallery.crelo.dev/templates/noctaria/', thumbnailSrc: '/assets/templates/14.webp', thumbnailAlt: '次元海賊NOCTARIA。魔導帆船に集まる5人のクルー', category: 'VTuber / Fantasy Adventure', tagline: '海図をひらいて、まだ見ぬ世界へ。', description: '5人の次元海賊と夜の海へ。クリックで出航するイントロ、クルー固有の演出、海域が変わる航海体験を備えた公式サイト風テンプレートです。', traits: '冒険 / キャラクター / 没入型イントロ', fit: 'VTuber・ゲーム・エンターテインメント・ファンタジー', videoSrc: null },
    { id: '15', order: 15, title: 'TERRISE', accent: 'rose', url: 'https://template-gallery.crelo.dev/templates/terrise/', thumbnailSrc: '/assets/templates/15.webp', thumbnailAlt: 'TERRISE。雨に濡れた未来都市で、プラズマ大剣を手に巨獣へ挑むセナ', category: 'Action RPG / Science Fiction', tagline: '地球を、奪い返せ。', description: '軌道上から巨獣の待つ地球へ。出撃イントロ、5人の隊員選択、回して調べる3D兵装展示を備えた、地球奪還アクションRPGのコンセプトLPです。', traits: '近未来 / アクション / 実3Dホログラム', fit: 'ゲーム・SF・キャラクターIP・エンターテインメント', videoSrc: null },
  ],
};

/** Return true only for an absolute HTTPS URL without user credentials. */
export function isValidHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Return a safe normalized href, or null for unset/invalid destinations. */
export function getSafeHttpsUrl(value: unknown): string | null {
  return isValidHttpsUrl(value) ? new URL(value).toString() : null;
}

export function getSafeGalleryUrl(config: WebTemplateGalleryConfig): string | null {
  return getSafeHttpsUrl(config.galleryUrl);
}

export function getSafeTemplateUrl(template: WebTemplate): string | null {
  return getSafeHttpsUrl(template.url);
}

export function getSafeTemplateThumbnail(template: WebTemplate): string | null {
  return isValidLocalThumbnailPath(template.thumbnailSrc) && typeof template.thumbnailAlt === 'string' && template.thumbnailAlt.trim() !== ''
    ? template.thumbnailSrc
    : null;
}

export function getSafeTemplateVideo(template: WebTemplate): string | null {
  return isValidLocalTemplateVideoPath(template.videoSrc) ? template.videoSrc : null;
}

/** Local public assets are intentionally stricter than external hrefs. */
export function isValidLocalThumbnailPath(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\/assets\/templates\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|webp|png|jpe?g|gif|svg)$/.test(value)) return false;
  const relativePath = value.slice('/assets/templates/'.length);
  return !relativePath.includes('//') && !relativePath.split('/').some((segment) => segment === '.' || segment === '..');
}

export function isValidLocalTemplateVideoPath(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\/assets\/templates\/[A-Za-z0-9][A-Za-z0-9._/-]*\.mp4$/.test(value)) return false;
  const relativePath = value.slice('/assets/templates/'.length);
  return !relativePath.includes('//') && !relativePath.split('/').some((segment) => segment === '.' || segment === '..');
}

export type WebTemplateGalleryValidation = { ok: true; errors: [] } | { ok: false; errors: string[] };

export function validateWebTemplateGalleryConfig(config: WebTemplateGalleryConfig): WebTemplateGalleryValidation {
  const errors: string[] = [];
  const galleryUrl = config?.galleryUrl;
  const templates = Array.isArray(config?.templates) ? config.templates : [];
  if (galleryUrl !== null && !isValidHttpsUrl(galleryUrl)) {
    errors.push('galleryUrl must be an HTTPS URL without credentials or null.');
  }
  if (!Array.isArray(config?.templates) || templates.length !== 15) {
    errors.push('templates must contain exactly 15 entries.');
  }

  const orders = new Set<number>();
  const ids = new Set<string>();
  templates.forEach((template, index) => {
    const label = `templates[${index}]`;
    if (!template || typeof template !== 'object') {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (!Number.isInteger(template.order) || template.order < 1 || template.order > 15 || orders.has(template.order)) {
      errors.push(`${label}.order must be a unique integer from 1 to 15.`);
    }
    orders.add(template.order);
    if (typeof template.id !== 'string' || template.id.trim() === '' || ids.has(template.id)) errors.push(`${label}.id must be unique and non-empty.`);
    ids.add(template.id);
    if (typeof template.title !== 'string' || template.title.trim() === '') errors.push(`${label}.title must be non-empty.`);
    if (!WEB_TEMPLATE_ACCENTS.includes(template.accent)) errors.push(`${label}.accent is invalid.`);
    if (!isValidHttpsUrl(template.url) && template.url !== null) errors.push(`${label}.url must be an HTTPS URL without credentials or null.`);
    const hasSrc = template.thumbnailSrc !== null;
    const hasAlt = template.thumbnailAlt !== null;
    if (hasSrc !== hasAlt) errors.push(`${label}.thumbnailSrc and thumbnailAlt must be set together.`);
    if (hasSrc && !isValidLocalThumbnailPath(template.thumbnailSrc)) errors.push(`${label}.thumbnailSrc must be a local /assets/templates path.`);
    if (hasAlt && (typeof template.thumbnailAlt !== 'string' || template.thumbnailAlt.trim() === '')) errors.push(`${label}.thumbnailAlt must be non-empty.`);
    for (const key of ['category', 'tagline', 'description', 'traits', 'fit'] as const) {
      if (typeof template[key] !== 'string' || template[key].trim() === '') errors.push(`${label}.${key} must be non-empty.`);
    }
    if (template.videoSrc !== null && !isValidLocalTemplateVideoPath(template.videoSrc)) errors.push(`${label}.videoSrc must be a local MP4 path or null.`);
  });

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function getPendingTemplateMessage(template: WebTemplate): string {
  return `${template.title} のURLは準備中です。`;
}
