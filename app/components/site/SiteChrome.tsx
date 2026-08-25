'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { REPLAY_EVENT } from '../visual/IntroExperience';
import { getSiteModeCopy } from './site-mode';

const navItems = [
  { href: '#selected-work', label: 'Selected work' },
  { href: '#method', label: 'Method' },
  { href: '#profile', label: 'Profile' },
  { href: '#contact', label: 'Contact' },
];

export default function SiteChrome({ publicBuild }: { publicBuild: boolean }) {
  const modeCopy = getSiteModeCopy(publicBuild);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const replayPendingRef = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        const replayingIntro = replayPendingRef.current;
        replayPendingRef.current = false;
        if (!replayingIntro) menuButtonRef.current?.focus();
      }
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('.site-main, .site-footer'));
    const hadInert = inertTargets.map((element) => element.hasAttribute('inert'));
    inertTargets.forEach((element) => element.setAttribute('inert', ''));
    window.setTimeout(() => navRef.current?.querySelector<HTMLElement>('a')?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [menuButtonRef.current, ...Array.from(navRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [])].filter((element): element is HTMLElement => Boolean(element));
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      inertTargets.forEach((element, index) => {
        if (!hadInert[index]) element.removeAttribute('inert');
      });
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  const replayIntro = () => {
    replayPendingRef.current = open;
    window.dispatchEvent(new Event(REPLAY_EVENT));
    setOpen(false);
  };
  return (
    <>
      <header className="site-header">
        <a className="brand-mark" href="#top" aria-label="Crelo home">
          <Image src="/assets/crelo-logo.png" alt="Crelo" width={42} height={42} priority />
          <span>CRELO</span>
        </a>
        <nav ref={navRef} id="primary-navigation" className={`site-nav${open ? ' site-nav--open' : ''}`} aria-label="Primary navigation">
          {navItems.map((item, index) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{item.label}</a>)}
          <button className="site-nav__replay" type="button" onClick={replayIntro}>Replay intro <span aria-hidden="true">↗</span></button>
        </nav>
        <div className="header-right">
          <p className="header-status"><span className="status-dot" aria-hidden="true" /><span>{modeCopy.headerStatus}</span></p>
          <button ref={menuButtonRef} className="menu-toggle" type="button" aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((current) => !current)}><span /><span /><span /><b>{open ? 'Close' : 'Menu'}</b></button>
        </div>
      </header>
    </>
  );
}
