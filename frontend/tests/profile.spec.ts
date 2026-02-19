import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'TestPass123!';
let counter = 0;

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}${counter++}@example.com`;
}

async function enrollAndLogin(page: Page, email: string, name?: string) {
  await page.goto('/enroll');
  await page.fill('#email', email);
  if (name) await page.fill('#name', name);
  await page.fill('#password', PASSWORD);
  await page.fill('#confirmPassword', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile');
}

test.describe('Profile', () => {
  test('view profile shows user email and name in form', async ({ page }) => {
    const email = uniqueEmail('profile-view');
    await enrollAndLogin(page, email, 'Profile Tester');
    await page.goto('/profile');
    await expect(page.locator('#email')).toHaveValue(email);
    await expect(page.locator('#name')).toHaveValue('Profile Tester');
  });

  test('update display name persists after reload', async ({ page }) => {
    const email = uniqueEmail('profile-update');
    await enrollAndLogin(page, email, 'Original Name');
    await page.goto('/profile');

    await page.fill('#name', 'Updated Name');
    await page.click('button:has-text("Update Profile")');
    await expect(page.locator('.success-message')).toBeVisible();

    await page.reload();
    await expect(page.locator('#name')).toHaveValue('Updated Name');
  });

  test('access profile without auth redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });
});
