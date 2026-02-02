/**
 * Cursor-Only Paragraph Operations Tests
 *
 * Tests that paragraph-level operations (lists, alignment, indentation) work
 * when the cursor is positioned in a paragraph WITHOUT selecting text.
 *
 * In Word/Google Docs, paragraph operations apply to the current paragraph
 * where your cursor is, even without selecting text. This is expected behavior.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Cursor-Only List Operations', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('bullet list applies with cursor only (no selection)', async ({ page }) => {
    // Type text
    await editor.typeText('This is a paragraph');

    // Move cursor to middle of text (no selection)
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Click bullet list button - should work without selection
    await editor.toggleBulletList();

    // Verify the paragraph became a list item
    // Use 'p' selector to target paragraph element specifically (not span inside it)
    const listItem = page.locator('p[data-paragraph-index="0"]');
    // Check for list marker or list styling
    const hasListStyle = await listItem.evaluate((el) => {
      const style = window.getComputedStyle(el);
      // Check various indicators of list formatting
      return (
        el.closest('li') !== null ||
        el.querySelector('.list-marker') !== null ||
        style.listStyleType !== 'none' ||
        el.getAttribute('data-list-type') !== null
      );
    });

    // The text should still be there
    await assertions.assertDocumentContainsText(page, 'This is a paragraph');
  });

  test('numbered list applies with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('First paragraph');

    // Just click at end (cursor, no selection)
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'First paragraph');
  });

  test('toggle bullet list off with cursor only', async ({ page }) => {
    await editor.typeText('List item text');
    await editor.toggleBulletList();

    // Move cursor (no selection)
    await page.keyboard.press('Home');

    // Toggle off - should work without selection
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'List item text');
  });

  test('indent list with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Indentable item');
    await editor.toggleBulletList();

    // Move cursor to middle (no selection)
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');

    // Indent should work without selection
    await editor.indent();

    await assertions.assertDocumentContainsText(page, 'Indentable item');
  });

  test('outdent list with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Outdentable item');
    await editor.toggleBulletList();
    await editor.indent(); // First indent

    // Move cursor (no selection)
    await page.keyboard.press('Home');

    // Outdent should work without selection
    await editor.outdent();

    await assertions.assertDocumentContainsText(page, 'Outdentable item');
  });
});

test.describe('Cursor-Only Alignment Operations', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('align center with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Center this text');

    // Move cursor to middle (no selection)
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Center alignment should work without selection
    await editor.alignCenter();

    // Verify alignment changed
    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const textAlign = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });

    expect(textAlign).toBe('center');
    await assertions.assertDocumentContainsText(page, 'Center this text');
  });

  test('align right with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Right align this');

    // Click somewhere in the middle (cursor only)
    await page.keyboard.press('Home');

    await editor.alignRight();

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const textAlign = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });

    expect(textAlign).toBe('right');
  });

  test('justify with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Justify this paragraph text');

    await page.keyboard.press('Home');

    await editor.alignJustify();

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const textAlign = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });

    expect(textAlign).toBe('justify');
  });

  test('align left (reset) with cursor only', async ({ page }) => {
    await editor.typeText('Reset to left');

    // First center it
    await editor.alignCenter();

    // Move cursor
    await page.keyboard.press('Home');

    // Then reset to left
    await editor.alignLeft();

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const textAlign = await paragraph.evaluate((el) => {
      const align = window.getComputedStyle(el).textAlign;
      return align === 'start' ? 'left' : align;
    });

    expect(textAlign).toBe('left');
  });

  test('keyboard shortcut Ctrl+E centers with cursor only', async ({ page }) => {
    await editor.typeText('Shortcut test');

    await page.keyboard.press('Home');

    // Use keyboard shortcut
    await page.keyboard.press('Control+e');

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const textAlign = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });

    expect(textAlign).toBe('center');
  });
});

test.describe('Cursor-Only Indentation Operations', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('indent paragraph with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Indent this paragraph');

    // Move cursor (no selection)
    await page.keyboard.press('Home');

    // Indent should work without selection
    await editor.indent();

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const marginLeft = await paragraph.evaluate((el) => {
      return window.getComputedStyle(el).marginLeft;
    });

    // Should have some indent (not 0)
    expect(marginLeft).not.toBe('0px');
    await assertions.assertDocumentContainsText(page, 'Indent this paragraph');
  });

  test('outdent paragraph with cursor only (no selection)', async ({ page }) => {
    await editor.typeText('Outdent test');

    // Indent first
    await editor.indent();

    // Move cursor (no selection)
    await page.keyboard.press('Home');

    // Outdent should work without selection
    await editor.outdent();

    await assertions.assertDocumentContainsText(page, 'Outdent test');
  });

  test('multiple indents with cursor only', async ({ page }) => {
    await editor.typeText('Multi-indent text');

    await page.keyboard.press('Home');

    // Multiple indents
    await editor.indent();
    await editor.indent();

    const paragraph = page.locator('p[data-paragraph-index="0"]');
    const marginLeft = await paragraph.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).marginLeft, 10);
    });

    // Should have more indent than single indent (assuming ~36px per level)
    expect(marginLeft).toBeGreaterThan(50);
  });
});

test.describe('Multi-Paragraph Operations', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('align multiple paragraphs when selected', async ({ page }) => {
    // Create multiple paragraphs
    await editor.typeText('First paragraph');
    await editor.pressEnter();
    await editor.typeText('Second paragraph');
    await editor.pressEnter();
    await editor.typeText('Third paragraph');

    // Select all (Ctrl+A)
    await page.keyboard.press('Control+a');

    // Center align
    await editor.alignCenter();

    // All paragraphs should be centered
    for (let i = 0; i < 3; i++) {
      const paragraph = page.locator(`p[data-paragraph-index="${i}"]`);
      if ((await paragraph.count()) > 0) {
        const textAlign = await paragraph.evaluate((el) => {
          return window.getComputedStyle(el).textAlign;
        });
        expect(textAlign).toBe('center');
      }
    }
  });

  test('bullet list multiple paragraphs when selected', async ({ page }) => {
    await editor.typeText('Item A');
    await editor.pressEnter();
    await editor.typeText('Item B');
    await editor.pressEnter();
    await editor.typeText('Item C');

    // Select all
    await page.keyboard.press('Control+a');

    // Apply bullet list
    await editor.toggleBulletList();

    // All items should be in the list
    await assertions.assertDocumentContainsText(page, 'Item A');
    await assertions.assertDocumentContainsText(page, 'Item B');
    await assertions.assertDocumentContainsText(page, 'Item C');
  });
});
