// ABOUT: Onboarding flow — 4-slide intro shown on first visit.
// ABOUT: Exports hasSeenOnboarding() and markOnboardingSeen() localStorage helpers.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '@/i18n/context';

const ONBOARDING_KEY = 'takt.onboarding.v1';
const TOTAL_SLIDES = 4;

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // ignore
  }
}

type Props = { onDone: () => void };

export function Onboarding({ onDone }: Props) {
  const { t } = useI18n();
  const [slide, setSlide] = useState(0);
  const slideValue = useRef(slide);
  slideValue.current = slide;

  const isLast = slide === TOTAL_SLIDES - 1;

  // Keyboard navigation: ←/→ to move between slides, Esc to skip
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const s = slideValue.current;
      if (e.key === 'ArrowRight') {
        if (s < TOTAL_SLIDES - 1) setSlide(s + 1);
        else onDone();
      } else if (e.key === 'ArrowLeft') {
        if (s > 0) setSlide(s - 1);
      } else if (e.key === 'Escape') {
        onDone();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDone]);

  return (
    <div className="onboarding screen">
      {!isLast && (
        <button type="button" className="onboarding-skip" onClick={onDone}>
          {t('onboarding.skip')}
        </button>
      )}

      <div className="onboarding-slide" aria-live="polite" aria-atomic="true">
        {slide === 0 && (
          <div className="onboarding-slide-content">
            <h1 className="onboarding-tagline">{t('onboarding.s1.tagline')}</h1>
            <p className="onboarding-body">{t('onboarding.s1.body')}</p>
          </div>
        )}

        {slide === 1 && (
          <div className="onboarding-slide-content">
            <div className="eyebrow onboarding-eyebrow">{t('onboarding.s2.eyebrow')}</div>
            <p className="onboarding-body">{t('onboarding.s2.intro')}</p>
            <p className="onboarding-example">
              <em>{t('onboarding.s2.example1')}</em>
            </p>
            <p className="onboarding-example">
              <em>{t('onboarding.s2.example2')}</em>
            </p>
            <p className="onboarding-body">{t('onboarding.s2.outro')}</p>
          </div>
        )}

        {slide === 2 && (
          <div className="onboarding-slide-content">
            <div className="eyebrow onboarding-eyebrow">{t('onboarding.s3.eyebrow')}</div>
            <p className="onboarding-body">{t('onboarding.s3.body')}</p>
            <p className="onboarding-warning">{t('onboarding.s3.warning')}</p>
            <Link to="/privacy" className="onboarding-privacy-link">
              {t('onboarding.s3.privacyLink')}
            </Link>
          </div>
        )}

        {slide === 3 && (
          <div className="onboarding-slide-content">
            <div className="eyebrow onboarding-eyebrow">{t('onboarding.s4.eyebrow')}</div>
            <p className="onboarding-body">{t('onboarding.s4.body')}</p>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <nav className="pager" aria-label="Slide progress">
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <span key={i} className={`pd${slide === i ? ' active' : ''}`} />
          ))}
        </nav>

        <button
          type="button"
          className="btn btn-primary onboarding-cta"
          onClick={() => {
            if (slide < TOTAL_SLIDES - 1) setSlide(slide + 1);
            else onDone();
          }}
        >
          {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
        </button>
      </div>
    </div>
  );
}
