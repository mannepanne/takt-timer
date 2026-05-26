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

import { getMe, type AuthUser } from './client';

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
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  // Generation counter: login() increments this so any in-flight refresh() response
  // whose generation no longer matches is dropped rather than overwriting the login state.
  const refreshGenRef = useRef(0);

  const refresh = useCallback(() => {
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
