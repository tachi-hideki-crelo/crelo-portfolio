import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" className="not-found-page" tabIndex={-1}>
      <div className="not-found-page__grid" aria-hidden="true" />
      <div className="not-found-page__code">ERR / FIELD_NOT_FOUND</div>
      <div className="not-found-page__core"><h1 className="not-found-page__title" aria-label="404 / Field not found"><span aria-hidden="true">404</span><small>FIELD NOT FOUND</small></h1><p>探しているページは、まだこのフィールドにありません。</p><Link className="button button--solid" href="/">Return to Crelo <span aria-hidden="true">↗</span></Link></div>
      <div className="not-found-page__footer"><span>CRELO / FIELD SYSTEM</span><span>ROUTE UNKNOWN</span></div>
    </main>
  );
}
