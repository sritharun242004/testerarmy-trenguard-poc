import { test, expect } from '@playwright/test';

test('reset behavior clears persisted orders and restores an empty history', async ({ page, request }) => {
  await request.post('/api/reset', { data: {} });
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toContainText('Order confirmed');

  const resetResponse = await request.post('/api/reset', { data: {} });
  expect(resetResponse.ok()).toBeTruthy();

  await page.goto('/orders');
  await expect(page.getByRole('status')).toContainText('No orders yet');
});

test('fixture endpoint stays stable after reset', async ({ request }) => {
  const resetResponse = await request.post('/api/reset', { data: {} });
  expect(resetResponse.ok()).toBeTruthy();

  const response = await request.get('/api/fixtures');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({
    dataVersion: 'phase-1-v1',
    checkout: {
      productId: 'proofforge-notebook',
      quantity: 2,
      customerName: 'Ada Lovelace',
    },
    mutation: {
      id: null,
      marker: 'HEALTHY_BASELINE',
    },
    products: [
      {
        id: 'proofforge-notebook',
        name: 'TrenGuard Notebook',
        description: 'A fixed fixture item for repeatable checkout tests.',
        unitPriceCents: 1299,
      },
      {
        id: 'verification-pen',
        name: 'Verification Pen',
        description: 'A second fixture item used to keep the catalog realistic.',
        unitPriceCents: 499,
      },
    ],
  });
});
