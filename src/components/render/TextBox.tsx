/**
 * TextBox Component
 *
 * Renders floating text containers from DOCX documents.
 * Text boxes are positioned independently and contain paragraphs/tables.
 *
 * Features:
 * - Positioned independently (floating)
 * - Contains paragraphs and tables
 * - Applies borders and background
 * - Internal margins/padding
 * - Text wrapping modes
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { TextBox as TextBoxType, Paragraph, Table } from '../../types/document';
import {
  getTextBoxWidthPx,
  getTextBoxHeightPx,
  getTextBoxDimensionsPx,
  getTextBoxMarginsPx,
  isFloatingTextBox,
  hasTextBoxFill,
  hasTextBoxOutline,
  hasTextBoxContent,
  resolveTextBoxFillColor,
  resolveTextBoxOutlineColor,
  getTextBoxOutlineWidthPx,
} from '../../docx/textBoxParser';
import { emuToPixels } from '../../docx/imageParser';

/**
 * Props for the TextBox component
 */
export interface TextBoxProps {
  /** The text box data to render */
  textBox: TextBoxType;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether the text box is selected (for editing) */
  selected?: boolean;
  /** Callback when text box is clicked */
  onClick?: () => void;
  /** Render function for paragraph content */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
  /** Render function for table content */
  renderTable?: (table: Table, index: number) => ReactNode;
}

/**
 * Selected text box style
 */
const SELECTED_STYLE: CSSProperties = {
  outline: '2px solid #0078d4',
  outlineOffset: '2px',
};

/**
 * TextBox component - renders floating text containers
 */
export function TextBox({
  textBox,
  className,
  style: additionalStyle,
  selected = false,
  onClick,
  renderParagraph,
  renderTable,
}: TextBoxProps): React.ReactElement {
  // Get dimensions
  const { width, height } = getTextBoxDimensionsPx(textBox);
  const margins = getTextBoxMarginsPx(textBox);

  // Build class names
  const classNames: string[] = ['docx-textbox'];
  if (className) {
    classNames.push(className);
  }

  if (isFloatingTextBox(textBox)) {
    classNames.push('docx-textbox-floating');
  }

  if (selected) {
    classNames.push('docx-textbox-selected');
  }

  // Build styles
  const boxStyle = buildTextBoxStyle(textBox, selected);
  const combinedStyle: CSSProperties = {
    ...boxStyle,
    ...additionalStyle,
  };

  // Render content
  const content = renderContent(textBox, renderParagraph, renderTable);

  return (
    <div
      className={classNames.join(' ')}
      style={combinedStyle}
      onClick={onClick}
      data-textbox-id={textBox.id}
    >
      {content}
    </div>
  );
}

/**
 * Build CSS styles for the text box
 */
function buildTextBoxStyle(textBox: TextBoxType, selected: boolean): CSSProperties {
  const style: CSSProperties = {
    display: 'block',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };

  // Dimensions
  const { width, height } = getTextBoxDimensionsPx(textBox);
  if (width > 0) {
    style.width = `${width}px`;
  }
  if (height > 0) {
    style.height = `${height}px`;
  }

  // Background/fill
  if (hasTextBoxFill(textBox)) {
    const fillColor = resolveTextBoxFillColor(textBox);
    if (fillColor) {
      style.backgroundColor = fillColor;
    }
  }

  // Border/outline
  if (hasTextBoxOutline(textBox)) {
    const outlineColor = resolveTextBoxOutlineColor(textBox) || '#000000';
    const outlineWidth = getTextBoxOutlineWidthPx(textBox) || 1;
    style.border = `${outlineWidth}px solid ${outlineColor}`;
  }

  // Internal margins/padding
  const margins = getTextBoxMarginsPx(textBox);
  style.padding = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;

  // Positioning for floating text boxes
  if (isFloatingTextBox(textBox) && textBox.position) {
    style.position = 'absolute';

    // Horizontal position
    const hPos = textBox.position.horizontal;
    if (hPos.posOffset !== undefined) {
      style.left = `${emuToPixels(hPos.posOffset)}px`;
    } else if (hPos.alignment === 'left') {
      style.left = '0';
    } else if (hPos.alignment === 'right') {
      style.right = '0';
    } else if (hPos.alignment === 'center') {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    }

    // Vertical position
    const vPos = textBox.position.vertical;
    if (vPos.posOffset !== undefined) {
      style.top = `${emuToPixels(vPos.posOffset)}px`;
    } else if (vPos.alignment === 'top') {
      style.top = '0';
    } else if (vPos.alignment === 'bottom') {
      style.bottom = '0';
    } else if (vPos.alignment === 'center') {
      style.top = '50%';
      const currentTransform = style.transform || '';
      style.transform = `${currentTransform} translateY(-50%)`.trim();
    }
  }

  // Wrap mode margins
  if (textBox.wrap) {
    const wrap = textBox.wrap;
    if (wrap.distT) style.marginTop = `${emuToPixels(wrap.distT)}px`;
    if (wrap.distB) style.marginBottom = `${emuToPixels(wrap.distB)}px`;
    if (wrap.distL) style.marginLeft = `${emuToPixels(wrap.distL)}px`;
    if (wrap.distR) style.marginRight = `${emuToPixels(wrap.distR)}px`;

    // Float for square/tight wrapping
    if (wrap.type === 'square' || wrap.type === 'tight' || wrap.type === 'through') {
      style.float = wrap.wrapText === 'left' ? 'right' : 'left';
    }

    // Z-index for behind/inFront
    if (wrap.type === 'behind') {
      style.zIndex = -1;
    } else if (wrap.type === 'inFront') {
      style.zIndex = 1;
    }
  }

  // Selected state
  if (selected) {
    Object.assign(style, SELECTED_STYLE);
    style.cursor = 'pointer';
  } else if (onClick) {
    style.cursor = 'pointer';
  }

  return style;
}

/**
 * Render text box content (paragraphs and tables)
 */
function renderContent(
  textBox: TextBoxType,
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode,
  renderTable?: (table: Table, index: number) => ReactNode
): ReactNode {
  if (!hasTextBoxContent(textBox)) {
    return null;
  }

  // TypeScript note: textBox.content is Paragraph[], but could contain tables
  // in a real implementation. For now, we treat all as paragraphs.
  return (
    <div className="docx-textbox-content">
      {textBox.content.map((item, index) => {
        if (renderParagraph) {
          return renderParagraph(item, index);
        }
        // Default placeholder
        return (
          <div key={index} className="docx-textbox-paragraph-placeholder">
            [Text content]
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if text box has any visible styling
 *
 * @param textBox - The text box to check
 * @returns true if text box has fill or outline
 */
export function hasVisibleStyling(textBox: TextBoxType): boolean {
  return hasTextBoxFill(textBox) || hasTextBoxOutline(textBox);
}

/**
 * Check if text box is empty
 *
 * @param textBox - The text box to check
 * @returns true if text box has no content
 */
export function isEmptyTextBox(textBox: TextBoxType): boolean {
  return !hasTextBoxContent(textBox);
}

/**
 * Get text box aspect ratio
 *
 * @param textBox - The text box
 * @returns Aspect ratio (width / height)
 */
export function getTextBoxAspectRatio(textBox: TextBoxType): number {
  const width = getTextBoxWidthPx(textBox);
  const height = getTextBoxHeightPx(textBox);
  if (height === 0) return 1;
  return width / height;
}

/**
 * Get description for accessibility
 *
 * @param textBox - The text box to describe
 * @returns Accessible description
 */
export function getTextBoxDescription(textBox: TextBoxType): string {
  if (!hasTextBoxContent(textBox)) {
    return 'Empty text box';
  }
  return `Text box with ${textBox.content.length} paragraph(s)`;
}

/**
 * Check if text box needs text wrapping
 *
 * @param textBox - The text box to check
 * @returns true if text should wrap around it
 */
export function needsTextWrapping(textBox: TextBoxType): boolean {
  if (!textBox.wrap) return false;
  return (
    textBox.wrap.type === 'square' ||
    textBox.wrap.type === 'tight' ||
    textBox.wrap.type === 'through'
  );
}

/**
 * Check if text box is behind text
 *
 * @param textBox - The text box to check
 * @returns true if text box is behind text layer
 */
export function isBehindText(textBox: TextBoxType): boolean {
  return textBox.wrap?.type === 'behind';
}

/**
 * Check if text box is in front of text
 *
 * @param textBox - The text box to check
 * @returns true if text box is in front of text layer
 */
export function isInFrontOfText(textBox: TextBoxType): boolean {
  return textBox.wrap?.type === 'inFront';
}

// Re-export utility functions from parser
export {
  getTextBoxWidthPx,
  getTextBoxHeightPx,
  getTextBoxDimensionsPx,
  getTextBoxMarginsPx,
  isFloatingTextBox,
  hasTextBoxFill,
  hasTextBoxOutline,
  hasTextBoxContent,
  resolveTextBoxFillColor,
  resolveTextBoxOutlineColor,
  getTextBoxOutlineWidthPx,
};

export default TextBox;
