import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div
            className="aq-mono"
            style={{
              fontSize: 13,
              letterSpacing: '0.08em',
              color: 'var(--aq-cyan)',
              marginBottom: 16,
            }}
          >
            404 — SIDE IKKE FUNNET
          </div>
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Denne siden finnes ikke.
          </h1>
          <p
            style={{
              marginTop: 16,
              color: 'rgba(255,255,255,0.6)',
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            Lenken er sannsynligvis utdatert, eller siden er flyttet. Gå tilbake til forsiden.
          </p>
          <Link
            href="/"
            className="btn-primary-v8 btn-lg"
            style={{ marginTop: 32, display: 'inline-flex' }}
          >
            Tilbake til forsiden
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>
    </>
  );
}
