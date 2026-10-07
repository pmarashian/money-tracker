import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

const TARGETS = [
  `${OUT}/nes-settings-full.png`,
  `${OUT}/nes-expenses.png`,
  `${OUT}/nes-expense-modal.png`,
];

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
      const text = await res.text();
      console.warn('seed warn', bill.name, res.status, text.slice(0, 120));
    }
  }
}

async function fillIonInput(page, index, value) {
  const input = page.locator('ion-input input').nth(index);
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(value);
}

async function login(page) {
  const token = await ensureUser();
  await seedExpenses(token);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await fillIonInput(page, 0, EMAIL);
  await fillIonInput(page, 1, PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function shot(page, path) {
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  const st = statSync(path);
  console.log('saved', path, `${st.size} bytes`);
}

function assertNotBlank(path) {
  const buf = readFileSync(path);
  if (buf.length < 20000) {
    throw new Error(`${path} too small (${buf.length} bytes) — likely blank or login screen`);
  }
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  let unique = new Set(sample).size;
  if (unique < 8) {
    throw new Error(`${path} low color variance — likely blank`);
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--window-size=390,844'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

try {
  await login(page);

  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nes-panel', { timeout: 15000 });
  const content = page.locator('ion-content').first();
  await content.evaluate((el) => {
    const scrollEl = el.shadowRoot?.querySelector('.inner-scroll') ?? el;
    scrollEl.scrollTop = scrollEl.scrollHeight * 0.55;
  });
  await page.waitForTimeout(600);
  await shot(page, TARGETS[0]);

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nes-expense-card', { timeout: 15000 });
  const cards = await page.locator('.nes-expense-card').count();
  if (cards < 3) throw new Error(`expected 3+ expense cards, got ${cards}`);
  await page.waitForTimeout(500);
  await shot(page, TARGETS[1]);

  await page.locator('ion-button.btn-retro--primary').first().click();
  await page.waitForSelector('.nes-menu', { timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, TARGETS[2]);

  for (const p of TARGETS) assertNotBlank(p);
  console.log('all captures OK');
} finally {
  await browser.close();
}
