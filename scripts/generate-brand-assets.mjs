import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const logoPath = path.join(root, 'public/assets/crelo-logo.png');
const outputDir = path.join(root, 'public');
const logo = await sharp(logoPath).ensureAlpha().png().toBuffer();
const ogLogo = await sharp(logoPath).ensureAlpha().resize(180, 180, { fit: 'contain' }).png().toBuffer();

const ogText = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <style>
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 3px; }
    .sans { font-family: Arial, Helvetica, sans-serif; }
  </style>
  <text x="72" y="94" class="mono" font-size="16" fill="#a6ffdb">CRELO / FORWARD DEPLOYED PRACTICE</text>
  <text x="72" y="292" class="sans" font-size="86" font-weight="700" letter-spacing="-5" fill="#f3f6f3">Forward Deployed</text>
  <text x="72" y="382" class="sans" font-size="86" font-weight="700" letter-spacing="-5" fill="#f3f6f3">Engineer</text>
  <text x="76" y="458" class="mono" font-size="22" fill="#a6ffdb">Business × AI × Software</text>
  <text x="76" y="526" class="sans" font-size="22" fill="#b5c6c1">課題整理から設計・開発・導入まで。</text>
  <text x="76" y="565" class="sans" font-size="22" fill="#b5c6c1">事業の課題を、技術で解決します。</text>
</svg>`);

await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 4, g: 9, b: 11, alpha: 1 } } })
  .composite([
    { input: Buffer.from('<svg width="1200" height="630"><defs><radialGradient id="g"><stop offset="0" stop-color="#1f6f61" stop-opacity=".44"/><stop offset="1" stop-color="#04090b" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>') },
    { input: ogLogo, left: 970, top: 76, blend: 'over' },
    { input: ogText, left: 0, top: 0, blend: 'over' },
  ])
  .png()
  .toFile(path.join(outputDir, 'og.png'));

const icon = await sharp(logo).resize(32, 32, { fit: 'contain' }).png().toBuffer();
await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 4, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: icon, left: 0, top: 0 }])
  .png()
  .toFile(path.join(outputDir, 'favicon.png'));

const appleIcon = await sharp(logo).resize(180, 180, { fit: 'contain' }).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 4, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: appleIcon, left: 0, top: 0 }])
  .png()
  .toFile(path.join(outputDir, 'apple-touch-icon.png'));

console.log('Generated public/og.png (1200x630), public/favicon.png (32x32), public/apple-touch-icon.png (180x180) from public/assets/crelo-logo.png.');
