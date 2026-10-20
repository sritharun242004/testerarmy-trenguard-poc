import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const target = process.argv[2];
assert(target, 'Usage: pnpm exec tsx scripts/smoke-hosted.ts https://<deployment>');
const baseURL = new URL(target).origin;
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const isolated = await browser.newContext({ baseURL });
const errors: string[] = [];
try {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const health = await context.request.get('/health');
  assert.equal(health.status(), 200);
  assert(health.headers()['content-type']?.includes('application/json'),
    'Health must return JSON without authentication redirects');
  assert.equal((await health.json()).hosted, true);
  assert.equal((await health.json()).mutationId, null);
  await page.goto('/checkout');
  await expect(page).toHaveTitle('TrenGuard · Checkout proof');
  await expect(page.getByLabel('Hosted demo limitations')).toContainText('not the benchmark');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await expect(page.getByRole('button', { name: 'Reset demo data' })).toBeEnabled();
  await page.getByLabel('Quantity for TrenGuard Notebook').fill('2');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.locator('#checkout-status')).toContainText('Order confirmed');
  await page.getByRole('link', { name: 'Order history' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('order-total')).toHaveText('$25.98');
  await page.reload();
  await expect(page.getByTestId('order-total')).toHaveText('$25.98');
  await mkdir('artifacts/hosted', { recursive: true });
  await page.screenshot({ path: 'artifacts/hosted/orders-desktop.png', fullPage: true });
  const cookie = (await context.cookies()).find((entry) => entry.name === 'trenguard_demo_state');
  assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
  assert.equal((await (await isolated.request.get('/api/orders')).json()).orders.length, 0);

  await page.goto('/settings');
  await page.getByLabel('Preferred name').fill('Ada Demo');
  await page.getByRole('button', { name: 'Save preference' }).click();
  await expect(page.locator('#profile-status')).toContainText('Saved as Ada Demo');
  await page.reload();
  await expect(page.getByLabel('Preferred name')).toHaveValue('Ada Demo');
  await page.goto('/records');
  const row = page.locator('[data-record-id="record-001"]');
  await row.getByRole('combobox').selectOption('archived');
  await row.getByRole('button', { name: 'Update' }).click();
  await expect(page.locator('#record-status')).toContainText('Updated record-001');
  await page.reload();
  await expect(page.getByLabel('Status for record-001')).toHaveValue('archived');
  await expect(page.getByLabel('Status for record-002')).toHaveValue('queued');
  await page.goto('/search');
  await expect(page.getByRole('listitem')).toContainText('Verification Pen');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  assert.equal((await context.request.get('/api/admin/summary')).status(), 403);

  await context.addCookies([{ name: 'trenguard_demo_state', value: 'broken', url: baseURL, secure: true }]);
  await page.goto('/orders');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await expect(page.getByRole('heading', { name: 'No orders yet.' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: 'artifacts/hosted/checkout-mobile.png', fullPage: true });
  if (overflow) console.log(await page.evaluate(() => Array.from(document.querySelectorAll('body *'))
    .filter((node) => node.getBoundingClientRect().right > innerWidth)
    .map((node) => ({ tag: node.tagName, className: node.className, right: node.getBoundingClientRect().right }))));
  assert.equal(overflow, false, 'No mobile horizontal overflow');
  assert.deepEqual(errors, []);
  console.log('PASS: public HTTPS, checkout/reload, cookie flags, browser isolation, settings, records, search, admin denial, malformed-state reset and mobile layout.');
} finally {
  await isolated.close();
  await context.close();
  await browser.close();
}
