/**
 * Unit tests for StyleResolver
 *
 * Tests style chain resolution, docDefaults cascade, and edge cases.
 */

import { describe, test, expect } from 'bun:test';
import { createStyleResolver } from './styleResolver';
import type { StyleDefinitions, DocDefaults } from '../../types/document';

describe('StyleResolver', () => {
  describe('constructor and basic operations', () => {
    test('creates empty resolver when no styles provided', () => {
      const resolver = createStyleResolver(undefined);
      expect(resolver.getStyle('Normal')).toBeUndefined();
      expect(resolver.hasStyle('Normal')).toBe(false);
    });

    test('indexes styles by styleId', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          { styleId: 'Normal', type: 'paragraph', name: 'Normal' },
          { styleId: 'Heading1', type: 'paragraph', name: 'Heading 1' },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      expect(resolver.hasStyle('Normal')).toBe(true);
      expect(resolver.hasStyle('Heading1')).toBe(true);
      expect(resolver.hasStyle('NonExistent')).toBe(false);
    });

    test('finds default paragraph style marked with default: true', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          { styleId: 'Normal', type: 'paragraph', name: 'Normal', default: true },
          { styleId: 'Heading1', type: 'paragraph', name: 'Heading 1' },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const defaultStyle = resolver.getDefaultParagraphStyle();
      expect(defaultStyle?.styleId).toBe('Normal');
    });

    test('falls back to "Normal" when no default marked', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          { styleId: 'Normal', type: 'paragraph', name: 'Normal' },
          { styleId: 'Heading1', type: 'paragraph', name: 'Heading 1' },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const defaultStyle = resolver.getDefaultParagraphStyle();
      expect(defaultStyle?.styleId).toBe('Normal');
    });
  });

  describe('resolveParagraphStyle', () => {
    test('returns docDefaults when no styleId provided', () => {
      const docDefaults: DocDefaults = {
        pPr: { lineSpacing: 240, spaceAfter: 160 },
        rPr: { fontSize: 22 },
      };

      const styleDefinitions: StyleDefinitions = {
        docDefaults,
        styles: [],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle(null);

      expect(result.paragraphFormatting?.lineSpacing).toBe(240);
      expect(result.paragraphFormatting?.spaceAfter).toBe(160);
      expect(result.runFormatting?.fontSize).toBe(22);
    });

    test('applies Normal style when no styleId and Normal exists', () => {
      const styleDefinitions: StyleDefinitions = {
        docDefaults: {
          pPr: { lineSpacing: 240 },
        },
        styles: [
          {
            styleId: 'Normal',
            type: 'paragraph',
            default: true,
            pPr: { spaceAfter: 200 },
            rPr: { fontSize: 24 },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle(undefined);

      // Should have both docDefaults and Normal style merged
      expect(result.paragraphFormatting?.lineSpacing).toBe(240); // From docDefaults
      expect(result.paragraphFormatting?.spaceAfter).toBe(200); // From Normal
      expect(result.runFormatting?.fontSize).toBe(24); // From Normal
    });

    test('resolves Heading1 style', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          {
            styleId: 'Normal',
            type: 'paragraph',
            default: true,
            pPr: { spaceAfter: 200 },
            rPr: { fontSize: 24 },
          },
          {
            styleId: 'Heading1',
            type: 'paragraph',
            basedOn: 'Normal', // Note: basedOn chain should already be resolved by parser
            pPr: { spaceBefore: 480, spaceAfter: 240, alignment: 'left' },
            rPr: { fontSize: 32, bold: true },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('Heading1');

      // Heading1 properties should override
      expect(result.paragraphFormatting?.spaceBefore).toBe(480);
      expect(result.paragraphFormatting?.spaceAfter).toBe(240);
      expect(result.paragraphFormatting?.alignment).toBe('left');
      expect(result.runFormatting?.fontSize).toBe(32);
      expect(result.runFormatting?.bold).toBe(true);
    });

    test('falls back to Normal when style not found', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          {
            styleId: 'Normal',
            type: 'paragraph',
            default: true,
            pPr: { spaceAfter: 200 },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('NonExistentStyle');

      // Should fall back to Normal
      expect(result.paragraphFormatting?.spaceAfter).toBe(200);
    });

    test('merges docDefaults → Normal → Heading1 chain', () => {
      const styleDefinitions: StyleDefinitions = {
        docDefaults: {
          pPr: { lineSpacing: 240, widowControl: true },
          rPr: { fontFamily: { ascii: 'Arial' } },
        },
        styles: [
          {
            styleId: 'Normal',
            type: 'paragraph',
            default: true,
            pPr: { spaceAfter: 200 },
            rPr: { fontSize: 24 },
          },
          {
            // In real usage, styleParser would have already merged basedOn
            // Here we simulate that Heading1 has its own properties
            styleId: 'Heading1',
            type: 'paragraph',
            basedOn: 'Normal',
            pPr: { spaceBefore: 480, alignment: 'center' },
            rPr: { fontSize: 32, bold: true },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('Heading1');

      // From docDefaults
      expect(result.paragraphFormatting?.lineSpacing).toBe(240);
      expect(result.paragraphFormatting?.widowControl).toBe(true);
      expect(result.runFormatting?.fontFamily?.ascii).toBe('Arial');

      // From Heading1
      expect(result.paragraphFormatting?.spaceBefore).toBe(480);
      expect(result.paragraphFormatting?.alignment).toBe('center');
      expect(result.runFormatting?.fontSize).toBe(32);
      expect(result.runFormatting?.bold).toBe(true);
    });
  });

  describe('resolveRunStyle', () => {
    test('returns docDefaults when no styleId', () => {
      const styleDefinitions: StyleDefinitions = {
        docDefaults: {
          rPr: { fontSize: 22, bold: false },
        },
        styles: [],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveRunStyle(null);

      expect(result?.fontSize).toBe(22);
      expect(result?.bold).toBe(false);
    });

    test('resolves character style', () => {
      const styleDefinitions: StyleDefinitions = {
        docDefaults: {
          rPr: { fontSize: 22 },
        },
        styles: [
          {
            styleId: 'Strong',
            type: 'character',
            rPr: { bold: true },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveRunStyle('Strong');

      expect(result?.fontSize).toBe(22); // From docDefaults
      expect(result?.bold).toBe(true); // From Strong style
    });
  });

  describe('getParagraphStyles', () => {
    test('returns only visible paragraph styles', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          { styleId: 'Normal', type: 'paragraph', name: 'Normal' },
          { styleId: 'Heading1', type: 'paragraph', name: 'Heading 1' },
          { styleId: 'HiddenStyle', type: 'paragraph', name: 'Hidden', hidden: true },
          { styleId: 'SemiHidden', type: 'paragraph', name: 'Semi', semiHidden: true },
          { styleId: 'Strong', type: 'character', name: 'Strong' }, // Not paragraph
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const styles = resolver.getParagraphStyles();

      expect(styles.length).toBe(2);
      expect(styles.map((s) => s.styleId)).toContain('Normal');
      expect(styles.map((s) => s.styleId)).toContain('Heading1');
    });

    test('sorts by uiPriority then name', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [
          { styleId: 'Heading3', type: 'paragraph', name: 'Heading 3', uiPriority: 9 },
          { styleId: 'Normal', type: 'paragraph', name: 'Normal', uiPriority: 0 },
          { styleId: 'Heading1', type: 'paragraph', name: 'Heading 1', uiPriority: 9 },
          { styleId: 'Title', type: 'paragraph', name: 'Title', uiPriority: 10 },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const styles = resolver.getParagraphStyles();

      expect(styles[0].styleId).toBe('Normal'); // Priority 0
      // Priority 9 styles sorted by name
      expect(styles[1].styleId).toBe('Heading1');
      expect(styles[2].styleId).toBe('Heading3');
      expect(styles[3].styleId).toBe('Title'); // Priority 10
    });
  });

  describe('edge cases', () => {
    test('handles empty styles array', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('Normal');

      expect(result.paragraphFormatting).toBeUndefined();
    });

    test('handles style without pPr or rPr', () => {
      const styleDefinitions: StyleDefinitions = {
        styles: [{ styleId: 'EmptyStyle', type: 'paragraph', name: 'Empty' }],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('EmptyStyle');

      expect(result.paragraphFormatting).toBeUndefined();
      expect(result.runFormatting).toBeUndefined();
    });

    test('merges nested objects like fontFamily correctly', () => {
      const styleDefinitions: StyleDefinitions = {
        docDefaults: {
          rPr: {
            fontFamily: { ascii: 'Arial', eastAsia: 'SimSun' },
          },
        },
        styles: [
          {
            styleId: 'Heading1',
            type: 'paragraph',
            rPr: {
              fontFamily: { ascii: 'Cambria' }, // Override only ascii
            },
          },
        ],
      };

      const resolver = createStyleResolver(styleDefinitions);
      const result = resolver.resolveParagraphStyle('Heading1');

      expect(result.runFormatting?.fontFamily?.ascii).toBe('Cambria'); // Overridden
      expect(result.runFormatting?.fontFamily?.eastAsia).toBe('SimSun'); // Preserved from docDefaults
    });
  });
});
