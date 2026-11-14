import { expect, test } from '@playwright/test';

// Which compat app is under test: ng18 and ng20 run on Zone.js, ng22 is zoneless.
const app = process.env['COMPAT_APP'] ?? '';
const expectedMajor = app.replace(/^ng/, '');
const expectZone = app !== 'ng22';

test('sends a message and streams the scripted reply', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });

  await page.goto('/');

  // The app really runs on the Angular major (and change detection mode) under test.
  await expect(page.locator('app-root')).toHaveAttribute(
    'ng-version',
    new RegExp(`^${expectedMajor}\\.`),
  );
  expect(await page.evaluate(() => 'Zone' in window)).toBe(expectZone);

  const input = page.locator('textarea');
  await input.fill('hello');
  await input.press('Enter');

  await expect(page.locator('[data-role="user"]')).toContainText('hello', { timeout: 5_000 });
  await expect(page.locator('[data-role="assistant"]')).toContainText('Hi there!', {
    timeout: 5_000,
  });
  // Sending clears the composer.
  await expect(input).toHaveValue('');

  expect(errors).toEqual([]);
});
