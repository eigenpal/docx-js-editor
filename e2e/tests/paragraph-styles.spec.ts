/**
 * Paragraph Style Tests
 *
 * Comprehensive tests for paragraph styles including:
 * - Normal, Heading 1-3, Title, Subtitle styles
 * - Style transitions
 * - Document structure with styles
 * - Styles with additional formatting
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Basic Styles', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('apply Normal style', async ({ page }) => {
    await editor.typeText('Normal paragraph text');
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Normal paragraph text');
  });

  test('apply Heading 1 style', async ({ page }) => {
    await editor.typeText('Main Heading');
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'Main Heading');
  });

  test('apply Heading 2 style', async ({ page }) => {
    await editor.typeText('Sub Heading');
    await editor.applyHeading2();

    await assertions.assertDocumentContainsText(page, 'Sub Heading');
  });

  test('apply Heading 3 style', async ({ page }) => {
    await editor.typeText('Section Heading');
    await editor.applyHeading3();

    await assertions.assertDocumentContainsText(page, 'Section Heading');
  });

  test('apply Title style', async ({ page }) => {
    await editor.typeText('Document Title');
    await editor.applyTitleStyle();

    await assertions.assertDocumentContainsText(page, 'Document Title');
  });

  test('apply Subtitle style', async ({ page }) => {
    await editor.typeText('Document Subtitle');
    await editor.applySubtitleStyle();

    await assertions.assertDocumentContainsText(page, 'Document Subtitle');
  });
});

test.describe('Style Transitions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('change from Normal to Heading 1', async ({ page }) => {
    await editor.typeText('Promote to heading');
    await editor.applyNormalStyle();
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'Promote to heading');
  });

  test('change from Heading 1 to Normal', async ({ page }) => {
    await editor.typeText('Demote to normal');
    await editor.applyHeading1();
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Demote to normal');
  });

  test('change from Heading 1 to Heading 2', async ({ page }) => {
    await editor.typeText('Demote heading level');
    await editor.applyHeading1();
    await editor.applyHeading2();

    await assertions.assertDocumentContainsText(page, 'Demote heading level');
  });

  test('change from Heading 2 to Heading 3', async ({ page }) => {
    await editor.typeText('Further demote');
    await editor.applyHeading2();
    await editor.applyHeading3();

    await assertions.assertDocumentContainsText(page, 'Further demote');
  });

  test('change from Title to Heading 1', async ({ page }) => {
    await editor.typeText('Title to Heading');
    await editor.applyTitleStyle();
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'Title to Heading');
  });

  test('cycle through styles', async ({ page }) => {
    await editor.typeText('Style cycle');
    await editor.applyNormalStyle();
    await editor.applyHeading1();
    await editor.applyHeading2();
    await editor.applyHeading3();
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Style cycle');
  });
});

test.describe('Document Structure', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('multiple headings in document', async ({ page }) => {
    await editor.typeText('Chapter One');
    await editor.applyHeading1();
    await editor.pressEnter();
    await editor.typeText('Introduction');
    await editor.applyHeading2();
    await editor.pressEnter();
    await editor.typeText('This is the body text.');
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Chapter One');
    await assertions.assertDocumentContainsText(page, 'Introduction');
    await assertions.assertDocumentContainsText(page, 'This is the body text.');
  });

  test('complete document structure', async ({ page }) => {
    await editor.typeText('Annual Report');
    await editor.applyTitleStyle();
    await editor.pressEnter();
    await editor.typeText('Fiscal Year 2024');
    await editor.applySubtitleStyle();
    await editor.pressEnter();
    await editor.typeText('Executive Summary');
    await editor.applyHeading1();
    await editor.pressEnter();
    await editor.typeText('This document provides an overview.');
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Annual Report');
    await assertions.assertDocumentContainsText(page, 'Fiscal Year 2024');
    await assertions.assertDocumentContainsText(page, 'Executive Summary');
  });

  test('nested heading structure', async ({ page }) => {
    await editor.typeText('Chapter 1');
    await editor.applyHeading1();
    await editor.pressEnter();
    await editor.typeText('Section 1.1');
    await editor.applyHeading2();
    await editor.pressEnter();
    await editor.typeText('Subsection 1.1.1');
    await editor.applyHeading3();
    await editor.pressEnter();
    await editor.typeText('Body text here.');
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Chapter 1');
    await assertions.assertDocumentContainsText(page, 'Section 1.1');
    await assertions.assertDocumentContainsText(page, 'Subsection 1.1.1');
  });

  test('alternating headings and paragraphs', async ({ page }) => {
    await editor.typeText('Heading');
    await editor.applyHeading1();
    await editor.pressEnter();
    await editor.typeText('Paragraph one.');
    await editor.applyNormalStyle();
    await editor.pressEnter();
    await editor.typeText('Another Heading');
    await editor.applyHeading1();
    await editor.pressEnter();
    await editor.typeText('Paragraph two.');
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Heading');
    await assertions.assertDocumentContainsText(page, 'Paragraph one.');
    await assertions.assertDocumentContainsText(page, 'Another Heading');
    await assertions.assertDocumentContainsText(page, 'Paragraph two.');
  });
});

test.describe('Styles with Formatting', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('style with additional bold', async ({ page }) => {
    await editor.typeText('Heading with extra bold');
    await editor.applyHeading1();
    await editor.selectText('extra');
    await editor.applyBold();

    await assertions.assertDocumentContainsText(page, 'Heading with extra bold');
  });

  test('style with additional italic', async ({ page }) => {
    await editor.typeText('Normal with italic word');
    await editor.applyNormalStyle();
    await editor.selectText('italic');
    await editor.applyItalic();

    await assertions.assertDocumentContainsText(page, 'Normal with italic word');
  });

  test('style with color override', async ({ page }) => {
    await editor.typeText('Colored heading');
    await editor.applyHeading1();
    await editor.selectAll();
    await editor.setTextColor('#FF0000');

    await assertions.assertDocumentContainsText(page, 'Colored heading');
  });

  test('style with alignment', async ({ page }) => {
    await editor.typeText('Centered Heading');
    await editor.applyHeading1();
    await editor.alignCenter();

    await assertions.assertDocumentContainsText(page, 'Centered Heading');
  });

  test('style with font override', async ({ page }) => {
    await editor.typeText('Custom Font Heading');
    await editor.applyHeading1();
    await editor.selectAll();
    await editor.setFontFamily('Georgia');

    await assertions.assertDocumentContainsText(page, 'Custom Font Heading');
  });

  test('heading with underline', async ({ page }) => {
    await editor.typeText('Underlined Heading');
    await editor.applyHeading2();
    await editor.selectAll();
    await editor.applyUnderline();

    await assertions.assertTextIsUnderlined(page, 'Underlined Heading');
  });
});

test.describe('Styles Undo/Redo', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('undo style change', async ({ page }) => {
    await editor.typeText('Undo style test');
    await editor.applyHeading1();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Undo style test');
  });

  test('redo style change', async ({ page }) => {
    await editor.typeText('Redo style test');
    await editor.applyHeading1();
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'Redo style test');
  });

  test('multiple undo style changes', async ({ page }) => {
    await editor.typeText('Multiple undo');
    await editor.applyNormalStyle();
    await editor.applyHeading1();
    await editor.applyHeading2();
    await editor.undo();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Multiple undo');
  });
});

test.describe('Styles Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('style on empty paragraph', async ({ page }) => {
    await editor.applyHeading1();
    await editor.typeText('Text after style');

    await assertions.assertDocumentContainsText(page, 'Text after style');
  });

  test('style preserves text content', async ({ page }) => {
    await editor.typeText('Important content that should not change');
    await editor.applyHeading1();
    await editor.applyHeading2();
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Important content that should not change');
  });

  test('rapid style changes', async ({ page }) => {
    await editor.typeText('Rapid changes');
    await editor.applyNormalStyle();
    await editor.applyHeading1();
    await editor.applyHeading2();
    await editor.applyHeading3();
    await editor.applyTitleStyle();
    await editor.applyNormalStyle();

    await assertions.assertDocumentContainsText(page, 'Rapid changes');
  });

  test('style with special characters', async ({ page }) => {
    await editor.typeText('Heading: @#$%^&*()');
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'Heading: @#$%^&*()');
  });

  test('style with unicode', async ({ page }) => {
    await editor.typeText('日本語見出し');
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, '日本語見出し');
  });

  test('style with numbers', async ({ page }) => {
    await editor.typeText('Chapter 1: Introduction');
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'Chapter 1: Introduction');
  });

  test('long heading text', async ({ page }) => {
    await editor.typeText(
      'This is a very long heading that spans multiple words and tests how the style handles longer content'
    );
    await editor.applyHeading1();

    await assertions.assertDocumentContainsText(page, 'This is a very long heading');
  });
});
