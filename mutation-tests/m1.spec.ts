import { test, expect } from '@playwright/test';

test('M1 confirms checkout but does not persist the order', async ({ page, request }) => {
  const healthResponse = await request.get('/health');
  expect(healthResponse.ok()).toBeTruthy();
  expect(await healthResponse.json()).toMatchObject({
    status: 'ok',
    mutationId: 'M1',
    mutationMarker: 'M1_ACTIVE',
  });

  const resetResponse = await request.post('/api/reset', { data: {} });
  expect(resetResponse.ok()).toBeTruthy();

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toContainText('Order confirmed');

  const ordersResponse = await request.get('/api/orders');
  expect(ordersResponse.ok()).toBeTruthy();
  expect(await ordersResponse.json()).toEqual({ orders: [] });

  await page.goto('/orders');
  await expect(page.getByRole('status')).toContainText('No orders yet');

  let strongAssertionFailed = false;
  try {
    await expect(page.getByRole('listitem')).toHaveCount(1, { timeout: 1_000 });
  } catch {
    strongAssertionFailed = true;
  }
  expect(strongAssertionFailed).toBeTruthy();
});
