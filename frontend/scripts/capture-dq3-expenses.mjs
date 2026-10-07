import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts/dq3-expenses.png';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

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

async function clearExpenses(t) {
  const listRes = await fetch(`${API}/api/transactions/recurring`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!listRes.ok) return;
  const { recurring } = await listRes.json();
  if (!Array.isArray(recurring)) return;
  for (let i = recurring.length - 1; i >= 0; i--) {
    await fetch(`${API}/api/transactions/recurring?index=${i}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    });
  }
}

async function seed(t) {
  const bills = [
    {
      name: 'American Income Life (Globe Life)',
      amount: 42.5,
      frequency: 'monthly',
      typicalDayOfMonth: 12,
    },
    { name: 'Netflix', amount: 15.99, frequency: 'monthly', typicalDayOfMonth: 1 },
    { name: 'Rent', amount: 1200, frequency: 'monthly', typicalDayOfMonth: 1 },
  ];
  for (const bill of bills) {
    await fetch(`${API}/api/transactions/recurring`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });
  }
}

const t = await token();
await clearExpenses(t);
await seed(t);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('ion-input input').nth(0).fill(EMAIL);
  await page.locator('ion-input input').nth(1).fill(PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__vendor', { timeout: 15000 });
  const long = await page.locator('.mt-expense__vendor').first().textContent();
  if (!long?.includes('American Income Life')) {
    throw new Error(`missing long vendor headline: ${long}`);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, fullPage: false, animations: 'disabled' });

  const st = statSync(OUT);
  if (st.size < 15000) throw new Error(`screenshot too small: ${st.size}`);
  const buf = readFileSync(OUT);
  if (new Set(buf.subarray(0, 5000)).size < 8) throw new Error('screenshot looks blank');
  console.log('OK', OUT, st.size);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.mt-expense__vendor');
  console.log('375x667 smoke OK');
} finally {
  await browser.close();
}
