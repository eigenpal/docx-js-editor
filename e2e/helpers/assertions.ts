/**
 * Custom Assertions for Playwright Tests
 *
 * Provides specialized assertions for verifying formatting, text content,
 * and document state in the DOCX editor.
 */

import { Page, expect } from '@playwright/test';
import { checkFormattingAtSelection, getParagraphText, getParagraphCount } from './text-selection';

/**
 * Assert that text is bold
 */
export async function assertTextIsBold(page: Page, searchText: string): Promise<void> {
  const isBold = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        let element = node.parentElement;
        while (element) {
          const style = window.getComputedStyle(element);
          const fontWeight = style.fontWeight;
          if (fontWeight === 'bold' || parseInt(fontWeight) >= 700) {
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
  }, searchText);

  expect(isBold, `Expected "${searchText}" to be bold`).toBe(true);
}

/**
 * Assert that text is not bold
 */
export async function assertTextIsNotBold(page: Page, searchText: string): Promise<void> {
  const isBold = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        let element = node.parentElement;
        while (element) {
          const style = window.getComputedStyle(element);
          const fontWeight = style.fontWeight;
          if (fontWeight === 'bold' || parseInt(fontWeight) >= 700) {
            return true;
          }
          if (element.tagName === 'STRONG' || element.tagName === 'B') {
            return true;
          }
          element = element.parentElement;
        }
        return false;
      }
    }
    return false;
  }, searchText);

  expect(isBold, `Expected "${searchText}" to NOT be bold`).toBe(false);
}

/**
 * Assert that text is italic
 */
export async function assertTextIsItalic(page: Page, searchText: string): Promise<void> {
  const isItalic = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
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
  }, searchText);

  expect(isItalic, `Expected "${searchText}" to be italic`).toBe(true);
}

/**
 * Assert that text is underlined
 */
export async function assertTextIsUnderlined(page: Page, searchText: string): Promise<void> {
  const isUnderlined = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        let element = node.parentElement;
        while (element) {
          const style = window.getComputedStyle(element);
          if (
            style.textDecoration.includes('underline') ||
            style.textDecorationLine.includes('underline')
          ) {
            return true;
          }
          if (element.tagName === 'U') {
            return true;
          }
          element = element.parentElement;
        }
      }
    }
    return false;
  }, searchText);

  expect(isUnderlined, `Expected "${searchText}" to be underlined`).toBe(true);
}

/**
 * Assert that text has strikethrough
 */
export async function assertTextHasStrikethrough(page: Page, searchText: string): Promise<void> {
  const hasStrike = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        let element = node.parentElement;
        while (element) {
          const style = window.getComputedStyle(element);
          if (
            style.textDecoration.includes('line-through') ||
            style.textDecorationLine.includes('line-through')
          ) {
            return true;
          }
          if (
            element.tagName === 'S' ||
            element.tagName === 'STRIKE' ||
            element.tagName === 'DEL'
          ) {
            return true;
          }
          element = element.parentElement;
        }
      }
    }
    return false;
  }, searchText);

  expect(hasStrike, `Expected "${searchText}" to have strikethrough`).toBe(true);
}

/**
 * Assert text has a specific font family
 */
export async function assertTextHasFontFamily(
  page: Page,
  searchText: string,
  fontFamily: string
): Promise<void> {
  const actualFont = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        const element = node.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          return style.fontFamily;
        }
      }
    }
    return '';
  }, searchText);

  expect(
    actualFont.toLowerCase(),
    `Expected "${searchText}" to have font family "${fontFamily}"`
  ).toContain(fontFamily.toLowerCase());
}

/**
 * Assert text has a specific font size
 */
export async function assertTextHasFontSize(
  page: Page,
  searchText: string,
  expectedSize: string
): Promise<void> {
  const actualSize = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        const element = node.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          return style.fontSize;
        }
      }
    }
    return '';
  }, searchText);

  expect(actualSize, `Expected "${searchText}" to have font size "${expectedSize}"`).toBe(
    expectedSize
  );
}

/**
 * Assert text has a specific color
 */
export async function assertTextHasColor(
  page: Page,
  searchText: string,
  expectedColor: string
): Promise<void> {
  const actualColor = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(text)) {
        const element = node.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          return style.color;
        }
      }
    }
    return '';
  }, searchText);

  // Normalize colors for comparison (both to lowercase)
  expect(
    actualColor.toLowerCase(),
    `Expected "${searchText}" to have color "${expectedColor}"`
  ).toContain(expectedColor.toLowerCase());
}

/**
 * Assert paragraph has specific alignment
 */
export async function assertParagraphAlignment(
  page: Page,
  paragraphIndex: number,
  expectedAlignment: 'left' | 'center' | 'right' | 'justify'
): Promise<void> {
  const alignment = await page.evaluate((pIndex) => {
    const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
    if (!paragraph) return '';
    const style = window.getComputedStyle(paragraph);
    return style.textAlign;
  }, paragraphIndex);

  expect(
    alignment,
    `Expected paragraph ${paragraphIndex} to have alignment "${expectedAlignment}"`
  ).toBe(expectedAlignment);
}

/**
 * Assert paragraph is a list item
 */
export async function assertParagraphIsList(
  page: Page,
  paragraphIndex: number,
  listType: 'bullet' | 'numbered'
): Promise<void> {
  const isList = await page.evaluate(
    ({ pIndex, type }) => {
      const paragraph = document.querySelector(`[data-paragraph-index="${pIndex}"]`);
      if (!paragraph) return false;

      // Check for list markers
      const parent = paragraph.closest('ul, ol');
      if (parent) {
        if (type === 'bullet' && parent.tagName === 'UL') return true;
        if (type === 'numbered' && parent.tagName === 'OL') return true;
      }

      // Check for CSS list style
      const style = window.getComputedStyle(paragraph);
      if (type === 'bullet' && style.listStyleType === 'disc') return true;
      if (type === 'numbered' && style.listStyleType === 'decimal') return true;

      return false;
    },
    { pIndex: paragraphIndex, type: listType }
  );

  expect(isList, `Expected paragraph ${paragraphIndex} to be a ${listType} list`).toBe(true);
}

/**
 * Assert document has specific paragraph count
 */
export async function assertParagraphCount(page: Page, expectedCount: number): Promise<void> {
  const count = await getParagraphCount(page);
  expect(count, `Expected ${expectedCount} paragraphs, but found ${count}`).toBe(expectedCount);
}

/**
 * Assert paragraph contains specific text
 */
export async function assertParagraphContainsText(
  page: Page,
  paragraphIndex: number,
  expectedText: string
): Promise<void> {
  const text = await getParagraphText(page, paragraphIndex);
  expect(text, `Expected paragraph ${paragraphIndex} to contain "${expectedText}"`).toContain(
    expectedText
  );
}

/**
 * Assert paragraph exactly matches text
 */
export async function assertParagraphExactText(
  page: Page,
  paragraphIndex: number,
  expectedText: string
): Promise<void> {
  const text = await getParagraphText(page, paragraphIndex);
  expect(
    text.trim(),
    `Expected paragraph ${paragraphIndex} to exactly match "${expectedText}"`
  ).toBe(expectedText);
}

/**
 * Assert document contains specific text (checks all contenteditable elements)
 */
export async function assertDocumentContainsText(page: Page, expectedText: string): Promise<void> {
  // Check across all contenteditable elements in the document
  const allText = await page.locator('[contenteditable="true"]').allTextContents();
  const fullText = allText.join(' ');
  expect(
    fullText.includes(expectedText),
    `Expected document to contain "${expectedText}" but found: "${fullText}"`
  ).toBe(true);
}

/**
 * Assert document does not contain specific text (checks all contenteditable elements)
 */
export async function assertDocumentNotContainsText(
  page: Page,
  expectedText: string
): Promise<void> {
  // Check across all contenteditable elements in the document
  const allText = await page.locator('[contenteditable="true"]').allTextContents();
  const fullText = allText.join(' ');
  expect(
    !fullText.includes(expectedText),
    `Expected document to NOT contain "${expectedText}" but found: "${fullText}"`
  ).toBe(true);
}

/**
 * Assert table exists with specific dimensions
 */
export async function assertTableDimensions(
  page: Page,
  tableIndex: number,
  expectedRows: number,
  expectedCols: number
): Promise<void> {
  const table = page.locator('table').nth(tableIndex);
  await expect(table, `Expected table ${tableIndex} to exist`).toBeVisible();

  const rows = await table.locator('tr').count();
  const cols = await table.locator('tr').first().locator('td, th').count();

  expect(rows, `Expected table ${tableIndex} to have ${expectedRows} rows`).toBe(expectedRows);
  expect(cols, `Expected table ${tableIndex} to have ${expectedCols} columns`).toBe(expectedCols);
}

/**
 * Assert table cell contains text
 */
export async function assertTableCellText(
  page: Page,
  tableIndex: number,
  row: number,
  col: number,
  expectedText: string
): Promise<void> {
  const table = page.locator('table').nth(tableIndex);
  const cell = table.locator('tr').nth(row).locator('td, th').nth(col);
  await expect(
    cell,
    `Expected cell (${row}, ${col}) in table ${tableIndex} to contain "${expectedText}"`
  ).toContainText(expectedText);
}

/**
 * Assert toolbar button is enabled
 */
export async function assertToolbarButtonEnabled(page: Page, buttonTestId: string): Promise<void> {
  const button = page.locator(`[data-testid="${buttonTestId}"]`);
  await expect(button, `Expected toolbar button "${buttonTestId}" to be enabled`).toBeEnabled();
}

/**
 * Assert toolbar button is disabled
 */
export async function assertToolbarButtonDisabled(page: Page, buttonTestId: string): Promise<void> {
  const button = page.locator(`[data-testid="${buttonTestId}"]`);
  await expect(button, `Expected toolbar button "${buttonTestId}" to be disabled`).toBeDisabled();
}

/**
 * Assert toolbar button is active (pressed state)
 */
export async function assertToolbarButtonActive(page: Page, buttonTestId: string): Promise<void> {
  const button = page.locator(`[data-testid="${buttonTestId}"]`);
  await expect(button, `Expected toolbar button "${buttonTestId}" to be active`).toHaveAttribute(
    'aria-pressed',
    'true'
  );
}

/**
 * Assert toolbar button is inactive (not pressed)
 */
export async function assertToolbarButtonInactive(page: Page, buttonTestId: string): Promise<void> {
  const button = page.locator(`[data-testid="${buttonTestId}"]`);
  await expect(button, `Expected toolbar button "${buttonTestId}" to be inactive`).toHaveAttribute(
    'aria-pressed',
    'false'
  );
}

/**
 * Assert no JavaScript errors on page
 */
export async function assertNoJavaScriptErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known non-critical errors
      if (!text.includes('favicon') && !text.includes('404')) {
        errors.push(text);
      }
    }
  });

  return errors;
}

/**
 * Assert current formatting matches expected
 */
export async function assertCurrentFormatting(
  page: Page,
  expected: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
  }
): Promise<void> {
  const formatting = await checkFormattingAtSelection(page);

  if (expected.bold !== undefined) {
    expect(formatting.bold, `Expected bold to be ${expected.bold}`).toBe(expected.bold);
  }
  if (expected.italic !== undefined) {
    expect(formatting.italic, `Expected italic to be ${expected.italic}`).toBe(expected.italic);
  }
  if (expected.underline !== undefined) {
    expect(formatting.underline, `Expected underline to be ${expected.underline}`).toBe(
      expected.underline
    );
  }
  if (expected.strikethrough !== undefined) {
    expect(formatting.strikethrough, `Expected strikethrough to be ${expected.strikethrough}`).toBe(
      expected.strikethrough
    );
  }
}

/**
 * Assert visual screenshot matches baseline
 */
export async function assertVisualMatch(
  page: Page,
  screenshotName: string,
  options?: {
    maxDiffPixels?: number;
    threshold?: number;
    fullPage?: boolean;
  }
): Promise<void> {
  await expect(page).toHaveScreenshot(screenshotName, {
    maxDiffPixels: options?.maxDiffPixels ?? 100,
    threshold: options?.threshold ?? 0.2,
    fullPage: options?.fullPage ?? false,
  });
}

/**
 * Assert element visual matches baseline
 */
export async function assertElementVisualMatch(
  page: Page,
  selector: string,
  screenshotName: string,
  options?: {
    maxDiffPixels?: number;
    threshold?: number;
  }
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toHaveScreenshot(screenshotName, {
    maxDiffPixels: options?.maxDiffPixels ?? 50,
    threshold: options?.threshold ?? 0.2,
  });
}
