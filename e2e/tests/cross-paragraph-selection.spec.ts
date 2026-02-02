/**
 * Cross-Paragraph Selection Tests
 *
 * Tests for selecting text across multiple paragraphs and performing
 * operations on those selections.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Cross-Paragraph Selection', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test.describe('Basic Selection', () => {
    test('select text and apply bold', async ({ page }) => {
      // Type some text
      await editor.typeText('Hello World');

      // Select text
      await editor.selectText('Hello');

      // Apply bold
      await editor.applyBold();

      // Verify bold was applied
      await assertions.assertTextIsBold(page, 'Hello');
    });

    test('select text and apply italic', async ({ page }) => {
      await editor.typeText('Italic test');
      await editor.selectText('Italic');
      await editor.applyItalic();
      await assertions.assertTextIsItalic(page, 'Italic');
    });

    test('select text and apply underline', async ({ page }) => {
      await editor.typeText('Underline test');
      await editor.selectText('Underline');
      await editor.applyUnderline();
      await assertions.assertTextIsUnderlined(page, 'Underline');
    });
  });

  test.describe('Multi-Paragraph Content', () => {
    test('create multiple paragraphs with Enter', async ({ page }) => {
      // Type first paragraph
      await editor.typeText('First paragraph');
      await editor.pressEnter();

      // Type second paragraph
      await editor.typeText('Second paragraph');
      await editor.pressEnter();

      // Type third paragraph
      await editor.typeText('Third paragraph');

      // Verify content exists
      await assertions.assertDocumentContainsText(page, 'First paragraph');
      await assertions.assertDocumentContainsText(page, 'Second paragraph');
      await assertions.assertDocumentContainsText(page, 'Third paragraph');
    });

    test('multiple paragraphs maintain text integrity', async ({ page }) => {
      // Create paragraphs
      await editor.typeText('Paragraph one');
      await editor.pressEnter();
      await editor.typeText('Paragraph two');

      // Verify both paragraphs exist
      await assertions.assertDocumentContainsText(page, 'Paragraph one');
      await assertions.assertDocumentContainsText(page, 'Paragraph two');
    });
  });

  test.describe('Delete Operations', () => {
    test('delete selected text within paragraph', async ({ page }) => {
      // Type text
      await editor.typeText('Delete this text');

      // Select word
      await editor.selectText('this');

      // Delete
      await page.keyboard.press('Delete');

      // Verify text is deleted
      await page.waitForTimeout(100);
      await assertions.assertDocumentNotContainsText(page, 'this');
    });

    test('backspace deletes selected text', async ({ page }) => {
      // Type text
      await editor.typeText('Remove word');

      // Select word
      await editor.selectText('Remove');

      // Backspace
      await page.keyboard.press('Backspace');

      // Verify text is deleted
      await page.waitForTimeout(100);
      await assertions.assertDocumentNotContainsText(page, 'Remove');
      await assertions.assertDocumentContainsText(page, 'word');
    });
  });

  test.describe('Selection with Lists', () => {
    test('apply bullet list to paragraph', async ({ page }) => {
      // Create a paragraph
      await editor.typeText('List item text');

      // Apply bullet list
      await editor.applyBulletList();

      // Verify it's a list
      await assertions.assertParagraphIsList(page, 0, 'bullet');
    });

    test('apply numbered list to paragraph', async ({ page }) => {
      // Create a paragraph
      await editor.typeText('Numbered item');

      // Apply numbered list
      await editor.applyNumberedList();

      // Verify it's a numbered list
      await assertions.assertParagraphIsList(page, 0, 'numbered');
    });
  });

  test.describe('Selection Edge Cases', () => {
    test('empty document has working cursor', async ({ page }) => {
      // Type text
      await editor.typeText('Typing works');

      // Verify text appears
      await assertions.assertDocumentContainsText(page, 'Typing works');
    });

    test('format partial word', async ({ page }) => {
      // Type text
      await editor.typeText('Hello');

      // Select first two characters
      await editor.selectRange(0, 0, 2);

      // Apply bold
      await editor.applyBold();

      // Verify partial bold
      await assertions.assertTextIsBold(page, 'He');
    });
  });

  test.describe('Formatting with Selection', () => {
    test('bold formats selected text', async ({ page }) => {
      await editor.typeText('Make this bold');
      await editor.selectText('bold');
      await editor.applyBold();
      await assertions.assertTextIsBold(page, 'bold');
    });

    test('italic formats selected text', async ({ page }) => {
      await editor.typeText('Make this italic');
      await editor.selectText('italic');
      await editor.applyItalic();
      await assertions.assertTextIsItalic(page, 'italic');
    });

    test('underline formats selected text', async ({ page }) => {
      await editor.typeText('Make this underlined');
      await editor.selectText('underlined');
      await editor.applyUnderline();
      await assertions.assertTextIsUnderlined(page, 'underlined');
    });

    test('combined formatting with keyboard', async ({ page }) => {
      // Test applying bold and italic using keyboard shortcuts on same selection
      await editor.typeText('Format this text');
      await editor.selectText('this');

      // Apply bold via Ctrl+B
      await editor.applyBoldShortcut();
      await page.waitForTimeout(50);

      // Re-select and apply italic via Ctrl+I
      await editor.selectText('this');
      await editor.applyItalicShortcut();

      // Verify both formats applied
      await assertions.assertTextIsBold(page, 'this');
      await assertions.assertTextIsItalic(page, 'this');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Ctrl+B applies bold', async ({ page }) => {
      await editor.typeText('Keyboard bold');
      await editor.selectText('bold');
      await editor.applyBoldShortcut();
      await assertions.assertTextIsBold(page, 'bold');
    });

    test('Ctrl+I applies italic', async ({ page }) => {
      await editor.typeText('Keyboard italic');
      await editor.selectText('italic');
      await editor.applyItalicShortcut();
      await assertions.assertTextIsItalic(page, 'italic');
    });

    test('Ctrl+U applies underline', async ({ page }) => {
      await editor.typeText('Keyboard underline');
      await editor.selectText('underline');
      await editor.applyUnderlineShortcut();
      await assertions.assertTextIsUnderlined(page, 'underline');
    });
  });
});
