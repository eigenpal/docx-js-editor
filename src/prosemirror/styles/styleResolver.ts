/**
 * Style Resolver for ProseMirror Editor
 *
 * Resolves OOXML style definitions to final paragraph and run properties.
 * Handles the cascade:
 * 1. Document defaults (docDefaults)
 * 2. Normal style (if no explicit styleId)
 * 3. Style chain (basedOn inheritance - already resolved by styleParser)
 * 4. Inline properties
 *
 * Based on ECMA-376 style cascade rules.
 */

import type {
  StyleDefinitions,
  Style,
  DocDefaults,
  ParagraphFormatting,
  TextFormatting,
} from '../../types/document';

/**
 * Resolved style properties ready for rendering
 */
export interface ResolvedParagraphStyle {
  /** Paragraph formatting (alignment, spacing, indentation, etc.) */
  paragraphFormatting?: ParagraphFormatting;
  /** Default run formatting from the style */
  runFormatting?: TextFormatting;
}

/**
 * StyleResolver provides efficient access to resolved style properties
 */
export class StyleResolver {
  private readonly stylesById: Map<string, Style>;
  private readonly docDefaults: DocDefaults | undefined;
  private readonly defaultParagraphStyle: Style | undefined;

  constructor(styleDefinitions: StyleDefinitions | undefined) {
    this.stylesById = new Map();
    this.docDefaults = styleDefinitions?.docDefaults;

    // Build lookup map
    if (styleDefinitions?.styles) {
      for (const style of styleDefinitions.styles) {
        if (style.styleId) {
          this.stylesById.set(style.styleId, style);
        }
      }
    }

    // Find default paragraph style
    this.defaultParagraphStyle = this.findDefaultStyle('paragraph');
  }

  /**
   * Get a style by ID
   */
  getStyle(styleId: string): Style | undefined {
    return this.stylesById.get(styleId);
  }

  /**
   * Get all available paragraph styles (for toolbar dropdown)
   */
  getParagraphStyles(): Style[] {
    const styles: Style[] = [];
    for (const style of this.stylesById.values()) {
      if (style.type === 'paragraph' && !style.hidden && !style.semiHidden) {
        styles.push(style);
      }
    }
    // Sort by uiPriority, then by name
    return styles.sort((a, b) => {
      const priorityA = a.uiPriority ?? 99;
      const priorityB = b.uiPriority ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.name ?? a.styleId).localeCompare(b.name ?? b.styleId);
    });
  }

  /**
   * Resolve paragraph style properties, including docDefaults cascade
   *
   * @param styleId - The style ID to resolve (e.g., 'Heading1', 'Normal')
   * @returns Resolved paragraph and run formatting
   */
  resolveParagraphStyle(styleId: string | undefined | null): ResolvedParagraphStyle {
    const result: ResolvedParagraphStyle = {};

    // Start with document defaults
    if (this.docDefaults?.pPr) {
      result.paragraphFormatting = { ...this.docDefaults.pPr };
    }
    if (this.docDefaults?.rPr) {
      result.runFormatting = { ...this.docDefaults.rPr };
    }

    // If no styleId, apply Normal style (if exists)
    if (!styleId) {
      if (this.defaultParagraphStyle) {
        this.mergeStyleIntoResult(result, this.defaultParagraphStyle);
      }
      return result;
    }

    // Get the requested style (already has basedOn chain resolved by styleParser)
    const style = this.stylesById.get(styleId);
    if (!style) {
      // Style not found, fall back to Normal
      if (this.defaultParagraphStyle) {
        this.mergeStyleIntoResult(result, this.defaultParagraphStyle);
      }
      return result;
    }

    // Merge style properties into result
    this.mergeStyleIntoResult(result, style);

    return result;
  }

  /**
   * Get all available table styles (for style gallery)
   */
  getTableStyles(): Style[] {
    const styles: Style[] = [];
    for (const style of this.stylesById.values()) {
      if (style.type === 'table' && !style.hidden && !style.semiHidden) {
        styles.push(style);
      }
    }
    return styles.sort((a, b) => {
      const priorityA = a.uiPriority ?? 99;
      const priorityB = b.uiPriority ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.name ?? a.styleId).localeCompare(b.name ?? b.styleId);
    });
  }

  /**
   * Resolve run (character) style properties
   *
   * @param styleId - The character style ID to resolve
   * @returns Resolved text formatting
   */
  resolveRunStyle(styleId: string | undefined | null): TextFormatting | undefined {
    // Start with document defaults
    let result: TextFormatting = {};
    if (this.docDefaults?.rPr) {
      result = { ...this.docDefaults.rPr };
    }

    // If no styleId, return defaults
    if (!styleId) {
      return Object.keys(result).length > 0 ? result : undefined;
    }

    // Get the requested style
    const style = this.stylesById.get(styleId);
    if (!style?.rPr) {
      return Object.keys(result).length > 0 ? result : undefined;
    }

    // Merge style's run properties
    const merged = this.mergeTextFormatting(result, style.rPr);

    return merged && Object.keys(merged).length > 0 ? merged : undefined;
  }

  /**
   * Get document defaults
   */
  getDocDefaults(): DocDefaults | undefined {
    return this.docDefaults;
  }

  /**
   * Get default paragraph style (usually "Normal")
   */
  getDefaultParagraphStyle(): Style | undefined {
    return this.defaultParagraphStyle;
  }

  /**
   * Check if a style exists
   */
  hasStyle(styleId: string): boolean {
    return this.stylesById.has(styleId);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private findDefaultStyle(type: 'paragraph' | 'character'): Style | undefined {
    // First try to find explicitly marked default
    for (const style of this.stylesById.values()) {
      if (style.type === type && style.default) {
        return style;
      }
    }
    // Fall back to "Normal" for paragraph styles
    if (type === 'paragraph') {
      return this.stylesById.get('Normal');
    }
    return undefined;
  }

  private mergeStyleIntoResult(result: ResolvedParagraphStyle, style: Style): void {
    if (style.pPr) {
      result.paragraphFormatting = this.mergeParagraphFormatting(
        result.paragraphFormatting,
        style.pPr
      );
    }
    if (style.rPr) {
      result.runFormatting = this.mergeTextFormatting(result.runFormatting, style.rPr);
    }
  }

  /**
   * Merge paragraph formatting (source overrides target)
   */
  private mergeParagraphFormatting(
    target: ParagraphFormatting | undefined,
    source: ParagraphFormatting | undefined
  ): ParagraphFormatting | undefined {
    if (!source) return target;
    if (!target) return source ? { ...source } : undefined;

    const result = { ...target };

    for (const key of Object.keys(source) as (keyof ParagraphFormatting)[]) {
      const value = source[key];
      if (value !== undefined) {
        if (key === 'runProperties') {
          result.runProperties = this.mergeTextFormatting(
            result.runProperties,
            source.runProperties
          );
        } else if (key === 'borders' || key === 'numPr' || key === 'frame') {
          const baseValue = result[key] as Record<string, unknown> | undefined;
          const sourceValue = value as Record<string, unknown> | undefined;
          (result as Record<string, unknown>)[key] = {
            ...(baseValue || {}),
            ...(sourceValue || {}),
          };
        } else if (key === 'tabs' && Array.isArray(value)) {
          // Tabs from higher priority source replace lower priority
          result.tabs = [...value];
        } else {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Merge text formatting (source overrides target)
   */
  private mergeTextFormatting(
    target: TextFormatting | undefined,
    source: TextFormatting | undefined
  ): TextFormatting | undefined {
    if (!source) return target;
    if (!target) return source ? { ...source } : undefined;

    const result = { ...target };

    for (const key of Object.keys(source) as (keyof TextFormatting)[]) {
      const value = source[key];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null) {
          // Deep merge for objects like fontFamily, color, underline
          (result as Record<string, unknown>)[key] = {
            ...((result[key] as Record<string, unknown>) || {}),
            ...(value as Record<string, unknown>),
          };
        } else {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }

    return result;
  }
}

/**
 * Create a style resolver from document's style definitions
 */
export function createStyleResolver(styleDefinitions: StyleDefinitions | undefined): StyleResolver {
  return new StyleResolver(styleDefinitions);
}
