import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const BASE = process.env.MT_BASE_URL || 'http://localhost:5173';
const OUT_390 = '/opt/cursor/artifacts/dq-login.png';
const OUT_375 = '/opt/cursor/artifacts/dq-login-se.png';

function assertImage(path, minBytes = 12000) {
  const st = statSync(path);
  if (st.size < minBytes) throw new Error(`${path} too small (${st.size})`);
  const buf = readFileSync(path);
  if (new Set(buf.subarray(0, 5000)).size < 8) throw new Error(`${path} looks blank`);
  console.log('OK', path, st.size);
}

const browser = await chromium.launch({ headless: true });

try {
  const context390 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context390.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.auth-screen__title', { timeout: 15000 });
  await page.waitForSelector('.rr-tag', { timeout: 10000 });
  const signUp = await page.locator('text=Sign up').count();
  const register = await page.locator('a[href="/register"]').count();
  if (signUp > 0 || register > 0) throw new Error('sign-up UI still present');

  const menuLinks = page.locator('.auth-screen__menu-link');
  const linkCount = await menuLinks.count();
  if (linkCount < 2) throw new Error(`expected 2 menu links, got ${linkCount}`);
  for (let i = 0; i < linkCount; i++) {
    const color = await menuLinks.nth(i).evaluate((el) => getComputedStyle(el).color);
    if (color !== 'rgb(252, 252, 252)') {
      throw new Error(`menu link ${i} color is ${color}, expected rgb(252, 252, 252)`);
    }
  }
  console.log('menu link colors OK');

  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT_390, fullPage: false, animations: 'disabled' });
  assertImage(OUT_390);

  await page.setViewportSize({ width: 390, height: 500 });
  await page.locator('#login-email').focus();
  await page.waitForTimeout(300);
  console.log('keyboard-short viewport smoke OK');

  await context390.close();

  const context375 = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const pageSe = await context375.newPage();
  await pageSe.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await pageSe.waitForSelector('.auth-screen__title');
  await pageSe.waitForTimeout(400);
  await pageSe.screenshot({ path: OUT_375, fullPage: false, animations: 'disabled' });
  assertImage(OUT_375, 10000);

  await pageSe.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
  await pageSe.waitForSelector('.rr-tag');
  await pageSe.goto(`${BASE}/reset-password`, { waitUntil: 'networkidle' });
  await pageSe.waitForSelector('.rr-tag');
  console.log('forgot + reset routes OK');
} finally {
  await browser.close();
}
