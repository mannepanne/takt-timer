// ABOUT: Catch-all 404 route. Calm language, gentle nudge back to Home.

import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';

export function NotFound() {
  return (
    <div className="screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label="Back to Home">
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 28px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--ink-3)' }}>
            404
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              margin: 0,
              textWrap: 'balance',
            }}
          >
            Nothing here.
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--ink-3)',
              marginTop: 14,
              lineHeight: 1.5,
              textWrap: 'balance',
            }}
          >
            That page doesn't exist — or hasn't been built yet.
          </p>
        </div>

        <div style={{ flex: 1 }} />
      </main>

      <div style={{ padding: '0 24px 28px', textAlign: 'center' }}>
        <Link
          to="/"
          style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            textDecoration: 'none',
            letterSpacing: 0.2,
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
