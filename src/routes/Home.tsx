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

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 28px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Setting up
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            lineHeight: 1.2,
            textWrap: 'balance',
          }}
        >
          Takt is under construction.
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--mute)',
            marginTop: 14,
            lineHeight: 1.5,
            textWrap: 'balance',
          }}
        >
          The timer, voice, and everything else arrive in the phases ahead.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 24px 28px', textAlign: 'center' }}>
        <Link
          to="/privacy"
          style={{
            fontSize: 12,
            color: 'var(--mute)',
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
