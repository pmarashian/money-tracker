import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const BASE = process.env.MT_BASE_URL || 'http://localhost:3001';
const OUT = '/opt/cursor/artifacts';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

const SAFE_TOP = '47px';
const SAFE_BOTTOM = '34px';

const SHOTS = [
  { path: `${OUT}/home-top.png`, route: '/app/home', wait: '.home-snapshot__status-row' },
  { path: `${OUT}/expenses-top.png`, route: '/app/expenses', wait: '.expenses-page__add-gap' },
  { path: `${OUT}/settings-top.png`, route: '/app/settings', wait: '.rr-tag' },
];

const MOCK_USER = { id: 'screen-user', email: EMAIL };

const MOCK_SNAPSHOT = {
  snapshot: {
    as_of: '2026-10-07T18:12:00.000Z',
    current_available_balance: 1110.98,
    next_bonus_date: '2026-10-31',
    projected_low_to_bonus: { amount: 150, date: '2026-10-20' },
    topoff_needed_after_bonus: 800,
    following_bonus_date: '2027-01-31',
    low_after_topoff: { amount: 200, date: '2026-11-15' },
    status: 'needs_topoff',
    topoff_needed_now: 400,
    balance_before_next_bonus: { amount: 1110.98, date: '2026-10-28' },
    bills: [],
  },
  as_of: '2026-10-07T18:12:00.000Z',
  received_at: '2026-10-07T18:12:00.000Z',
  stale: false,
};

function installApiMocks(page) {
  return page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path.endsWith('/api/auth/session')) {
      return json({ user: MOCK_USER });
    }
    if (path.endsWith('/api/snapshot')) {
      return json(MOCK_SNAPSHOT);
    }
    if (path.endsWith('/api/transactions/recurring')) {
      return json({
        recurring: [
          { name: 'Rent', amount: 1200, frequency: 'monthly', typicalDayOfMonth: 1 },
          { name: 'Netflix', amount: 15.99, frequency: 'monthly', typicalDayOfMonth: 1 },
        ],
      });
    }
    if (path.endsWith('/api/settings')) {
      return json({ paycheckAmount: 2000 });
    }
    return json({ ok: true });
  });
}

async function login(page) {
  await installApiMocks(page);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.setItem('auth-token', 'screen-mock-token');
  });
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
  await page.waitForTimeout(600);
}

function assertShot(path) {
  const st = statSync(path);
  if (st.size < 12000) throw new Error(`${path} too small (${st.size} bytes)`);
  console.log('OK', path, st.size);
}

async function measureTopGap(page) {
  return page.evaluate(() => {
    const header = document.querySelector('ion-header');
    const status = document.querySelector('.home-snapshot__status-row, .rr-lead');
    if (!header || !status) return null;
    const hb = header.getBoundingClientRect().bottom;
    const st = status.getBoundingClientRect().top;
    const title = document.querySelector('ion-title');
    const titleText = title?.textContent?.trim() ?? '';
    const titleTruncated = Boolean(title?.shadowRoot?.querySelector('.title-text')?.classList.contains('title-text-ellipsis'));
    return {
      gapPx: Math.round(st - hb),
      titleText,
      titleTruncated,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(({ safeTop, safeBottom }) => {
  const style = document.createElement('style');
  style.id = 'mt-safe-area-test';
  style.textContent = `
    :root {
      --safe-top: ${safeTop};
      --safe-bottom: ${safeBottom};
    }
  `;
  document.documentElement.appendChild(style);
}, { safeTop: SAFE_TOP, safeBottom: SAFE_BOTTOM });

const page = await context.newPage();

try {
  await login(page);
  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.route}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(shot.wait, { timeout: 15000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot.path, fullPage: false, animations: 'disabled' });
    assertShot(shot.path);
  }

  const homeGap = await measureTopGap(page);
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  const titleHome = await page.locator('ion-title').first().innerText();
  if (!titleHome.includes('MONEY TRACKER') && !titleHome.includes('Money Tracker')) {
    throw new Error(`Home title unexpected: ${titleHome}`);
  }
  if (homeGap && homeGap.gapPx > 28) {
    throw new Error(`Home header-to-content gap too large: ${homeGap.gapPx}px`);
  }
  console.log('layout', homeGap);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  const title375 = await page.locator('ion-title').first().innerText();
  if (title375.includes('...')) throw new Error(`Title truncated at 375px: ${title375}`);
  console.log('375 title', title375);
} finally {
  await browser.close();
}
