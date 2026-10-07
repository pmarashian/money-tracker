import { chromium } from 'playwright';

const BASE = process.env.MT_BASE_URL || 'http://127.0.0.1:5173';
const API = process.env.MT_API_URL || 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const EMAIL = process.env.MT_SCREEN_EMAIL || 'nes-screens@example.com';
const PASS = process.env.MT_SCREEN_PASS || 'password12345';

async function fillIonInput(page, index, value) {
  const input = page.locator('ion-input input').nth(index);
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(value);
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

async function login(page) {
  await ensureUser();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await fillIonInput(page, 0, EMAIL);
  await fillIonInput(page, 1, PASS);
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForSelector('ion-tab-bar', { timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function shot(page, path) {
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await login(page);
  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, `${OUT}/settings-nes.png`);
  await shot(page, `${OUT}/settings-retro-buttons.png`);

  const track = page.locator('.bg-carousel__track');
  if (await track.count()) {
    await track.evaluate((el) => {
      el.scrollLeft = el.clientWidth * 0.85;
    });
    await page.waitForTimeout(500);
    await shot(page, `${OUT}/bg-carousel.png`);
  }

  await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, `${OUT}/expenses-nes.png`);

  await page.locator('ion-button.btn-retro--primary').first().click();
  await page.waitForTimeout(600);
  await shot(page, `${OUT}/expense-modal.png`);

  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
  const useBtn = page.locator('text=Use this background');
  if (await useBtn.isVisible().catch(() => false)) {
    await useBtn.click();
    await page.waitForTimeout(500);
    await shot(page, `${OUT}/bg-carousel-selected.png`);
  }
} finally {
  await browser.close();
}
