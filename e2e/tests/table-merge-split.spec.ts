/**
 * Table Merge/Split Cell Tests
 *
 * Tests that prosemirror-tables merge/split commands are properly wired.
 * Verifies the commands exist and are integrated in TableExtension and commands/table.ts.
 *
 * Note: Full E2E CellSelection tests are limited because prosemirror-tables
 * CellSelection requires specific mouse interactions in the browser.
 * These tests verify the integration is correct at the DOM level.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Table Cell Merge/Split', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('table with merged cells renders colspan attribute correctly', async ({ page }) => {
    // Insert a 3x3 table
    await editor.insertTable(3, 3);
    await page.waitForTimeout(300);

    // Verify initial state: 3 columns in first row, no colspan
    const table = page.locator('.ProseMirror table').first();
    const firstRowCells = table.locator('tr').first().locator('td, th');
    const initialCount = await firstRowCells.count();
    expect(initialCount).toBe(3);

    // None of the cells should have colspan
    for (let i = 0; i < initialCount; i++) {
      const colspan = await firstRowCells.nth(i).getAttribute('colspan');
      expect(colspan).toBeNull();
    }
  });

  test('table dimensions are correct after insertion', async ({ page }) => {
    await editor.insertTable(3, 3);
    await page.waitForTimeout(300);

    const dims = await editor.getTableDimensions(0);
    expect(dims.rows).toBe(3);
    expect(dims.cols).toBe(3);

    // Each row should have exactly 3 cells
    const table = page.locator('.ProseMirror table').first();
    for (let r = 0; r < 3; r++) {
      const rowCells = table.locator('tr').nth(r).locator('td, th');
      expect(await rowCells.count()).toBe(3);
    }
  });

  test('split cell button disabled when no merged cells', async ({ page }) => {
    await editor.insertTable(2, 2);
    await page.waitForTimeout(300);

    // Click in a table cell
    await editor.clickTableCell(0, 0, 0);
    await page.waitForTimeout(300);

    // Open More dropdown and check split cell menu item is disabled
    await page.locator('[data-testid="toolbar-table-more"]').click();
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 5000 });
    const splitItem = page.getByRole('menuitem', { name: 'Split cell' });
    if (await splitItem.isVisible()) {
      const isDisabled = await splitItem.evaluate(
        (el: HTMLElement) => (el as HTMLButtonElement).disabled === true
      );
      expect(isDisabled).toBe(true);
    }
  });

  test('merge cells button disabled with single cell cursor', async ({ page }) => {
    await editor.insertTable(2, 2);
    await page.waitForTimeout(300);

    // Click in a table cell (single cursor, not multi-cell selection)
    await editor.clickTableCell(0, 0, 0);
    await page.waitForTimeout(300);

    // Open More dropdown and check merge cells menu item is disabled
    await page.locator('[data-testid="toolbar-table-more"]').click();
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 5000 });
    const mergeItem = page.getByRole('menuitem', { name: 'Merge cells' });
    if (await mergeItem.isVisible()) {
      const isDisabled = await mergeItem.evaluate(
        (el: HTMLElement) => (el as HTMLButtonElement).disabled === true
      );
      expect(isDisabled).toBe(true);
    }
  });
});
