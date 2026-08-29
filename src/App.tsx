// ABOUT: Top-level application component.
// ABOUT: Wraps routes in PhoneFrame and provides the session, i18n, settings, and
// ABOUT: stopwatch context to the tree.

import { useCallback, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

import { NativeBackButton } from '@/components/NativeBackButton';
import { PhoneFrame } from '@/components/PhoneFrame';
import { I18nProvider } from '@/i18n/context';
import { SessionProvider } from '@/lib/auth/session';
import { IntervalActiveProvider } from '@/lib/interval-active';
import { SettingsProvider } from '@/lib/settings/context';
import { StopwatchProvider } from '@/lib/stopwatch/context';
import { Complete } from '@/routes/Complete';
import { Configure } from '@/routes/Configure';
import { Home } from '@/routes/Home';
import { NotFound } from '@/routes/NotFound';
import { Onboarding, hasSeenOnboarding, markOnboardingSeen } from '@/routes/Onboarding';
import { Privacy, PrivacyRedirect } from '@/routes/Privacy';
import { Run } from '@/routes/Run';
import { Settings } from '@/routes/Settings';
import { Timer } from '@/routes/Timer';

function HomeOrOnboarding() {
  const [seen, setSeen] = useState(() => hasSeenOnboarding());

  const handleDone = useCallback(() => {
    markOnboardingSeen();
    setSeen(true);
  }, []);

  return seen ? <Home /> : <Onboarding onDone={handleDone} />;
}

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <SettingsProvider>
          <StopwatchProvider>
            <IntervalActiveProvider>
              <PhoneFrame>
                <NativeBackButton />
                <Routes>
                  <Route path="/" element={<HomeOrOnboarding />} />
                  <Route path="/configure" element={<Configure />} />
                  <Route path="/run" element={<Run />} />
                  <Route path="/complete" element={<Complete />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* Bare /privacy redirects to the platform's canonical variant below. */}
                  <Route path="/privacy" element={<PrivacyRedirect />} />
                  {/* Stable public URLs per platform (Play submits /privacy/android). */}
                  <Route path="/privacy/web" element={<Privacy variant="web" />} />
                  <Route path="/privacy/android" element={<Privacy variant="android" />} />
                  <Route path="/timer" element={<Timer />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PhoneFrame>
            </IntervalActiveProvider>
          </StopwatchProvider>
        </SettingsProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
