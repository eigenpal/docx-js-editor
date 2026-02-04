/**
 * Visual check test for demo.docx
 */
import { test } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test('take screenshot of demo.docx first page', async ({ page }) => {
  const editor = new EditorPage(page);
  await editor.goto();
  await editor.waitForReady();
  await editor.loadDocxFile('fixtures/demo/demo.docx');

  // Wait for rendering to settle
  await page.waitForTimeout(1000);

  // Take screenshot of the first page
  await page.screenshot({
    path: 'screenshots/demo-page1-check.png',
    fullPage: true,
  });
});
