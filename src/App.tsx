// ABOUT: Top-level application component.
// ABOUT: Wraps routes in PhoneFrame and provides the session context, i18n, and settings to the tree.

import { Route, Routes } from 'react-router-dom';

import { PhoneFrame } from '@/components/PhoneFrame';
import { I18nProvider } from '@/i18n/context';
import { SessionProvider } from '@/lib/auth/session';
import { SettingsProvider } from '@/lib/settings/context';
import { Account } from '@/routes/Account';
import { Complete } from '@/routes/Complete';
import { Configure } from '@/routes/Configure';
import { Home } from '@/routes/Home';
import { NotFound } from '@/routes/NotFound';
import { Privacy } from '@/routes/Privacy';
import { Run } from '@/routes/Run';
import { Settings } from '@/routes/Settings';

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <SettingsProvider>
          <PhoneFrame>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/configure" element={<Configure />} />
              <Route path="/run" element={<Run />} />
              <Route path="/complete" element={<Complete />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PhoneFrame>
        </SettingsProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
