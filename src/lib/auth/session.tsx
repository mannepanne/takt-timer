// ABOUT: React context that exposes the authenticated user to the component tree.
// ABOUT: Calls GET /api/auth/me on mount; re-fetches when refresh() is called.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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

  const refresh = useCallback(() => {
    setSession({ status: 'loading' });
    getMe()
      .then((user) => {
        setSession(user ? { status: 'authenticated', user } : { status: 'unauthenticated' });
      })
      .catch(() => {
        setSession({ status: 'unauthenticated' });
      });
  }, []);

  const login = useCallback((user: AuthUser) => {
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
