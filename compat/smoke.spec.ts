import { expect, test, type Page } from '@playwright/test';

// Which compat app is under test: ng18 and ng20 run on Zone.js, ng22 is zoneless.
const app = process.env['COMPAT_APP'] ?? '';
const expectedMajor = app.replace(/^ng/, '');
const expectZone = app !== 'ng22';

/** Opens the app, collecting page and console errors; asserts the Angular major and mode. */
async function open(page: Page): Promise<string[]> {
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
  return errors;
}

/** Types a message into the composer and presses Enter. */
async function send(page: Page, text: string): Promise<void> {
  const input = page.locator('textarea');
  await input.fill(text);
  await input.press('Enter');
}

test('sends a message and streams the scripted reply', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'hello');

  await expect(page.locator('[data-role="user"]')).toContainText('hello', { timeout: 5_000 });
  await expect(page.locator('[data-role="assistant"]')).toContainText('Hi there!', {
    timeout: 5_000,
  });
  // Sending clears the composer.
  await expect(page.locator('textarea')).toHaveValue('');

  expect(errors).toEqual([]);
});

test('renders the registered tool UI for a scripted tool call', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'weather');

  // The registered component renders (NgComponentOutlet with the `tool` input): first
  // waiting for the result, then updated in place when the tool output arrives.
  const card = page.locator('[data-testid="weather-card"]');
  await expect(card).toHaveAttribute('data-state', 'loading', { timeout: 15_000 });
  await expect(card).toContainText('Paris');
  await expect(card).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
  await expect(card).toContainText('Paris: 18C Sunny');
  await expect(page.locator('[data-role="assistant"]')).toContainText('It is sunny in Paris.', {
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="weather-card"]')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('swaps Send and Stop with *auiIf and cancels a running reply', async ({ page }) => {
  const errors = await open(page);
  const sendButton = page.getByRole('button', { name: 'Send' });
  const stopButton = page.getByRole('button', { name: 'Stop' });
  await expect(sendButton).toBeVisible();
  await expect(stopButton).toHaveCount(0);

  await send(page, 'slow');

  // *auiIf creates the Stop view from a store callback and removes the Send view.
  await expect(stopButton).toBeVisible({ timeout: 5_000 });
  await expect(sendButton).toHaveCount(0);
  await expect(page.locator('[data-role="assistant"]')).toContainText('one', { timeout: 5_000 });

  await stopButton.click();

  await expect(sendButton).toBeVisible({ timeout: 5_000 });
  await expect(stopButton).toHaveCount(0);
  // The stream was aborted: the rest of the reply never arrives.
  await page.waitForTimeout(1_500);
  await expect(page.locator('[data-role="assistant"]')).not.toContainText('the end');

  expect(errors).toEqual([]);
});
