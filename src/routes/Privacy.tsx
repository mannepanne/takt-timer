// ABOUT: Privacy policy page — stub for Phase 1, real bilingual content arrives in Phase 5.

import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';

export function Privacy() {
  return (
    <div className="screen">
      <TopBar
        left={
          <Link to="/" className="icon-btn" aria-label="Back to Home">
            <Icon.ChevronLeft />
          </Link>
        }
      />

      <main className="scroll" style={{ padding: '8px 24px 40px', flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-3)' }}>
          Privacy
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
          No email. No phone. No personal details.
        </h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
          Takt is built so that it cannot identify you. Full policy content is finalised in a later
          phase. The short version: we store a pseudonymous user handle, a public key (if you
          register), and your own session history. We never ask for your email, your phone, or your
          name.
        </p>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginTop: 24 }}>
          Stub page — full content ships in Phase 5 (English and Swedish).
        </p>
      </main>
    </div>
  );
}
