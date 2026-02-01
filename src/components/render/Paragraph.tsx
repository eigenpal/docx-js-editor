/**
 * Paragraph Component
 *
 * Renders a complete paragraph with all styling and content.
 * Handles:
 * - All paragraph formatting (alignment, spacing, indentation, borders, shading)
 * - All content types (runs, tabs, hyperlinks, fields, images, shapes)
 * - Empty paragraphs (renders as line break)
 * - Right-to-left text
 * - List items (via listRendering)
 * - Bookmarks
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Paragraph as ParagraphType,
  ParagraphContent,
  Theme,
  TabStop,
  Run as RunType,
  Hyperlink as HyperlinkType,
  SimpleField,
  ComplexField,
  BookmarkStart,
  BookmarkEnd,
  Image as ImageType,
  Shape as ShapeType,
  TextBox as TextBoxType,
} from '../../types/document';
import { paragraphToStyle, textToStyle, mergeStyles } from '../../utils/formatToStyle';
import { twipsToPixels, formatPx } from '../../utils/units';
import { Run } from './Run';
import { Tab } from './Tab';
import { Hyperlink } from './Hyperlink';
import { Field } from './Field';
import { DocImage } from './DocImage';
import { Shape } from './Shape';
import { TextBox } from './TextBox';

/**
 * Props for the Paragraph component
 */
export interface ParagraphProps {
  /** The paragraph data to render */
  paragraph: ParagraphType;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Current page number (for PAGE fields) */
  pageNumber?: number;
  /** Total page count (for NUMPAGES fields) */
  totalPages?: number;
  /** Page width in twips (for tab calculations) */
  pageWidth?: number;
  /** Callback when a bookmark link is clicked */
  onBookmarkClick?: (bookmarkName: string) => void;
  /** Whether to disable links */
  disableLinks?: boolean;
  /** Render function for images (optional override) */
  renderImage?: (image: ImageType, index: number) => ReactNode;
  /** Render function for shapes (optional override) */
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  /** Render function for text boxes (optional override) */
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
  /** Index for key generation */
  index?: number;
}

/**
 * Default style for empty paragraphs (line break)
 */
const EMPTY_PARAGRAPH_STYLE: CSSProperties = {
  minHeight: '1em',
};

/**
 * List marker style
 */
const LIST_MARKER_STYLE: CSSProperties = {
  display: 'inline-block',
  minWidth: '1.5em',
  marginRight: '0.5em',
  textAlign: 'right',
};

/**
 * Paragraph component - renders a complete paragraph with all formatting
 */
export function Paragraph({
  paragraph,
  theme,
  className,
  style: additionalStyle,
  pageNumber,
  totalPages,
  pageWidth,
  onBookmarkClick,
  disableLinks = false,
  renderImage,
  renderShape,
  renderTextBox,
  index: paraIndex,
}: ParagraphProps): React.ReactElement {
  // Get CSS styles from paragraph formatting
  const formattingStyle = paragraphToStyle(paragraph.formatting, theme);

  // Apply default run properties if present (paragraph-level formatting for runs)
  const defaultRunStyle = paragraph.formatting?.runProperties
    ? textToStyle(paragraph.formatting.runProperties, theme)
    : {};

  // Combine styles
  const combinedStyle = mergeStyles(formattingStyle, additionalStyle, defaultRunStyle);

  // Check if paragraph is empty
  const isEmpty = !paragraph.content || paragraph.content.length === 0;

  // Handle empty paragraphs - render as a line break
  if (isEmpty) {
    return (
      <p
        className={buildClassNames(paragraph, className)}
        style={mergeStyles(combinedStyle, EMPTY_PARAGRAPH_STYLE)}
        id={paragraph.paraId}
        data-text-id={paragraph.textId}
      >
        <br />
      </p>
    );
  }

  // Collect tab stops from formatting
  const tabStops: TabStop[] = paragraph.formatting?.tabs || [];

  // Track position for tab width calculation (simplified - actual implementation
  // would need text measurement)
  let currentPosition = 0;

  // Render paragraph content
  const children: ReactNode[] = [];

  // Add list marker if this is a list item
  if (paragraph.listRendering) {
    children.push(
      <span
        key="list-marker"
        className="docx-list-marker"
        style={getListMarkerStyle(paragraph.listRendering.level)}
      >
        {paragraph.listRendering.marker}
      </span>
    );
  }

  // Render each content item
  paragraph.content.forEach((content, contentIndex) => {
    const key = `content-${contentIndex}`;
    const rendered = renderParagraphContent(
      content,
      key,
      {
        theme,
        tabStops,
        pageWidth,
        currentPosition,
        pageNumber,
        totalPages,
        onBookmarkClick,
        disableLinks,
        renderImage,
        renderShape,
        renderTextBox,
        contentIndex,
      }
    );

    if (rendered !== null) {
      children.push(rendered);
    }

    // Update position estimate (simplified)
    // Real implementation would measure actual rendered width
    if (content.type === 'run') {
      currentPosition += estimateRunWidth(content);
    }
  });

  // Build class names
  const classNames = buildClassNames(paragraph, className);

  return (
    <p
      className={classNames}
      style={combinedStyle}
      id={paragraph.paraId}
      data-text-id={paragraph.textId}
    >
      {children}
    </p>
  );
}

/**
 * Options for rendering paragraph content
 */
interface RenderContentOptions {
  theme?: Theme | null;
  tabStops: TabStop[];
  pageWidth?: number;
  currentPosition: number;
  pageNumber?: number;
  totalPages?: number;
  onBookmarkClick?: (bookmarkName: string) => void;
  disableLinks: boolean;
  renderImage?: (image: ImageType, index: number) => ReactNode;
  renderShape?: (shape: ShapeType, index: number) => ReactNode;
  renderTextBox?: (textBox: TextBoxType, index: number) => ReactNode;
  contentIndex: number;
}

/**
 * Render a single piece of paragraph content
 */
function renderParagraphContent(
  content: ParagraphContent,
  key: string,
  options: RenderContentOptions
): ReactNode {
  switch (content.type) {
    case 'run':
      return renderRun(content, key, options);

    case 'hyperlink':
      return (
        <Hyperlink
          key={key}
          hyperlink={content}
          theme={options.theme}
          onBookmarkClick={options.onBookmarkClick}
          disabled={options.disableLinks}
        />
      );

    case 'bookmarkStart':
      return (
        <span
          key={key}
          id={content.name}
          className="docx-bookmark-start"
          data-bookmark-id={content.id}
          data-bookmark-name={content.name}
        />
      );

    case 'bookmarkEnd':
      return (
        <span
          key={key}
          className="docx-bookmark-end"
          data-bookmark-id={content.id}
        />
      );

    case 'simpleField':
    case 'complexField':
      return (
        <Field
          key={key}
          field={content}
          theme={options.theme}
          pageNumber={options.pageNumber}
          totalPages={options.totalPages}
        />
      );

    default:
      // Unknown content type
      return null;
  }
}

/**
 * Render a run with its content
 */
function renderRun(
  run: RunType,
  key: string,
  options: RenderContentOptions
): ReactNode {
  // Check if run contains images or shapes that need special handling
  const hasImages = run.content.some(c => c.type === 'drawing');
  const hasShapes = run.content.some(c => c.type === 'shape');

  // If run contains only an image or shape and custom renderer provided, use it
  if (hasImages || hasShapes) {
    const specialContent: ReactNode[] = [];
    const regularContent: RunType = {
      ...run,
      content: [],
    };

    for (const item of run.content) {
      if (item.type === 'drawing' && item.image) {
        if (options.renderImage) {
          specialContent.push(
            <React.Fragment key={`${key}-img-${specialContent.length}`}>
              {options.renderImage(item.image, options.contentIndex)}
            </React.Fragment>
          );
        } else {
          specialContent.push(
            <DocImage
              key={`${key}-img-${specialContent.length}`}
              image={item.image}
            />
          );
        }
      } else if (item.type === 'shape' && item.shape) {
        if (options.renderShape) {
          specialContent.push(
            <React.Fragment key={`${key}-shape-${specialContent.length}`}>
              {options.renderShape(item.shape, options.contentIndex)}
            </React.Fragment>
          );
        } else {
          specialContent.push(
            <Shape
              key={`${key}-shape-${specialContent.length}`}
              shape={item.shape}
            />
          );
        }
      } else {
        // Regular content - add to the regularContent run
        regularContent.content.push(item);
      }
    }

    // If we have both special and regular content, render both
    const result: ReactNode[] = [];

    if (regularContent.content.length > 0) {
      result.push(
        <Run
          key={`${key}-run`}
          run={regularContent}
          theme={options.theme}
        />
      );
    }

    result.push(...specialContent);

    return <React.Fragment key={key}>{result}</React.Fragment>;
  }

  // Check for tab content that needs special rendering
  const hasTab = run.content.some(c => c.type === 'tab');

  if (hasTab) {
    // Render run content with Tab components for tab characters
    const pieces: ReactNode[] = [];
    let pieceIndex = 0;

    for (const item of run.content) {
      if (item.type === 'tab') {
        pieces.push(
          <Tab
            key={`${key}-tab-${pieceIndex}`}
            currentPosition={options.currentPosition}
            tabStops={options.tabStops}
            pageWidth={options.pageWidth}
            index={pieceIndex}
          />
        );
        pieceIndex++;
      } else {
        // Create a mini-run for this content
        const miniRun: RunType = {
          type: 'run',
          formatting: run.formatting,
          content: [item],
        };
        pieces.push(
          <Run
            key={`${key}-piece-${pieceIndex}`}
            run={miniRun}
            theme={options.theme}
          />
        );
        pieceIndex++;
      }
    }

    return <React.Fragment key={key}>{pieces}</React.Fragment>;
  }

  // Standard run rendering
  return (
    <Run
      key={key}
      run={run}
      theme={options.theme}
    />
  );
}

/**
 * Build CSS class names for paragraph
 */
function buildClassNames(paragraph: ParagraphType, additionalClass?: string): string {
  const classNames: string[] = ['docx-paragraph'];

  if (additionalClass) {
    classNames.push(additionalClass);
  }

  // Add formatting-specific classes
  if (paragraph.formatting) {
    const fmt = paragraph.formatting;

    // Alignment
    if (fmt.alignment) {
      classNames.push(`docx-align-${fmt.alignment}`);
    }

    // Direction
    if (fmt.bidi) {
      classNames.push('docx-rtl');
    }

    // Style reference
    if (fmt.styleId) {
      classNames.push(`docx-style-${fmt.styleId}`);
    }

    // Page break
    if (fmt.pageBreakBefore) {
      classNames.push('docx-page-break-before');
    }

    // Keep controls
    if (fmt.keepNext) {
      classNames.push('docx-keep-next');
    }
    if (fmt.keepLines) {
      classNames.push('docx-keep-lines');
    }
  }

  // List item
  if (paragraph.listRendering) {
    classNames.push('docx-list-item');
    classNames.push(`docx-list-level-${paragraph.listRendering.level}`);
    if (paragraph.listRendering.isBullet) {
      classNames.push('docx-list-bullet');
    } else {
      classNames.push('docx-list-numbered');
    }
  }

  // Empty paragraph
  if (!paragraph.content || paragraph.content.length === 0) {
    classNames.push('docx-paragraph-empty');
  }

  return classNames.join(' ');
}

/**
 * Get style for list marker based on level
 */
function getListMarkerStyle(level: number): CSSProperties {
  return {
    ...LIST_MARKER_STYLE,
    marginLeft: formatPx(level * 18), // 18px per level indent
  };
}

/**
 * Estimate run width in twips (simplified)
 * Real implementation would use text measurement
 */
function estimateRunWidth(run: RunType): number {
  let charCount = 0;

  for (const content of run.content) {
    if (content.type === 'text') {
      charCount += content.text.length;
    } else if (content.type === 'tab') {
      charCount += 4; // Estimate tab as 4 chars
    } else if (content.type === 'symbol') {
      charCount += 1;
    }
  }

  // Rough estimate: 10 twips per character at default size
  const fontSize = run.formatting?.fontSize || 24; // Default 12pt = 24 half-points
  const charWidth = (fontSize / 24) * 144; // Adjust for font size

  return charCount * charWidth;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get plain text content from a paragraph
 *
 * @param paragraph - The paragraph to extract text from
 * @returns Plain text string
 */
export function getParagraphText(paragraph: ParagraphType): string {
  const parts: string[] = [];

  for (const content of paragraph.content) {
    switch (content.type) {
      case 'run':
        for (const item of content.content) {
          if (item.type === 'text') {
            parts.push(item.text);
          } else if (item.type === 'tab') {
            parts.push('\t');
          } else if (item.type === 'break' && item.breakType === 'textWrapping') {
            parts.push('\n');
          } else if (item.type === 'symbol') {
            parts.push(String.fromCharCode(parseInt(item.char, 16)));
          }
        }
        break;

      case 'hyperlink':
        for (const child of content.children) {
          if (child.type === 'run') {
            for (const item of child.content) {
              if (item.type === 'text') {
                parts.push(item.text);
              }
            }
          }
        }
        break;

      case 'simpleField':
        // Extract field result text
        for (const item of content.content) {
          if ('content' in item && item.type === 'run') {
            for (const runItem of item.content) {
              if (runItem.type === 'text') {
                parts.push(runItem.text);
              }
            }
          }
        }
        break;

      case 'complexField':
        // Extract field result text
        for (const run of content.fieldResult) {
          for (const item of run.content) {
            if (item.type === 'text') {
              parts.push(item.text);
            }
          }
        }
        break;
    }
  }

  return parts.join('');
}

/**
 * Check if paragraph is empty (no visible content)
 *
 * @param paragraph - The paragraph to check
 * @returns true if empty
 */
export function isEmptyParagraph(paragraph: ParagraphType): boolean {
  if (!paragraph.content || paragraph.content.length === 0) {
    return true;
  }

  // Check if any content has visible text
  return !paragraph.content.some((content) => {
    if (content.type === 'run') {
      return content.content.some((item) => {
        if (item.type === 'text' && item.text.trim().length > 0) {
          return true;
        }
        if (item.type === 'drawing' || item.type === 'shape') {
          return true;
        }
        return false;
      });
    }
    if (content.type === 'hyperlink') {
      return content.children.length > 0;
    }
    if (content.type === 'simpleField' || content.type === 'complexField') {
      return true;
    }
    return false;
  });
}

/**
 * Check if paragraph is a list item
 *
 * @param paragraph - The paragraph to check
 * @returns true if list item
 */
export function isListItem(paragraph: ParagraphType): boolean {
  return paragraph.listRendering !== undefined ||
    (paragraph.formatting?.numPr?.numId !== undefined &&
      paragraph.formatting?.numPr?.numId !== 0);
}

/**
 * Get list level (0-8)
 *
 * @param paragraph - The paragraph to check
 * @returns List level or -1 if not a list item
 */
export function getListLevel(paragraph: ParagraphType): number {
  if (paragraph.listRendering) {
    return paragraph.listRendering.level;
  }
  if (paragraph.formatting?.numPr?.ilvl !== undefined) {
    return paragraph.formatting.numPr.ilvl;
  }
  return -1;
}

/**
 * Check if paragraph has a specific style
 *
 * @param paragraph - The paragraph to check
 * @param styleId - Style ID to check for
 * @returns true if paragraph has the style
 */
export function hasStyle(paragraph: ParagraphType, styleId: string): boolean {
  return paragraph.formatting?.styleId === styleId;
}

/**
 * Check if paragraph is right-to-left
 *
 * @param paragraph - The paragraph to check
 * @returns true if RTL
 */
export function isRtlParagraph(paragraph: ParagraphType): boolean {
  return paragraph.formatting?.bidi === true;
}

/**
 * Get all template variables from paragraph
 *
 * @param paragraph - The paragraph to scan
 * @returns Array of variable names (without braces)
 */
export function getTemplateVariables(paragraph: ParagraphType): string[] {
  const text = getParagraphText(paragraph);
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    variables.push(match[1].trim());
  }

  return [...new Set(variables)]; // Remove duplicates
}

/**
 * Check if paragraph contains images
 *
 * @param paragraph - The paragraph to check
 * @returns true if contains images
 */
export function hasImages(paragraph: ParagraphType): boolean {
  return paragraph.content.some((content) => {
    if (content.type === 'run') {
      return content.content.some((item) => item.type === 'drawing');
    }
    return false;
  });
}

/**
 * Check if paragraph contains shapes
 *
 * @param paragraph - The paragraph to check
 * @returns true if contains shapes
 */
export function hasShapes(paragraph: ParagraphType): boolean {
  return paragraph.content.some((content) => {
    if (content.type === 'run') {
      return content.content.some((item) => item.type === 'shape');
    }
    return false;
  });
}

/**
 * Get word count of paragraph
 *
 * @param paragraph - The paragraph to count
 * @returns Word count
 */
export function getWordCount(paragraph: ParagraphType): number {
  const text = getParagraphText(paragraph);
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Get character count of paragraph (excluding whitespace)
 *
 * @param paragraph - The paragraph to count
 * @param includeSpaces - Whether to include spaces
 * @returns Character count
 */
export function getCharacterCount(paragraph: ParagraphType, includeSpaces = false): number {
  const text = getParagraphText(paragraph);
  if (includeSpaces) {
    return text.length;
  }
  return text.replace(/\s/g, '').length;
}

export default Paragraph;
