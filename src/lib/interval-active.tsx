// ABOUT: Publishes the live interval session (whether one is active, whether it's currently running,
// ABOUT: and pause/resume controls) so the app-level native back-button handler can confirm before
// ABOUT: leaving AND pause the timer while the confirm dialog is up — without reaching into Run's
// ABOUT: route-scoped machine. A ref (not state) so the once-registered back listener reads the live
// ABOUT: value without re-subscribing, and so writing it never re-renders the tree. Inert on web.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react';

// null = no interval session on screen. `running` distinguishes running (countIn/work/rest) from
// paused, so the back handler only auto-pauses a running timer and only auto-resumes what it paused.
export type RunSession = {
  running: boolean;
  pause: () => void;
  resume: () => void;
};

type IntervalActiveContextValue = {
  sessionRef: MutableRefObject<RunSession | null>;
  setSession: (session: RunSession | null) => void;
};

const IntervalActiveContext = createContext<IntervalActiveContextValue | null>(null);

export function IntervalActiveProvider({ children }: { children: React.ReactNode }) {
  const sessionRef = useRef<RunSession | null>(null);
  const setSession = useCallback((session: RunSession | null) => {
    sessionRef.current = session;
  }, []);
  const value = useMemo(() => ({ sessionRef, setSession }), [setSession]);
  return <IntervalActiveContext.Provider value={value}>{children}</IntervalActiveContext.Provider>;
}

/** RunInner calls this to publish its live session (or null when it unmounts). No-op with no provider. */
export function useSetRunSession(): (session: RunSession | null) => void {
  const ctx = useContext(IntervalActiveContext);
  return ctx?.setSession ?? noop;
}

/** The back-button handler reads `.current` at press time. Null with no provider. */
export function useRunSessionRef(): MutableRefObject<RunSession | null> | null {
  return useContext(IntervalActiveContext)?.sessionRef ?? null;
}

function noop(): void {}
