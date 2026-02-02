/**
 * Run Component
 *
 * Renders a text run with complete formatting as a span element.
 * Handles all text formatting properties including:
 * - Font: family, size, weight, style
 * - Color and highlighting
 * - Underline, strikethrough, double-strike
 * - Superscript/subscript positioning
 * - Small-caps, all-caps transformation
 * - Character spacing, effects
 * - Template variables {{...}} styling
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Run as RunType, RunContent, Theme } from '../../types/document';
import { textToStyle, mergeStyles } from '../../utils/formatToStyle';

/**
 * Props for the Run component
 */
export interface RunProps {
  /** The run data to render */
  run: RunType;
  /** Theme for resolving colors and fonts */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether to render as inline-block (useful for positioned text) */
  inline?: boolean;
}

/**
 * Check if text contains template variables
 */
function containsTemplateVariable(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text);
}

/**
 * Style for template variables
 */
const TEMPLATE_VARIABLE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 223, 128, 0.5)',
  borderRadius: '2px',
  padding: '0 2px',
  fontFamily: 'monospace',
  color: '#8B4513',
};

/**
 * Render text content, highlighting template variables
 */
function renderTextWithVariables(text: string): ReactNode {
  if (!containsTemplateVariable(text)) {
    return text;
  }

  // Split text by template variables, keeping the delimiters
  const parts: ReactNode[] = [];
  const regex = /(\{\{[^}]+\}\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the template variable with special styling
    parts.push(
      <span key={match.index} style={TEMPLATE_VARIABLE_STYLE}>
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

/**
 * Render a single piece of run content
 */
function renderContent(content: RunContent, index: number): ReactNode {
  switch (content.type) {
    case 'text':
      return <React.Fragment key={index}>{renderTextWithVariables(content.text)}</React.Fragment>;

    case 'tab':
      // Render tab as a span with tab character styling
      // Actual tab width would be calculated by parent paragraph
      return (
        <span key={index} className="docx-tab" style={{ whiteSpace: 'pre' }}>
          {'\t'}
        </span>
      );

    case 'break':
      switch (content.breakType) {
        case 'page':
          // Page breaks are typically handled at paragraph level
          return (
            <span
              key={index}
              className="docx-page-break"
              style={{ display: 'block', pageBreakAfter: 'always' }}
            >
              {'\n'}
            </span>
          );
        case 'column':
          // Column breaks handled at layout level
          return <span key={index} className="docx-column-break" />;
        case 'textWrapping':
        default:
          // Line break
          return <br key={index} />;
      }

    case 'symbol':
      // Symbol with specific font
      return (
        <span key={index} className="docx-symbol" style={{ fontFamily: content.font }}>
          {String.fromCharCode(parseInt(content.char, 16))}
        </span>
      );

    case 'footnoteRef':
    case 'endnoteRef':
      // Footnote/endnote reference - superscript number
      // The actual number would be resolved by the parent component
      return (
        <sup
          key={index}
          className={`docx-${content.type}`}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          [{content.id}]
        </sup>
      );

    case 'fieldChar':
      // Field characters are structural - not rendered directly
      // They are used during parsing to build ComplexField structures
      return null;

    case 'instrText':
      // Field instructions are not rendered
      return null;

    case 'softHyphen':
      // Soft hyphen - visible only when line breaks there
      return (
        <span key={index} className="docx-soft-hyphen">
          {'\u00AD'}
        </span>
      );

    case 'noBreakHyphen':
      // Non-breaking hyphen
      return (
        <span key={index} className="docx-no-break-hyphen">
          {'\u2011'}
        </span>
      );

    case 'drawing':
      // Image - would be rendered by separate Image component
      // For now, placeholder
      return (
        <span
          key={index}
          className="docx-drawing-placeholder"
          style={{
            display: 'inline-block',
            backgroundColor: '#f0f0f0',
            padding: '4px 8px',
            border: '1px dashed #ccc',
          }}
        >
          [Image]
        </span>
      );

    case 'shape':
      // Shape - would be rendered by separate Shape component
      return (
        <span
          key={index}
          className="docx-shape-placeholder"
          style={{
            display: 'inline-block',
            backgroundColor: '#e8f4ff',
            padding: '4px 8px',
            border: '1px dashed #88c',
          }}
        >
          [Shape]
        </span>
      );

    default:
      // Unknown content type
      return null;
  }
}

/**
 * Run component - renders a text run with all formatting
 */
export function Run({
  run,
  theme,
  className,
  style: additionalStyle,
  inline: _inline = true,
}: RunProps): React.ReactElement | null {
  // Get CSS styles from formatting
  const formattingStyle = textToStyle(run.formatting, theme);

  // Merge with additional styles
  const combinedStyle = mergeStyles(formattingStyle, additionalStyle);

  // Handle empty runs
  if (!run.content || run.content.length === 0) {
    return null;
  }

  // Render all content
  const children = run.content.map((content, index) => renderContent(content, index));

  // Build class name
  const classNames: string[] = ['docx-run'];
  if (className) {
    classNames.push(className);
  }

  // Add formatting-specific classes for CSS targeting
  if (run.formatting) {
    if (run.formatting.bold) classNames.push('docx-run-bold');
    if (run.formatting.italic) classNames.push('docx-run-italic');
    if (run.formatting.underline) classNames.push('docx-run-underline');
    if (run.formatting.strike || run.formatting.doubleStrike) classNames.push('docx-run-strike');
    if (run.formatting.vertAlign === 'superscript') classNames.push('docx-run-superscript');
    if (run.formatting.vertAlign === 'subscript') classNames.push('docx-run-subscript');
    if (run.formatting.smallCaps) classNames.push('docx-run-small-caps');
    if (run.formatting.allCaps) classNames.push('docx-run-all-caps');
    if (run.formatting.highlight && run.formatting.highlight !== 'none') {
      classNames.push('docx-run-highlighted');
    }
    if (run.formatting.hidden) classNames.push('docx-run-hidden');
  }

  // Check if any content contains template variables
  const hasVariables = run.content.some(
    (c) => c.type === 'text' && containsTemplateVariable(c.text)
  );
  if (hasVariables) {
    classNames.push('docx-run-has-variable');
  }

  return (
    <span className={classNames.join(' ')} style={combinedStyle}>
      {children}
    </span>
  );
}

/**
 * Get plain text from a run
 */
export function getRunPlainText(run: RunType): string {
  return run.content
    .map((content) => {
      switch (content.type) {
        case 'text':
          return content.text;
        case 'tab':
          return '\t';
        case 'break':
          return content.breakType === 'textWrapping' ? '\n' : '';
        case 'symbol':
          return String.fromCharCode(parseInt(content.char, 16));
        case 'softHyphen':
          return '\u00AD';
        case 'noBreakHyphen':
          return '\u2011';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Check if run has visible content
 */
export function hasVisibleContent(run: RunType): boolean {
  return run.content.some((content) => {
    switch (content.type) {
      case 'text':
        return content.text.length > 0;
      case 'drawing':
      case 'shape':
      case 'symbol':
        return true;
      default:
        return false;
    }
  });
}

/**
 * Check if run contains only whitespace
 */
export function isWhitespaceOnly(run: RunType): boolean {
  return run.content.every((content) => {
    if (content.type === 'text') {
      return /^\s*$/.test(content.text);
    }
    if (content.type === 'tab' || content.type === 'break') {
      return true;
    }
    return false;
  });
}

export default Run;
