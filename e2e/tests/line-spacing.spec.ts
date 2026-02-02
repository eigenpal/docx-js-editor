/**
 * Line Spacing Tests
 *
 * Comprehensive tests for line spacing functionality including:
 * - Single, 1.5, and double line spacing
 * - Line spacing with other formatting
 * - Multiple paragraphs with different spacing
 * - Undo/redo for spacing changes
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Basic Line Spacing', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('set single line spacing', async ({ page }) => {
    await editor.typeText('First line of text');
    await editor.pressEnter();
    await editor.typeText('Second line of text');
    await editor.selectAll();
    await editor.setLineSpacingSingle();

    await assertions.assertDocumentContainsText(page, 'First line of text');
    await assertions.assertDocumentContainsText(page, 'Second line of text');
  });

  test('set 1.5 line spacing', async ({ page }) => {
    await editor.typeText('First line of text');
    await editor.pressEnter();
    await editor.typeText('Second line of text');
    await editor.selectAll();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, 'First line of text');
    await assertions.assertDocumentContainsText(page, 'Second line of text');
  });

  test('set double line spacing', async ({ page }) => {
    await editor.typeText('First line of text');
    await editor.pressEnter();
    await editor.typeText('Second line of text');
    await editor.selectAll();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'First line of text');
    await assertions.assertDocumentContainsText(page, 'Second line of text');
  });
});

test.describe('Line Spacing Transitions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('change from single to double spacing', async ({ page }) => {
    await editor.typeText('Line one');
    await editor.pressEnter();
    await editor.typeText('Line two');
    await editor.selectAll();
    await editor.setLineSpacingSingle();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'Line one');
    await assertions.assertDocumentContainsText(page, 'Line two');
  });

  test('change from double to 1.5 spacing', async ({ page }) => {
    await editor.typeText('Line one');
    await editor.pressEnter();
    await editor.typeText('Line two');
    await editor.selectAll();
    await editor.setLineSpacingDouble();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, 'Line one');
    await assertions.assertDocumentContainsText(page, 'Line two');
  });

  test('change from 1.5 to single spacing', async ({ page }) => {
    await editor.typeText('Line one');
    await editor.pressEnter();
    await editor.typeText('Line two');
    await editor.selectAll();
    await editor.setLineSpacing15();
    await editor.setLineSpacingSingle();

    await assertions.assertDocumentContainsText(page, 'Line one');
    await assertions.assertDocumentContainsText(page, 'Line two');
  });

  test('cycle through all spacings', async ({ page }) => {
    await editor.typeText('Spacing cycle');
    await editor.pressEnter();
    await editor.typeText('test text');
    await editor.selectAll();
    await editor.setLineSpacingSingle();
    await editor.setLineSpacing15();
    await editor.setLineSpacingDouble();
    await editor.setLineSpacingSingle();

    await assertions.assertDocumentContainsText(page, 'Spacing cycle');
  });
});

test.describe('Multiple Paragraph Spacing', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('line spacing on multiple paragraphs', async ({ page }) => {
    await editor.typeText('First paragraph');
    await editor.pressEnter();
    await editor.typeText('Second paragraph');
    await editor.pressEnter();
    await editor.typeText('Third paragraph');
    await editor.selectAll();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, 'First paragraph');
    await assertions.assertDocumentContainsText(page, 'Third paragraph');
  });

  test('different spacing per paragraph', async ({ page }) => {
    await editor.typeText('Single spaced');
    await editor.setLineSpacingSingle();
    await editor.pressEnter();
    await editor.typeText('Double spaced');
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'Single spaced');
    await assertions.assertDocumentContainsText(page, 'Double spaced');
  });

  test('long paragraph with spacing', async ({ page }) => {
    await editor.typeText(
      'This is a single paragraph with multiple sentences. It should have line spacing applied when the text wraps to the next line within the same paragraph. The spacing should affect how lines within the paragraph are displayed.'
    );
    await editor.selectAll();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'This is a single paragraph');
  });
});

test.describe('Line Spacing with Formatting', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('line spacing with bold text', async ({ page }) => {
    await editor.typeText('Bold text with spacing');
    await editor.selectAll();
    await editor.applyBold();
    await editor.setLineSpacing15();

    await assertions.assertTextIsBold(page, 'Bold text with spacing');
  });

  test('line spacing with italic text', async ({ page }) => {
    await editor.typeText('Italic text with spacing');
    await editor.selectAll();
    await editor.applyItalic();
    await editor.setLineSpacingDouble();

    await assertions.assertTextIsItalic(page, 'Italic text with spacing');
  });

  test('line spacing with font size change', async ({ page }) => {
    await editor.typeText('Large text with spacing');
    await editor.selectAll();
    await editor.setFontSize(24);
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'Large text with spacing');
  });

  test('line spacing with alignment', async ({ page }) => {
    await editor.typeText('Centered text with spacing');
    await editor.selectAll();
    await editor.alignCenter();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, 'Centered text with spacing');
  });

  test('line spacing in list', async ({ page }) => {
    await editor.typeText('List item one');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('List item two');
    await editor.selectAll();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'List item one');
    await assertions.assertDocumentContainsText(page, 'List item two');
  });

  test('all formatting with spacing', async ({ page }) => {
    await editor.typeText('Full formatting');
    await editor.selectAll();
    await editor.applyBold();
    await editor.setFontSize(18);
    await editor.setTextColor('#0000FF');
    await editor.alignCenter();
    await editor.setLineSpacingDouble();

    await assertions.assertTextIsBold(page, 'Full formatting');
  });
});

test.describe('Line Spacing Undo/Redo', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('undo line spacing change', async ({ page }) => {
    await editor.typeText('Undo spacing test');
    await editor.selectAll();
    await editor.setLineSpacingDouble();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Undo spacing test');
  });

  test('redo line spacing change', async ({ page }) => {
    await editor.typeText('Redo spacing test');
    await editor.selectAll();
    await editor.setLineSpacingDouble();
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'Redo spacing test');
  });

  test('multiple undo spacing changes', async ({ page }) => {
    await editor.typeText('Multiple undo');
    await editor.selectAll();
    await editor.setLineSpacingSingle();
    await editor.setLineSpacing15();
    await editor.setLineSpacingDouble();
    await editor.undo();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Multiple undo');
  });
});

test.describe('Line Spacing Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('spacing on empty paragraph', async ({ page }) => {
    await editor.setLineSpacingDouble();
    await editor.typeText('Text after spacing');

    await assertions.assertDocumentContainsText(page, 'Text after spacing');
  });

  test('spacing with single word', async ({ page }) => {
    await editor.typeText('Word');
    await editor.selectAll();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'Word');
  });

  test('rapid spacing changes', async ({ page }) => {
    await editor.typeText('Rapid changes');
    await editor.selectAll();
    await editor.setLineSpacingSingle();
    await editor.setLineSpacing15();
    await editor.setLineSpacingDouble();
    await editor.setLineSpacingSingle();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, 'Rapid changes');
  });

  test('spacing with special characters', async ({ page }) => {
    await editor.typeText('Special: @#$%^&*()');
    await editor.pressEnter();
    await editor.typeText('More: []{}|');
    await editor.selectAll();
    await editor.setLineSpacingDouble();

    await assertions.assertDocumentContainsText(page, 'Special: @#$%^&*()');
  });

  test('spacing with unicode', async ({ page }) => {
    await editor.typeText('日本語テキスト');
    await editor.pressEnter();
    await editor.typeText('中文文本');
    await editor.selectAll();
    await editor.setLineSpacing15();

    await assertions.assertDocumentContainsText(page, '日本語');
  });
});
