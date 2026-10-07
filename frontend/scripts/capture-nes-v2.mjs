import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const EMAIL = 'nes-screens@example.com';
const PASS = 'password12345';

const FILES = [
  `${OUT}/nes-settings-v2.png`,
  `${OUT}/nes-expenses-v2.png`,
  `${OUT}/nes-expense-modal-v2.png`,
];

async function token() {
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
  if (!data.token) throw new Error(JSON.stringify(data));
  return data.token;
}

async function seed(t) {
  for (const bill of [
    { name: 'AT&T', amount: 50, frequency: 'monthly', typicalDayOfMonth: 23 },
    { name: 'Boost Me', amount: 1, frequency: 'monthly', typicalDayOfMonth: 15 },
    { name: 'Netflix', amount: 15.99, frequency: 'monthly', typicalDayOfMonth: 1 },
    { name: 'Rent', amount: 1200, frequency: 'monthly', typicalDayOfMonth: 1 },
  ]) {
    await fetch(`${API}/api/transactions/recurring`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });
  }
}

async function login(page) {
  await seed(await token());
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('ion-input input').nth(0).fill(EMAIL);
  await page.locator('ion-input input').nth(1).fill(PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
}

function check(path) {
  const n = statSync(path).size;
  if (n < 15000) throw new Error(`${path} only ${n} bytes`);
  const buf = readFileSync(path);
  if (new Set(buf.subarray(0, 5000)).size < 10) throw new Error(`${path} looks blank`);
  console.log('OK', path, n);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
try {
  await login(page);
  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bg-carousel', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: FILES[0] });

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nes-expense-card', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: FILES[1] });

  await page.locator('.expenses-page__add-btn').click();
  await page.waitForSelector('.nes-menu', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: FILES[2] });

  for (const f of FILES) check(f);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nes-expense-card');
} finally {
  await browser.close();
}
