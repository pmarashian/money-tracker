import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const outDir = process.env.SCREENSHOT_OUT_DIR || '/opt/cursor/artifacts';
const port = 4173;

const mockSnapshot = {
  snapshot: {
    as_of: '2026-10-07T14:00:00.000Z',
    current_available_balance: 4287.42,
    next_bonus_date: '2026-10-31',
    balance_before_next_bonus: { amount: 1842.15, date: '2026-10-22' },
    projected_low_to_bonus: { amount: -42.5, date: '2026-10-18' },
    topoff_needed_after_bonus: 800,
    following_bonus_date: '2027-01-31',
    low_after_topoff: { amount: 200, date: '2026-11-15' },
    status: 'needs_topoff',
    topoff_needed_now: 275,
    min_balance: 0,
    bills: [],
  },
  as_of: '2026-10-07T14:00:00.000Z',
  received_at: '2026-10-07T14:00:01.000Z',
  stale: false,
};

const mockSettings = { paycheckAmount: 2000 };

function preview() {
  return spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: frontendRoot,
    stdio: 'pipe',
  });
}

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview not ready');
}

const proc = preview();
try {
  await ready();
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'demo', email: 'phillip@example.com' } }),
    })
  );
  await page.route('**/api/snapshot**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSnapshot) })
  );
  await page.route('**/api/settings**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
  );
  await page.addInitScript(() => window.localStorage.setItem('auth-token', 'demo'));
  await page.goto(`http://127.0.0.1:${port}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-stat-card--hero-ok, .home-stat-card--hero-bad', { timeout: 15000 });
  await page.screenshot({ path: path.join(outDir, 'home-dashboard-colored.png'), fullPage: true });
  await page.goto(`http://127.0.0.1:${port}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('ion-title');
  await page.screenshot({ path: path.join(outDir, 'settings-simplified.png'), fullPage: true });
  await browser.close();
  console.log('Screenshots saved to', outDir);
} finally {
  proc.kill('SIGTERM');
}
