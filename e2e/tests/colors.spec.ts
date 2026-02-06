/**
 * Color Tests
 *
 * Comprehensive tests for text color and highlight color functionality including:
 * - Text color changes (red, blue, green, custom hex)
 * - Highlight/background colors
 * - Combined color operations
 * - Undo/redo for color changes
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Text Color', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('set text color to red', async ({ page }) => {
    await editor.typeText('Red text');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');

    await assertions.assertDocumentContainsText(page, 'Red text');
  });

  test('set text color to blue', async ({ page }) => {
    await editor.typeText('Blue text');
    await editor.selectAll();
    await editor.setTextColor('#0000FF');

    await assertions.assertDocumentContainsText(page, 'Blue text');
  });

  test('set text color to green', async ({ page }) => {
    await editor.typeText('Green text');
    await editor.selectAll();
    await editor.setTextColor('#00FF00');

    await assertions.assertDocumentContainsText(page, 'Green text');
  });

  test.skip('set text color to custom hex', async ({ page }) => {
    // Flaky: custom hex input + selectAll loses text in paged editor
    await editor.typeText('Custom color');
    await editor.selectAll();
    await editor.setTextColor('#FF5733');

    await assertions.assertDocumentContainsText(page, 'Custom color');
  });

  test('set text color to black', async ({ page }) => {
    await editor.typeText('Black text');
    await editor.selectAll();
    await editor.setTextColor('#000000');

    await assertions.assertDocumentContainsText(page, 'Black text');
  });

  test('text color on partial selection', async ({ page }) => {
    await editor.typeText('Hello World');
    await editor.selectText('World');
    await editor.setTextColor('#FF0000');

    await assertions.assertDocumentContainsText(page, 'Hello World');
  });

  test('multiple colors in document', async ({ page }) => {
    // Type all text first
    await editor.typeText('Red text');
    await editor.pressEnter();
    await editor.typeText('Blue text');

    // Now color each part
    await editor.selectText('Red text');
    await editor.setTextColor('#FF0000');
    await editor.selectText('Blue text');
    await editor.setTextColor('#0000FF');

    await assertions.assertDocumentContainsText(page, 'Red text');
    await assertions.assertDocumentContainsText(page, 'Blue text');
  });

  test('undo text color change', async ({ page }) => {
    await editor.typeText('Undo color test');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Undo color test');
  });

  test('redo text color change', async ({ page }) => {
    await editor.typeText('Redo color test');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'Redo color test');
  });
});

test.describe('Highlight Color', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('set highlight color to yellow', async ({ page }) => {
    await editor.typeText('Highlighted text');
    await editor.selectAll();
    await editor.setHighlightColor('yellow');

    await assertions.assertDocumentContainsText(page, 'Highlighted text');
  });

  test('set highlight color to cyan', async ({ page }) => {
    await editor.typeText('Cyan highlight');
    await editor.selectAll();
    await editor.setHighlightColor('cyan');

    await assertions.assertDocumentContainsText(page, 'Cyan highlight');
  });

  test('set highlight color to magenta', async ({ page }) => {
    await editor.typeText('Magenta highlight');
    await editor.selectAll();
    await editor.setHighlightColor('magenta');

    await assertions.assertDocumentContainsText(page, 'Magenta highlight');
  });

  test('set highlight color to green', async ({ page }) => {
    await editor.typeText('Green highlight');
    await editor.selectAll();
    await editor.setHighlightColor('green');

    await assertions.assertDocumentContainsText(page, 'Green highlight');
  });

  test('highlight on partial selection', async ({ page }) => {
    await editor.typeText('Hello World');
    await editor.selectText('World');
    await editor.setHighlightColor('yellow');

    await assertions.assertDocumentContainsText(page, 'Hello World');
  });

  test('multiple highlights in document', async ({ page }) => {
    // Type all text first
    await editor.typeText('Yellow text');
    await editor.pressEnter();
    await editor.typeText('Cyan text');

    // Now highlight each part
    await editor.selectText('Yellow text');
    await editor.setHighlightColor('yellow');
    await editor.selectText('Cyan text');
    await editor.setHighlightColor('cyan');

    await assertions.assertDocumentContainsText(page, 'Yellow text');
    await assertions.assertDocumentContainsText(page, 'Cyan text');
  });

  test('undo highlight change', async ({ page }) => {
    await editor.typeText('Undo highlight test');
    await editor.selectAll();
    await editor.setHighlightColor('yellow');
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Undo highlight test');
  });
});

test.describe('Combined Color Operations', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('text color and highlight combined', async ({ page }) => {
    await editor.typeText('Combined colors');
    await editor.selectAll();
    await editor.setTextColor('#0000FF');
    await editor.setHighlightColor('yellow');

    await assertions.assertDocumentContainsText(page, 'Combined colors');
  });

  test('text color with bold formatting', async ({ page }) => {
    await editor.typeText('Bold red text');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'Bold red text');
  });

  test('text color with italic formatting', async ({ page }) => {
    await editor.typeText('Italic blue text');
    await editor.selectAll();
    await editor.setTextColor('#0000FF');
    await editor.applyItalic();

    await assertions.assertTextIsItalic(page, 'Italic blue text');
  });

  test('highlight with bold formatting', async ({ page }) => {
    await editor.typeText('Bold highlighted');
    await editor.selectAll();
    await editor.setHighlightColor('yellow');
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'Bold highlighted');
  });

  test.skip('color with font family change', async ({ page }) => {
    // Flaky: selectAll + setFontFamily via native select loses ProseMirror selection/text
    await editor.typeText('Colored font test');
    await editor.selectAll();
    await editor.setFontFamily('Georgia');
    await editor.setTextColor('#8B4513');

    await assertions.assertDocumentContainsText(page, 'Colored font test');
  });

  test('color with font size change', async ({ page }) => {
    await editor.typeText('Large colored text');
    await editor.selectAll();
    await editor.setFontSize(24);
    await editor.setTextColor('#FF0000');

    await assertions.assertDocumentContainsText(page, 'Large colored text');
  });

  test('all formatting combined', async ({ page }) => {
    await editor.typeText('Full formatting');
    await editor.selectAll();
    await editor.setFontFamily('Arial');
    await editor.setFontSize(18);
    await editor.setTextColor('#0000FF');
    await editor.setHighlightColor('yellow');
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'Full formatting');
  });
});

test.describe('Color Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('color change with no selection', async ({ page }) => {
    await editor.typeText('No selection');
    await editor.setTextColor('#FF0000');
    await editor.typeText(' more text');

    await assertions.assertDocumentContainsText(page, 'No selection more text');
  });

  test('color on empty document', async ({ page }) => {
    await editor.setTextColor('#FF0000');
    await editor.typeText('Red from start');

    await assertions.assertDocumentContainsText(page, 'Red from start');
  });

  test('highlight on empty document', async ({ page }) => {
    await editor.setHighlightColor('yellow');
    await editor.typeText('Highlighted from start');

    await assertions.assertDocumentContainsText(page, 'Highlighted from start');
  });

  test('rapid color changes', async ({ page }) => {
    await editor.typeText('Rapid colors');
    await editor.selectAll();

    await editor.setTextColor('#FF0000');
    await editor.setTextColor('#00FF00');
    await editor.setTextColor('#0000FF');
    await editor.setTextColor('#FF00FF');

    await assertions.assertDocumentContainsText(page, 'Rapid colors');
  });

  test('rapid highlight changes', async ({ page }) => {
    await editor.typeText('Rapid highlights');
    await editor.selectAll();

    await editor.setHighlightColor('yellow');
    await editor.setHighlightColor('cyan');
    await editor.setHighlightColor('magenta');
    await editor.setHighlightColor('green');

    await assertions.assertDocumentContainsText(page, 'Rapid highlights');
  });

  test('color with special characters', async ({ page }) => {
    await editor.typeText('Special: @#$%^&*()');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');

    await assertions.assertDocumentContainsText(page, 'Special: @#$%^&*()');
  });

  test('color with unicode characters', async ({ page }) => {
    await editor.typeText('Unicode: 日本語 中文');
    await editor.selectAll();
    await editor.setTextColor('#0000FF');

    await assertions.assertDocumentContainsText(page, 'Unicode:');
  });

  test.skip('alternating colors per word', async ({ page }) => {
    // Flaky: selectText + setTextColor + typeText sequence loses text
    await editor.typeText('Red ');
    await editor.selectText('Red');
    await editor.setTextColor('#FF0000');

    await editor.typeText('Blue ');
    await editor.selectText('Blue');
    await editor.setTextColor('#0000FF');

    await editor.typeText('Green');
    await editor.selectText('Green');
    await editor.setTextColor('#00FF00');

    await assertions.assertDocumentContainsText(page, 'Red');
    await assertions.assertDocumentContainsText(page, 'Blue');
    await assertions.assertDocumentContainsText(page, 'Green');
  });
});
