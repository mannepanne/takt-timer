// ABOUT: Pre-paint appearance resolver. Loaded as a blocking script in <head> so a dark-mode user
// ABOUT: never sees a light first frame. Reads takt.theme.v1 and prefers-color-scheme, stamps
// ABOUT: data-theme on <html>. External (not inline) so it passes script-src 'self' on both CSPs.
// Mirrors src/lib/settings/theme.ts — theme-init.test.ts keeps the key and query in step.
(function () {
  var mode = 'system';
  try {
    var stored = localStorage.getItem('takt.theme.v1');
    if (stored === 'light' || stored === 'dark' || stored === 'system') mode = stored;
  } catch (e) {
    // Blocked storage: resolve as if nothing was stored.
  }
  var systemDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = mode === 'dark' || (mode === 'system' && systemDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
