/**
 * FootnoteArea Component
 *
 * Renders footnotes at the bottom of a page:
 * - Separator line above footnotes
 * - All footnotes for the current page
 * - Smaller text for footnote content
 * - Numbered references that link back to text
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Footnote,
  Endnote,
  Theme,
  Paragraph,
  FootnoteProperties,
  EndnoteProperties,
} from '../../types/document';
import { formatNoteNumber } from './FootnoteRef';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the FootnoteArea component
 */
export interface FootnoteAreaProps {
  /** Footnotes to render */
  footnotes: Footnote[];
  /** Current page number */
  pageNumber: number;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Footnote properties (numbering format, etc.) */
  properties?: FootnoteProperties | null;
  /** Starting number for this page */
  startNumber?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to show separator line */
  showSeparator?: boolean;
  /** Custom separator element */
  separator?: ReactNode;
  /** Render function for footnote content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Callback when footnote number is clicked (back-link) */
  onFootnoteClick?: (id: number) => void;
}

/**
 * Props for the EndnoteArea component
 */
export interface EndnoteAreaProps {
  /** Endnotes to render */
  endnotes: Endnote[];
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Endnote properties */
  properties?: EndnoteProperties | null;
  /** Starting number */
  startNumber?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to show header/title */
  showTitle?: boolean;
  /** Custom title text */
  title?: string;
  /** Render function for endnote content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Callback when endnote number is clicked */
  onEndnoteClick?: (id: number) => void;
}

/**
 * Props for individual footnote rendering
 */
interface FootnoteItemProps {
  footnote: Footnote;
  displayNumber: number;
  numberFormat?: string;
  theme?: Theme | null;
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  onClick?: (id: number) => void;
}

// ============================================================================
// MAIN COMPONENTS
// ============================================================================

/**
 * FootnoteArea component - renders footnotes at page bottom
 */
export function FootnoteArea({
  footnotes,
  pageNumber: _pageNumber,
  theme,
  properties,
  startNumber = 1,
  className,
  style: additionalStyle,
  showSeparator = true,
  separator,
  renderParagraph,
  onFootnoteClick,
}: FootnoteAreaProps): React.ReactElement | null {
  // Filter out separator footnotes
  const displayableFootnotes = footnotes.filter(
    (fn) => fn.noteType === 'normal' || fn.noteType === undefined
  );

  if (displayableFootnotes.length === 0) {
    return null;
  }

  // Build class names
  const classNames: string[] = ['docx-footnote-area'];
  if (className) {
    classNames.push(className);
  }

  // Build style
  const style: CSSProperties = {
    fontSize: '10px',
    lineHeight: '1.3',
    paddingTop: '8px',
    ...additionalStyle,
  };

  // Get number format
  const numberFormat = properties?.numFmt;

  return (
    <div className={classNames.join(' ')} style={style} role="region" aria-label="Footnotes">
      {/* Separator line */}
      {showSeparator && (separator || <FootnoteSeparator />)}

      {/* Footnotes */}
      <div className="docx-footnote-list">
        {displayableFootnotes.map((footnote, index) => (
          <FootnoteItem
            key={footnote.id}
            footnote={footnote}
            displayNumber={startNumber + index}
            numberFormat={numberFormat}
            theme={theme}
            renderParagraph={renderParagraph}
            onClick={onFootnoteClick}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * EndnoteArea component - renders endnotes (typically at section/document end)
 */
export function EndnoteArea({
  endnotes,
  theme,
  properties,
  startNumber = 1,
  className,
  style: additionalStyle,
  showTitle = true,
  title = 'Endnotes',
  renderParagraph,
  onEndnoteClick,
}: EndnoteAreaProps): React.ReactElement | null {
  // Filter out separator endnotes
  const displayableEndnotes = endnotes.filter(
    (en) => en.noteType === 'normal' || en.noteType === undefined
  );

  if (displayableEndnotes.length === 0) {
    return null;
  }

  // Build class names
  const classNames: string[] = ['docx-endnote-area'];
  if (className) {
    classNames.push(className);
  }

  // Build style
  const style: CSSProperties = {
    fontSize: '10px',
    lineHeight: '1.3',
    paddingTop: '16px',
    ...additionalStyle,
  };

  // Get number format
  const numberFormat = properties?.numFmt;

  return (
    <div className={classNames.join(' ')} style={style} role="region" aria-label="Endnotes">
      {/* Title */}
      {showTitle && (
        <div
          className="docx-endnote-title"
          style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '12px' }}
        >
          {title}
        </div>
      )}

      {/* Endnotes */}
      <div className="docx-endnote-list">
        {displayableEndnotes.map((endnote, index) => (
          <EndnoteItem
            key={endnote.id}
            endnote={endnote}
            displayNumber={startNumber + index}
            numberFormat={numberFormat}
            theme={theme}
            renderParagraph={renderParagraph}
            onClick={onEndnoteClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Default footnote separator line
 */
function FootnoteSeparator(): React.ReactElement {
  return (
    <div
      className="docx-footnote-separator"
      style={{
        width: '33%',
        height: '1px',
        backgroundColor: '#000000',
        marginBottom: '8px',
      }}
      role="separator"
    />
  );
}

/**
 * Individual footnote item
 */
function FootnoteItem({
  footnote,
  displayNumber,
  numberFormat,
  theme: _theme,
  renderParagraph,
  onClick,
}: FootnoteItemProps): React.ReactElement {
  const formattedNumber = formatNoteNumber(displayNumber, numberFormat);

  const handleClick = () => {
    if (onClick) {
      onClick(footnote.id);
    }
  };

  return (
    <div
      className="docx-footnote-item"
      id={`footnote-${footnote.id}`}
      style={{
        display: 'flex',
        marginBottom: '4px',
      }}
    >
      {/* Footnote number */}
      <span
        className="docx-footnote-number"
        style={{
          minWidth: '20px',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : 'default',
          color: onClick ? '#0066cc' : 'inherit',
        }}
        onClick={handleClick}
        role={onClick ? 'link' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`Go to footnote ${formattedNumber} reference`}
      >
        {formattedNumber}.
      </span>

      {/* Footnote content */}
      <div className="docx-footnote-content" style={{ flex: 1 }}>
        {footnote.content.map((block, index) => {
          if (block.type === 'paragraph') {
            if (renderParagraph) {
              return <React.Fragment key={index}>{renderParagraph(block, index)}</React.Fragment>;
            }
            return (
              <div key={index} className="docx-fn-para">
                {getBlockText(block)}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

/**
 * Individual endnote item
 */
function EndnoteItem({
  endnote,
  displayNumber,
  numberFormat,
  theme: _theme,
  renderParagraph,
  onClick,
}: {
  endnote: Endnote;
  displayNumber: number;
  numberFormat?: string;
  theme?: Theme | null;
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  onClick?: (id: number) => void;
}): React.ReactElement {
  const formattedNumber = formatNoteNumber(displayNumber, numberFormat);

  const handleClick = () => {
    if (onClick) {
      onClick(endnote.id);
    }
  };

  return (
    <div
      className="docx-endnote-item"
      id={`endnote-${endnote.id}`}
      style={{
        display: 'flex',
        marginBottom: '8px',
      }}
    >
      {/* Endnote number */}
      <span
        className="docx-endnote-number"
        style={{
          minWidth: '24px',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : 'default',
          color: onClick ? '#0066cc' : 'inherit',
        }}
        onClick={handleClick}
        role={onClick ? 'link' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`Go to endnote ${formattedNumber} reference`}
      >
        {formattedNumber}.
      </span>

      {/* Endnote content */}
      <div className="docx-endnote-content" style={{ flex: 1 }}>
        {endnote.content.map((block, index) => {
          if (block.type === 'paragraph') {
            if (renderParagraph) {
              return <React.Fragment key={index}>{renderParagraph(block, index)}</React.Fragment>;
            }
            return (
              <div key={index} className="docx-en-para">
                {getBlockText(block)}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get plain text from a paragraph
 */
function getBlockText(block: Paragraph): string {
  const parts: string[] = [];

  for (const content of block.content) {
    if (content.type === 'run') {
      for (const item of content.content) {
        if (item.type === 'text') {
          parts.push(item.text);
        }
      }
    }
  }

  return parts.join('') || '\u00A0';
}

/**
 * Calculate footnote area height (approximate)
 */
export function calculateFootnoteAreaHeight(
  footnotes: Footnote[],
  options: { fontSize?: number; lineHeight?: number; separatorHeight?: number } = {}
): number {
  const { fontSize = 10, lineHeight = 1.3, separatorHeight = 9 } = options;

  // Filter displayable footnotes
  const displayable = footnotes.filter(
    (fn) => fn.noteType === 'normal' || fn.noteType === undefined
  );

  if (displayable.length === 0) {
    return 0;
  }

  // Estimate height per footnote (one line each, simplified)
  const footnoteHeight = fontSize * lineHeight + 4; // 4px margin
  const totalHeight = separatorHeight + displayable.length * footnoteHeight + 8; // 8px padding

  return totalHeight;
}

/**
 * Get footnotes for a specific page
 */
export function getFootnotesForPage(
  allFootnotes: Footnote[],
  pageFootnoteIds: number[]
): Footnote[] {
  return allFootnotes.filter((fn) => pageFootnoteIds.includes(fn.id));
}

/**
 * Calculate starting number for footnotes on a page
 */
export function getFootnoteStartNumber(
  pageNumber: number,
  footnoteIdsByPage: Map<number, number[]>,
  restartNumbering: string = 'continuous'
): number {
  if (restartNumbering === 'eachPage') {
    return 1;
  }

  // Count all footnotes on previous pages
  let count = 0;
  for (let p = 1; p < pageNumber; p++) {
    const ids = footnoteIdsByPage.get(p);
    if (ids) {
      count += ids.length;
    }
  }

  return count + 1;
}

/**
 * Check if a page has footnotes
 */
export function hasFootnotes(footnotes: Footnote[] | undefined | null): boolean {
  if (!footnotes || footnotes.length === 0) return false;

  return footnotes.some((fn) => fn.noteType === 'normal' || fn.noteType === undefined);
}

/**
 * Check if a page has endnotes
 */
export function hasEndnotes(endnotes: Endnote[] | undefined | null): boolean {
  if (!endnotes || endnotes.length === 0) return false;

  return endnotes.some((en) => en.noteType === 'normal' || en.noteType === undefined);
}

/**
 * Get footnote count (excluding separators)
 */
export function getFootnoteCount(footnotes: Footnote[] | undefined | null): number {
  if (!footnotes) return 0;

  return footnotes.filter((fn) => fn.noteType === 'normal' || fn.noteType === undefined).length;
}

/**
 * Get endnote count (excluding separators)
 */
export function getEndnoteCount(endnotes: Endnote[] | undefined | null): number {
  if (!endnotes) return 0;

  return endnotes.filter((en) => en.noteType === 'normal' || en.noteType === undefined).length;
}

export default FootnoteArea;
