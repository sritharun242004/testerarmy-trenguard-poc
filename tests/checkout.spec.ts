import { test, expect } from '@playwright/test';

const fixture = {
  productName: 'TrenGuard Notebook',
  customerName: 'Ada Lovelace',
  quantity: '2',
  unitPrice: '$12.99',
  total: '$25.98',
};

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/reset', { data: {} });
  expect(response.ok()).toBeTruthy();
});

test('S1 weak-example: confirmation appears after checkout', async ({ page }) => {
  await page.goto('/checkout');

  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByLabel('Customer name')).toHaveValue(fixture.customerName);
  await page.getByLabel(`Quantity for ${fixture.productName}`).fill(fixture.quantity);
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByRole('status')).toContainText('Order confirmed');
});

test('S2 strong-example: checkout persists the exact order after reload', async ({ page }) => {
  await page.goto('/checkout');

  await page.getByLabel(`Quantity for ${fixture.productName}`).fill(fixture.quantity);
  await expect(page.locator('#expected-total')).toHaveText(fixture.total);
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toContainText('Order confirmed');

  await page.getByRole('link', { name: 'Order history' }).click();
  await expect(page).toHaveURL(/\/orders$/);

  const order = page.getByRole('listitem').filter({ hasText: fixture.productName });
  await expect(order).toHaveCount(1);
  await expect(order).toContainText(`${fixture.quantity} × ${fixture.unitPrice}`);
  await expect(order).toContainText(fixture.customerName);
  await expect(order.getByTestId('order-total')).toHaveText(fixture.total);
  await expect(page.getByRole('listitem')).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('order-total')).toHaveText(fixture.total);
});
