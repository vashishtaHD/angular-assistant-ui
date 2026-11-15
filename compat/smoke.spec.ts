import { expect, test, type Locator, type Page } from '@playwright/test';

// Which compat app is under test: ng18 and ng20 run on Zone.js, ng22 is zoneless.
// Every app renders the styled kit (`aui-thread-list` + `aui-thread` from
// `angular-assistant-ui/ui`) over AISDKThreads (in-memory thread list) and the
// scripted transport from `angular-assistant-ui/testing`.
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
  await expect(composerInput(page)).toBeVisible();
  return errors;
}

const composerInput = (page: Page): Locator => page.getByRole('textbox', { name: 'Message input' });
const userMessages = (page: Page): Locator => page.locator('aui-thread [data-role="user"]');
const assistantMessages = (page: Page): Locator =>
  page.locator('aui-thread [data-role="assistant"]');

/** Types a message into the thread composer and presses Enter. */
async function send(page: Page, text: string): Promise<void> {
  const input = composerInput(page);
  await input.fill(text);
  await input.press('Enter');
}

test('styles.css loads: the kit tokens resolve', async ({ page }) => {
  const errors = await open(page);

  const background = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--aui-background').trim(),
  );
  expect(background).not.toBe('');
  // The kit's own rules apply too (not only the tokens).
  await expect(page.locator('aui-thread')).toHaveCSS('display', /flex|block|grid/);

  expect(errors).toEqual([]);
});

test('sends a message and streams the scripted reply', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'hello');

  await expect(userMessages(page)).toContainText('hello', { timeout: 5_000 });
  await expect(assistantMessages(page)).toContainText('Hi there!', { timeout: 5_000 });
  // Sending clears the composer.
  await expect(composerInput(page)).toHaveValue('');

  expect(errors).toEqual([]);
});

test('renders markdown bold and a code block', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'markdown');

  const reply = assistantMessages(page).last();
  await expect(reply.locator('strong')).toHaveText('bold', { timeout: 5_000 });
  await expect(reply.locator('pre code')).toContainText('const answer = 42;');

  expect(errors).toEqual([]);
});

test('renders the registered tool UI for a scripted tool call', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'weather');

  // The registered component renders with the `tool` input: first waiting for the
  // result, then updated in place when the tool output arrives.
  const card = page.locator('[data-testid="weather-card"]');
  await expect(card).toHaveAttribute('data-state', 'loading', { timeout: 15_000 });
  await expect(card).toContainText('Paris');
  await expect(card).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
  await expect(card).toContainText('Paris: 18C Sunny');
  await expect(assistantMessages(page)).toContainText('It is sunny in Paris.', {
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="weather-card"]')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('swaps Send and Stop and cancels a running reply', async ({ page }) => {
  const errors = await open(page);
  const sendButton = page.getByRole('button', { name: 'Send message' });
  const stopButton = page.getByRole('button', { name: 'Stop generating' });
  await expect(sendButton).toBeVisible();
  await expect(stopButton).toHaveCount(0);

  await send(page, 'slow');

  await expect(stopButton).toBeVisible({ timeout: 5_000 });
  await expect(sendButton).toHaveCount(0);
  await expect(assistantMessages(page)).toContainText('one', { timeout: 5_000 });

  await stopButton.click();

  await expect(sendButton).toBeVisible({ timeout: 5_000 });
  await expect(stopButton).toHaveCount(0);
  // The stream was aborted: the rest of the reply never arrives.
  await page.waitForTimeout(1_500);
  await expect(assistantMessages(page)).not.toContainText('the end');

  expect(errors).toEqual([]);
});

test('editing a message branches: the picker shows 2 / 2, Previous shows 1 / 2', async ({
  page,
}) => {
  const errors = await open(page);

  await send(page, 'hello');
  await expect(assistantMessages(page)).toContainText('Hi there!', { timeout: 5_000 });

  const user = userMessages(page).first();
  await user.hover();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editInput = page.getByRole('textbox', { name: 'Edit message' });
  await editInput.fill('hello again');
  await page.getByRole('button', { name: 'Update' }).click();

  await expect(userMessages(page)).toContainText('hello again', { timeout: 5_000 });
  const state = page.locator('aui-thread .aui-branch-picker-state').first();
  await expect(state).toHaveText(/^\s*2\s*\/\s*2\s*$/, { timeout: 5_000 });

  await userMessages(page).first().hover();
  await page.getByRole('button', { name: 'Previous' }).first().click();
  await expect(state).toHaveText(/^\s*1\s*\/\s*2\s*$/);
  await expect(userMessages(page).first()).toContainText('hello');
  await expect(userMessages(page).first()).not.toContainText('hello again');

  expect(errors).toEqual([]);
});

test('an attachment chip appears after choosing a file', async ({ page }) => {
  const errors = await open(page);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add Attachment' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('compat smoke'),
  });

  const chip = page.locator('.aui-composer-attachments [data-slot="aui_attachment-root"]');
  await expect(chip).toHaveCount(1, { timeout: 5_000 });

  // The scripted attachment adapter completes it on send; the user message shows it.
  await send(page, 'hello');
  await expect(userMessages(page).last().locator('[data-slot="aui_attachment-root"]')).toHaveCount(
    1,
    { timeout: 5_000 },
  );
  await expect(chip).toHaveCount(0);
  await expect(assistantMessages(page)).toContainText('Hi there!', { timeout: 5_000 });

  expect(errors).toEqual([]);
});

test('approving a tool call renders the receipt', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'book');

  const approve = page.getByRole('button', { name: 'Approve' });
  await expect(approve).toBeVisible({ timeout: 10_000 });
  await approve.click();

  const receipt = page.locator('[data-slot="aui_tool-fallback-approval-receipt"]');
  await expect(receipt).toHaveAttribute('data-outcome', 'allowed', { timeout: 5_000 });
  await expect(receipt).toContainText('Approved');
  // The answer resubmits automatically and the scripted continuation arrives.
  await expect(assistantMessages(page).last()).toContainText('Booked.', { timeout: 5_000 });
  await expect(receipt).toHaveAttribute('data-outcome', 'allowed');

  expect(errors).toEqual([]);
});

test('answering an ask-user question resubmits the choice', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'ask');

  const form = page.locator('[data-slot="aui_tool-fallback-ask-user"]');
  await expect(form).toContainText('Which city?', { timeout: 10_000 });
  await form.getByRole('radio', { name: 'Paris' }).check();
  await form.getByRole('button', { name: 'Submit' }).click();

  await expect(assistantMessages(page).last()).toContainText('You picked Paris.', {
    timeout: 5_000,
  });
  await expect(form).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('the thread list creates a new thread and switches back', async ({ page }) => {
  const errors = await open(page);

  await send(page, 'hello');
  await expect(assistantMessages(page)).toContainText('Hi there!', { timeout: 5_000 });

  await page.locator('aui-thread-list').getByRole('button', { name: 'New Thread' }).click();
  await expect(userMessages(page)).toHaveCount(0, { timeout: 5_000 });

  await send(page, 'second thread');
  await expect(userMessages(page)).toContainText('second thread', { timeout: 5_000 });

  const items = page.locator('aui-thread-list .aui-thread-list-item');
  await expect(items).toHaveCount(2, { timeout: 5_000 });
  await page
    .locator(
      'aui-thread-list .aui-thread-list-item:not([data-active]) .aui-thread-list-item-trigger',
    )
    .click();

  await expect(userMessages(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(userMessages(page)).toContainText('hello');
  await expect(userMessages(page)).not.toContainText('second thread');
  await expect(assistantMessages(page)).toContainText('Hi there!');

  expect(errors).toEqual([]);
});
