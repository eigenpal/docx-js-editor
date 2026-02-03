/**
 * Formatting Persistence Tests
 *
 * Tests for paragraph-level formatting persistence:
 * - Set formatting on empty paragraph, navigate away, return - formatting should persist
 * - Set formatting, type, delete all, type again - formatting should persist
 * - Multiple formatting types should persist together
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Formatting Persistence - Empty Paragraph', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('bold persists when navigating away and back', async ({ page }) => {
    // Set bold on empty paragraph
    await editor.applyBold();

    // Verify bold is active in toolbar
    await expect(page.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Bold should not be active in new paragraph
    await expect(page.getByTestId('toolbar-bold')).not.toHaveAttribute('aria-pressed', 'true');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // Bold should be active again
    await expect(page.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');

    // Type text - should be bold
    await editor.typeText('Bold text');
    await assertions.assertTextIsBold(page, 'Bold text');
  });

  test('italic persists when navigating away and back', async ({ page }) => {
    // Set italic on empty paragraph
    await editor.applyItalic();

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // Italic should be active
    await expect(page.getByTestId('toolbar-italic')).toHaveAttribute('aria-pressed', 'true');

    // Type text - should be italic
    await editor.typeText('Italic text');
    await assertions.assertTextIsItalic(page, 'Italic text');
  });

  test('underline persists when navigating away and back', async ({ page }) => {
    // Set underline on empty paragraph
    await editor.applyUnderline();

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // Underline should be active
    await expect(page.getByTestId('toolbar-underline')).toHaveAttribute('aria-pressed', 'true');

    // Type text - should be underlined
    await editor.typeText('Underlined text');
    await assertions.assertTextIsUnderlined(page, 'Underlined text');
  });

  test('combined formatting persists when navigating away and back', async ({ page }) => {
    // Set multiple formats on empty paragraph
    await editor.applyBold();
    await editor.applyItalic();
    await editor.applyUnderline();

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // All formats should be active
    await expect(page.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('toolbar-italic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('toolbar-underline')).toHaveAttribute('aria-pressed', 'true');

    // Type text
    await editor.typeText('Combined');
    await assertions.assertTextIsBold(page, 'Combined');
    await assertions.assertTextIsItalic(page, 'Combined');
    await assertions.assertTextIsUnderlined(page, 'Combined');
  });
});

test.describe('Formatting Persistence - Delete and Retype', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('bold persists after typing, selecting all, and retyping', async ({ page }) => {
    // Set bold and type
    await editor.applyBold();
    await editor.typeText('Initial bold');

    // Select all and delete
    await editor.selectAll();
    await page.keyboard.press('Backspace');

    // Type again - should still be bold
    await editor.typeText('Still bold');
    await assertions.assertTextIsBold(page, 'Still bold');
  });

  test('italic persists after delete and retype', async ({ page }) => {
    // Set italic and type
    await editor.applyItalic();
    await editor.typeText('Initial italic');

    // Select all and delete
    await editor.selectAll();
    await page.keyboard.press('Backspace');

    // Type again - should still be italic
    await editor.typeText('Still italic');
    await assertions.assertTextIsItalic(page, 'Still italic');
  });

  test('formatting persists through multiple delete cycles', async ({ page }) => {
    // Set bold
    await editor.applyBold();
    await editor.typeText('First');

    // Delete and retype - cycle 1
    await editor.selectAll();
    await page.keyboard.press('Backspace');
    await editor.typeText('Second');
    await assertions.assertTextIsBold(page, 'Second');

    // Delete and retype - cycle 2
    await editor.selectAll();
    await page.keyboard.press('Backspace');
    await editor.typeText('Third');
    await assertions.assertTextIsBold(page, 'Third');

    // Delete and retype - cycle 3
    await editor.selectAll();
    await page.keyboard.press('Backspace');
    await editor.typeText('Fourth');
    await assertions.assertTextIsBold(page, 'Fourth');
  });

  test('combined formatting persists after delete and retype', async ({ page }) => {
    // Set multiple formats
    await editor.applyBold();
    await editor.applyItalic();
    await editor.typeText('Combined text');

    // Select all and delete
    await editor.selectAll();
    await page.keyboard.press('Backspace');

    // Type again - all formats should persist
    await editor.typeText('New combined');
    await assertions.assertTextIsBold(page, 'New combined');
    await assertions.assertTextIsItalic(page, 'New combined');
  });
});

test.describe('Formatting Persistence - Font Properties', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  // TODO: Font persistence via dropdown has focus/selection timing issues
  test.skip('font family persists when navigating away and back', async ({ page }) => {
    // Set font family on empty paragraph
    await editor.setFontFamily('Georgia');

    // Verify in toolbar
    await expect(page.locator('[aria-label="Select font family"]')).toContainText('Georgia');

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // Font family should persist
    await expect(page.locator('[aria-label="Select font family"]')).toContainText('Georgia');

    // Type text
    await editor.typeText('Georgia text');
    await assertions.assertDocumentContainsText(page, 'Georgia text');
  });

  // TODO: Font persistence via dropdown has focus/selection timing issues
  test.skip('font size persists when navigating away and back', async ({ page }) => {
    // Set font size on empty paragraph
    await editor.setFontSize(24);

    // Verify in toolbar
    await expect(page.locator('[aria-label="Select font size"]')).toContainText('24');

    // Press Enter to create new paragraph
    await page.keyboard.press('Enter');

    // Navigate back to first paragraph
    await page.keyboard.press('ArrowUp');

    // Font size should persist
    await expect(page.locator('[aria-label="Select font size"]')).toContainText('24');
  });
});

test.describe('Formatting Persistence - Toggling Off', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('toggling bold off persists', async ({ page }) => {
    // Set bold, then toggle off
    await editor.applyBold();
    await expect(page.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');

    await editor.applyBold(); // Toggle off
    await expect(page.getByTestId('toolbar-bold')).not.toHaveAttribute('aria-pressed', 'true');

    // Navigate away and back
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');

    // Bold should still be off
    await expect(page.getByTestId('toolbar-bold')).not.toHaveAttribute('aria-pressed', 'true');
  });

  test('toggling format on after type/delete clears formatting', async ({ page }) => {
    // Set bold and type
    await editor.applyBold();
    await editor.typeText('Bold text');

    // Delete all
    await editor.selectAll();
    await page.keyboard.press('Backspace');

    // Now toggle bold OFF
    await editor.applyBold();

    // Type - should not be bold
    await editor.typeText('Not bold');

    // The text should not be bold
    const isBold = await page.evaluate(() => {
      const p = document.querySelector('.prosemirror-editor-content p');
      const strong = p?.querySelector('strong');
      return strong !== null;
    });
    expect(isBold).toBe(false);
  });
});
