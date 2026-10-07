import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';
import { readFile } from 'fs/promises';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

const TARGETS = [
  `${OUT}/dq2-home.png`,
  `${OUT}/dq2-home-topoff.png`,
  `${OUT}/dq2-expenses.png`,
  `${OUT}/dq2-modal.png`,
  `${OUT}/dq2-settings.png`,
];

async function loadPushToken() {
  try {
    const env = await readFile('/workspace/backend/.env', 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('MT_PUSH_TOKEN='));
    if (line) return line.slice('MT_PUSH_TOKEN='.length).trim();
  } catch {
    /* ignore */
  }
  return process.env.MT_PUSH_TOKEN || null;
}

async function ensureUser() {
  await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).catch(() => {});
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`login failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function clearExpenses(token) {
  const listRes = await fetch(`${API}/api/transactions/recurring`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return;
  const { recurring } = await listRes.json();
  if (!Array.isArray(recurring)) return;
  for (let i = recurring.length - 1; i >= 0; i--) {
    await fetch(`${API}/api/transactions/recurring?index=${i}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

async function seedExpenses(token) {
  const bills = [
    { name: 'AT&T', amount: 50, frequency: 'monthly', typicalDayOfMonth: 23 },
    { name: 'Boost Me', amount: 1, frequency: 'monthly', typicalDayOfMonth: 15 },
    { name: 'Netflix', amount: 15.99, frequency: 'monthly', typicalDayOfMonth: 1 },
    { name: 'Rent', amount: 1200, frequency: 'monthly', typicalDayOfMonth: 1 },
  ];
  for (const bill of bills) {
    const res = await fetch(`${API}/api/transactions/recurring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bill),
    });
    if (!res.ok) {
      console.warn('seed bill', bill.name, res.status);
    }
  }
}

function snapshotPayload({ topoffNow = 0 }) {
  return {
    email: EMAIL,
    as_of: new Date().toISOString(),
    current_available_balance: 4250,
    next_bonus_date: '2026-10-31',
    projected_low_to_bonus: { amount: 150, date: '2026-10-20' },
    topoff_needed_after_bonus: 800,
    following_bonus_date: '2027-01-31',
    low_after_topoff: { amount: 200, date: '2026-11-15' },
    status: topoffNow > 0 ? 'needs_topoff' : 'on_track',
    topoff_needed_now: topoffNow,
    balance_before_next_bonus: { amount: 4250, date: '2026-10-28' },
    bills: [{ name: 'Rent', amount: 1200, frequency: 'monthly', next_date: '2026-11-01' }],
  };
}

async function pushSnapshot(pushToken, topoffNow) {
  const res = await fetch(`${API}/api/snapshot/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pushToken}`,
    },
    body: JSON.stringify(snapshotPayload({ topoffNow })),
  });
  if (!res.ok) {
    throw new Error(`snapshot push ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function login(page, token) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('ion-input input').nth(0).fill(EMAIL);
  await page.locator('ion-input input').nth(1).fill(PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
  await page.waitForTimeout(600);
}

function assertNotBlank(path) {
  const st = statSync(path);
  const minBytes = path.includes('modal') ? 6000 : 15000;
  if (st.size < minBytes) throw new Error(`${path} too small (${st.size} bytes)`);
  const buf = readFileSync(path);
  if (new Set(buf.subarray(0, Math.min(buf.length, 8000))).size < 8) {
    throw new Error(`${path} low variance — likely blank`);
  }
  console.log('OK', path, st.size);
}

async function scrollSettingsTop(page) {
  const content = page.locator('ion-content').first();
  await content.evaluate((el) => {
    const scrollEl = el.shadowRoot?.querySelector('.inner-scroll') ?? el;
    scrollEl.scrollTop = 0;
  });
  await page.waitForTimeout(400);
}

const pushToken = await loadPushToken();
if (!pushToken) throw new Error('MT_PUSH_TOKEN required for snapshot seed');

const token = await ensureUser();
await clearExpenses(token);
await seedExpenses(token);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await pushSnapshot(pushToken, 0);
  await login(page, token);

  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-hero-win', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: TARGETS[0], fullPage: false, animations: 'disabled' });

  await pushSnapshot(pushToken, 350);
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-hero-win', { timeout: 15000 });
  const topoff = await page.locator('.home-hero-win').count();
  if (topoff < 2) throw new Error('expected balance + top-off windows on home');
  await page.waitForTimeout(500);
  await page.screenshot({ path: TARGETS[1], fullPage: false, animations: 'disabled' });

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__amount', { timeout: 15000 });
  const cards = await page.locator('.rr-win--tagged').count();
  if (cards < 4) throw new Error(`expected 4 expense cards, got ${cards}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: TARGETS[2], fullPage: false, animations: 'disabled' });

  await page.locator('.expenses-page__add-gap').click();
  await page.waitForSelector('.expense-form-modal__cmd-win', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: TARGETS[3], fullPage: false, animations: 'disabled' });

  await page.locator('.expense-form-modal__actions .rr-cmd-item').nth(1).click();
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bg-carousel__preview--active', { timeout: 15000 });
  await scrollSettingsTop(page);
  await page.screenshot({ path: TARGETS[4], fullPage: false, animations: 'disabled' });

  for (const p of TARGETS) assertNotBlank(p);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__amount', { timeout: 15000 });
  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await scrollSettingsTop(page);
  console.log('375x667 smoke OK');
} finally {
  await browser.close();
}
