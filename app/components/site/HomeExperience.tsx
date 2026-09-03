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

const PROFILE_PORTRAIT_BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAGAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAGAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABwcHBwcHDAcHDBEMDAwRFxEREREXHhcXFxcXHiQeHh4eHh4kJCQkJCQkJCsrKysrKzIyMjIyODg4ODg4ODg4OP/bAEMBCQkJDg0OGQ0NGTsoISg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O//dAAQAAv/aAAwDAQACEQMRAD8A8du5BGm8jPoKyxMhOHH3uhFXJ38xSK6yx0HS7m3E0lwBuTcAOduD6/Ss5z5dzanT5tjgpQFbGc+9Q5FdFr/h+70eVNxSSKYbo2UjJHuvUEfTHpXP+RP/AHDVp3V0ZyVnZn//0PCHlyMVPY3ZtplmC+YBklCSFJx3x6daoN0p0P8A8V/Kla+407aomvtQnu5nuJ2yzfkB2A9qzvtB96WTpVantohPXVn/2Q==';

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
  const profileReady = profile.approved && Boolean(profile.name && profile.portraitSrc && profile.portraitAlt && profile.career);
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
          <div className="section-marker"><span>06</span><span>{profileReady ? getSiteModeCopy(true).profileMarker : getSiteModeCopy(false).profileMarker}</span></div>
          <div className="profile-section__grid">
            {profileReady ? (
              <div className="profile-orbit profile-orbit--approved">
                <div className="profile-photo-frame">
                  <Image
                    className="profile-photo"
                    src={profile.portraitSrc!}
                    alt={profile.portraitAlt!}
                    width={960}
                    height={960}
                    sizes="(max-width: 720px) 56vw, 27vw"
                    preload
                    unoptimized
                    placeholder="blur"
                    blurDataURL={PROFILE_PORTRAIT_BLUR_DATA_URL}
                  />
                </div>
                <span className="profile-orbit__ring profile-orbit__ring--one" aria-hidden="true" />
                <span className="profile-orbit__ring profile-orbit__ring--two" aria-hidden="true" />
                <span className="profile-orbit__signal" aria-hidden="true">ID / PUBLIC</span>
                <p className="profile-identity-plate">
                  <span>NAME / IDENTITY</span>
                  <strong>{profile.name}</strong>
                </p>
              </div>
            ) : (
              <div className="profile-orbit" aria-hidden="true"><div className="profile-orbit__core"><span>CR</span></div><span className="profile-orbit__ring profile-orbit__ring--one" /><span className="profile-orbit__ring profile-orbit__ring--two" /><span className="profile-orbit__signal">ID / 00</span></div>
            )}
            <div className="profile-copy">
              <p className="eyebrow eyebrow--cyan">Person / Forward Deployed Engineer</p>
              <h2 id="profile-title"><span className="profile-heading-line">創造は論理を持って</span><br /><em className="profile-heading-line">かたちにする。</em></h2>
              <p className="profile-description">{profileReady ? profile.career : 'ただ創造するだけでなく、「なぜそうするのか」\n論理、根拠、設計思想をもって形にします。'}</p>
              <div className="profile-facts">
                <div><span>ROLE</span><strong>Forward Deployed Engineer</strong></div>
                <div><span>MODE</span><strong>Business × AI × Software</strong></div>
                <div><span>STATUS</span><strong>{profileReady ? 'Identity / approved' : 'Identity content pending approval'}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="contact-section" aria-labelledby="contact-title">
          <div className="section-marker"><span>07</span><span>CONTACT / START A FIELD LOOP</span></div>
          <div className="contact-section__grid"><div className="contact-copy"><p className="eyebrow eyebrow--mint">Let&apos;s work from the field</p><h2 id="contact-title"><span className="contact-heading-line">まずはお気軽に</span><br /><span className="contact-heading-line"><em>お悩み</em>をご相談</span><br /><span className="contact-heading-line">ください。</span></h2><p>まだ要件になっていなくても大丈夫です。現場で起きていること、変えたいこと、制約を教えてください。</p><aside className="contact-copy__availability" aria-label="営業連絡への返信について"><span>SALES INQUIRIES / NO REPLY</span><p>営業に関するご連絡には返信できません。あらかじめご了承ください。</p></aside><div className="contact-copy__meta"><span>{modeCopy.contactPolicy}</span><span>{modeCopy.contactSecurity}</span></div></div><ContactForm publicBuild={publicBuild} /></div>
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#top"><span>CRELO</span><small>FDE / FIELD SYSTEM</small></a><div className="footer-links"><a href="/privacy">Privacy notice</a><button type="button" onClick={() => window.dispatchEvent(new Event('crelo:replay-intro'))}>Replay intro</button></div><span className="footer-copyright">© {footerYear} CRELO / {modeCopy.footerStatus}</span></footer>
    </div>
  );
}
