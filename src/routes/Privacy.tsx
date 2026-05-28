// ABOUT: Privacy policy page — bilingual (English and Swedish).
// ABOUT: Headings via t(); paragraph copy inline JSX conditioned on lang to keep strings.ts lean.

import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';

export function Privacy() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label={t('nav.backToHome')}
          >
            <Icon.ChevronLeft size={20} />
          </button>
        }
      />

      <main className="scroll" style={{ padding: '8px 24px 40px', flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-3)' }}>
          {t('privacy.eyebrow')}
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            margin: '0 0 24px',
            textWrap: 'balance',
          }}
        >
          {t('privacy.heading')}
        </h1>

        <section>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
            {t('privacy.stored.heading')}
          </h2>
          {lang === 'sv' ? (
            <p style={bodyStyle}>
              Takt lagrar ett pseudonymt användarhandtag (en slumpmässig identifierare), en
              passkey-publik nyckel om du har registrerat dig, namn och inställningar för dina
              förinställningar, samt sammanfattningar av pass — enbart antal och längder på
              intervaller. Inga namn, inga e-postadresser, inga platser.
            </p>
          ) : (
            <p style={bodyStyle}>
              Takt stores a pseudonymous user handle (a random identifier), a passkey public key if
              you've registered, the names and settings of any presets you've saved, and session
              summaries — just the counts and durations of intervals you've completed. No names, no
              email addresses, no locations.
            </p>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
            {t('privacy.cloudflare.heading')}
          </h2>
          {lang === 'sv' ? (
            <p style={bodyStyle}>
              Takt är hostat på Cloudflares globala nätverk. Cloudflare ser IP-adresser vid
              nätverkskanten som en del av normal routing. Vi använder Cloudflares anonyma analys
              (inga kakor, ingen spårning). Tillfälliga begränsningsräknare är kopplade till din
              IP-adress i upp till 24 timmar, sedan raderas de.
            </p>
          ) : (
            <p style={bodyStyle}>
              Takt is hosted on Cloudflare's global network. Cloudflare sees IP addresses at the
              edge as part of normal routing. We use Cloudflare's anonymous analytics — no cookies,
              no cross-site tracking. Temporary rate-limit counters are tied to your IP address for
              up to 24 hours, then discarded.
            </p>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
            {t('privacy.delete.heading')}
          </h2>
          {lang === 'sv' ? (
            <p style={bodyStyle}>
              Gå till Inställningar → Konto → Ta bort konto. Radering är omedelbar och
              oåterkallelig. Alla förinställningar och pass-historik tas bort permanent.
            </p>
          ) : (
            <p style={bodyStyle}>
              Go to Settings → Account → Delete account. Deletion is immediate and irreversible. All
              presets and session history are permanently removed.
            </p>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
            {t('privacy.contact.heading')}
          </h2>
          {lang === 'sv' ? (
            <p style={bodyStyle}>
              Frågor eller funderingar? Skicka e-post till{' '}
              <a href="mailto:privacy@takt.hultberg.org" style={linkStyle}>
                privacy@takt.hultberg.org
              </a>
              .
            </p>
          ) : (
            <p style={bodyStyle}>
              Questions or concerns? Email{' '}
              <a href="mailto:privacy@takt.hultberg.org" style={linkStyle}>
                privacy@takt.hultberg.org
              </a>
              .
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  color: 'var(--ink-2)',
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
};
