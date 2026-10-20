import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/reset', { data: {} });
  expect(response.ok()).toBeTruthy();
});

test('S1 weak-example: confirmation appears after checkout', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toContainText('Order confirmed');
});

test('S2 strong-example: persisted order has exact item and total', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Quantity for TrenGuard Notebook').fill('2');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toContainText('Order confirmed');
  await page.getByRole('link', { name: 'Order history' }).click();

  const order = page.getByRole('listitem').filter({ hasText: 'TrenGuard Notebook' });
  await expect(order).toHaveCount(1);
  await expect(order).toContainText('2 × $12.99');
  await expect(order).toContainText('Ada Lovelace');
  await expect(order.getByTestId('order-total')).toHaveText('$25.98');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('order-total')).toHaveText('$25.98');
});

test('S3 settings-persistence: saved preferred name survives reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Preferred name').fill('Ada Verified');
  await page.getByRole('button', { name: 'Save preference' }).click();
  await expect(page.getByRole('status')).toContainText('Ada Verified');
  await page.reload();
  await expect(page.getByLabel('Preferred name')).toHaveValue('Ada Verified');
});

test('S4 authorization: normal user is rejected from admin summary', async ({ request }) => {
  const response = await request.get('/api/admin/summary');
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: 'FORBIDDEN', message: 'Admin access is required.' });
});

test('S5 search-correctness: matching fixture result is present', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem')).toContainText('Verification Pen');
});

test('S6 wrong-record-isolation: only the selected record changes', async ({ page }) => {
  await page.goto('/records');
  const selected = page.locator('[data-record-id="record-002"]');
  await selected.getByRole('combobox').selectOption({ label: 'ready' });
  await selected.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('status')).toContainText('Updated record-002');
  await page.reload();

  await expect(page.locator('[data-record-id="record-002"] select')).toHaveValue('ready');
  await expect(page.locator('[data-record-id="record-003"] select')).toHaveValue('archived');
});
