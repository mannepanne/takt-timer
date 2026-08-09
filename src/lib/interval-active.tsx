// ABOUT: Publishes whether an interval session is active (running or paused), so the app-level
// ABOUT: native back-button handler can confirm-before-exit without reaching into Run's route-scoped
// ABOUT: timer machine. A ref (not state) so the once-registered back listener reads the live value
// ABOUT: without re-subscribing, and so writing it never re-renders the tree. Inert on web.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react';

type IntervalActiveContextValue = {
  activeRef: MutableRefObject<boolean>;
  setActive: (active: boolean) => void;
};

const IntervalActiveContext = createContext<IntervalActiveContextValue | null>(null);

export function IntervalActiveProvider({ children }: { children: React.ReactNode }) {
  const activeRef = useRef(false);
  const setActive = useCallback((active: boolean) => {
    activeRef.current = active;
  }, []);
  const value = useMemo(() => ({ activeRef, setActive }), [setActive]);
  return <IntervalActiveContext.Provider value={value}>{children}</IntervalActiveContext.Provider>;
}

/** RunInner calls this to publish its live active/inactive state. No-op with no provider. */
export function useSetIntervalActive(): (active: boolean) => void {
  const ctx = useContext(IntervalActiveContext);
  return ctx?.setActive ?? noop;
}

/** The back-button handler reads `.current` at press time. Null with no provider. */
export function useIntervalActiveRef(): MutableRefObject<boolean> | null {
  return useContext(IntervalActiveContext)?.activeRef ?? null;
}

function noop(): void {}
