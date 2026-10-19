/**
 * @file  tests/e2e-web/login.spec.ts
 * @area  Tests
 * @what  Sign-in card (19 Oct 2026): Continue with email → code → signed in; layout at 320/390/1440; Google button only when configured; focus ring; errors.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('continue with email: code step, then signed in (one account per email)', async ({ page, browserName }) => {
  // Linux WebKit drops the Secure session cookie on http://localhost (production is https); the journey runs in Chromium
  test.skip(browserName === 'webkit', 'Secure cookie over plain http');
  const email = `login-${Date.now()}@e2e.local`;
  await signIn(page, email, '/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
  // signing in again with the same email reaches the same account
  const me1 = await page.evaluate(async () => (await (await fetch('/api/v1/me')).json()).user.id);
  await page.context().clearCookies();
  await signIn(page, email, '/dashboard');
  expect(await page.evaluate(async () => (await (await fetch('/api/v1/me')).json()).user.id)).toBe(me1);
});

test('card layout: email first step, no Google button while Google is not configured', async ({ page }) => {
  await page.goto('/login');
  const card = page.locator('.login-card');
  await expect(card.getByRole('heading', { name: 'Sign in or create an account' })).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Email' })).toHaveAttribute('placeholder', 'Enter your email');
  await expect(card.getByRole('button', { name: 'Continue with email' })).toBeVisible();
  const google = (await (await page.request.get('/api/v1/auth/providers')).json()).google;
  await expect(card.getByRole('link', { name: 'Continue with Google' })).toHaveCount(google ? 1 : 0);
  await expect(card.locator('.login-or')).toHaveCount(google ? 1 : 0);
});

for (const width of [320, 390, 1440]) {
  test(`no overlap or sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/login');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    const input = await box('.login-card input[type=email]'), btn = await box('.login-card .login-email .btn'), card = await box('.login-card');
    expect(btn.y).toBeGreaterThanOrEqual(input.y + input.height);                 // stacked, not overlapping
    expect(input.x).toBeGreaterThanOrEqual(card.x); expect(btn.x + btn.width).toBeLessThanOrEqual(card.x + card.width);
    expect(btn.height).toBeGreaterThanOrEqual(44);
  });
}

test('keyboard focus is visible and errors are shown', async ({ page }) => {
  await page.goto('/login');
  const input = page.getByRole('textbox', { name: 'Email' });
  await input.focus();
  await expect.poll(() => input.evaluate((el) => getComputedStyle(el).borderColor)).toBe('rgb(255, 214, 10)');
  await input.fill('someone@e2e.local');
  await input.press('Enter');                                        // Enter in the email box sends the code
  await expect(page.getByText(/We sent a 6-digit code to/)).toBeVisible();
  await page.getByRole('textbox', { name: '6-digit code' }).fill('000000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.login-card .status.err')).toHaveText(/wrong or has expired/);
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
});
