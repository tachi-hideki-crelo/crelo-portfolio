export const CASE_STUDY_SLUGS = [
  'field-signal',
  'workflow-atlas',
  'decision-lens',
  'ops-interface',
  'delivery-orbit',
] as const;

export type CaseStudySlug = (typeof CASE_STUDY_SLUGS)[number];

export type CaseStudyImageMedia = {
  src: string;
  alt: string;
  kind: 'image';
  approved: boolean;
  approvedAt: string;
  width: number;
  height: number;
};

export type CaseStudyVideoRole = 'preview' | 'full';

export type CaseStudyVideoMedia = {
  src: string;
  alt: string;
  kind: 'video';
  role: CaseStudyVideoRole;
  approved: boolean;
  approvedAt: string;
  poster: string | null;
  hasAudio: boolean;
  captionsSrc: string | null;
};

export type CaseStudyMedia = CaseStudyImageMedia | CaseStudyVideoMedia;

export type CaseStudyDetailOutcome = {
  title: string;
  description: string;
};

export type CaseStudyDetail = {
  projectName: string;
  overview: string;
  outcomesLabel: '成果' | '効果';
  outcomes: readonly CaseStudyDetailOutcome[];
};

export type CaseStudy = {
  slug: CaseStudySlug;
  displayOrder: number;
  title: string | null;
  industry: string | null;
  periodLabel: string | null;
  challenge: string | null;
  constraints: readonly string[];
  role: string | null;
  discovery: string | null;
  design: string | null;
  implementation: string | null;
  rollout: string | null;
  qualitativeOutcome: string | null;
  detail: CaseStudyDetail | null;
  technologies: readonly string[];
  tags: readonly string[];
  theme: string;
  approved: boolean;
  /** Internal approval evidence; never projected to the public UI payload. */
  approvedAt: string | null;
  media: readonly CaseStudyMedia[];
};

export const INQUIRY_TYPES = [
  'project',
  'ai-workflow',
  'software-delivery',
  'other',
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];

export type ContactRequest = {
  name: string;
  company: string;
  email: string;
  inquiryType: InquiryType;
  message: string;
  consent: boolean;
  turnstileToken: string;
  requestId?: string;
  honeypot?: string;
};

export type ContactErrorCode =
  | 'INVALID_REQUEST'
  | 'CONTENT_TYPE_REQUIRED'
  | 'BODY_TOO_LARGE'
  | 'ORIGIN_NOT_ALLOWED'
  | 'BOT_DETECTED'
  | 'TURNSTILE_REJECTED'
  | 'REQUEST_DUPLICATE'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'DELIVERY_FAILED'
  | 'INTERNAL_ERROR';

export type ContactResponse = {
  ok: boolean;
  requestId?: string;
  errorCode?: ContactErrorCode;
};

export type ProfileContent = {
  name: string | null;
  portraitSrc: string | null;
  portraitAlt: string | null;
  career: string | null;
  approved: boolean;
  approvedAt: string | null;
};

export type PrivacyContent = {
  operator: string | null;
  version: string | null;
  effectiveDate: string | null;
  collectedItems: readonly string[];
  purposes: readonly string[];
  retentionPeriod: string | null;
  processors: string | null;
  overseasTransfer: string | null;
  rightsContact: string | null;
};

export type SiteContent = {
  profile: ProfileContent;
  privacy: PrivacyContent;
  contactEmail: string | null;
};

export type SelfBuiltToolAccent = 'mint' | 'cyan' | 'amber' | 'violet';

export type SelfBuiltToolDetail = {
  overview: string;
  problem: string;
  approach: string;
  features: readonly string[];
  technologies: readonly string[];
};

export type SelfBuiltTool = {
  id: string;
  order: number;
  title: string;
  category: string;
  summary: string;
  tags: readonly string[];
  accent: SelfBuiltToolAccent;
  status: 'placeholder' | 'published';
  slug: string | null;
  thumbnailSrc: string | null;
  thumbnailAlt: string | null;
  detail: SelfBuiltToolDetail | null;
};
