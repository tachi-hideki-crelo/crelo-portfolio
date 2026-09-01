'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import type { SiteContent } from '../../lib/types';
import ContactForm from './ContactForm';
import FdeMethod from './FdeMethod';
import HeroExperience from './HeroExperience';
import SelfDevelopmentLab from './SelfDevelopmentLab';
import SiteChrome from './SiteChrome';
import { getSiteModeCopy } from './site-mode';
import WebTemplateGallery from './WebTemplateGallery';
import IntroExperience from '../visual/IntroExperience';
import SelectedWork from '../work/selected-work';
import type { PublicCaseStudy } from '../work/work-public';

const NeuralBackdrop = dynamic(() => import('../visual/NeuralBackdrop'), {
  ssr: false,
  loading: () => <div className="neural-backdrop neural-backdrop--loading" aria-hidden="true" />,
});

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

        <FdeMethod />

        <WebTemplateGallery />

        <SelfDevelopmentLab />

        <section id="profile" className="profile-section" aria-labelledby="profile-title">
          <div className="section-marker"><span>06</span><span>{profileReady ? modeCopy.profileMarker : getSiteModeCopy(false).profileMarker}</span></div>
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
          <div className="section-marker"><span>07</span><span>CONTACT / START A FIELD LOOP</span></div>
          <div className="contact-section__grid"><div className="contact-copy"><p className="eyebrow eyebrow--mint">Let&apos;s work from the field</p><h2 id="contact-title"><span className="contact-heading-line">まず、課題の</span><br /><span className="contact-heading-line"><em>輪郭</em>を</span><br /><span className="contact-heading-line">聞かせてください。</span></h2><p>まだ要件になっていなくても大丈夫です。現場で起きていること、変えたいこと、制約を教えてください。</p><div className="contact-copy__meta"><span>{modeCopy.contactPolicy}</span><span>{modeCopy.contactSecurity}</span></div></div><ContactForm publicBuild={publicBuild} /></div>
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#top"><span>CRELO</span><small>FDE / FIELD SYSTEM</small></a><div className="footer-links"><a href="/privacy">Privacy notice</a><button type="button" onClick={() => window.dispatchEvent(new Event('crelo:replay-intro'))}>Replay intro</button></div><span className="footer-copyright">© {footerYear} CRELO / {modeCopy.footerStatus}</span></footer>
    </div>
  );
}
