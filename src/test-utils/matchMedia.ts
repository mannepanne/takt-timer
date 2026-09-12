// ABOUT: Controllable window.matchMedia fake for tests — jsdom ships none, and the appearance
// ABOUT: code both reads it and subscribes to its change events.
// ABOUT: Installed once by setup.ts; tests flip the OS preference with setPrefersDark().

import { DARK_SCHEME_QUERY } from '@/lib/settings/theme';

type ChangeListener = (event: MediaQueryListEvent) => void;

let dark = false;
const listeners = new Set<ChangeListener>();

function makeList(query: string): MediaQueryList {
  const matches = () => query === DARK_SCHEME_QUERY && dark;
  const list = {
    get matches() {
      return matches();
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: ChangeListener) => {
      if (query === DARK_SCHEME_QUERY) listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      listeners.delete(listener);
    },
    addListener: (listener: ChangeListener) => {
      if (query === DARK_SCHEME_QUERY) listeners.add(listener);
    },
    removeListener: (listener: ChangeListener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  };
  return list as unknown as MediaQueryList;
}

/**
 * Sets the fake OS preference and, by default, notifies every subscribed `change` listener.
 * Pass `notify: false` to flip it silently — the "OS changed while the app was backgrounded and
 * the WebView never delivered the event" case.
 */
export function setPrefersDark(value: boolean, notify = true): void {
  dark = value;
  if (!notify) return;
  const event = { matches: value, media: DARK_SCHEME_QUERY } as MediaQueryListEvent;
  for (const listener of listeners) listener(event);
}

export function installMatchMediaFake(): void {
  // Root-level tests that opt into the node environment have no window; nothing to install.
  if (typeof window === 'undefined') return;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => makeList(query),
  });
}

/** Back to "OS prefers light" with no listeners — called between tests. */
export function resetMatchMediaFake(): void {
  dark = false;
  listeners.clear();
}
