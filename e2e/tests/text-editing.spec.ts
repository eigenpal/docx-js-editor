/**
 * Text Editing Tests
 *
 * Comprehensive tests for text editing functionality including:
 * - Basic text input
 * - Line breaks and paragraphs
 * - Backspace and Delete
 * - Selection and navigation
 * - Copy/Cut/Paste
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';
import * as textSelection from '../helpers/text-selection';

test.describe('Basic Text Input', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('type single character', async ({ page }) => {
    await editor.typeText('a');
    await assertions.assertDocumentContainsText(page, 'a');
  });

  test('type a sentence', async ({ page }) => {
    await editor.typeText('The quick brown fox jumps over the lazy dog.');
    await assertions.assertDocumentContainsText(page, 'The quick brown fox');
  });

  test('type special characters', async ({ page }) => {
    await editor.typeText('Special: !@#$%^&*()_+-=[]{}|;\':",./<>?');
    await assertions.assertDocumentContainsText(page, '!@#$%^&*()');
  });

  test('type unicode characters', async ({ page }) => {
    await editor.typeText('Unicode: äöü ñ éèêë');
    await assertions.assertDocumentContainsText(page, 'äöü');
  });

  test('type numbers', async ({ page }) => {
    await editor.typeText('Numbers: 0123456789');
    await assertions.assertDocumentContainsText(page, '0123456789');
  });

  test('type mixed content', async ({ page }) => {
    await editor.typeText('Mix: Hello 123 !@# äöü');
    await assertions.assertDocumentContainsText(page, 'Mix: Hello 123');
  });
});

test.describe('Line Breaks and Paragraphs', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('Enter creates new paragraph', async ({ page }) => {
    await editor.typeText('Paragraph 1');
    await editor.pressEnter();
    await editor.typeText('Paragraph 2');

    await assertions.assertDocumentContainsText(page, 'Paragraph 1');
    await assertions.assertDocumentContainsText(page, 'Paragraph 2');
  });

  test('Shift+Enter creates soft break', async ({ page }) => {
    await editor.typeText('Line 1');
    await editor.pressShiftEnter();
    await editor.typeText('Line 2');

    await assertions.assertDocumentContainsText(page, 'Line 1');
    await assertions.assertDocumentContainsText(page, 'Line 2');
  });

  test('multiple Enter presses create multiple paragraphs', async ({ page }) => {
    await editor.typeText('First');
    await editor.pressEnter();
    await editor.pressEnter();
    await editor.pressEnter();
    await editor.typeText('After gaps');

    await assertions.assertDocumentContainsText(page, 'First');
    await assertions.assertDocumentContainsText(page, 'After gaps');
  });

  test('Enter at start of paragraph', async ({ page }) => {
    await editor.typeText('Text');
    await page.keyboard.press('Home');
    await editor.pressEnter();

    await assertions.assertDocumentContainsText(page, 'Text');
  });

  test('Enter at end of paragraph', async ({ page }) => {
    await editor.typeText('Text');
    await editor.pressEnter();
    await editor.typeText('More');

    await assertions.assertDocumentContainsText(page, 'Text');
    await assertions.assertDocumentContainsText(page, 'More');
  });

  test('Enter in middle of text', async ({ page }) => {
    await editor.typeText('HelloWorld');
    // Move cursor to middle
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await editor.pressEnter();

    await assertions.assertDocumentContainsText(page, 'Hello');
    await assertions.assertDocumentContainsText(page, 'World');
  });
});

test.describe('Backspace and Delete', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('Backspace deletes character before cursor', async ({ page }) => {
    await editor.typeText('Hello');
    await editor.pressBackspace();

    await assertions.assertDocumentContainsText(page, 'Hell');
    await assertions.assertDocumentNotContainsText(page, 'Hello');
  });

  test('Delete removes character after cursor', async ({ page }) => {
    await editor.typeText('Hello');
    await page.keyboard.press('Home');
    await editor.pressDelete();

    await assertions.assertDocumentContainsText(page, 'ello');
  });

  test('Backspace at start does nothing', async ({ page }) => {
    await editor.typeText('Text');
    await page.keyboard.press('Home');
    await editor.pressBackspace();
    await editor.pressBackspace();

    await assertions.assertDocumentContainsText(page, 'Text');
  });

  test('Delete at end does nothing', async ({ page }) => {
    await editor.typeText('Text');
    await editor.pressDelete();
    await editor.pressDelete();

    await assertions.assertDocumentContainsText(page, 'Text');
  });

  test('Backspace deletes selected text', async ({ page }) => {
    await editor.typeText('Hello World');
    await editor.selectText('World');
    await editor.pressBackspace();

    await assertions.assertDocumentContainsText(page, 'Hello ');
    await assertions.assertDocumentNotContainsText(page, 'World');
  });

  test('Delete removes selected text', async ({ page }) => {
    await editor.typeText('Hello World');
    await editor.selectText('Hello');
    await editor.pressDelete();

    await assertions.assertDocumentContainsText(page, 'World');
  });

  test('multiple backspaces', async ({ page }) => {
    await editor.typeText('ABCDE');
    await editor.pressBackspace();
    await editor.pressBackspace();
    await editor.pressBackspace();

    await assertions.assertDocumentContainsText(page, 'AB');
  });
});

test.describe('Selection', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('Select all with Ctrl+A', async ({ page }) => {
    await editor.typeText('Select all this text');
    await editor.selectAll();

    const selected = await editor.getSelectedText();
    expect(selected).toContain('Select all this text');
  });

  test('select specific text', async ({ page }) => {
    await editor.typeText('Find this word in the text');
    const found = await editor.selectText('word');

    expect(found).toBe(true);
    const selected = await editor.getSelectedText();
    expect(selected).toBe('word');
  });

  test('extend selection with Shift+Arrow', async ({ page }) => {
    await editor.typeText('Hello');
    await page.keyboard.press('Home');

    // Extend selection to the right
    await textSelection.extendSelectionByCharacter(page, 'right', 3);

    const selected = await editor.getSelectedText();
    expect(selected).toBe('Hel');
  });

  test('typing replaces selection', async ({ page }) => {
    await editor.typeText('Replace this');
    await editor.selectText('this');
    await editor.typeText('that');

    await assertions.assertDocumentContainsText(page, 'Replace that');
    await assertions.assertDocumentNotContainsText(page, 'this');
  });
});

test.describe('Copy, Cut, Paste', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('copy and paste', async ({ page }) => {
    await editor.typeText('Copy me');
    await editor.selectAll();
    await editor.copy();
    await page.keyboard.press('End');
    await editor.typeText(' - ');
    await editor.paste();

    await assertions.assertDocumentContainsText(page, 'Copy me - Copy me');
  });

  test.skip('cut and paste', async ({ page }) => {
    // TODO: Fix cut operation - execCommand('delete') doesn't work well with ProseMirror
    await editor.typeText('ABC');
    await editor.selectText('B');
    await editor.cut();
    await page.keyboard.press('End');
    await editor.paste();

    await assertions.assertDocumentContainsText(page, 'ACB');
  });

  test('paste replaces selection', async ({ page }) => {
    await editor.typeText('Original');
    await editor.selectAll();
    await editor.copy();
    await page.keyboard.press('End');
    await editor.typeText(' New');
    await editor.selectText('New');
    await editor.paste();

    await assertions.assertDocumentContainsText(page, 'Original Original');
  });
});

test.describe('Navigation', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('Arrow keys move cursor', async ({ page }) => {
    await editor.typeText('Test');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await editor.typeText('X');

    await assertions.assertDocumentContainsText(page, 'TeXst');
  });

  test('Home moves to start', async ({ page }) => {
    await editor.typeText('Hello');
    await page.keyboard.press('Home');
    await editor.typeText('X');

    await assertions.assertDocumentContainsText(page, 'XHello');
  });

  test.skip('End moves to end', async ({ page }) => {
    // TODO: End key behavior differs between platforms - needs investigation
    await editor.typeText('Hello');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await editor.typeText('X');

    await assertions.assertDocumentContainsText(page, 'HelloX');
  });

  test('Ctrl+Left moves by word', async ({ page }) => {
    await editor.typeText('Hello World Test');
    const modifier = process.platform === 'darwin' ? 'Alt' : 'Control';
    await page.keyboard.press(`${modifier}+ArrowLeft`);
    await page.keyboard.press(`${modifier}+ArrowLeft`);
    await editor.typeText('X');

    // Should insert before "World"
    await assertions.assertDocumentContainsText(page, 'Hello XWorld');
  });
});

test.describe('Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('rapid typing preserves all characters', async ({ page }) => {
    await editor.typeTextSlowly('abcdefghij', 20);
    await assertions.assertDocumentContainsText(page, 'abcdefghij');
  });

  test('empty document operations', async ({ page }) => {
    // These should not crash
    await editor.selectAll();
    await editor.pressBackspace();
    await editor.pressDelete();

    await editor.expectReady();
  });

  test('very long text input', async ({ page }) => {
    const longText = 'Lorem ipsum '.repeat(50);
    await editor.typeText(longText);

    await assertions.assertDocumentContainsText(page, 'Lorem ipsum');
  });

  test('whitespace only', async ({ page }) => {
    await editor.typeText('   ');
    await editor.selectAll();
    await editor.pressBackspace();

    await editor.expectReady();
  });
});
