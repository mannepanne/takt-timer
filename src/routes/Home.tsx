// ABOUT: Home screen placeholder for Phase 1 — TopBar and a calm empty body.
// ABOUT: Real content (mic button, prompt, sparkline, last-session card) lands in Phase 2+.

import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';

export function Home() {
  return (
    <div className="screen">
      <TopBar
        left={
          <button className="icon-btn" aria-label="Presets" type="button" disabled>
            <Icon.List />
          </button>
        }
        right={
          <button className="icon-btn" aria-label="Settings" type="button" disabled>
            <Icon.Settings />
          </button>
        }
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 28px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--ink-3)' }}>
            Setting up
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1.2,
              margin: 0,
              textWrap: 'balance',
            }}
          >
            Takt is under construction.
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
            The timer, voice, and everything else arrive in the phases ahead.
          </p>
        </div>

        <div style={{ flex: 1 }} />
      </main>

      <div style={{ padding: '0 24px 28px', textAlign: 'center' }}>
        <Link
          to="/privacy"
          style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            textDecoration: 'none',
            letterSpacing: 0.2,
          }}
        >
          Privacy
        </Link>
      </div>
    </div>
  );
}
