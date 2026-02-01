/**
 * FootnoteRef Component
 *
 * Renders footnote and endnote reference markers in document text.
 * Supports:
 * - Superscript numbered references
 * - Clickable to jump to footnote/endnote content
 * - Tooltip preview of footnote content
 * - Custom reference marks
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Footnote,
  Endnote,
  FootnoteProperties,
  EndnoteProperties,
  Theme,
  Paragraph,
} from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the FootnoteRef component
 */
export interface FootnoteRefProps {
  /** The footnote/endnote ID being referenced */
  id: number;
  /** Type of note: footnote or endnote */
  type: 'footnote' | 'endnote';
  /** The footnote/endnote content (for tooltip preview) */
  noteContent?: Footnote | Endnote | null;
  /** Custom reference mark (overrides number) */
  customMark?: string;
  /** The display number (may differ from ID due to separator notes) */
  displayNumber?: number;
  /** Theme for styling */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Callback when reference is clicked */
  onClick?: (id: number, type: 'footnote' | 'endnote') => void;
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
  /** Custom tooltip content */
  tooltipContent?: ReactNode;
  /** Index for key generation */
  index?: number;
}

/**
 * Props for the FootnoteTooltip component
 */
interface FootnoteTooltipProps {
  content: Footnote | Endnote;
  visible: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  type: 'footnote' | 'endnote';
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

/**
 * Tooltip that shows footnote/endnote preview
 */
function FootnoteTooltip({
  content,
  visible,
  anchorRef,
  type,
}: FootnoteTooltipProps): React.ReactElement | null {
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [visible, anchorRef]);

  if (!visible) {
    return null;
  }

  // Extract preview text from footnote content
  const previewText = getNotePreviewText(content, 150);

  return (
    <div
      className={`docx-note-tooltip docx-${type}-tooltip`}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        maxWidth: '300px',
        padding: '8px 12px',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        fontSize: '12px',
        lineHeight: '1.4',
        color: '#333',
        pointerEvents: 'none',
      }}
      role="tooltip"
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', color: '#666' }}>
        {type === 'footnote' ? 'Footnote' : 'Endnote'} {content.id}
      </div>
      <div>{previewText}</div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * FootnoteRef component - renders footnote/endnote reference markers
 */
export function FootnoteRef({
  id,
  type,
  noteContent,
  customMark,
  displayNumber,
  theme,
  className,
  style: additionalStyle,
  onClick,
  showTooltip = true,
  tooltipContent,
  index,
}: FootnoteRefProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const refElement = useRef<HTMLSpanElement>(null);

  // Determine what to display
  const displayMark = customMark ?? String(displayNumber ?? id);

  // Build class names
  const classNames: string[] = [
    'docx-note-ref',
    `docx-${type}-ref`,
  ];
  if (className) {
    classNames.push(className);
  }
  if (onClick) {
    classNames.push('docx-note-ref-clickable');
  }

  // Build style
  const style: CSSProperties = {
    verticalAlign: 'super',
    fontSize: '0.75em',
    lineHeight: '1',
    cursor: onClick ? 'pointer' : 'default',
    color: '#0066cc',
    textDecoration: 'none',
    ...additionalStyle,
  };

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClick) {
        onClick(id, type);
      } else {
        // Default behavior: try to scroll to the note
        const noteElementId = type === 'footnote' ? `footnote-${id}` : `endnote-${id}`;
        const noteElement = document.getElementById(noteElementId);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          noteElement.focus();
        }
      }
    },
    [id, type, onClick]
  );

  // Handle hover
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Determine tooltip visibility
  const shouldShowTooltip = showTooltip && isHovered && (noteContent || tooltipContent);

  return (
    <>
      <span
        ref={refElement}
        className={classNames.join(' ')}
        style={style}
        onClick={onClick || noteContent ? handleClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={!showTooltip && noteContent ? getNotePreviewText(noteContent, 100) : undefined}
        role="link"
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${type === 'footnote' ? 'Footnote' : 'Endnote'} ${displayMark}`}
        data-note-id={id}
        data-note-type={type}
        data-index={index}
      >
        {displayMark}
      </span>
      {shouldShowTooltip && noteContent && !tooltipContent && (
        <FootnoteTooltip
          content={noteContent}
          visible={isHovered}
          anchorRef={refElement}
          type={type}
        />
      )}
      {shouldShowTooltip && tooltipContent && (
        <div
          className="docx-note-tooltip-custom"
          style={{
            position: 'absolute',
            zIndex: 1000,
          }}
        >
          {tooltipContent}
        </div>
      )}
    </>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract plain text preview from a footnote/endnote
 */
function getNotePreviewText(note: Footnote | Endnote, maxLength: number = 100): string {
  const parts: string[] = [];

  for (const paragraph of note.content) {
    if (paragraph.type === 'paragraph') {
      for (const content of paragraph.content) {
        if (content.type === 'run') {
          for (const item of content.content) {
            if (item.type === 'text') {
              parts.push(item.text);
            }
          }
        } else if (content.type === 'hyperlink') {
          for (const run of content.children) {
            if (run.type === 'run') {
              for (const item of run.content) {
                if (item.type === 'text') {
                  parts.push(item.text);
                }
              }
            }
          }
        }
      }
    }
  }

  const text = parts.join('').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '…';
  }
  return truncated + '…';
}

/**
 * Get the display number for a footnote
 *
 * Takes into account that separator footnotes (id -1, 0) are not numbered
 */
export function getFootnoteDisplayNumber(
  footnoteId: number,
  allFootnotes: Footnote[],
  properties?: FootnoteProperties | null
): number {
  // Filter out separator footnotes
  const normalFootnotes = allFootnotes.filter(
    (fn) => fn.type === 'normal' || fn.type === undefined
  );

  // Find index of this footnote among normal footnotes
  const index = normalFootnotes.findIndex((fn) => fn.id === footnoteId);
  if (index === -1) {
    return footnoteId; // Fallback to ID
  }

  // Apply start number from properties
  const startNumber = properties?.numStart ?? 1;
  return startNumber + index;
}

/**
 * Get the display number for an endnote
 */
export function getEndnoteDisplayNumber(
  endnoteId: number,
  allEndnotes: Endnote[],
  properties?: EndnoteProperties | null
): number {
  // Filter out separator endnotes
  const normalEndnotes = allEndnotes.filter(
    (en) => en.type === 'normal' || en.type === undefined
  );

  // Find index of this endnote among normal endnotes
  const index = normalEndnotes.findIndex((en) => en.id === endnoteId);
  if (index === -1) {
    return endnoteId; // Fallback to ID
  }

  // Apply start number from properties
  const startNumber = properties?.numStart ?? 1;
  return startNumber + index;
}

/**
 * Format a footnote/endnote number according to format settings
 */
export function formatNoteNumber(
  number: number,
  format: string | undefined
): string {
  switch (format) {
    case 'upperRoman':
      return toUpperRoman(number);
    case 'lowerRoman':
      return toLowerRoman(number);
    case 'upperLetter':
      return toUpperLetter(number);
    case 'lowerLetter':
      return toLowerLetter(number);
    case 'chicago':
      return toChicago(number);
    case 'decimal':
    default:
      return String(number);
  }
}

/**
 * Convert number to uppercase Roman numeral
 */
function toUpperRoman(num: number): string {
  if (num <= 0 || num > 3999) return String(num);

  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Convert number to lowercase Roman numeral
 */
function toLowerRoman(num: number): string {
  return toUpperRoman(num).toLowerCase();
}

/**
 * Convert number to uppercase letter (A, B, C, ... Z, AA, AB, ...)
 */
function toUpperLetter(num: number): string {
  if (num <= 0) return String(num);

  let result = '';
  let n = num;

  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }

  return result;
}

/**
 * Convert number to lowercase letter
 */
function toLowerLetter(num: number): string {
  return toUpperLetter(num).toLowerCase();
}

/**
 * Convert number to Chicago manual of style symbols
 * *, †, ‡, §, ||, ¶, then doubles: **, ††, etc.
 */
function toChicago(num: number): string {
  const symbols = ['*', '†', '‡', '§', '||', '¶'];
  if (num <= 0) return String(num);

  const cycle = Math.ceil(num / symbols.length);
  const symbolIndex = (num - 1) % symbols.length;
  const symbol = symbols[symbolIndex];

  return symbol.repeat(cycle);
}

/**
 * Check if a footnote is a separator (not content)
 */
export function isSeparatorNote(note: Footnote | Endnote): boolean {
  return (
    note.type === 'separator' ||
    note.type === 'continuationSeparator' ||
    note.type === 'continuationNotice'
  );
}

/**
 * Check if a footnote reference needs a superscript number
 */
export function needsSuperscriptNumber(note: Footnote | Endnote): boolean {
  return note.type === 'normal' || note.type === undefined;
}

/**
 * Get all footnotes that should be displayed (not separators)
 */
export function getDisplayableFootnotes(footnotes: Footnote[]): Footnote[] {
  return footnotes.filter((fn) => !isSeparatorNote(fn));
}

/**
 * Get all endnotes that should be displayed (not separators)
 */
export function getDisplayableEndnotes(endnotes: Endnote[]): Endnote[] {
  return endnotes.filter((en) => !isSeparatorNote(en));
}

/**
 * Create footnote element ID for scroll targeting
 */
export function getFootnoteElementId(id: number): string {
  return `footnote-${id}`;
}

/**
 * Create endnote element ID for scroll targeting
 */
export function getEndnoteElementId(id: number): string {
  return `endnote-${id}`;
}

/**
 * Create footnote reference element ID for back-linking
 */
export function getFootnoteRefElementId(id: number, index?: number): string {
  return index !== undefined ? `footnote-ref-${id}-${index}` : `footnote-ref-${id}`;
}

/**
 * Create endnote reference element ID for back-linking
 */
export function getEndnoteRefElementId(id: number, index?: number): string {
  return index !== undefined ? `endnote-ref-${id}-${index}` : `endnote-ref-${id}`;
}

export default FootnoteRef;
