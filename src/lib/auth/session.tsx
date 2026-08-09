// ABOUT: React context that exposes the authenticated user to the component tree.
// ABOUT: Hydrates via GET /api/auth/me; login() sets the session directly post-auth.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { isNativePlatform } from '@/lib/platform';

import { getMe, type AuthUser } from './client';
import { markRegistered } from './local-hint';

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' };

type SessionContextValue = {
  session: SessionState;
  refresh: () => void;
  // Sets the session directly from an auth response without a network round-trip.
  // Use after registration or sign-in where the server has already returned the user.
  // Avoids the KV eventual-consistency window that refresh() is subject to.
  login: (user: AuthUser) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // On native there are no accounts: start at a definite `unauthenticated` state (no `loading`
  // flash, no spinner-stuck views) rather than hydrating from the network.
  const [session, setSession] = useState<SessionState>(() =>
    isNativePlatform() ? { status: 'unauthenticated' } : { status: 'loading' },
  );
  // Generation counter: login() increments this so any in-flight refresh() response
  // whose generation no longer matches is dropped rather than overwriting the login state.
  const refreshGenRef = useRef(0);

  const refresh = useCallback(() => {
    // Native makes the "no auth network call, ever" guarantee structural: gate on platform, not on
    // auth state. Resolve to unauthenticated without ever calling getMe(). Otherwise a later
    // refresh() would re-arm the very GET /api/auth/me the mount path avoids.
    if (isNativePlatform()) {
      refreshGenRef.current++;
      setSession({ status: 'unauthenticated' });
      return;
    }
    const gen = ++refreshGenRef.current;
    setSession({ status: 'loading' });
    getMe()
      .then((user) => {
        if (gen !== refreshGenRef.current) return;
        setSession(user ? { status: 'authenticated', user } : { status: 'unauthenticated' });
      })
      .catch(() => {
        if (gen !== refreshGenRef.current) return;
        setSession({ status: 'unauthenticated' });
      });
  }, []);

  const login = useCallback((user: AuthUser) => {
    refreshGenRef.current++; // invalidate any in-flight refresh response
    markRegistered();
    setSession({ status: 'authenticated', user });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, refresh, login }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
