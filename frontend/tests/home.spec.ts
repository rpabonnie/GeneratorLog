import { expect, test } from '@playwright/test';

test('home page renders and allows counter increment', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Vite + React' })).toBeVisible();

  const counterButton = page.getByRole('button', { name: /count is/i });
  await expect(counterButton).toHaveText(/count is 0/i);

  await counterButton.click();
  await expect(counterButton).toHaveText(/count is 1/i);
});
