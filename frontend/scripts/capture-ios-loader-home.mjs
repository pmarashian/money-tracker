/**
 * WebKit (iPhone viewport): animated RetroLoader coin frames + Home dashboard with mocked API.
 */
import { webkit, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts/screenshots';
const BASE = process.env.MT_BASE_URL || 'http://127.0.0.1:3001';
const iPhone = devices['iPhone 12'];

const MOCK_USER = { id: 'user-playwright', email: 'demo@example.com' };

const MOCK_SNAPSHOT = {
  snapshot: {
    as_of: '2026-10-09T12:00:00.000Z',
    current_available_balance: 4200,
    next_bonus_date: '2026-10-24',
    projected_low_to_bonus: { amount: 800, date: '2026-10-20' },
    topoff_needed_after_bonus: 0,
    following_bonus_date: '2026-11-07',
    low_after_topoff: { amount: 1200, date: '2026-11-01' },
    status: 'on_track',
    topoff_needed_now: 0,
    bills: [],
    balance_before_next_bonus: { amount: 3850.5, date: '2026-10-23' },
  },
  as_of: '2026-10-09T12:00:00.000Z',
  received_at: '2026-10-09T12:00:00.000Z',
  stale: false,
};

async function waitForCoinFrame(page, minFrame, timeoutMs = 5000) {
  await page.waitForFunction(
    (min) => {
      const el = document.querySelector('.rr-loader__coin-frame[data-frame]');
      if (!el) return false;
      const n = Number(el.getAttribute('data-frame'));
      return Number.isFinite(n) && n >= min;
    },
    minFrame,
    { timeout: timeoutMs }
  );
}

async function captureLoaderFrames(page) {
  await page.goto(`${BASE}/dev/retro-loader?screen=home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rr-loader__stack', { timeout: 15000 });
  await page.waitForSelector('.rr-loader__coin-frame[data-frame]', { timeout: 15000 });

  for (let i = 0; i < 4; i += 1) {
    if (i > 0) await waitForCoinFrame(page, i, 1200);
    else await waitForCoinFrame(page, 0, 1200);
    await page.screenshot({
      path: path.join(OUT, `webkit-retro-loader-frame-${i}.png`),
      fullPage: false,
    });
  }
}

async function captureHomeDashboard(context) {
  const page = await context.newPage();
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: MOCK_USER }),
    });
  });
  await page.route('**/api/snapshot', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SNAPSHOT),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('auth-token', 'playwright-test-token');
  });

  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-snapshot', { timeout: 20000 });
  await page.screenshot({
    path: path.join(OUT, 'webkit-home-dashboard.png'),
    fullPage: false,
  });
  await page.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await captureLoaderFrames(page);
  await captureHomeDashboard(context);

  await browser.close();
  console.log('Saved WebKit screenshots to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
