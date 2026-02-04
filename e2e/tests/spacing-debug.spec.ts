/**
 * Debugging test to check spacing values in demo.docx
 */
import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test('check paragraph positions in demo.docx', async ({ page }) => {
  const editor = new EditorPage(page);
  await editor.goto();
  await editor.waitForReady();
  await editor.loadDocxFile('fixtures/demo/demo.docx');

  // Wait for rendering to settle
  await page.waitForTimeout(1000);

  // Get paragraph fragment positions from the DOM
  const fragmentInfo = await page.evaluate(() => {
    const fragments = document.querySelectorAll('.layout-paragraph');
    const info: any[] = [];

    fragments.forEach((frag, idx) => {
      if (idx < 10) {
        const style = (frag as HTMLElement).style;
        const computed = window.getComputedStyle(frag);
        const text = frag.textContent?.slice(0, 40) || '(empty)';

        info.push({
          idx,
          text: text + (frag.textContent && frag.textContent.length > 40 ? '...' : ''),
          top: style.top,
          left: style.left,
          height: style.height,
          computedTop: computed.top,
          marginTop: computed.marginTop,
          marginBottom: computed.marginBottom,
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom,
        });
      }
    });

    return info;
  });

  console.log('Fragment positions:', JSON.stringify(fragmentInfo, null, 2));

  // Check first 3 fragments don't overlap
  for (let i = 1; i < Math.min(3, fragmentInfo.length); i++) {
    const prev = fragmentInfo[i - 1];
    const curr = fragmentInfo[i];

    const prevTop = parseFloat(prev.top);
    const prevHeight = parseFloat(prev.height);
    const currTop = parseFloat(curr.top);

    console.log(
      `Fragment ${i - 1} ends at ${prevTop + prevHeight}px, Fragment ${i} starts at ${currTop}px`
    );

    // Check if current fragment starts after previous one ends
    // This would indicate no overlap
    const overlap = currTop < prevTop + prevHeight;
    if (overlap) {
      console.log(`WARNING: Fragments ${i - 1} and ${i} overlap!`);
    }
  }

  expect(fragmentInfo.length).toBeGreaterThan(0);
});
