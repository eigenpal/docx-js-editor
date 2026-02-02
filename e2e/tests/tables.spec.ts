/**
 * Table Tests
 *
 * Comprehensive tests for table functionality including:
 * - Table insertion
 * - Cell navigation
 * - Cell content editing
 * - Formatting within tables
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';

test.describe('Table Creation', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test.skip('insert 3x3 table', async ({ page }) => {
    // Note: Table insertion requires the insert table dialog to be open
    // This test is skipped pending implementation details
    await editor.insertTable(3, 3);

    const tableCount = await editor.getTableCount();
    expect(tableCount).toBe(1);

    const dimensions = await editor.getTableDimensions(0);
    expect(dimensions.rows).toBe(3);
    expect(dimensions.cols).toBe(3);
  });

  test.skip('insert minimal 1x1 table', async ({ page }) => {
    await editor.insertTable(1, 1);

    await assertions.assertTableDimensions(page, 0, 1, 1);
  });

  test.skip('insert larger 10x5 table', async ({ page }) => {
    await editor.insertTable(10, 5);

    await assertions.assertTableDimensions(page, 0, 10, 5);
  });
});

test.describe('Table Content', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test.skip('type in table cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 0);
    await editor.typeText('Cell A1');

    await assertions.assertTableCellText(page, 0, 0, 0, 'Cell A1');
  });

  test.skip('type in multiple cells', async ({ page }) => {
    await editor.insertTable(2, 2);

    await editor.clickTableCell(0, 0, 0);
    await editor.typeText('A1');

    await editor.clickTableCell(0, 0, 1);
    await editor.typeText('B1');

    await editor.clickTableCell(0, 1, 0);
    await editor.typeText('A2');

    await editor.clickTableCell(0, 1, 1);
    await editor.typeText('B2');

    await assertions.assertTableCellText(page, 0, 0, 0, 'A1');
    await assertions.assertTableCellText(page, 0, 0, 1, 'B1');
    await assertions.assertTableCellText(page, 0, 1, 0, 'A2');
    await assertions.assertTableCellText(page, 0, 1, 1, 'B2');
  });

  test.skip('format text in table cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 0);
    await editor.typeText('Bold cell');
    await editor.selectText('Bold');
    await editor.applyBold();

    await assertions.assertTextIsBold(page, 'Bold');
  });
});

test.describe('Table Navigation', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test.skip('Tab moves to next cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 0);
    await editor.typeText('A');
    await editor.pressTab();
    await editor.typeText('B');

    await assertions.assertTableCellText(page, 0, 0, 0, 'A');
    await assertions.assertTableCellText(page, 0, 0, 1, 'B');
  });

  test.skip('Shift+Tab moves to previous cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 1);
    await editor.typeText('B');
    await editor.pressShiftTab();
    await editor.typeText('A');

    await assertions.assertTableCellText(page, 0, 0, 0, 'A');
    await assertions.assertTableCellText(page, 0, 0, 1, 'B');
  });

  test.skip('Tab at last cell creates new row', async ({ page }) => {
    await editor.insertTable(1, 2);
    await editor.clickTableCell(0, 0, 1);
    await editor.typeText('Last');
    await editor.pressTab();

    // Should now have 2 rows
    const dimensions = await editor.getTableDimensions(0);
    expect(dimensions.rows).toBe(2);
  });
});

test.describe('Table Edge Cases', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test.skip('backspace in empty cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 0);
    await editor.pressBackspace();
    await editor.pressBackspace();
    await editor.pressBackspace();

    // Table should still exist
    const tableCount = await editor.getTableCount();
    expect(tableCount).toBe(1);
  });

  test.skip('long content in cell', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.clickTableCell(0, 0, 0);
    await editor.typeText('This is a very long text that should wrap within the cell');

    await assertions.assertDocumentContainsText(page, 'This is a very long text');
  });

  test.skip('undo table insert', async ({ page }) => {
    await editor.insertTable(2, 2);

    let tableCount = await editor.getTableCount();
    expect(tableCount).toBe(1);

    await editor.undo();

    tableCount = await editor.getTableCount();
    expect(tableCount).toBe(0);
  });

  test.skip('redo table insert', async ({ page }) => {
    await editor.insertTable(2, 2);
    await editor.undo();
    await editor.redo();

    const tableCount = await editor.getTableCount();
    expect(tableCount).toBe(1);
  });
});
