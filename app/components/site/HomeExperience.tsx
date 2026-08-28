'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import type { SiteContent } from '../../lib/types';
import ContactForm from './ContactForm';
import HeroExperience from './HeroExperience';
import SiteChrome from './SiteChrome';
import { getSiteModeCopy } from './site-mode';
import IntroExperience from '../visual/IntroExperience';
import SelectedWork from '../work/selected-work';
import type { PublicCaseStudy } from '../work/work-public';

const NeuralBackdrop = dynamic(() => import('../visual/NeuralBackdrop'), {
  ssr: false,
  loading: () => <div className="neural-backdrop neural-backdrop--loading" aria-hidden="true" />,
});

const processSteps = [
  { code: '01', name: 'Frame', jp: '課題を定義する', copy: '現場の声と事業の制約をつなぎ、何を解くべきかを一緒に定めます。' },
  { code: '02', name: 'Prove', jp: '仮説を確かめる', copy: '小さく作って触り、技術と業務の両面から進む理由を可視化します。' },
  { code: '03', name: 'Build', jp: '使える形にする', copy: 'AI・ソフトウェア・連携を、運用に乗る設計へ落とし込みます。' },
  { code: '04', name: 'Land', jp: '現場へ届ける', copy: '導入後の学習と改善まで伴走し、チームの手に残る仕組みにします。' },
];

const capabilities = [
  { number: '01', title: 'AI', label: 'INTELLIGENCE LAYER', copy: '生成AI・検索・評価を、業務の判断と行動へつなげる。', detail: 'Discovery / Evaluation / Prompt systems' },
  { number: '02', title: 'Software', label: 'PRODUCT SURFACE', copy: '曖昧な要件を、触れるプロダクトと持続するコードへ。', detail: 'Web apps / Interfaces / APIs' },
  { number: '03', title: 'Integration', label: 'SYSTEM BRIDGE', copy: '既存のデータと人の流れを断ち切らず、連携を設計する。', detail: 'Data flows / Automation / Security' },
  { number: '04', title: 'Deployment', label: 'FIELD OPERATIONS', copy: 'リリースの先にある現場定着まで、観測し、調整する。', detail: 'Enablement / Rollout / Iteration' },
];

type HomeExperienceProps = {
  publicBuild: boolean;
  profile: SiteContent['profile'];
  workCases: readonly PublicCaseStudy[];
  footerYear: number;
};

export default function HomeExperience({ publicBuild, profile, workCases, footerYear }: HomeExperienceProps) {
  const mainRef = useRef<HTMLElement>(null);
  const [heroEntrance, setHeroEntrance] = useState({ ready: false, sequence: 0 });
  const handleIntroStart = useCallback(() => {
    setHeroEntrance((current) => current.ready ? { ...current, ready: false } : current);
  }, []);
  const handleIntroComplete = useCallback(() => {
    setHeroEntrance((current) => ({ ready: true, sequence: current.sequence + 1 }));
  }, []);
  const profileReady = publicBuild && profile.approved && Boolean(profile.name && profile.portraitSrc && profile.portraitAlt && profile.career);
  const modeCopy = getSiteModeCopy(publicBuild);

  return (
    <div className="site-shell">
      <NeuralBackdrop />
      <IntroExperience mainRef={mainRef} onIntroStart={handleIntroStart} onIntroComplete={handleIntroComplete} />
      <SiteChrome publicBuild={publicBuild} />

      <main id="main-content" ref={mainRef} className="site-main" tabIndex={-1}>
        <HeroExperience entranceReady={heroEntrance.ready} entranceSequence={heroEntrance.sequence} />

        <SelectedWork cases={workCases} />

        <section id="method" className="method-section" aria-labelledby="method-title">
          <div className="section-marker"><span>03</span><span>FDE METHOD / FIELD LOOP</span></div>
          <div className="method-section__intro">
            <p className="eyebrow eyebrow--mint">From ambiguity to adoption</p>
            <h2 id="method-title">Frame <span>→</span> Prove <span>→</span> Build <span>→</span> Land</h2>
            <p>技術を納品して終わらせず、事業の現場で使われ続けるところまで。4つの動詞で、変化を前へ進めます。</p>
          </div>
          <div className="method-rail" aria-label="FDE process">
            {processSteps.map((step) => (
              <article className="method-step" key={step.name}>
                <div className="method-step__top"><span>{step.code}</span><span className="method-step__node" aria-hidden="true" /></div>
                <h3>{step.name}</h3>
                <p className="method-step__jp">{step.jp}</p>
                <p>{step.copy}</p>
                <span className="method-step__cursor" aria-hidden="true">+</span>
              </article>
            ))}
          </div>
        </section>

        <section className="capabilities-section" aria-labelledby="capabilities-title">
          <div className="section-marker"><span>04</span><span>CAPABILITY MAP / SYSTEM LAYERS</span></div>
          <div className="capabilities-section__head"><div><p className="eyebrow eyebrow--amber">Capability map</p><h2 id="capabilities-title">Business context <br /><em>into</em> working systems.</h2></div><p>ひとつの専門領域に閉じず、事業・技術・現場の境界を往復します。</p></div>
          <div className="capability-grid">
            {capabilities.map((capability) => (
              <article className="capability-card" key={capability.title}>
                <div className="capability-card__top"><span>{capability.number}</span><span className="capability-card__signal" aria-hidden="true" /></div>
                <span className="capability-card__label">{capability.label}</span>
                <h3>{capability.title}</h3>
                <p>{capability.copy}</p>
                <span className="capability-card__detail">{capability.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="profile" className="profile-section" aria-labelledby="profile-title">
          <div className="section-marker"><span>05</span><span>{profileReady ? modeCopy.profileMarker : getSiteModeCopy(false).profileMarker}</span></div>
          <div className="profile-section__grid">
            {profileReady ? (
              <div className="profile-orbit profile-orbit--approved">
                <Image className="profile-photo" src={profile.portraitSrc!} alt={profile.portraitAlt!} width={640} height={640} />
                <span className="profile-orbit__ring profile-orbit__ring--one" aria-hidden="true" />
                <span className="profile-orbit__ring profile-orbit__ring--two" aria-hidden="true" />
                <span className="profile-orbit__signal" aria-hidden="true">ID / PUBLIC</span>
              </div>
            ) : (
              <div className="profile-orbit" aria-hidden="true"><div className="profile-orbit__core"><span>CR</span></div><span className="profile-orbit__ring profile-orbit__ring--one" /><span className="profile-orbit__ring profile-orbit__ring--two" /><span className="profile-orbit__signal">ID / 00</span></div>
            )}
            <div className="profile-copy">
              <p className="eyebrow eyebrow--cyan">The person behind Crelo</p>
              {profileReady ? (
                <>
                  <h2 id="profile-title">{profile.name}</h2>
                  <p>{profile.career}</p>
                  <div className="profile-facts"><div><span>ROLE</span><strong>Forward Deployed Engineer</strong></div><div><span>MODE</span><strong>Business × AI × Software</strong></div><div><span>STATUS</span><strong>Public profile / approved</strong></div></div>
                </>
              ) : (
                <>
                  <h2 id="profile-title"><span className="profile-heading-line">知るところから、</span><br /><em>つくる。</em></h2>
                  <p>Creloの実名・顔写真・経歴は、公開承認後にこの場所へ反映します。いまは屋号としての考え方と、現場に向き合う姿勢を公開しています。</p>
                  <div className="profile-facts"><div><span>ROLE</span><strong>Forward Deployed Engineer</strong></div><div><span>MODE</span><strong>Business × AI × Software</strong></div><div><span>STATUS</span><strong>Identity content pending approval</strong></div></div>
                </>
              )}
            </div>
          </div>
        </section>

        <section id="contact" className="contact-section" aria-labelledby="contact-title">
          <div className="section-marker"><span>06</span><span>CONTACT / START A FIELD LOOP</span></div>
          <div className="contact-section__grid"><div className="contact-copy"><p className="eyebrow eyebrow--mint">Let&apos;s work from the field</p><h2 id="contact-title"><span className="contact-heading-line">まず、課題の</span><br /><span className="contact-heading-line"><em>輪郭</em>を</span><br /><span className="contact-heading-line">聞かせてください。</span></h2><p>まだ要件になっていなくても大丈夫です。現場で起きていること、変えたいこと、制約を教えてください。</p><div className="contact-copy__meta"><span>{modeCopy.contactPolicy}</span><span>{modeCopy.contactSecurity}</span></div></div><ContactForm publicBuild={publicBuild} /></div>
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#top"><span>CRELO</span><small>FDE / FIELD SYSTEM</small></a><div className="footer-links"><a href="/privacy">Privacy notice</a><button type="button" onClick={() => window.dispatchEvent(new Event('crelo:replay-intro'))}>Replay intro</button></div><span className="footer-copyright">© {footerYear} CRELO / {modeCopy.footerStatus}</span></footer>
    </div>
  );
}
