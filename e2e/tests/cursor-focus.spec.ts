/**
 * Cursor Focus Tests
 *
 * Tests for maintaining cursor focus in the editor:
 * - Cursor should not be lost when clicking toolbar buttons
 * - Cursor should remain after using dropdowns (font, size, color)
 * - Clicking on page background should focus the editor
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Cursor Focus - Toolbar Interactions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('cursor stays visible after clicking Bold button', async ({ page }) => {
    // Type some text and position cursor
    await editor.typeText('Test text');

    // Verify editor has focus
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);

    // Click Bold button
    await page.getByTestId('toolbar-bold').click();

    // Verify editor still has focus after clicking toolbar
    const editorStillHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorStillHasFocus).toBe(true);

    // Typing should work immediately without needing to click
    await page.keyboard.type(' more text');

    // Verify the text was added
    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Test text more text');
  });

  test('cursor stays visible after clicking Italic button', async ({ page }) => {
    await editor.typeText('Test text');

    // Click Italic button
    await page.getByTestId('toolbar-italic').click();

    // Verify focus is maintained
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);
  });

  test('cursor stays visible after clicking Underline button', async ({ page }) => {
    await editor.typeText('Test text');

    // Click Underline button
    await page.getByTestId('toolbar-underline').click();

    // Verify focus is maintained
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);
  });

  test('cursor stays visible after clicking alignment buttons', async ({ page }) => {
    await editor.typeText('Test text');

    // Click Center alignment
    await page.getByRole('button', { name: 'Center (Ctrl+E)' }).click();

    // Verify focus is maintained
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);

    // Click Right alignment
    await page.getByRole('button', { name: 'Align Right (Ctrl+R)' }).click();

    // Verify focus is still maintained
    const stillHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(stillHasFocus).toBe(true);
  });

  test('cursor stays visible after clicking list buttons', async ({ page }) => {
    await editor.typeText('Test text');

    // Click Bullet List
    await page.getByRole('button', { name: 'Bullet List' }).click();

    // Verify focus is maintained
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);
  });

  test('can type immediately after clicking multiple toolbar buttons', async ({ page }) => {
    // Click Bold
    await page.getByTestId('toolbar-bold').click();

    // Click Italic
    await page.getByTestId('toolbar-italic').click();

    // Click Underline
    await page.getByTestId('toolbar-underline').click();

    // Type - should work without needing to click in editor
    await page.keyboard.type('Formatted text');

    // Verify text was typed
    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Formatted text');
  });
});

test.describe('Cursor Focus - Dropdown Interactions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('can type after using font family dropdown', async ({ page }) => {
    await editor.typeText('Before ');

    // Use font dropdown
    await editor.setFontFamily('Georgia');

    // Type more text
    await page.keyboard.type('After');

    // Verify all text is present
    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Before After');
  });

  test('can type after using font size dropdown', async ({ page }) => {
    await editor.typeText('Before ');

    // Use font size dropdown
    await editor.setFontSize(18);

    // Type more text
    await page.keyboard.type('After');

    // Verify all text is present
    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Before After');
  });
});

test.describe('Cursor Focus - Rapid Interactions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('rapid toolbar clicks maintain focus', async ({ page }) => {
    await editor.typeText('Test');

    // Rapidly click multiple toolbar buttons
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('toolbar-bold').click();
      await page.getByTestId('toolbar-italic').click();
    }

    // Should still be able to type
    await page.keyboard.type(' more');

    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Test more');
  });
});

test.describe('Cursor Focus - Text Selection Preservation', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('text selection preserved when clicking Bold button', async ({ page }) => {
    // Type text
    await editor.typeText('Hello World');

    // Select "World" by using keyboard (Shift+Ctrl+Left to select word)
    await page.keyboard.press('Shift+Control+ArrowLeft');

    // Verify there's a selection
    const hasSelectionBefore = await page.evaluate(() => {
      const selection = window.getSelection();
      return selection && !selection.isCollapsed;
    });
    expect(hasSelectionBefore).toBe(true);

    // Click Bold button
    await page.getByTestId('toolbar-bold').click();

    // Verify text is now bold
    const hasBold = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.querySelector('strong, b') !== null;
    });
    expect(hasBold).toBe(true);

    // Verify selection is still there (editor still has focus)
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);
  });

  test('text selection preserved when using font family dropdown', async ({ page }) => {
    // Type text
    await editor.typeText('Select this text');

    // Select all text
    await editor.selectAll();

    // Verify there's a selection
    const hasSelectionBefore = await page.evaluate(() => {
      const selection = window.getSelection();
      return selection && !selection.isCollapsed;
    });
    expect(hasSelectionBefore).toBe(true);

    // Change font family
    await editor.setFontFamily('Georgia');

    // Verify editor still has focus
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);

    // Verify the font was applied (by checking for Georgia font style)
    const hasGeorgia = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      const span = editor?.querySelector('span[style*="Georgia"], span[style*="georgia"]');
      return span !== null;
    });
    expect(hasGeorgia).toBe(true);
  });

  test('text selection preserved when using font size dropdown', async ({ page }) => {
    // Type text
    await editor.typeText('Size this text');

    // Select all text
    await editor.selectAll();

    // Verify there's a selection
    const hasSelectionBefore = await page.evaluate(() => {
      const selection = window.getSelection();
      return selection && !selection.isCollapsed;
    });
    expect(hasSelectionBefore).toBe(true);

    // Change font size
    await editor.setFontSize(18);

    // Verify editor still has focus
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);
  });
});

test.describe('Cursor Focus - Background Click', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('clicking toolbar does not lose editor focus', async ({ page }) => {
    // Type some text first
    await editor.typeText('Some text');

    // Click on the toolbar area (but not on a button)
    const toolbar = page.getByTestId('toolbar');
    const box = await toolbar.boundingBox();
    if (box) {
      // Click on empty area of toolbar (far right where there are no buttons)
      await page.mouse.click(box.x + box.width - 10, box.y + box.height / 2);
    }

    // Small delay to allow focus to settle
    await page.waitForTimeout(50);

    // Verify editor still has focus
    const editorHasFocus = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return document.activeElement === editor || editor?.contains(document.activeElement);
    });
    expect(editorHasFocus).toBe(true);

    // Should be able to type immediately
    await page.keyboard.type(' more');

    const text = await page.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      return editor?.textContent;
    });
    expect(text).toContain('Some text more');
  });
});
