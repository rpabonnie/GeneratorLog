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

  // Create a generator via the profile page
  await page.fill('#generatorName', 'Test Generator');
  await page.click('button:has-text("Create Generator")');
  await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
}

test.describe('Generator Logs', () => {
  test.beforeEach(async ({ page }) => {
    await enrollLoginAndCreateGenerator(page, uniqueEmail('logs'));
    await page.goto('/logs');
  });

  test('shows empty state when no logs exist', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('creates a log entry with start and end time', async ({ page }) => {
    await page.fill('#startTime', '2026-01-01T10:00');
    await page.fill('#endTime', '2026-01-01T12:30');
    await page.click('button:has-text("Add Entry")');

    await expect(page.locator('.log-row')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.log-row')).toContainText('2.5');
  });

  test('creates a log entry with only start time', async ({ page }) => {
    await page.fill('#startTime', '2026-01-02T08:00');
    await page.click('button:has-text("Add Entry")');

    await expect(page.locator('.log-row')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.log-row')).toContainText('—');
  });

  test('rejects entry when end time is before start time', async ({ page }) => {
    await page.fill('#startTime', '2026-01-01T12:00');
    await page.fill('#endTime', '2026-01-01T10:00');
    await page.click('button:has-text("Add Entry")');

    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('edits a log entry', async ({ page }) => {
    await page.fill('#startTime', '2026-01-01T10:00');
    await page.fill('#endTime', '2026-01-01T12:00');
    await page.click('button:has-text("Add Entry")');
    await expect(page.locator('.log-row')).toHaveCount(1, { timeout: 5000 });

    await page.click('.edit-log-button');
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();

    await page.fill('#endTime', '2026-01-01T14:00');
    await page.click('button:has-text("Save Changes")');

    await expect(page.locator('.log-row')).toContainText('4');
  });

  test('cancels editing restores list view', async ({ page }) => {
    await page.fill('#startTime', '2026-01-01T10:00');
    await page.fill('#endTime', '2026-01-01T11:00');
    await page.click('button:has-text("Add Entry")');
    await expect(page.locator('.log-row')).toHaveCount(1, { timeout: 5000 });

    await page.click('.edit-log-button');
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Add Entry")')).toBeVisible();
  });

  test('deletes a log entry', async ({ page }) => {
    await page.fill('#startTime', '2026-01-01T10:00');
    await page.fill('#endTime', '2026-01-01T11:00');
    await page.click('button:has-text("Add Entry")');
    await expect(page.locator('.log-row')).toHaveCount(1, { timeout: 5000 });

    const deletePromise = page.waitForResponse(
      r => r.url().includes('/logs/') && r.request().method() === 'DELETE'
    );
    page.once('dialog', dialog => dialog.accept());
    await page.click('.delete-log-button');
    await deletePromise;

    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('requires authentication to view logs', async ({ page }) => {
    // Log out
    await page.click('.nav-logout');
    await page.goto('/logs');
    await expect(page).toHaveURL('/login');
  });
});
