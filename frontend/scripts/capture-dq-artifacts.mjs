import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';
import { readFile } from 'fs/promises';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

const TARGETS = [
  `${OUT}/dq-home.png`,
  `${OUT}/dq-expenses.png`,
  `${OUT}/dq-modal.png`,
  `${OUT}/dq-settings.png`,
];

async function loadPushToken() {
  try {
    const env = await readFile('/workspace/backend/.env', 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('MT_PUSH_TOKEN='));
    if (!line) return null;
    return line.slice('MT_PUSH_TOKEN='.length).trim();
  } catch {
    return process.env.MT_PUSH_TOKEN || null;
  }
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

async function seedSnapshot(pushToken) {
  const payload = {
    email: EMAIL,
    as_of: new Date().toISOString(),
    current_available_balance: 4250,
    next_bonus_date: '2026-10-31',
    projected_low_to_bonus: { amount: 150, date: '2026-10-20' },
    topoff_needed_after_bonus: 800,
    following_bonus_date: '2027-01-31',
    low_after_topoff: { amount: 200, date: '2026-11-15' },
    status: 'on_track',
    topoff_needed_now: 0,
    balance_before_next_bonus: { amount: 4250, date: '2026-10-28' },
    bills: [{ name: 'Rent', amount: 1200, frequency: 'monthly', next_date: '2026-11-01' }],
  };
  const res = await fetch(`${API}/api/snapshot/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pushToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn('snapshot push warn', res.status, text.slice(0, 200));
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
    await fetch(`${API}/api/transactions/recurring`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bill),
    });
  }
}

async function login(page) {
  const token = await ensureUser();
  const pushToken = await loadPushToken();
  if (pushToken) await seedSnapshot(pushToken);
  await seedExpenses(token);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('ion-input input').nth(0).fill(EMAIL);
  await page.locator('ion-input input').nth(1).fill(PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
  await page.waitForTimeout(800);
}

function assertNotBlank(path) {
  const st = statSync(path);
  if (st.size < 15000) throw new Error(`${path} too small (${st.size} bytes)`);
  const buf = readFileSync(path);
  if (new Set(buf.subarray(0, Math.min(buf.length, 8000))).size < 8) {
    throw new Error(`${path} low variance — likely blank`);
  }
  console.log('OK', path, st.size);
}

async function captureSet(page) {
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-hero-win', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: TARGETS[0], fullPage: false, animations: 'disabled' });

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__amount', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: TARGETS[1], fullPage: false, animations: 'disabled' });

  await page.locator('.expenses-page__add-gap').click();
  await page.waitForSelector('.rr-menu', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: TARGETS[2], fullPage: false, animations: 'disabled' });

  await page.locator('.expense-form-modal__actions .rr-cmd-item').first().click();
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rr-tag', { timeout: 15000 });
  const content = page.locator('ion-content').first();
  await content.evaluate((el) => {
    const scrollEl = el.shadowRoot?.querySelector('.inner-scroll') ?? el;
    scrollEl.scrollTop = scrollEl.scrollHeight * 0.45;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: TARGETS[3], fullPage: false, animations: 'disabled' });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await login(page);
  await captureSet(page);
  for (const p of TARGETS) assertNotBlank(p);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/app/home`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-hero-win', { timeout: 15000 });
  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__amount', { timeout: 15000 });
  console.log('375x667 smoke OK');
} finally {
  await browser.close();
}
