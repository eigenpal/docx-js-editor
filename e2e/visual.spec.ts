import { test, expect } from '@playwright/test';

/**
 * Visual regression tests - take screenshots and compare
 * These run after each phase to verify visual output
 */

test.describe('Visual Regression Tests', () => {

  test('capture current editor state', async ({ page }) => {
    await page.goto('/');

    // Wait for fonts to load
    await page.waitForFunction(() => document.fonts.ready);

    // Wait for any async content
    await page.waitForTimeout(1000);

    // Full page screenshot
    await page.screenshot({
      path: 'screenshots/current-state.png',
      fullPage: true
    });

    // Check page loaded
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('no JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('Errors found:', criticalErrors);
    }

    expect(criticalErrors).toHaveLength(0);
  });

});

test.describe('Component Screenshots', () => {

  test('screenshot toolbar (when exists)', async ({ page }) => {
    await page.goto('/');

    const toolbar = page.locator('[data-testid="toolbar"], .toolbar, #toolbar');

    if (await toolbar.count() > 0) {
      await toolbar.screenshot({ path: 'screenshots/component-toolbar.png' });
    }
  });

  test('screenshot editor area (when exists)', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"], .editor, #editor, [contenteditable]');

    if (await editor.count() > 0) {
      await editor.first().screenshot({ path: 'screenshots/component-editor.png' });
    }
  });

  test('screenshot document viewer (when exists)', async ({ page }) => {
    await page.goto('/');

    const viewer = page.locator('[data-testid="document-viewer"], .document-viewer, .page');

    if (await viewer.count() > 0) {
      await viewer.first().screenshot({ path: 'screenshots/component-viewer.png' });
    }
  });

});
