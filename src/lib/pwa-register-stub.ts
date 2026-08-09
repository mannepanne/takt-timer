// ABOUT: Build-time stand-in for `virtual:pwa-register` in the native (Android) build.
// ABOUT: The native build disables VitePWA, which removes the virtual module — this stub is
// ABOUT: aliased in its place so `main.tsx`'s bare import resolves at build time instead of failing.
//
// A runtime `isNativePlatform()` guard cannot solve this: with VitePWA disabled the
// `virtual:pwa-register` module does not exist, so a bare `import` fails during the *build*,
// long before any runtime check could run. The fix has to be at module-resolution time — hence
// this alias target. `registerSW` is a no-op returning a no-op updater, matching the real
// signature so `main.tsx` needs no platform branching around the call.

export function registerSW(_options?: unknown): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
