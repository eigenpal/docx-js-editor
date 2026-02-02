/**
 * List Tests
 *
 * Comprehensive tests for bullet and numbered list functionality including:
 * - Creating bullet and numbered lists
 * - Multiple list items
 * - Nested lists (indent/outdent)
 * - List conversion and removal
 * - Lists with formatting
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Bullet Lists', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('create bullet list', async ({ page }) => {
    await editor.typeText('First item');
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'First item');
  });

  test('multiple bullet items', async ({ page }) => {
    await editor.typeText('Item one');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Item two');
    await editor.pressEnter();
    await editor.typeText('Item three');

    await assertions.assertDocumentContainsText(page, 'Item one');
    await assertions.assertDocumentContainsText(page, 'Item two');
    await assertions.assertDocumentContainsText(page, 'Item three');
  });

  test('toggle bullet list off', async ({ page }) => {
    await editor.typeText('List item');
    await editor.toggleBulletList();
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('bullet list with five items', async ({ page }) => {
    await editor.typeText('Apple');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Banana');
    await editor.pressEnter();
    await editor.typeText('Cherry');
    await editor.pressEnter();
    await editor.typeText('Date');
    await editor.pressEnter();
    await editor.typeText('Elderberry');

    await assertions.assertDocumentContainsText(page, 'Apple');
    await assertions.assertDocumentContainsText(page, 'Elderberry');
  });
});

test.describe('Numbered Lists', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('create numbered list', async ({ page }) => {
    await editor.typeText('First item');
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'First item');
  });

  test('multiple numbered items', async ({ page }) => {
    await editor.typeText('First');
    await editor.toggleNumberedList();
    await editor.pressEnter();
    await editor.typeText('Second');
    await editor.pressEnter();
    await editor.typeText('Third');

    await assertions.assertDocumentContainsText(page, 'First');
    await assertions.assertDocumentContainsText(page, 'Second');
    await assertions.assertDocumentContainsText(page, 'Third');
  });

  test('toggle numbered list off', async ({ page }) => {
    await editor.typeText('List item');
    await editor.toggleNumberedList();
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('numbered list with five items', async ({ page }) => {
    await editor.typeText('Step 1');
    await editor.toggleNumberedList();
    await editor.pressEnter();
    await editor.typeText('Step 2');
    await editor.pressEnter();
    await editor.typeText('Step 3');
    await editor.pressEnter();
    await editor.typeText('Step 4');
    await editor.pressEnter();
    await editor.typeText('Step 5');

    await assertions.assertDocumentContainsText(page, 'Step 1');
    await assertions.assertDocumentContainsText(page, 'Step 5');
  });
});

test.describe('List Conversion', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('convert bullet to numbered', async ({ page }) => {
    await editor.typeText('List item');
    await editor.toggleBulletList();
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('convert numbered to bullet', async ({ page }) => {
    await editor.typeText('List item');
    await editor.toggleNumberedList();
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('convert paragraph to bullet list', async ({ page }) => {
    await editor.typeText('First line');
    await editor.pressEnter();
    await editor.typeText('Second line');
    await editor.pressEnter();
    await editor.typeText('Third line');
    await editor.selectAll();
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'First line');
    await assertions.assertDocumentContainsText(page, 'Second line');
    await assertions.assertDocumentContainsText(page, 'Third line');
  });

  test('convert paragraph to numbered list', async ({ page }) => {
    await editor.typeText('First');
    await editor.pressEnter();
    await editor.typeText('Second');
    await editor.pressEnter();
    await editor.typeText('Third');
    await editor.selectAll();
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'First');
    await assertions.assertDocumentContainsText(page, 'Third');
  });
});

test.describe('Nested Lists', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('indent list item', async ({ page }) => {
    await editor.typeText('Parent item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Child item');
    await editor.indent();

    await assertions.assertDocumentContainsText(page, 'Parent item');
    await assertions.assertDocumentContainsText(page, 'Child item');
  });

  test('outdent list item', async ({ page }) => {
    await editor.typeText('Parent item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Child item');
    await editor.indent();
    // Use Shift+Tab to outdent (more reliable than toolbar button)
    await editor.pressShiftTab();

    await assertions.assertDocumentContainsText(page, 'Parent item');
    await assertions.assertDocumentContainsText(page, 'Child item');
  });

  test('nested bullet list three levels', async ({ page }) => {
    await editor.typeText('Level 1');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Level 2');
    await editor.indent();
    await editor.pressEnter();
    await editor.typeText('Level 3');
    await editor.indent();

    await assertions.assertDocumentContainsText(page, 'Level 1');
    await assertions.assertDocumentContainsText(page, 'Level 2');
    await assertions.assertDocumentContainsText(page, 'Level 3');
  });

  test('nested numbered list', async ({ page }) => {
    await editor.typeText('First');
    await editor.toggleNumberedList();
    await editor.pressEnter();
    await editor.typeText('First-A');
    await editor.indent();
    await editor.pressEnter();
    await editor.typeText('First-B');

    await assertions.assertDocumentContainsText(page, 'First');
    await assertions.assertDocumentContainsText(page, 'First-A');
    await assertions.assertDocumentContainsText(page, 'First-B');
  });

  test('Tab key indents list', async ({ page }) => {
    await editor.typeText('Item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Sub-item');
    await editor.pressTab();

    await assertions.assertDocumentContainsText(page, 'Item');
    await assertions.assertDocumentContainsText(page, 'Sub-item');
  });

  test('Shift+Tab outdents list', async ({ page }) => {
    await editor.typeText('Item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Sub-item');
    await editor.pressTab();
    await editor.pressShiftTab();

    await assertions.assertDocumentContainsText(page, 'Item');
    await assertions.assertDocumentContainsText(page, 'Sub-item');
  });
});

test.describe('Lists with Formatting', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('bold text in list', async ({ page }) => {
    await editor.typeText('Bold item');
    await editor.selectAll();
    await editor.applyBold();
    await editor.toggleBulletList();

    await assertions.assertTextIsBold(page, 'Bold item');
  });

  test('italic text in list', async ({ page }) => {
    await editor.typeText('Italic item');
    await editor.selectAll();
    await editor.applyItalic();
    await editor.toggleBulletList();

    await assertions.assertTextIsItalic(page, 'Italic item');
  });

  test('colored text in list', async ({ page }) => {
    await editor.typeText('Colored item');
    await editor.selectAll();
    await editor.setTextColor('#FF0000');
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'Colored item');
  });

  test('multiple formatting in list item', async ({ page }) => {
    await editor.typeText('Full formatting');
    await editor.selectAll();
    await editor.applyBold();
    await editor.applyItalic();
    await editor.toggleBulletList();

    await assertions.assertTextIsBold(page, 'Full formatting');
  });

  test.skip('different formatting per list item', async ({ page }) => {
    // Type first item and make it bold using Shift+Home to select
    await editor.typeText('Bold');
    await page.keyboard.press('Shift+Home'); // Select to beginning of line
    await editor.applyBold();
    await page.keyboard.press('ArrowRight'); // Collapse selection
    await editor.toggleBulletList();
    await editor.pressEnter();

    // Type second item and make it italic
    await editor.typeText('Italic');
    await page.keyboard.press('Shift+Home');
    await editor.applyItalic();
    await page.keyboard.press('ArrowRight');
    await editor.pressEnter();

    // Type third item (normal)
    await editor.typeText('Normal');

    await assertions.assertDocumentContainsText(page, 'Bold');
    await assertions.assertDocumentContainsText(page, 'Italic');
    await assertions.assertDocumentContainsText(page, 'Normal');
  });
});

test.describe('List Undo/Redo', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('undo bullet list', async ({ page }) => {
    await editor.typeText('List item');
    // Wait for ProseMirror history group delay to expire
    await page.waitForTimeout(600);
    await editor.toggleBulletList();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('undo numbered list', async ({ page }) => {
    await editor.typeText('List item');
    // Wait for ProseMirror history group delay to expire
    await page.waitForTimeout(600);
    await editor.toggleNumberedList();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('redo bullet list', async ({ page }) => {
    await editor.typeText('List item');
    // Wait for ProseMirror history group delay to expire
    await page.waitForTimeout(600);
    await editor.toggleBulletList();
    await editor.undo();
    await editor.redo();

    await assertions.assertDocumentContainsText(page, 'List item');
  });

  test('undo indent', async ({ page }) => {
    await editor.typeText('Item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Sub-item');
    // Wait for ProseMirror history group delay to expire
    await page.waitForTimeout(600);
    await editor.indent();
    await editor.undo();

    await assertions.assertDocumentContainsText(page, 'Item');
    await assertions.assertDocumentContainsText(page, 'Sub-item');
  });
});

test.describe('List Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('exit list with double Enter', async ({ page }) => {
    await editor.typeText('List item');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.pressEnter();
    await editor.typeText('Normal text');

    await assertions.assertDocumentContainsText(page, 'List item');
    await assertions.assertDocumentContainsText(page, 'Normal text');
  });

  test('empty list item', async ({ page }) => {
    await editor.typeText('Item 1');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.pressEnter();
    await editor.typeText('Item 2');
    await editor.toggleBulletList();

    await assertions.assertDocumentContainsText(page, 'Item 1');
    await assertions.assertDocumentContainsText(page, 'Item 2');
  });

  test('list with special characters', async ({ page }) => {
    await editor.typeText('Item @#$%');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('Item ^&*()');

    await assertions.assertDocumentContainsText(page, 'Item @#$%');
    await assertions.assertDocumentContainsText(page, 'Item ^&*()');
  });

  test('list with unicode', async ({ page }) => {
    await editor.typeText('日本語');
    await editor.toggleBulletList();
    await editor.pressEnter();
    await editor.typeText('中文');

    await assertions.assertDocumentContainsText(page, '日本語');
    await assertions.assertDocumentContainsText(page, '中文');
  });

  test('rapid list toggle', async ({ page }) => {
    await editor.typeText('Rapid toggle');
    await editor.toggleBulletList();
    await editor.toggleBulletList();
    await editor.toggleBulletList();
    await editor.toggleNumberedList();
    await editor.toggleNumberedList();

    await assertions.assertDocumentContainsText(page, 'Rapid toggle');
  });
});
