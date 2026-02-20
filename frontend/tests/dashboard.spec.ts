import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'TestPass123!';
let counter = 0;

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}${counter++}@example.com`;
}

async function enrollLoginAndCreateGenerator(page: Page, email: string) {
  await page.goto('/enroll');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.fill('#confirmPassword', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile');

  await page.fill('#generatorName', 'Honda EU2200i');
  await page.click('button:has-text("Create Generator")');
  await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await enrollLoginAndCreateGenerator(page, uniqueEmail('dash'));
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.click('.nav-logout');
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('shows generator name in heading area', async ({ page }) => {
    await expect(page.locator('.dashboard-page')).toBeVisible();
    await expect(page.locator('text=Honda EU2200i')).toBeVisible();
  });

  test('shows status card with running state', async ({ page }) => {
    await expect(page.locator('.stat-card')).toHaveCount(3);
    await expect(page.locator('.stat-card').first()).toContainText('Stopped');
  });

  test('shows hours to next oil change card', async ({ page }) => {
    await expect(page.locator('.stat-card').nth(1)).toContainText('Hours');
  });

  test('shows months to next oil change card', async ({ page }) => {
    await expect(page.locator('.stat-card').nth(2)).toContainText('Months');
  });

  test('shows oil change history section', async ({ page }) => {
    await expect(page.locator('.oil-change-section')).toBeVisible();
  });

  test('can log an oil change from dashboard', async ({ page }) => {
    await page.click('button:has-text("Log Oil Change")');
    await expect(page.locator('.oil-change-form')).toBeVisible();

    await page.fill('.oil-change-form #oilNotes', 'Used Castrol 10W-30');
    await page.click('.oil-change-form button[type="submit"]');

    await expect(page.locator('.oil-change-entry')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.oil-change-entry')).toContainText('Castrol 10W-30');
  });

  test('can delete an oil change entry', async ({ page }) => {
    await page.click('button:has-text("Log Oil Change")');
    await page.click('.oil-change-form button[type="submit"]');
    await expect(page.locator('.oil-change-entry')).toHaveCount(1, { timeout: 5000 });

    const deletePromise = page.waitForResponse(
      r => r.url().includes('/oil-changes/') && r.request().method() === 'DELETE'
    );
    page.once('dialog', dialog => dialog.accept());
    await page.click('.delete-oil-change-button');
    await deletePromise;

    await expect(page.locator('.oil-change-entry')).toHaveCount(0, { timeout: 5000 });
  });

  test('navigation order is Dashboard, Run Log, API Keys, Downloads', async ({ page }) => {
    const links = page.locator('.nav-links .nav-link');
    await expect(links.nth(0)).toContainText('Dashboard');
    await expect(links.nth(1)).toContainText('Run Log');
    await expect(links.nth(2)).toContainText('API Keys');
    await expect(links.nth(3)).toContainText('Downloads');
  });
});
