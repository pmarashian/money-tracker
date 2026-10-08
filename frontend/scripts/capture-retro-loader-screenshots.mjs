import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts/screenshots';
const BASE = 'http://127.0.0.1:3001';

const iPhone = devices['iPhone 12'];

async function shot(page, url, file) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rr-loader__window', { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await shot(page, `${BASE}/dev/retro-loader?screen=home`, 'retro-loader-home.png');
  await shot(page, `${BASE}/dev/retro-loader?screen=expenses`, 'retro-loader-expenses.png');

  await page.goto(`${BASE}/dev/retro-loader?sprite=1`, { waitUntil: 'networkidle' });
  const sprite = page.locator('.rr-loader__sprite');
  await sprite.waitFor({ timeout: 10000 });
  await sprite.screenshot({ path: path.join(OUT, 'retro-loader-sprite-closeup.png') });

  await browser.close();
  console.log('Saved screenshots to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
