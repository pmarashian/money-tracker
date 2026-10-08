import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts/screenshots';
const BASE = 'http://127.0.0.1:3001';
const iPhone = devices['iPhone 12'];

async function pauseCoinAt(page, frameIndex) {
  await page.evaluate((index) => {
    document.querySelectorAll('.rr-loader__coin-frame').forEach((el, i) => {
      el.style.animation = 'none';
      el.style.opacity = i === index ? '1' : '0';
    });
  }, frameIndex);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/dev/retro-loader?screen=home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rr-loader__window', { timeout: 10000 });

  for (let i = 0; i < 4; i += 1) {
    await pauseCoinAt(page, i);
    await page.screenshot({
      path: path.join(OUT, `retro-loader-home-frame-${i}.png`),
      fullPage: false,
    });
  }

  await pauseCoinAt(page, 0);
  await page.screenshot({ path: path.join(OUT, 'retro-loader-home.png'), fullPage: false });

  await page.goto(`${BASE}/dev/retro-loader?screen=expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rr-loader__window', { timeout: 10000 });
  await pauseCoinAt(page, 0);
  await page.screenshot({ path: path.join(OUT, 'retro-loader-expenses.png'), fullPage: false });

  await page.goto(`${BASE}/dev/retro-loader?sprite=1`, { waitUntil: 'networkidle' });
  const strip = page.locator('.rr-loader__coin-svg--strip');
  await strip.waitFor({ timeout: 10000 });
  await strip.screenshot({ path: path.join(OUT, 'retro-loader-sprite-closeup.png') });

  await browser.close();
  console.log('Saved screenshots to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
