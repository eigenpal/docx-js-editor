/**
 * Edge Case Tests
 *
 * Tests for edge cases, race conditions, and boundary conditions.
 * These tests are designed to find and prevent bugs.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Race Conditions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('rapid typing preserves all characters', async ({ page }) => {
    await editor.typeTextSlowly('abcdefghijklmnop', 10);

    await assertions.assertDocumentContainsText(page, 'abcdefghijklmnop');
  });

  test('quick format toggle does not corrupt', async ({ page }) => {
    await editor.typeText('Test text');
    await editor.selectAll();

    // Rapidly toggle formatting
    await editor.applyBold();
    await editor.applyBold();
    await editor.applyBold();
    await editor.applyItalic();
    await editor.applyItalic();
    await editor.applyItalic();
    await editor.applyUnderline();
    await editor.applyUnderline();

    // Document should still be intact
    await assertions.assertDocumentContainsText(page, 'Test text');
  });

  test('fast undo/redo sequence', async ({ page }) => {
    await editor.typeText('Original text');

    for (let i = 0; i < 5; i++) {
      await editor.undo();
      await editor.redo();
    }

    await assertions.assertDocumentContainsText(page, 'Original text');
  });

  test('rapid selection changes', async ({ page }) => {
    await editor.typeText('Word one two three four five');

    // Rapidly select different words
    await editor.selectText('one');
    await editor.selectText('two');
    await editor.selectText('three');
    await editor.selectText('four');
    await editor.selectText('five');

    // Document should still be intact
    await assertions.assertDocumentContainsText(page, 'Word one two three four five');
  });
});

test.describe('Boundary Conditions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('empty document operations', async ({ page }) => {
    // Operations on empty document should not crash
    await editor.selectAll();
    await editor.applyBold();
    await editor.applyItalic();
    await editor.pressBackspace();
    await editor.pressDelete();
    await editor.undo();
    await editor.redo();

    await editor.expectReady();
  });

  test('single character document', async ({ page }) => {
    await editor.typeText('X');
    await editor.selectAll();
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'X');

    await editor.pressBackspace();

    await assertions.assertDocumentNotContainsText(page, 'X');
  });

  test('whitespace only document', async ({ page }) => {
    await editor.typeText('   ');
    await editor.selectAll();
    await editor.applyBold();

    await editor.expectReady();
  });

  test('undo at empty history', async ({ page }) => {
    // Multiple undos on fresh document should not crash
    await editor.undo();
    await editor.undo();
    await editor.undo();

    await editor.expectReady();
  });

  test('redo at empty history', async ({ page }) => {
    // Multiple redos with nothing to redo should not crash
    await editor.redo();
    await editor.redo();
    await editor.redo();

    await editor.expectReady();
  });

  test('very long paragraph', async ({ page }) => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50);
    await editor.typeText(longText);
    await editor.selectAll();
    await editor.applyBold();

    await editor.expectReady();
  });

  test('many empty paragraphs', async ({ page }) => {
    // Create many empty paragraphs
    for (let i = 0; i < 20; i++) {
      await editor.pressEnter();
    }
    await editor.typeText('After many paragraphs');

    await assertions.assertDocumentContainsText(page, 'After many paragraphs');
  });
});

test.describe('Focus and Blur', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('blur and refocus', async ({ page }) => {
    await editor.typeText('Before blur');
    await editor.blur();
    await page.waitForTimeout(500);
    await editor.focus();
    await editor.typeText(' after refocus');

    await assertions.assertDocumentContainsText(page, 'Before blur');
    await assertions.assertDocumentContainsText(page, 'after refocus');
  });

  test('Escape key does not affect document', async ({ page }) => {
    await editor.typeText('Test text');
    await page.keyboard.press('Escape');

    await assertions.assertDocumentContainsText(page, 'Test text');
  });

  test('Tab key behavior', async ({ page }) => {
    await editor.typeText('Before');
    await editor.pressTab();
    await editor.typeText('After');

    await assertions.assertDocumentContainsText(page, 'Before');
    await assertions.assertDocumentContainsText(page, 'After');
  });
});

test.describe('Selection Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('format with collapsed cursor', async ({ page }) => {
    // No selection, just cursor
    await editor.applyBold();
    await editor.typeText('Bold text');
    await editor.applyBold(); // Turn off bold
    await editor.typeText(' normal text');

    await assertions.assertTextIsBold(page, 'Bold text');
  });

  test('selection spanning formatted regions', async ({ page }) => {
    await editor.typeText('Normal');
    await editor.applyBold();
    await editor.typeText('Bold');
    await editor.applyBold();
    await editor.typeText('Normal');

    await editor.selectAll();
    await editor.applyItalic();

    // All text should now be italic
    await assertions.assertTextIsItalic(page, 'Normal');
  });

  test('partial word selection', async ({ page }) => {
    await editor.typeText('ABCDE');
    await editor.selectRange(0, 1, 4); // Select 'BCD'
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'BCD');
  });

  test('selection replaced by typing', async ({ page }) => {
    await editor.typeText('Replace this word');
    await editor.selectText('this');
    await editor.typeText('that');

    await assertions.assertDocumentContainsText(page, 'Replace that word');
  });
});

test.describe('State Consistency', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('cursor position after formatting', async ({ page }) => {
    await editor.typeText('Hello');
    await editor.selectAll();
    await editor.applyBold();
    await editor.typeText(' World');

    await assertions.assertDocumentContainsText(page, 'Hello World');
  });

  test('document state after many operations', async ({ page }) => {
    await editor.typeText('Start');
    await editor.pressEnter();
    await editor.typeText('Middle');
    await editor.pressEnter();
    await editor.typeText('End');

    await editor.selectText('Middle');
    await editor.applyBold();

    await editor.undo();
    await editor.redo();

    await editor.selectAll();
    await editor.applyItalic();

    await assertions.assertDocumentContainsText(page, 'Start');
    await assertions.assertDocumentContainsText(page, 'Middle');
    await assertions.assertDocumentContainsText(page, 'End');
  });

  test('toolbar state reflects selection', async ({ page }) => {
    await editor.typeText('Bold text');
    await editor.selectText('Bold');
    await editor.applyBold();

    // Select bold text - toolbar should show active
    await editor.selectText('Bold');
    await assertions.assertToolbarButtonActive(page, 'toolbar-bold');

    // Select other text - toolbar should show inactive
    await editor.selectText('text');
    // Note: 'text' is not bold, so toolbar should reflect that
  });
});

test.describe('Unicode and Special Characters', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('unicode characters preserved', async ({ page }) => {
    await editor.typeText('Unicode: äöü éèêë ñ');

    await assertions.assertDocumentContainsText(page, 'äöü');
    await assertions.assertDocumentContainsText(page, 'éèêë');
    await assertions.assertDocumentContainsText(page, 'ñ');
  });

  test('special characters preserved', async ({ page }) => {
    await editor.typeText('Special: !@#$%^&*()_+-=[]{}|;\':",./<>?');

    await assertions.assertDocumentContainsText(page, '!@#$%^&*()');
  });

  test('Asian characters', async ({ page }) => {
    await editor.typeText('Asian: 日本語 中文 한국어');

    await assertions.assertDocumentContainsText(page, '日本語');
  });

  test('format unicode text', async ({ page }) => {
    await editor.typeText('Format äöü test');
    await editor.selectText('äöü');
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'äöü');
  });
});

test.describe('Performance', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('handles large text input', async ({ page }) => {
    test.setTimeout(60000);

    const largeText = 'Lorem ipsum dolor sit amet. '.repeat(200);
    await editor.typeText(largeText);

    await assertions.assertDocumentContainsText(page, 'Lorem ipsum');
  });

  test('many format operations', async ({ page }) => {
    await editor.typeText('Word '.repeat(50));

    // Apply formatting multiple times
    for (let i = 0; i < 10; i++) {
      await editor.selectAll();
      await editor.applyBold();
      await editor.undo();
    }

    await editor.expectReady();
  });

  test('many undo/redo cycles', async ({ page }) => {
    // Create some history
    for (let i = 0; i < 10; i++) {
      await editor.typeText(`Line ${i} `);
    }

    // Undo/redo many times
    for (let i = 0; i < 5; i++) {
      await editor.undo();
    }

    for (let i = 0; i < 5; i++) {
      await editor.redo();
    }

    await editor.expectReady();
  });
});
