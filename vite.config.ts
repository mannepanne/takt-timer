// ABOUT: Vite configuration for the Takt SPA — web and native (Android/Capacitor) build modes.
// ABOUT: React plugin, path alias `@/` → `./src`, VitePWA on web, and a native build variant
// ABOUT: (self-hosted fonts, no analytics, scoped CSP, service worker disabled) via `--mode native`.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

import { nativeHtmlPlugin } from './vite.native-html';

export default defineConfig(({ mode }) => {
  const isNative = mode === 'native';

  return {
    plugins: [
      react(),
      // VitePWA is web-only: the native build ships no service worker (offline is inherent — the
      // whole bundle is on-device), and disabling it removes the `virtual:pwa-register` module,
      // which the resolve.alias below stubs so main.tsx's import still builds.
      ...(isNative
        ? [nativeHtmlPlugin()]
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['robots.txt'],
              manifest: {
                name: 'Takt',
                short_name: 'Takt',
                description: 'Voice-driven, mobile-first interval timer.',
                theme_color: '#F5F4F0',
                background_color: '#F5F4F0',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                  {
                    src: '/icons/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: '/icons/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                  {
                    src: '/icons/icon-512-maskable.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,webmanifest,png,ico}'],
                navigateFallback: '/index.html',
                // Any path the Worker owns server-side must be listed here;
                // otherwise the SW shadows it with index.html.
                // /cdn-cgi/ is Cloudflare's own edge path (Access auth callback etc.)
                navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/cdn-cgi\//],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'google-fonts-stylesheets',
                      expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                    },
                  },
                  {
                    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'google-fonts-webfonts',
                      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                  {
                    urlPattern: /\/api\/(presets|sessions)/,
                    handler: 'NetworkFirst',
                    options: {
                      cacheName: 'takt-api-data',
                      networkTimeoutSeconds: 5,
                      expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
                      cacheableResponse: { statuses: [200] },
                    },
                  },
                ],
              },
            }),
          ]),
    ],
    resolve: {
      // More-specific native aliases MUST precede the '@' catch-all — @rollup/plugin-alias matches
      // in order, first hit wins, and '@' would otherwise swallow '@/lib/presets'. (The string
      // matcher requires '/' or end after the key, so '@/lib/presets' does NOT catch
      // '@/lib/presets-local'.)
      alias: {
        ...(isNative
          ? {
              // Native presets live in device localStorage, not D1 — swap the whole module so
              // PresetsDrawer/SavePresetSheet stay byte-identical on web (07d).
              '@/lib/presets': path.resolve(__dirname, './src/lib/presets-local.ts'),
              // Native voice uses the on-device recogniser + local English parser, not the Whisper/
              // Llama HTTP pipeline — swap the hook so MicButton/VoiceOverlay stay shared (07f).
              '@/lib/voice/useVoiceMachine': path.resolve(
                __dirname,
                './src/lib/voice/useVoiceMachine-native.ts',
              ),
              // Native has no VitePWA and therefore no `virtual:pwa-register` module; alias it to a
              // no-op stub so the bare import in main.tsx resolves at build time.
              'virtual:pwa-register': path.resolve(__dirname, './src/lib/pwa-register-stub.ts'),
            }
          : {}),
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': 'http://localhost:8787',
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    build: {
      outDir: isNative ? 'dist-native' : 'dist',
      sourcemap: true,
      target: 'es2022',
    },
  };
});
