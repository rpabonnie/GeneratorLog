import { test, expect } from '@playwright/test';

const PASSWORD = 'TestPass123!';
let counter = 0;

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}${counter++}@example.com`;
}

async function enroll(page: import('@playwright/test').Page, email: string, name?: string) {
  await page.goto('/enroll');
  await page.fill('#email', email);
  if (name) await page.fill('#name', name);
  await page.fill('#password', PASSWORD);
  await page.fill('#confirmPassword', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile');
}

test.describe('Authentication', () => {
  test('full enrollment redirects to profile', async ({ page }) => {
    await page.goto('/enroll');
    await page.fill('#email', uniqueEmail('enroll-happy'));
    await page.fill('#name', 'Test User');
    await page.fill('#password', PASSWORD);
    await page.fill('#confirmPassword', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/profile');
  });

  test('login with valid credentials redirects to profile', async ({ page }) => {
    const email = uniqueEmail('login-happy');
    await enroll(page, email);
    await page.click('button:has-text("Sign Out")');
    await expect(page).toHaveURL('/login');

    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/profile');
  });

  test('logout redirects to login', async ({ page }) => {
    await enroll(page, uniqueEmail('logout'));
    await page.click('button:has-text("Sign Out")');
    await expect(page).toHaveURL('/login');
  });

  test('session persists on page reload', async ({ page }) => {
    await enroll(page, uniqueEmail('session'));
    await page.reload();
    await expect(page).toHaveURL('/profile');
  });

  test('wrong password shows error message', async ({ page }) => {
    const email = uniqueEmail('wrong-pass');
    await enroll(page, email);
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL('/login');

    await page.fill('#email', email);
    await page.fill('#password', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('unauthenticated access to profile redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });

  test('password too short shows validation error without submitting', async ({ page }) => {
    await page.goto('/enroll');
    await page.fill('#email', uniqueEmail('short-pass'));
    await page.fill('#password', 'short');
    await page.fill('#confirmPassword', 'short');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('8 characters');
    await expect(page).toHaveURL('/enroll');
  });

  test('mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/enroll');
    await page.fill('#email', uniqueEmail('mismatch'));
    await page.fill('#password', PASSWORD);
    await page.fill('#confirmPassword', 'DifferentPass123!');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toHaveText('Passwords do not match');
    await expect(page).toHaveURL('/enroll');
  });
});
