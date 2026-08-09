// ABOUT: Generates Takt's app icons from the "takt" wordmark SVG — no external artwork.
// ABOUT: Emits the PWA/web icons (public/icons) and, when android/ exists, the Android
// ABOUT: adaptive-icon layers (foreground + legacy launcher PNGs) and the splash logo.

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webOut = resolve(root, 'public/icons');
mkdirSync(webOut, { recursive: true });

const BG = '#F5F4F0';
const INK = '#0E1116';
const ACCENT = '#4EA47A';

// Full icon: solid background, the "takt" wordmark, a green accent bar. `maskable` adds the inner
// safe rectangle the PWA maskable purpose expects. `scale` shrinks the wordmark toward the centre
// so a foreground layer survives Android's circular adaptive-icon mask (the safe zone is ~66%).
const iconSvg = (size, { maskable = false, transparent = false, scale = 1 } = {}) => {
  const c = size / 2; // scale the wordmark group about the centre
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${transparent ? '' : `<rect width="${size}" height="${size}" fill="${BG}"/>`}
  ${maskable ? `<rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" fill="${BG}"/>` : ''}
  <g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})">
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
          font-family="Figtree, sans-serif" font-weight="600"
          font-size="${size * 0.42}" fill="${INK}" letter-spacing="-0.03em">takt</text>
    <rect x="${size * 0.72}" y="${size * 0.36}" width="${size * 0.035}" height="${size * 0.28}"
          fill="${ACCENT}" rx="${size * 0.01}"/>
  </g>
</svg>`;
};

async function renderPng(svgString, size, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const png = await sharp(Buffer.from(svgString)).resize(size, size).png().toBuffer();
  await sharp(png).toFile(filePath);
  console.log(`wrote ${filePath.replace(root + '/', '')}`);
}

// Circular-masked variant, for legacy round launcher icons on API < 26.
async function renderRoundPng(svgString, size, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const base = await sharp(Buffer.from(svgString)).resize(size, size).png().toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  await sharp(base)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(filePath);
  console.log(`wrote ${filePath.replace(root + '/', '')}`);
}

// --- Web / PWA icons ---
await renderPng(iconSvg(192), 192, resolve(webOut, 'icon-192.png'));
await renderPng(iconSvg(512), 512, resolve(webOut, 'icon-512.png'));
await renderPng(iconSvg(512, { maskable: true }), 512, resolve(webOut, 'icon-512-maskable.png'));

// --- Android launcher icons (only if the native project has been generated) ---
const androidRes = resolve(root, 'android/app/src/main/res');
if (existsSync(androidRes)) {
  // density → [legacy launcher px, adaptive foreground px]
  const densities = {
    mdpi: [48, 108],
    hdpi: [72, 162],
    xhdpi: [96, 216],
    xxhdpi: [144, 324],
    xxxhdpi: [192, 432],
  };
  for (const [density, [legacy, fg]] of Object.entries(densities)) {
    const dir = resolve(androidRes, `mipmap-${density}`);
    // Legacy square + round icons (API < 26): the full design.
    await renderPng(iconSvg(legacy), legacy, resolve(dir, 'ic_launcher.png'));
    await renderRoundPng(iconSvg(legacy), legacy, resolve(dir, 'ic_launcher_round.png'));
    // Adaptive foreground (API 26+): transparent, wordmark scaled into the safe zone.
    await renderPng(
      iconSvg(fg, { transparent: true, scale: 0.62 }),
      fg,
      resolve(dir, 'ic_launcher_foreground.png'),
    );
  }
  // Splash logo (transparent), centred by the splash layer-list drawable.
  await renderPng(
    iconSvg(480, { transparent: true, scale: 0.8 }),
    480,
    resolve(androidRes, 'drawable/splash_logo.png'),
  );
}
