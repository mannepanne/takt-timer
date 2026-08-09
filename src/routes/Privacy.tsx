// ABOUT: Privacy policy page — bilingual (English and Swedish).
// ABOUT: Headings via t(); paragraph copy inline JSX conditioned on lang to keep strings.ts lean.

import { useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { TopBar } from '@/components/TopBar';
import { useI18n } from '@/i18n/context';
import { isNativePlatform } from '@/lib/platform';

export function Privacy() {
  const { t, lang } = useI18n();
  const native = isNativePlatform();
  const navigate = useNavigate();
  const location = useLocation();
  const returnSlide = (location.state as { returnSlide?: number } | null)?.returnSlide;

  return (
    <div className="screen">
      <TopBar
        left={
          <button
            type="button"
            className="icon-btn"
            onClick={() =>
              navigate('/', {
                state: typeof returnSlide === 'number' ? { resumeSlide: returnSlide } : undefined,
              })
            }
            aria-label={t('nav.backToHome')}
          >
            <Icon.ChevronLeft size={20} />
          </button>
        }
      />

      <main className="scroll privacy-main">
        <div className="eyebrow privacy-eyebrow">{t('privacy.eyebrow')}</div>

        <h1 className="privacy-heading">{t('privacy.heading')}</h1>

        {native ? (
          <>
            <section>
              <h2 className="privacy-section-heading">{t('privacy.stored.heading')}</h2>
              {lang === 'sv' ? (
                <p className="privacy-body">
                  Allt Takt sparar — dina rundor, inställningar och pass-historik — lagras enbart på
                  den här enheten. Det finns inget konto och ingen server: ingenting skickas
                  någonstans, och ingenting identifierar dig. Inga namn, inga e-postadresser, inga
                  platser.
                </p>
              ) : (
                <p className="privacy-body">
                  Everything Takt keeps — your presets, settings, and session history — is stored
                  only on this device. There's no account and no server: nothing is sent anywhere,
                  and nothing identifies you. No names, no email addresses, no locations.
                </p>
              )}
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section-heading">{t('privacy.voice.heading')}</h2>
              {lang === 'sv' ? (
                <p className="privacy-body">
                  När du använder rösten för att ställa in ett pass lämnar Takt ljudet till
                  telefonens inbyggda taligenkänning. Den är en del av Android och kan behandla
                  ljudet via Googles tjänst, beroende på dina enhetsinställningar. Takt spelar
                  aldrig själv in, lagrar eller skickar ditt ljud — appen tar bara emot texten och
                  tolkar den på enheten.
                </p>
              ) : (
                <p className="privacy-body">
                  When you use voice to set up a session, Takt hands the audio to your phone's
                  built-in speech recogniser. It's part of Android and may process the audio using
                  Google's service, depending on your device settings. Takt itself never records,
                  stores, or sends your audio — it only receives the text back and reads it on the
                  device.
                </p>
              )}
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section-heading">{t('privacy.delete.heading')}</h2>
              {lang === 'sv' ? (
                <p className="privacy-body">
                  Allt finns på den här enheten, så du bestämmer. Rensa Takts data i Androids
                  Inställningar → Appar → Takt → Lagring för att ta bort dina rundor och historik.
                </p>
              ) : (
                <p className="privacy-body">
                  Everything is on this device, so you're in control. Clear Takt's storage in
                  Android Settings → Apps → Takt → Storage to remove your presets and history.
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 className="privacy-section-heading">{t('privacy.stored.heading')}</h2>
              {lang === 'sv' ? (
                <p className="privacy-body">
                  Takt lagrar ett pseudonymt användarhandtag (en slumpmässig identifierare), en
                  passkey-publik nyckel om du har registrerat dig, namn och inställningar för dina
                  förinställningar, sammanfattningar av pass — enbart antal och längder på
                  intervaller — samt tidsstämplar för röst-API-anrop (kopplade till ditt pseudonyma
                  handtag när du är inloggad, anonymt annars). Inga namn, inga e-postadresser, inga
                  platser.
                </p>
              ) : (
                <p className="privacy-body">
                  Takt stores a pseudonymous user handle (a random identifier), a passkey public key
                  if you've registered, the names and settings of any presets you've saved, session
                  summaries — just the counts and durations of intervals you've completed — and
                  timestamps of voice API requests (linked to your pseudonymous handle when signed
                  in, anonymous otherwise). No names, no email addresses, no locations.
                </p>
              )}
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section-heading">{t('privacy.cloudflare.heading')}</h2>
              {lang === 'sv' ? (
                <p className="privacy-body">
                  Takt är hostat på Cloudflares globala nätverk. Cloudflare ser IP-adresser vid
                  nätverkskanten som en del av normal routing. Vi använder Cloudflares anonyma
                  analys (inga kakor, ingen spårning). Tillfälliga begränsningsräknare är kopplade
                  till din IP-adress i upp till 26 timmar, sedan raderas de.
                </p>
              ) : (
                <p className="privacy-body">
                  Takt is hosted on Cloudflare's global network. Cloudflare sees IP addresses at the
                  edge as part of normal routing. We use Cloudflare's anonymous analytics — no
                  cookies, no cross-site tracking. Temporary rate-limit counters are tied to your IP
                  address for up to 26 hours, then discarded.
                </p>
              )}
            </section>

            <section className="privacy-section">
              <h2 className="privacy-section-heading">{t('privacy.delete.heading')}</h2>
              {lang === 'sv' ? (
                <>
                  <p className="privacy-body">
                    Gå till Inställningar → Konto → Ta bort konto. Radering är omedelbar och
                    oåterkallelig. Alla förinställningar och pass-historik tas bort permanent.
                  </p>
                  <p className="privacy-body" style={{ marginTop: 12 }}>
                    Om du inte har loggat in lagrar Takt ingenting om dig på servern. Rensa
                    webbplatsens data i din webbläsare för att ta bort det som sparats lokalt.
                  </p>
                </>
              ) : (
                <>
                  <p className="privacy-body">
                    Go to Settings → Account → Delete account. Deletion is immediate and
                    irreversible. All presets and session history are permanently removed.
                  </p>
                  <p className="privacy-body" style={{ marginTop: 12 }}>
                    If you haven't signed in, Takt holds no server-side data about you. Clear this
                    site's data in your browser to remove anything stored locally.
                  </p>
                </>
              )}
            </section>
          </>
        )}

        <section className="privacy-section">
          <h2 className="privacy-section-heading">{t('privacy.contact.heading')}</h2>
          {lang === 'sv' ? (
            <p className="privacy-body">
              Frågor eller funderingar? Skicka e-post till{' '}
              <a href="mailto:takt@hultberg.org" className="privacy-link">
                takt@hultberg.org
              </a>
              .
            </p>
          ) : (
            <p className="privacy-body">
              Questions or concerns? Email{' '}
              <a href="mailto:takt@hultberg.org" className="privacy-link">
                takt@hultberg.org
              </a>
              .
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
