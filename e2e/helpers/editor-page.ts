/**
 * Page Object Model for the DOCX Editor
 *
 * Encapsulates all editor interactions for Playwright tests.
 * Provides methods for navigation, text editing, formatting, tables, and assertions.
 */

import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Formatting options for text
 */
export interface FormattingOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  highlightColor?: string;
}

/**
 * Table cell reference
 */
export interface CellRef {
  tableIndex: number;
  row: number;
  col: number;
}

/**
 * Selection range in the editor
 */
export interface SelectionRange {
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
}

/**
 * EditorPage - Main Page Object Model for DOCX Editor testing
 */
export class EditorPage {
  readonly page: Page;

  // Main locators
  readonly editor: Locator;
  readonly toolbar: Locator;
  readonly variablePanel: Locator;
  readonly zoomControl: Locator;

  // Toolbar button locators
  readonly boldButton: Locator;
  readonly italicButton: Locator;
  readonly underlineButton: Locator;
  readonly strikethroughButton: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly clearFormattingButton: Locator;

  // Dialog locators
  readonly findReplaceDialog: Locator;
  readonly insertTableDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main component locators
    this.editor = page.locator('[data-testid="docx-editor"]');
    this.toolbar = page.locator('[data-testid="toolbar"]');
    this.variablePanel = page.locator('.variable-panel');
    this.zoomControl = page.locator('.zoom-control');

    // Toolbar buttons
    this.boldButton = page.locator('[data-testid="toolbar-bold"]');
    this.italicButton = page.locator('[data-testid="toolbar-italic"]');
    this.underlineButton = page.locator('[data-testid="toolbar-underline"]');
    this.strikethroughButton = page.locator('[data-testid="toolbar-strikethrough"]');
    this.undoButton = page.locator('[data-testid="toolbar-undo"]');
    this.redoButton = page.locator('[data-testid="toolbar-redo"]');
    this.clearFormattingButton = page.locator('[data-testid="toolbar-clear-formatting"]');

    // Dialogs
    this.findReplaceDialog = page.locator('[data-testid="find-replace-dialog"]');
    this.insertTableDialog = page.locator('[data-testid="insert-table-dialog"]');
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Navigate to the editor page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /**
   * Wait for the editor to be ready
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="docx-editor"]', { timeout: 10000 });
    // Wait for fonts to load
    await this.page.waitForFunction(() => document.fonts.ready);
    // Wait for any loading states to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Load a DOCX file via file input
   */
  async loadDocxFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, '..', filePath);

    // Find file input and upload
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(absolutePath);

    // Wait for document to load
    await this.waitForReady();
  }

  // ============================================================================
  // TEXT EDITING
  // ============================================================================

  /**
   * Get the first editable content area
   */
  getContentArea(): Locator {
    return this.page.locator('[contenteditable="true"]').first();
  }

  /**
   * Get a specific paragraph by index (0-based)
   */
  getParagraph(index: number): Locator {
    // Use 'p' prefix to avoid matching span elements that also have data-paragraph-index
    return this.page.locator(`p[data-paragraph-index="${index}"]`);
  }

  /**
   * Focus on a specific paragraph
   */
  async focusParagraph(index: number): Promise<void> {
    const paragraph = this.getParagraph(index);
    await paragraph.click();
  }

  /**
   * Type text at the current cursor position
   */
  async typeText(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /**
   * Type text slowly (character by character)
   */
  async typeTextSlowly(text: string, delay: number = 50): Promise<void> {
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(delay);
    }
  }

  /**
   * Press Enter to create a new paragraph
   * Includes a small delay to allow focus restoration to complete
   */
  async pressEnter(): Promise<void> {
    await this.page.keyboard.press('Enter');
    // Wait for React to complete re-render and focus restoration
    await this.page.waitForTimeout(50);
  }

  /**
   * Press Shift+Enter for soft line break
   */
  async pressShiftEnter(): Promise<void> {
    await this.page.keyboard.press('Shift+Enter');
  }

  /**
   * Press Backspace
   */
  async pressBackspace(): Promise<void> {
    await this.page.keyboard.press('Backspace');
  }

  /**
   * Press Delete
   */
  async pressDelete(): Promise<void> {
    await this.page.keyboard.press('Delete');
  }

  /**
   * Press Tab
   */
  async pressTab(): Promise<void> {
    await this.page.keyboard.press('Tab');
  }

  /**
   * Press Shift+Tab
   */
  async pressShiftTab(): Promise<void> {
    await this.page.keyboard.press('Shift+Tab');
  }

  /**
   * Select all text in the editor by spanning from first to last text node.
   * Note: Ctrl+A and selectNodeContents don't work reliably with nested contentEditable elements.
   * We must walk text nodes and create a range spanning from first to last.
   */
  async selectAll(): Promise<void> {
    await this.page.evaluate(() => {
      const contentArea =
        document.querySelector('.ProseMirror') ||
        document.querySelector('.docx-editor-pages') ||
        document.querySelector('.docx-ai-editor');
      if (!contentArea) return;

      // Walk all text nodes to find first and last with actual content
      const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, null);
      let firstTextNode: Text | null = null;
      let lastTextNode: Text | null = null;

      while (walker.nextNode()) {
        const text = walker.currentNode.textContent || '';
        // Include nodes with content (even spaces)
        if (text.length > 0) {
          if (!firstTextNode) firstTextNode = walker.currentNode as Text;
          lastTextNode = walker.currentNode as Text;
        }
      }

      if (!firstTextNode || !lastTextNode) return;

      const selection = window.getSelection();
      if (!selection) return;

      selection.removeAllRanges();
      const range = document.createRange();
      range.setStart(firstTextNode, 0);
      range.setEnd(lastTextNode, lastTextNode.textContent?.length || 0);
      selection.addRange(range);
    });
  }

  /**
   * Select specific text by searching for it in the document
   */
  async selectText(searchText: string): Promise<boolean> {
    // First, get the bounding rect of the text we want to select
    const textInfo = await this.page.evaluate((text) => {
      // Search only within the editor content area (not toolbar which contains icon text like "format_bold")
      // ProseMirror uses .ProseMirror, legacy editors use .docx-editor-pages or .docx-ai-editor
      const contentArea =
        document.querySelector('.ProseMirror') ||
        document.querySelector('.docx-editor-pages') ||
        document.querySelector('.docx-ai-editor');
      if (!contentArea) return null;

      const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, null);

      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const index = node.textContent?.indexOf(text) ?? -1;
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);

          // Get the bounding rect to use for clicking
          const rect = range.getBoundingClientRect();

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);

          return {
            found: true,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          };
        }
      }
      return null;
    }, searchText);

    if (!textInfo) return false;

    // Focus the editor by clicking, then re-select
    // This ensures ProseMirror is focused and will sync selections
    const pm = this.page.locator('.ProseMirror');
    await pm.focus();

    // Re-apply the selection after focus
    await this.page.evaluate((text) => {
      const contentArea =
        document.querySelector('.ProseMirror') ||
        document.querySelector('.docx-editor-pages') ||
        document.querySelector('.docx-ai-editor');
      if (!contentArea) return;

      const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, null);

      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const index = node.textContent?.indexOf(text) ?? -1;
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return;
        }
      }
    }, searchText);

    // Wait for ProseMirror to sync
    await this.page.waitForTimeout(100);
    return true;
  }

  /**
   * Select text by character range within a paragraph
   */
  async selectRange(paragraphIndex: number, startOffset: number, endOffset: number): Promise<void> {
    await this.page.evaluate(
      ({ pIndex, start, end }) => {
        // Try ProseMirror structure first, then fall back to legacy
        const contentArea =
          document.querySelector('.ProseMirror') ||
          document.querySelector('.docx-editor-pages') ||
          document.querySelector('.docx-ai-editor');
        if (!contentArea) return;

        // Find paragraph by index
        let paragraph: Element | null = document.querySelector(
          `[data-paragraph-index="${pIndex}"]`
        );
        if (!paragraph) {
          // Fall back to finding p elements by position
          const paragraphs = contentArea.querySelectorAll('p');
          paragraph = paragraphs[pIndex] || null;
        }
        if (!paragraph) return;

        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

        let currentOffset = 0;
        let startNode: Node | null = null;
        let startNodeOffset = 0;
        let endNode: Node | null = null;
        let endNodeOffset = 0;

        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          const nodeLength = node.textContent?.length ?? 0;

          if (!startNode && currentOffset + nodeLength >= start) {
            startNode = node;
            startNodeOffset = start - currentOffset;
          }

          if (!endNode && currentOffset + nodeLength >= end) {
            endNode = node;
            endNodeOffset = end - currentOffset;
            break;
          }

          currentOffset += nodeLength;
        }

        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, startNodeOffset);
          range.setEnd(endNode, endNodeOffset);

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);

          // Focus the content area to trigger ProseMirror's selection sync
          if (contentArea instanceof HTMLElement) {
            contentArea.focus();
          }

          // Dispatch selectionchange event to notify ProseMirror
          document.dispatchEvent(new Event('selectionchange'));
        }
      },
      { pIndex: paragraphIndex, start: startOffset, end: endOffset }
    );

    // Wait for ProseMirror to sync
    await this.page.waitForTimeout(100);
  }

  /**
   * Get the current selection text
   */
  async getSelectedText(): Promise<string> {
    return await this.page.evaluate(() => {
      return window.getSelection()?.toString() ?? '';
    });
  }

  // Page-local clipboard storage for isolated tests
  private clipboardContent: string = '';

  /**
   * Copy selected text to page-local clipboard
   * Note: This does NOT deselect the text - caller must handle that if needed
   */
  async copy(): Promise<void> {
    this.clipboardContent = await this.page.evaluate(() => {
      const selection = window.getSelection();
      return selection?.toString() || '';
    });
    // Collapse selection to end to deselect without losing cursor position
    await this.page.evaluate(() => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        selection.collapseToEnd();
      }
    });
  }

  /**
   * Cut selected text to page-local clipboard
   */
  async cut(): Promise<void> {
    this.clipboardContent = await this.page.evaluate(() => {
      const selection = window.getSelection();
      const text = selection?.toString() || '';
      if (text) {
        document.execCommand('delete');
      }
      return text;
    });
  }

  /**
   * Paste from page-local clipboard
   */
  async paste(): Promise<void> {
    if (this.clipboardContent) {
      await this.page.keyboard.type(this.clipboardContent);
    }
  }

  // ============================================================================
  // FORMATTING
  // ============================================================================

  /**
   * Apply bold formatting via toolbar
   */
  async applyBold(): Promise<void> {
    await this.boldButton.click();
    // Wait for selection to be restored after the DOM re-renders
    // Uses requestAnimationFrame + setTimeout internally, so we need enough time
    await this.page.waitForTimeout(100);
  }

  /**
   * Apply bold formatting via keyboard shortcut
   */
  async applyBoldShortcut(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+b`);
  }

  /**
   * Apply italic formatting via toolbar
   */
  async applyItalic(): Promise<void> {
    await this.italicButton.click();
    // Wait for selection to be restored after the DOM re-renders
    // Uses requestAnimationFrame + setTimeout internally, so we need enough time
    await this.page.waitForTimeout(100);
  }

  /**
   * Apply italic formatting via keyboard shortcut
   */
  async applyItalicShortcut(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+i`);
  }

  /**
   * Apply underline formatting via toolbar
   */
  async applyUnderline(): Promise<void> {
    await this.underlineButton.click();
    // Wait for selection to be restored after the DOM re-renders
    // Uses requestAnimationFrame + setTimeout internally, so we need enough time
    await this.page.waitForTimeout(100);
  }

  /**
   * Apply underline formatting via keyboard shortcut
   */
  async applyUnderlineShortcut(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+u`);
  }

  /**
   * Apply strikethrough formatting via toolbar
   */
  async applyStrikethrough(): Promise<void> {
    await this.strikethroughButton.click();
    // Wait for selection to be restored after the DOM re-renders
    // Uses requestAnimationFrame + setTimeout internally, so we need enough time
    await this.page.waitForTimeout(100);
  }

  /**
   * Clear all formatting
   */
  async clearFormatting(): Promise<void> {
    await this.clearFormattingButton.click();
  }

  /**
   * Set font family
   */
  async setFontFamily(fontFamily: string): Promise<void> {
    // Click on font picker trigger (uses Radix Select with aria-label)
    const fontPicker = this.toolbar.locator('[aria-label="Select font family"]');
    await fontPicker.click();
    // Wait for dropdown to open
    await this.page.waitForSelector('[role="listbox"]', { state: 'visible', timeout: 5000 });
    // Select the font by exact name match
    await this.page.getByRole('option', { name: fontFamily, exact: true }).click();
    // Wait for dropdown to close
    await this.page.waitForSelector('[role="listbox"]', { state: 'hidden', timeout: 5000 });
    // Refocus editor after selecting from dropdown
    await this.focus();
  }

  /**
   * Set font size
   */
  async setFontSize(size: number): Promise<void> {
    // Click on font size picker trigger (uses Radix Select with aria-label)
    const fontSizePicker = this.toolbar.locator('[aria-label="Select font size"]');
    await fontSizePicker.click();
    // Wait for dropdown to open and select the size with exact text match
    await this.page.getByRole('option', { name: size.toString(), exact: true }).click();
    // Refocus editor after selecting from dropdown
    await this.focus();
  }

  /**
   * Set text color
   */
  async setTextColor(color: string): Promise<void> {
    // ColorPicker component uses .docx-color-picker-text class
    const colorPicker = this.toolbar.locator('.docx-color-picker-text');
    await colorPicker.click();

    // Wait for dropdown to be visible
    await this.page.waitForSelector('.docx-color-picker-dropdown', {
      state: 'visible',
      timeout: 5000,
    });

    // Normalize color (remove # if present)
    const hexColor = color.replace(/^#/, '').toUpperCase();

    // First, try to find a matching color button in the grid
    const colorButton = this.page.locator(`.docx-color-grid button[aria-selected="false"]`).filter({
      has: this.page.locator(`[style*="background-color: rgb"]`),
    });

    // Try to click a color by looking at the color grid buttons
    // The colors are stored with backgroundColor style like "background-color: rgb(...)"
    // Convert hex to RGB for matching
    const r = parseInt(hexColor.slice(0, 2), 16);
    const g = parseInt(hexColor.slice(2, 4), 16);
    const b = parseInt(hexColor.slice(4, 6), 16);

    // Find button with matching color or use custom input
    const buttons = await this.page.locator('.docx-color-grid button').all();
    let found = false;
    for (const button of buttons) {
      const style = await button.getAttribute('style');
      if (style && style.includes(`rgb(${r}, ${g}, ${b})`)) {
        await button.click();
        found = true;
        break;
      }
    }

    // If not found in grid, use custom hex input
    if (!found) {
      const hexInput = this.page.locator('[aria-label="Custom hex color"]');
      if (await hexInput.isVisible()) {
        await hexInput.fill(hexColor);
        await hexInput.press('Enter');
      }
    }
    // Refocus editor after selecting from dropdown
    await this.focus();
  }

  /**
   * Set highlight color
   */
  async setHighlightColor(color: string): Promise<void> {
    // ColorPicker component uses .docx-color-picker-highlight class
    const highlightPicker = this.toolbar.locator('.docx-color-picker-highlight');
    await highlightPicker.click();

    // Wait for dropdown to be visible
    await this.page.waitForSelector('.docx-color-picker-dropdown', {
      state: 'visible',
      timeout: 5000,
    });

    // Highlight colors have aria-label with the color name (capitalized)
    // e.g., "Yellow", "Cyan", "Magenta", "Green", "Blue", "Red"
    const capitalizedColor = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();

    // Find the button with matching aria-label in the color grid
    const colorButton = this.page.locator(
      `.docx-color-grid button[aria-label="${capitalizedColor}"]`
    );
    if (await colorButton.isVisible()) {
      await colorButton.click();
    } else {
      // Fallback: try the exact color name as provided
      const fallbackButton = this.page.locator(`.docx-color-grid button[aria-label="${color}"]`);
      if (await fallbackButton.isVisible()) {
        await fallbackButton.click();
      }
    }
    // Refocus editor after selecting from dropdown
    await this.focus();
  }

  // ============================================================================
  // ALIGNMENT & LISTS
  // ============================================================================

  /**
   * Align text left
   */
  async alignLeft(): Promise<void> {
    await this.toolbar.locator('[aria-label="Align Left (Ctrl+L)"]').click();
  }

  /**
   * Align text center
   */
  async alignCenter(): Promise<void> {
    await this.toolbar.locator('[aria-label="Center (Ctrl+E)"]').click();
  }

  /**
   * Align text right
   */
  async alignRight(): Promise<void> {
    await this.toolbar.locator('[aria-label="Align Right (Ctrl+R)"]').click();
  }

  /**
   * Justify text
   */
  async alignJustify(): Promise<void> {
    await this.toolbar.locator('[aria-label="Justify (Ctrl+J)"]').click();
  }

  /**
   * Toggle bullet list
   */
  async toggleBulletList(): Promise<void> {
    await this.toolbar.locator('[aria-label="Bullet List"]').click();
  }

  /**
   * Apply bullet list (alias for toggleBulletList)
   */
  async applyBulletList(): Promise<void> {
    await this.toggleBulletList();
  }

  /**
   * Toggle numbered list
   */
  async toggleNumberedList(): Promise<void> {
    await this.toolbar.locator('[aria-label="Numbered List"]').click();
  }

  /**
   * Apply numbered list (alias for toggleNumberedList)
   */
  async applyNumberedList(): Promise<void> {
    await this.toggleNumberedList();
  }

  /**
   * Indent paragraph/list item
   */
  async indent(): Promise<void> {
    await this.toolbar.locator('[aria-label="Increase Indent"]').click();
  }

  /**
   * Outdent paragraph/list item
   */
  async outdent(): Promise<void> {
    await this.toolbar.locator('[aria-label="Decrease Indent"]').click();
  }

  // ============================================================================
  // LINE SPACING
  // ============================================================================

  /**
   * Set line spacing
   * @param spacing - The spacing value: '1.0', '1.15', '1.5', '2.0' or label like 'Single', 'Double'
   */
  async setLineSpacing(spacing: string): Promise<void> {
    // Click on line spacing dropdown (uses Radix Select with aria-label)
    const lineSpacingButton = this.toolbar.locator('[aria-label="Line spacing"]');
    await lineSpacingButton.click();

    // Map spacing values to their display labels
    const spacingLabels: Record<string, string> = {
      '1.0': 'Single',
      '1.15': '1.15',
      '1.5': '1.5',
      '2.0': 'Double',
      Single: 'Single',
      Double: 'Double',
    };

    const label = spacingLabels[spacing] || spacing;

    // Select spacing value from dropdown using role="option" with exact match
    await this.page.getByRole('option', { name: label, exact: true }).click();
  }

  /**
   * Set single line spacing
   */
  async setLineSpacingSingle(): Promise<void> {
    await this.setLineSpacing('1.0');
  }

  /**
   * Set 1.5 line spacing
   */
  async setLineSpacing15(): Promise<void> {
    await this.setLineSpacing('1.5');
  }

  /**
   * Set double line spacing
   */
  async setLineSpacingDouble(): Promise<void> {
    await this.setLineSpacing('2.0');
  }

  // ============================================================================
  // PARAGRAPH STYLES
  // ============================================================================

  /**
   * Set paragraph style
   */
  async setParagraphStyle(style: string): Promise<void> {
    // Click on style picker dropdown (uses Radix Select with aria-label)
    const stylePicker = this.toolbar.locator('[aria-label="Select paragraph style"]');
    await stylePicker.click();
    // Select style from dropdown using role="option" with exact text match
    await this.page.getByRole('option', { name: style, exact: true }).click();
  }

  /**
   * Apply Normal style
   */
  async applyNormalStyle(): Promise<void> {
    await this.setParagraphStyle('Normal');
  }

  /**
   * Apply Heading 1 style
   */
  async applyHeading1(): Promise<void> {
    await this.setParagraphStyle('Heading 1');
  }

  /**
   * Apply Heading 2 style
   */
  async applyHeading2(): Promise<void> {
    await this.setParagraphStyle('Heading 2');
  }

  /**
   * Apply Heading 3 style
   */
  async applyHeading3(): Promise<void> {
    await this.setParagraphStyle('Heading 3');
  }

  /**
   * Apply Title style
   */
  async applyTitleStyle(): Promise<void> {
    await this.setParagraphStyle('Title');
  }

  /**
   * Apply Subtitle style
   */
  async applySubtitleStyle(): Promise<void> {
    await this.setParagraphStyle('Subtitle');
  }

  // ============================================================================
  // UNDO / REDO
  // ============================================================================

  /**
   * Undo via toolbar
   */
  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  /**
   * Undo via keyboard shortcut
   */
  async undoShortcut(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+z`);
  }

  /**
   * Redo via toolbar
   */
  async redo(): Promise<void> {
    await this.redoButton.click();
  }

  /**
   * Redo via keyboard shortcut (Ctrl+Y or Ctrl+Shift+Z)
   */
  async redoShortcut(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+y`);
  }

  /**
   * Check if undo is available
   */
  async isUndoAvailable(): Promise<boolean> {
    return !(await this.undoButton.isDisabled());
  }

  /**
   * Check if redo is available
   */
  async isRedoAvailable(): Promise<boolean> {
    return !(await this.redoButton.isDisabled());
  }

  // ============================================================================
  // TABLES
  // ============================================================================

  /**
   * Insert a table with specified dimensions
   */
  async insertTable(rows: number, cols: number): Promise<void> {
    // Open insert table dialog (usually via menu or button)
    await this.page.locator('[aria-label="Insert table"]').click();

    // Wait for dialog
    await this.insertTableDialog.waitFor();

    // Fill in dimensions
    await this.page.locator('[data-testid="table-rows-input"]').fill(rows.toString());
    await this.page.locator('[data-testid="table-cols-input"]').fill(cols.toString());

    // Click insert
    await this.page.locator('[data-testid="table-insert-button"]').click();

    // Wait for dialog to close
    await this.insertTableDialog.waitFor({ state: 'hidden' });
  }

  /**
   * Click on a specific table cell
   */
  async clickTableCell(tableIndex: number, row: number, col: number): Promise<void> {
    const table = this.page.locator('table').nth(tableIndex);
    const cell = table.locator('tr').nth(row).locator('td, th').nth(col);
    await cell.click();
  }

  /**
   * Get table cell content
   */
  async getTableCellContent(tableIndex: number, row: number, col: number): Promise<string> {
    const table = this.page.locator('table').nth(tableIndex);
    const cell = table.locator('tr').nth(row).locator('td, th').nth(col);
    return (await cell.textContent()) ?? '';
  }

  /**
   * Count tables in the document
   */
  async getTableCount(): Promise<number> {
    return await this.page.locator('table').count();
  }

  /**
   * Get table dimensions (rows x cols)
   */
  async getTableDimensions(tableIndex: number): Promise<{ rows: number; cols: number }> {
    const table = this.page.locator('table').nth(tableIndex);
    const rows = await table.locator('tr').count();
    const cols = await table.locator('tr').first().locator('td, th').count();
    return { rows, cols };
  }

  // ============================================================================
  // FIND & REPLACE
  // ============================================================================

  /**
   * Open find dialog (Ctrl+F / Cmd+F)
   */
  async openFind(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+f`);
    await this.findReplaceDialog.waitFor();
  }

  /**
   * Open find & replace dialog (Ctrl+H / Cmd+H)
   */
  async openFindReplace(): Promise<void> {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+h`);
    await this.findReplaceDialog.waitFor();
  }

  /**
   * Perform find operation
   */
  async find(searchText: string): Promise<void> {
    await this.page.locator('[data-testid="find-input"]').fill(searchText);
    await this.page.locator('[data-testid="find-input"]').press('Enter');
  }

  /**
   * Find next match
   */
  async findNext(): Promise<void> {
    await this.page.locator('[aria-label="Find next"]').click();
  }

  /**
   * Find previous match
   */
  async findPrevious(): Promise<void> {
    await this.page.locator('[aria-label="Find previous"]').click();
  }

  /**
   * Replace current match
   */
  async replace(replaceText: string): Promise<void> {
    await this.page.locator('[data-testid="replace-input"]').fill(replaceText);
    await this.page.locator('[data-testid="replace-button"]').click();
  }

  /**
   * Replace all matches
   */
  async replaceAll(searchText: string, replaceText: string): Promise<void> {
    await this.page.locator('[data-testid="find-input"]').fill(searchText);
    await this.page.locator('[data-testid="replace-input"]').fill(replaceText);
    await this.page.locator('[data-testid="replace-all-button"]').click();
  }

  /**
   * Close find/replace dialog
   */
  async closeFindReplace(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.findReplaceDialog.waitFor({ state: 'hidden' });
  }

  // ============================================================================
  // ZOOM
  // ============================================================================

  /**
   * Set zoom level
   */
  async setZoom(level: number): Promise<void> {
    const zoomInput = this.page.locator('.zoom-control input');
    await zoomInput.fill(level.toString());
    await zoomInput.press('Enter');
  }

  /**
   * Zoom in
   */
  async zoomIn(): Promise<void> {
    await this.page.locator('.zoom-control [aria-label="Zoom in"]').click();
  }

  /**
   * Zoom out
   */
  async zoomOut(): Promise<void> {
    await this.page.locator('.zoom-control [aria-label="Zoom out"]').click();
  }

  // ============================================================================
  // ASSERTIONS
  // ============================================================================

  /**
   * Assert the editor is visible and ready
   */
  async expectReady(): Promise<void> {
    await expect(this.editor).toBeVisible();
  }

  /**
   * Assert document has specific paragraph count
   */
  async expectParagraphCount(count: number): Promise<void> {
    const paragraphs = this.page.locator('[data-paragraph-index]');
    await expect(paragraphs).toHaveCount(count);
  }

  /**
   * Assert paragraph contains text
   */
  async expectParagraphText(index: number, expectedText: string): Promise<void> {
    const paragraph = this.getParagraph(index);
    await expect(paragraph).toContainText(expectedText);
  }

  /**
   * Assert text is bold (has bold styling)
   */
  async expectTextBold(text: string): Promise<boolean> {
    return await this.page.evaluate((searchText) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node.textContent?.includes(searchText)) {
          let element = node.parentElement;
          while (element) {
            const style = window.getComputedStyle(element);
            if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) {
              return true;
            }
            if (element.tagName === 'STRONG' || element.tagName === 'B') {
              return true;
            }
            element = element.parentElement;
          }
        }
      }
      return false;
    }, text);
  }

  /**
   * Assert text is italic (has italic styling)
   */
  async expectTextItalic(text: string): Promise<boolean> {
    return await this.page.evaluate((searchText) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node.textContent?.includes(searchText)) {
          let element = node.parentElement;
          while (element) {
            const style = window.getComputedStyle(element);
            if (style.fontStyle === 'italic') {
              return true;
            }
            if (element.tagName === 'EM' || element.tagName === 'I') {
              return true;
            }
            element = element.parentElement;
          }
        }
      }
      return false;
    }, text);
  }

  /**
   * Assert toolbar button is active
   */
  async expectToolbarButtonActive(buttonName: string): Promise<void> {
    const button = this.toolbar.locator(`[data-testid="toolbar-${buttonName}"]`);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  /**
   * Assert toolbar button is not active
   */
  async expectToolbarButtonInactive(buttonName: string): Promise<void> {
    const button = this.toolbar.locator(`[data-testid="toolbar-${buttonName}"]`);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  }

  /**
   * Get the document text content
   */
  async getDocumentText(): Promise<string> {
    const contentArea = this.getContentArea();
    return (await contentArea.textContent()) ?? '';
  }

  /**
   * Assert document contains text
   */
  async expectDocumentContains(text: string): Promise<void> {
    const contentArea = this.getContentArea();
    await expect(contentArea).toContainText(text);
  }

  /**
   * Assert document does not contain text
   */
  async expectDocumentNotContains(text: string): Promise<void> {
    const contentArea = this.getContentArea();
    await expect(contentArea).not.toContainText(text);
  }

  /**
   * Take a screenshot for visual comparison
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Wait for any animations to complete
   */
  async waitForAnimations(): Promise<void> {
    await this.page.waitForTimeout(300);
  }

  /**
   * Focus the editor content area
   */
  async focus(): Promise<void> {
    const contentArea = this.getContentArea();
    await contentArea.focus();
  }

  /**
   * Blur the editor (click outside)
   */
  async blur(): Promise<void> {
    await this.page.click('body', { position: { x: 0, y: 0 } });
  }
}
