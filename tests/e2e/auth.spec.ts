import { test, expect } from '@playwright/test';

test.describe('Authentication & Real Session Workflow', () => {
  test('displays login modal and requires real credentials', async ({ page }) => {
    await page.goto('/');

    const loginTrigger = page.locator('button:has-text("Đăng Nhập"), button:has-text("Xác thực")').first();
    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
    }

    const authDialog = page.locator('#auth-dialog');
    await expect(authDialog).toBeVisible();

    const emailInput = authDialog.locator('input[type="email"]');
    const passwordInput = authDialog.locator('input[type="password"]');
    const submitBtn = authDialog.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Attempt login with invalid credentials
    await emailInput.fill('invalid-user@dps.media');
    await passwordInput.fill('wrongpassword123');
    await submitBtn.click();

    // Verify error alert is displayed
    const errorAlert = authDialog.locator('[data-testid="auth-error-alert"]');
    await expect(errorAlert).toBeVisible();
  });
});

