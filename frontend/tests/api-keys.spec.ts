import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'TestPass123!';
let counter = 0;

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}${counter++}@example.com`;
}

async function enrollAndLogin(page: Page, email: string) {
  await page.goto('/enroll');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.fill('#confirmPassword', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile');
}

test.describe('API Keys', () => {
  test.beforeEach(async ({ page }) => {
    await enrollAndLogin(page, uniqueEmail('apikeys'));
    await page.goto('/api-keys');
  });

  test('create API key shows raw key in modal', async ({ page }) => {
    await page.fill('.key-name-input', 'Test Key');
    await page.click('button:has-text("Create New API Key")');
    await expect(page.locator('.modal')).toBeVisible();
    const keyText = await page.locator('.key-display code').textContent();
    expect(keyText).toMatch(/^gl_/);
    expect(keyText!.length).toBe(46);
  });

  test('raw key shown only once after dismissing modal', async ({ page }) => {
    await page.fill('.key-name-input', 'Persistent Key');
    await page.click('button:has-text("Create New API Key")');
    await expect(page.locator('.modal')).toBeVisible();
    await page.click("button:has-text(\"I've Saved the Key\")");
    await expect(page.locator('.modal')).not.toBeVisible();

    const hint = page.locator('.key-preview code');
    await expect(hint).toBeVisible();
    const hintText = await hint.textContent();
    expect(hintText).toMatch(/^gl_\.\.\./);
  });

  test('delete API key removes it from list', async ({ page }) => {
    await page.fill('.key-name-input', 'Key to Delete');
    await page.click('button:has-text("Create New API Key")');
    await expect(page.locator('.modal')).toBeVisible();
    await page.click("button:has-text(\"I've Saved the Key\")");
    await expect(page.locator('.key-card')).toHaveCount(1);

    const deletePromise = page.waitForResponse(
      r => r.url().includes('/api/api-keys/') && r.request().method() === 'DELETE'
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('.delete-button');
    await deletePromise;
    await expect(page.locator('.key-card')).toHaveCount(0, { timeout: 10_000 });
  });

  test('reset API key shows new raw key', async ({ page }) => {
    await page.fill('.key-name-input', 'Key to Reset');
    await page.click('button:has-text("Create New API Key")');
    const originalKey = await page.locator('.key-display code').textContent();
    await page.click("button:has-text(\"I've Saved the Key\")");

    page.once('dialog', (dialog) => dialog.accept());
    await page.click('.reset-button');
    await expect(page.locator('.modal')).toBeVisible();
    const newKey = await page.locator('.key-display code').textContent();
    expect(newKey).toMatch(/^gl_/);
    expect(newKey).not.toBe(originalKey);
  });

  test('create key with empty name shows error', async ({ page }) => {
    await page.click('button:has-text("Create New API Key")');
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('required');
  });
});
