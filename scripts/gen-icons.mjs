import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const outDir = '/Users/magnus/Documents/Coding/TaktTimer/takt-timer/public/icons';
mkdirSync(outDir, { recursive: true });

const svg = (size, maskable = false) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#F5F4F0"/>
  ${maskable ? `<rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" fill="#F5F4F0"/>` : ''}
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="Figtree, sans-serif" font-weight="600"
        font-size="${size * 0.42}" fill="#0E1116"
        letter-spacing="-0.03em">takt</text>
  <rect x="${size * 0.72}" y="${size * 0.36}" width="${size * 0.035}" height="${size * 0.28}"
        fill="#4EA47A" rx="${size * 0.01}"/>
</svg>
`;

async function render(svgString, size, filename) {
  const png = await sharp(Buffer.from(svgString)).resize(size, size).png().toBuffer();
  await sharp(png).toFile(`${outDir}/${filename}`);
  console.log(`wrote ${filename}`);
}

await render(svg(192), 192, 'icon-192.png');
await render(svg(512), 512, 'icon-512.png');
await render(svg(512, true), 512, 'icon-512-maskable.png');
