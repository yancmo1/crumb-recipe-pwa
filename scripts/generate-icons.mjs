import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const defaultSrcPngPath = path.join(publicDir, 'icon-source.png');
const defaultSrcSvgPath = path.join(publicDir, 'icon.svg');

const iosAppIconPath = path.join(
  root,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png'
);

async function ensureExists(p) {
  try {
    await fs.access(p);
  } catch {
    throw new Error(`Missing required file: ${p}`);
  }
}

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('-')) return null;
  return v;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveSourcePath() {
  const cli = getArgValue('--input') || getArgValue('-i');
  if (cli) return path.isAbsolute(cli) ? cli : path.join(root, cli);

  if (await fileExists(defaultSrcPngPath)) return defaultSrcPngPath;
  return defaultSrcSvgPath;
}

async function renderPng({ srcPath, outPath, size }) {
  const ext = path.extname(srcPath).toLowerCase();
  const input = await fs.readFile(srcPath);

  // If the source is SVG, bump density to avoid soft results.
  const img = ext === '.svg' ? sharp(input, { density: 256 }) : sharp(input);

  await img.resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
}

async function run() {
  const srcPath = await resolveSourcePath();
  await ensureExists(srcPath);

  const outputs = [
    // PWA manifest icons
    { file: 'pwa-192x192.png', size: 192 },
    { file: 'pwa-512x512.png', size: 512 },

    // Apple touch icons
    { file: 'apple-touch-icon.png', size: 180 },
    { file: 'apple-touch-icon-152x152.png', size: 152 },
    { file: 'apple-touch-icon-167x167.png', size: 167 },
    { file: 'apple-touch-icon-180x180.png', size: 180 },
  ];

  for (const o of outputs) {
    const outPath = path.join(publicDir, o.file);
    // eslint-disable-next-line no-console
    console.log(`Generating ${o.file} (${o.size}x${o.size})`);
    await renderPng({ srcPath, outPath, size: o.size });
  }

  // iOS App Icon (single 1024x1024 file referenced by the asset catalog).
  if (await fileExists(path.dirname(iosAppIconPath))) {
    // eslint-disable-next-line no-console
    console.log('Generating iOS AppIcon (1024x1024)');
    await renderPng({ srcPath, outPath: iosAppIconPath, size: 1024 });
  } else {
    // eslint-disable-next-line no-console
    console.log('Skipping iOS AppIcon (iOS project not found)');
  }

  // eslint-disable-next-line no-console
  console.log('Done.');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
