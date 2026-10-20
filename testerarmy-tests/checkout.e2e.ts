import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('S2 strong-example: TesterArmy web adapter verifies persisted order', async ({ app, screen, browser }) => {
  await app.open('/checkout');
  await browser.evaluate(async () => {
    await fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  });
  await app.open('/checkout');
  await screen.getByLabel('Quantity for TrenGuard Notebook').fill('2');
  await screen.getByRole('button', { name: 'Place order' }).click();
  await expect(screen.getByRole('status')).toContainText('Order confirmed');
  await app.open('/orders');
  await expect(screen.getByRole('list', { name: 'Orders' })).toContainText('TrenGuard Notebook');
  await expect(screen.getByTestId('order-total')).toHaveText('$25.98');
  await browser.reload();
  await expect(screen.getByTestId('order-total')).toHaveText('$25.98');
});
