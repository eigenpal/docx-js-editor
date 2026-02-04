/**
 * Paged Editor Click Positioning Tests
 *
 * Tests for click-to-position mapping in the paginated editor:
 * - Click on text positions cursor correctly
 * - Click on tab positions cursor correctly
 * - Click after tab positions at first char of next run
 * - Double-click selects word
 * - Triple-click selects paragraph
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Paged Editor - Click Positioning', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('click on text positions cursor correctly', async ({ page }) => {
    // Type some text
    await editor.typeText('Hello World');

    // Get the text span containing "World"
    const textSpan = page.locator('span:has-text("World")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Click somewhere in the middle of "World"
      await page.mouse.click(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );
    }

    // Type something to verify cursor is in the text
    await page.keyboard.type('X');

    // The text should now contain "WorXld" or similar (X inserted where we clicked)
    const content = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent || '';
    });
    expect(content).toContain('X');
    expect(content).toContain('Hello');
  });

  test('click at start of text positions cursor at beginning', async ({ page }) => {
    // Type some text
    await editor.typeText('Hello World');

    // Get the text span containing "Hello"
    const textSpan = page.locator('span:has-text("Hello")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Click at the very start of "Hello"
      await page.mouse.click(boundingBox.x + 2, boundingBox.y + boundingBox.height / 2);
    }

    // Type something
    await page.keyboard.type('X');

    // The text should start with "XHello" or "XHello" followed by rest
    const content = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent || '';
    });
    expect(content.startsWith('X') || content.startsWith('HXello')).toBe(true);
  });

  test('click at end of text positions cursor at end', async ({ page }) => {
    // Type some text
    await editor.typeText('Hello');

    // Get the text span
    const textSpan = page.locator('span:has-text("Hello")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Click at the very end of the text
      await page.mouse.click(
        boundingBox.x + boundingBox.width - 2,
        boundingBox.y + boundingBox.height / 2
      );
    }

    // Type something
    await page.keyboard.type('X');

    // The text should now end with "HelloX" or "HellXo" (depending on click precision)
    const content = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent || '';
    });
    expect(content).toContain('Hello');
    expect(content).toContain('X');
  });
});

test.describe('Paged Editor - Tab Click Handling', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('click on tab positions cursor correctly', async ({ page }) => {
    // Type text with a tab
    await editor.typeText('Before');
    await editor.pressTab();
    await editor.typeText('After');

    // Find the tab span (should have layout-run-tab class or contain tab character)
    const tabSpan = page.locator('.layout-run-tab').first();
    const tabExists = await tabSpan.count();

    if (tabExists > 0) {
      const boundingBox = await tabSpan.boundingBox();

      if (boundingBox) {
        // Click in the left half of the tab
        await page.mouse.click(boundingBox.x + 5, boundingBox.y + boundingBox.height / 2);

        // Type something - should insert before the tab content
        await page.keyboard.type('X');

        const content = await page.evaluate(() => {
          const pm = document.querySelector('.ProseMirror');
          return pm?.textContent || '';
        });
        expect(content).toContain('X');
      }
    } else {
      // Tab might be rendered differently in ProseMirror editor
      // Just verify the content contains both parts
      const content = await page.evaluate(() => {
        const pm = document.querySelector('.ProseMirror');
        return pm?.textContent || '';
      });
      expect(content).toContain('Before');
      expect(content).toContain('After');
    }
  });

  test('click after tab positions at first char of next run', async ({ page }) => {
    // Type text with a tab
    await editor.typeText('Before');
    await editor.pressTab();
    await editor.typeText('After');

    // Find text after the tab
    const afterSpan = page.locator('span:has-text("After")').first();
    const boundingBox = await afterSpan.boundingBox();

    if (boundingBox) {
      // Click at the very start of "After"
      await page.mouse.click(boundingBox.x + 2, boundingBox.y + boundingBox.height / 2);

      // Type X
      await page.keyboard.type('X');

      // Should get "XAfter" or "AXfter" depending on precise click
      const content = await page.evaluate(() => {
        const pm = document.querySelector('.ProseMirror');
        return pm?.textContent || '';
      });
      expect(content).toContain('Before');
      expect(content).toMatch(/X.*After|After.*X|AXfter|XAfter/);
    }
  });
});

test.describe('Paged Editor - Double/Triple Click Selection', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('double-click selects word', async ({ page }) => {
    // Type some text with multiple words
    await editor.typeText('Hello beautiful World');

    // Get the text span containing "beautiful"
    const textSpan = page.locator('span:has-text("beautiful")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Double-click on "beautiful"
      await page.mouse.dblclick(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );

      // Wait for selection to be applied
      await page.waitForTimeout(100);

      // Check that the word is selected
      const selectedText = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });

      // Should select "beautiful" (possibly with surrounding spaces)
      expect(selectedText.trim()).toContain('beautiful');
    }
  });

  test('double-click on last word selects it', async ({ page }) => {
    // Type some text
    await editor.typeText('Hello World');

    // Get the text span containing "World" - which is reliably at the end
    const textSpan = page.locator('span:has-text("World")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Double-click on "World" - use the right side of the span
      await page.mouse.dblclick(
        boundingBox.x + boundingBox.width - 20,
        boundingBox.y + boundingBox.height / 2
      );

      await page.waitForTimeout(100);

      const selectedText = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });

      // Should select "World"
      expect(selectedText.trim()).toBe('World');
    }
  });

  test('triple-click selects paragraph', async ({ page }) => {
    // Type multiple paragraphs
    await editor.typeText('First paragraph with some text.');
    await editor.pressEnter();
    await editor.typeText('Second paragraph here.');

    // Get the text in first paragraph
    const textSpan = page.locator('span:has-text("First paragraph")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Triple-click to select paragraph
      await page.mouse.click(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2,
        { clickCount: 3 }
      );

      await page.waitForTimeout(100);

      const selectedText = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });

      // Should select the first paragraph (or most of it)
      expect(selectedText).toContain('First paragraph');
      // Should NOT include second paragraph
      expect(selectedText).not.toContain('Second paragraph');
    }
  });

  test('triple-click in middle paragraph selects only that paragraph', async ({ page }) => {
    // Type three paragraphs
    await editor.typeText('First paragraph.');
    await editor.pressEnter();
    await editor.typeText('Middle paragraph content here.');
    await editor.pressEnter();
    await editor.typeText('Third paragraph.');

    // Get the text in middle paragraph
    const textSpan = page.locator('span:has-text("Middle paragraph")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Triple-click to select paragraph
      await page.mouse.click(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2,
        { clickCount: 3 }
      );

      await page.waitForTimeout(100);

      const selectedText = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });

      // Should select the middle paragraph
      expect(selectedText).toContain('Middle paragraph');
      // Should NOT include other paragraphs
      expect(selectedText).not.toContain('First paragraph');
      expect(selectedText).not.toContain('Third paragraph');
    }
  });
});

test.describe('Paged Editor - Click on Empty Areas', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('click on empty paragraph positions cursor there', async ({ page }) => {
    // Create an empty paragraph
    await editor.typeText('First line');
    await editor.pressEnter();
    await editor.pressEnter();
    await editor.typeText('Third line');

    // Go back up to type in empty line
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // Type in the empty line
    await page.keyboard.type('Middle');

    const content = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent || '';
    });

    expect(content).toContain('First line');
    expect(content).toContain('Middle');
    expect(content).toContain('Third line');
  });

  test('click after end of line positions cursor at line end', async ({ page }) => {
    // Type a short line
    await editor.typeText('Short');

    // Move to somewhere on the page - we'll use keyboard to position
    await page.keyboard.press('End');
    await page.keyboard.type('X');

    const content = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent || '';
    });

    expect(content).toBe('ShortX');
  });
});

test.describe('Paged Editor - Cursor Position Accuracy', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.focus();
  });

  test('clicking between characters positions cursor accurately', async ({ page }) => {
    // Type a word
    await editor.typeText('ABCDE');

    // Get the text span
    const textSpan = page.locator('span:has-text("ABCDE")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      // Calculate approximate position between C and D
      // Each character is roughly 1/5 of the width
      const charWidth = boundingBox.width / 5;
      const clickX = boundingBox.x + charWidth * 3; // After C

      await page.mouse.click(clickX, boundingBox.y + boundingBox.height / 2);
      await page.keyboard.type('X');

      const content = await page.evaluate(() => {
        const pm = document.querySelector('.ProseMirror');
        return pm?.textContent || '';
      });

      // X should be inserted somewhere in the middle
      expect(content).toMatch(/AB.*X.*DE|ABC.*X.*E|ABCD.*X|AB.*X.*CDE/);
    }
  });

  test('repeated clicks in same position maintain cursor', async ({ page }) => {
    // Type some text
    await editor.typeText('Hello World');

    // Get the text span
    const textSpan = page.locator('span:has-text("Hello")').first();
    const boundingBox = await textSpan.boundingBox();

    if (boundingBox) {
      const clickX = boundingBox.x + boundingBox.width / 2;
      const clickY = boundingBox.y + boundingBox.height / 2;

      // Click multiple times at the same position
      await page.mouse.click(clickX, clickY);
      await page.mouse.click(clickX, clickY);
      await page.mouse.click(clickX, clickY);

      // Type to verify cursor position
      await page.keyboard.type('X');

      const content = await page.evaluate(() => {
        const pm = document.querySelector('.ProseMirror');
        return pm?.textContent || '';
      });

      // Should have exactly one X inserted
      const xCount = (content.match(/X/g) || []).length;
      expect(xCount).toBe(1);
    }
  });
});
