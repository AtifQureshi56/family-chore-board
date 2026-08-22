/**
 * Generates the PWA icon set from one SVG.
 *
 *   npm run icons
 *
 * Re-run this only if the artwork changes; the PNGs are committed so a clean
 * checkout can build without running it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve(process.cwd(), 'public', 'icons');

/**
 * A star on the board's own background.
 *
 * `padding` leaves room for the circular mask Android applies to maskable icons -
 * without it the points of the star get cropped off.
 */
function svg(padding: number): string {
  const size = 512;
  const scale = 1 - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3B82F6"/>
  <g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-size / 2} ${-size / 2})">
    <path fill="#FFFFFF" d="M256 84 L310 194 L432 212 L344 298 L365 419 L256 362 L147 419 L168 298 L80 212 L202 194 Z"/>
    <path fill="#FBBF24" d="M256 140 L292 213 L373 225 L315 282 L328 362 L256 324 L184 362 L197 282 L139 225 L220 213 Z"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, padding: 0.06 },
  { file: 'icon-512.png', size: 512, padding: 0.06 },
  // Maskable icons get cropped to a circle on Android, so the art sits well inside.
  { file: 'icon-192-maskable.png', size: 192, padding: 0.18 },
  { file: 'icon-512-maskable.png', size: 512, padding: 0.18 },
  // iOS ignores the manifest and uses this one.
  { file: 'apple-touch-icon.png', size: 180, padding: 0.08 },
  { file: 'favicon-32.png', size: 32, padding: 0.04 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  for (const target of TARGETS) {
    const png = await sharp(Buffer.from(svg(target.padding)))
      .resize(target.size, target.size)
      .png()
      .toBuffer();

    writeFileSync(resolve(OUT, target.file), png);
    console.log(`  ${target.file}  ${target.size}x${target.size}`);
  }

  console.log(`\nWrote ${TARGETS.length} icons to public/icons`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
