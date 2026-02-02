/**
 * Visual Regression Tests
 *
 * Uses Playwright's screenshot comparison to detect visual regressions.
 * Baselines are automatically created on first run.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Visual Regression - Basic States', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    // Wait for fonts and animations
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);
  });

  test('empty editor state', async ({ page }) => {
    await expect(page).toHaveScreenshot('empty-editor.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('editor with simple text', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Hello, this is a simple test document.');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('simple-text.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });

  test('editor with multiple paragraphs', async ({ page }) => {
    await editor.focus();
    await editor.typeText('First paragraph with some text.');
    await editor.pressEnter();
    await editor.typeText('Second paragraph with more text.');
    await editor.pressEnter();
    await editor.typeText('Third paragraph to complete the layout.');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('multiple-paragraphs.png', {
      maxDiffPixels: 200,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Formatting', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);
  });

  test('bold text', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Normal ');
    await editor.applyBold();
    await editor.typeText('Bold');
    await editor.applyBold();
    await editor.typeText(' Normal');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('bold-text.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('italic text', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Normal ');
    await editor.applyItalic();
    await editor.typeText('Italic');
    await editor.applyItalic();
    await editor.typeText(' Normal');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('italic-text.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('underlined text', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Normal ');
    await editor.applyUnderline();
    await editor.typeText('Underlined');
    await editor.applyUnderline();
    await editor.typeText(' Normal');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('underlined-text.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('combined formatting', async ({ page }) => {
    await editor.focus();
    await editor.typeText('This has ');
    await editor.applyBold();
    await editor.applyItalic();
    await editor.typeText('bold italic');
    await editor.applyBold();
    await editor.applyItalic();
    await editor.typeText(' text.');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('combined-formatting.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Toolbar', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);
  });

  test('toolbar default state', async ({ page }) => {
    const toolbar = page.locator('[data-testid="toolbar"]');
    await expect(toolbar).toHaveScreenshot('toolbar-default.png', {
      maxDiffPixels: 50,
      threshold: 0.2,
    });
  });

  test('toolbar with bold active', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Bold text');
    await editor.selectAll();
    await editor.applyBold();
    await page.waitForTimeout(200);

    const toolbar = page.locator('[data-testid="toolbar"]');
    await expect(toolbar).toHaveScreenshot('toolbar-bold-active.png', {
      maxDiffPixels: 50,
      threshold: 0.2,
    });
  });

  test('toolbar with multiple formats active', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Formatted');
    await editor.selectAll();
    await editor.applyBold();
    await editor.applyItalic();
    await page.waitForTimeout(200);

    const toolbar = page.locator('[data-testid="toolbar"]');
    await expect(toolbar).toHaveScreenshot('toolbar-multiple-active.png', {
      maxDiffPixels: 50,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Selection', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);
  });

  test('text selection', async ({ page }) => {
    await editor.focus();
    await editor.typeText('Select this word in the document.');
    await editor.selectText('word');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('text-selection.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('select all', async ({ page }) => {
    await editor.focus();
    await editor.typeText('All of this text will be selected.');
    await editor.selectAll();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('select-all.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Responsive', () => {
  test('narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });

    const editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);

    await editor.focus();
    await editor.typeText('Text in narrow viewport.');

    await expect(page).toHaveScreenshot('narrow-viewport.png', {
      maxDiffPixels: 150,
      threshold: 0.2,
    });
  });

  test('wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);

    await editor.focus();
    await editor.typeText('Text in wide viewport.');

    await expect(page).toHaveScreenshot('wide-viewport.png', {
      maxDiffPixels: 200,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Error States', () => {
  test.skip('loading state', async ({ page }) => {
    // Navigate without waiting for ready
    await page.goto('/');

    // Capture loading state quickly
    await expect(page).toHaveScreenshot('loading-state.png', {
      maxDiffPixels: 100,
      threshold: 0.3,
    });
  });
});

// Component-level screenshots for detailed regression testing
test.describe('Component Screenshots', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);
  });

  test('editor container', async ({ page }) => {
    const editorContainer = page.locator('[data-testid="docx-editor"]');

    if (await editorContainer.isVisible()) {
      await expect(editorContainer).toHaveScreenshot('editor-container.png', {
        maxDiffPixels: 200,
        threshold: 0.2,
      });
    }
  });
});

// Full page screenshots for overall regression
test.describe('Full Page Screenshots', () => {
  test('full page empty', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('full-page-empty.png', {
      fullPage: true,
      maxDiffPixels: 300,
      threshold: 0.2,
    });
  });

  test('full page with content', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForTimeout(500);

    await editor.focus();
    await editor.typeText('This is a test document with some content.');
    await editor.pressEnter();
    await editor.typeText('It has multiple paragraphs.');
    await editor.pressEnter();
    await editor.typeText('And various text elements.');

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('full-page-with-content.png', {
      fullPage: true,
      maxDiffPixels: 400,
      threshold: 0.2,
    });
  });
});
