import { expect, test } from '@playwright/test';

test('homepage renders and counter increments', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vite + React');

  const counterButton = page.getByRole('button', { name: /count is/i });
  await expect(counterButton).toBeVisible();

  await counterButton.click();
  await expect(counterButton).toHaveText('count is 1');
});
