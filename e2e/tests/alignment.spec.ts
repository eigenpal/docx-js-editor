/**
 * Alignment Tests
 *
 * Comprehensive tests for text alignment functionality including:
 * - Left, center, right, justify alignment
 * - Multiple paragraphs with different alignments
 * - Alignment with other formatting
 * - Undo/redo for alignment changes
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Basic Alignment', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('align text left', async ({ page }) => {
    await editor.typeText('Left aligned text');
    await editor.alignLeft();

    await assertions.assertDocumentContainsText(page, 'Left aligned text');
  });

  test('align text center', async ({ page }) => {
    await editor.typeText('Centered text');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Centered text');
  });

  test('align text right', async ({ page }) => {
    await editor.typeText('Right aligned text');
    await editor.alignRight();

    await assertions.assertDocumentContainsText(page, 'Right aligned text');
  });

  test('justify text', async ({ page }) => {
    await editor.typeText(
      'This is a longer paragraph that should be justified to show how text stretches across the full width.'
    );
    await editor.alignJustify();

    await assertions.assertDocumentContainsText(page, 'This is a longer paragraph');
  });
});

test.describe('Alignment Transitions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('change from left to center', async ({ page }) => {
    await editor.typeText('Toggle alignment');
    await editor.alignLeft();
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Toggle alignment');
  });

  test('change from center to right', async ({ page }) => {
    await editor.typeText('Toggle alignment');
    await editor.alignCenter();
    await editor.alignRight();

    await assertions.assertDocumentContainsText(page, 'Toggle alignment');
  });

  test('change from right to justify', async ({ page }) => {
    await editor.typeText('This is a longer text to test justify alignment properly.');
    await editor.alignRight();
    await editor.alignJustify();

    await assertions.assertDocumentContainsText(page, 'This is a longer text');
  });

  test('change from justify to left', async ({ page }) => {
    await editor.typeText('Justify to left transition');
    await editor.alignJustify();
    await editor.alignLeft();

    await assertions.assertDocumentContainsText(page, 'Justify to left transition');
  });

  test('cycle through all alignments', async ({ page }) => {
    await editor.typeText('Cycle test');
    await editor.alignLeft();
    await editor.alignCenter();
    await editor.alignRight();
    await editor.alignJustify();
    await editor.alignLeft();

    await assertions.assertDocumentContainsText(page, 'Cycle test');
  });
});

test.describe('Multiple Paragraph Alignment', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('align multiple paragraphs at once', async ({ page }) => {
    await editor.typeText('First paragraph');
    await editor.pressEnter();
    await editor.typeText('Second paragraph');
    await editor.selectAll();
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'First paragraph');
    await assertions.assertDocumentContainsText(page, 'Second paragraph');
  });

  test('different alignments per paragraph', async ({ page }) => {
    await editor.typeText('Left paragraph');
    await editor.alignLeft();
    await editor.pressEnter();
    await editor.typeText('Center paragraph');
    await editor.alignCenter();
    await editor.pressEnter();
    await editor.typeText('Right paragraph');
    await editor.alignRight();

    await assertions.assertDocumentContainsText(page, 'Left paragraph');
    await assertions.assertDocumentContainsText(page, 'Center paragraph');
    await assertions.assertDocumentContainsText(page, 'Right paragraph');
  });

  test('alternating alignment pattern', async ({ page }) => {
    await editor.typeText('First');
    await editor.alignLeft();
    await editor.pressEnter();
    await editor.typeText('Second');
    await editor.alignRight();
    await editor.pressEnter();
    await editor.typeText('Third');
    await editor.alignLeft();
    await editor.pressEnter();
    await editor.typeText('Fourth');
    await editor.alignRight();

    await assertions.assertDocumentContainsText(page, 'First');
    await assertions.assertDocumentContainsText(page, 'Fourth');
  });
});

test.describe('Alignment with Formatting', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('alignment with bold', async ({ page }) => {
    await editor.typeText('Bold centered text');
    await editor.selectAll();
    await editor.applyBold();
    await editor.alignCenter();

    await assertions.assertTextIsBold(page, 'Bold centered text');
  });

  test('alignment with italic', async ({ page }) => {
    await editor.typeText('Italic right text');
    await editor.selectAll();
    await editor.applyItalic();
    await editor.alignRight();

    await assertions.assertTextIsItalic(page, 'Italic right text');
  });

  test('alignment with underline', async ({ page }) => {
    await editor.typeText('Underlined justified text');
    await editor.selectAll();
    await editor.applyUnderline();
    await editor.alignJustify();

    await assertions.assertTextIsUnderlined(page, 'Underlined justified text');
  });

  test('center alignment with font change', async ({ page }) => {
    await editor.typeText('Styled centered text');
    await editor.selectAll();
    await editor.setFontFamily('Georgia');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Styled centered text');
  });

  test('right alignment with color', async ({ page }) => {
    await editor.typeText('Colored right text');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');
    await editor.alignRight();

    await assertions.assertDocumentContainsText(page, 'Colored right text');
  });

  test('justify with large font', async ({ page }) => {
    await editor.typeText(
      'This is a larger text that should be justified and displayed in a bigger font size.'
    );
    await editor.selectAll();
    await editor.setFontSize(18);
    await editor.alignJustify();

    await assertions.assertDocumentContainsText(page, 'This is a larger text');
  });

  test('all formatting with center alignment', async ({ page }) => {
    await editor.typeText('Full formatting');
    await editor.selectAll();
    await editor.applyBold();
    await editor.applyItalic();
    await editor.setFontSize(16);
    await editor.setTextColor('#0000FF');
    await editor.alignCenter();

    await assertions.assertTextIsBold(page, 'Full formatting');
  });
});

test.describe('Alignment Undo/Redo', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('undo alignment change', async ({ page }) => {
    await editor.typeText('Undo alignment test');
    await editor.alignCenter();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Undo alignment test');
  });

  test('redo alignment change', async ({ page }) => {
    await editor.typeText('Redo alignment test');
    await editor.alignCenter();
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'Redo alignment test');
  });

  test('multiple undo alignment changes', async ({ page }) => {
    await editor.typeText('Multiple undo');
    await editor.alignLeft();
    await editor.alignCenter();
    await editor.alignRight();
    await editor.undo();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Multiple undo');
  });

  test('undo and redo sequence', async ({ page }) => {
    await editor.typeText('Sequence test');
    await editor.alignCenter();
    await editor.undo();
    await editor.alignRight();
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'Sequence test');
  });
});

test.describe('Alignment Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('alignment on empty paragraph', async ({ page }) => {
    await editor.alignCenter();
    await editor.typeText('Text after alignment');

    await assertions.assertDocumentContainsText(page, 'Text after alignment');
  });

  test('alignment with single character', async ({ page }) => {
    await editor.typeText('X');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'X');
  });

  test('alignment with whitespace', async ({ page }) => {
    await editor.typeText('   Padded text   ');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Padded text');
  });

  test('rapid alignment changes', async ({ page }) => {
    await editor.typeText('Rapid changes');
    await editor.alignLeft();
    await editor.alignCenter();
    await editor.alignRight();
    await editor.alignJustify();
    await editor.alignLeft();
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Rapid changes');
  });

  test('alignment with special characters', async ({ page }) => {
    await editor.typeText('Special: @#$%^&*()');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Special: @#$%^&*()');
  });

  test('alignment with unicode', async ({ page }) => {
    await editor.typeText('日本語テキスト');
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, '日本語');
  });
});
