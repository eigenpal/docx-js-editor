/**
 * Field Component
 *
 * Renders dynamic field content from DOCX documents.
 * Fields display computed or placeholder values like:
 * - Page numbers (PAGE, NUMPAGES)
 * - Dates and times (DATE, TIME, CREATEDATE)
 * - Document properties (AUTHOR, TITLE, FILENAME)
 * - Cross-references (REF, PAGEREF, NOTEREF)
 * - Mail merge fields (MERGEFIELD)
 *
 * Features:
 * - Displays current field value from document
 * - Styled to indicate dynamic content (subtle background)
 * - Placeholder display for page numbers until pagination
 * - Tooltip showing field instruction on hover
 * - Supports both simple and complex fields
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Field as FieldType,
  SimpleField,
  ComplexField,
  Run as RunType,
  Theme,
} from '../../types/document';
import { Run } from './Run';
import {
  getFieldDisplayValue,
  isPageNumberField,
  isTotalPagesField,
  isDateTimeField,
  isDocPropertyField,
  isReferenceField,
  isMergeField,
  isTocField,
  parseFieldInstruction,
} from '../../docx/fieldParser';

/**
 * Props for the Field component
 */
export interface FieldProps {
  /** The field data to render */
  field: FieldType;
  /** Theme for resolving colors and fonts in child runs */
  theme?: Theme | null;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Current page number (for PAGE field) */
  pageNumber?: number;
  /** Total page count (for NUMPAGES field) */
  totalPages?: number;
  /** Whether to show field code instead of result */
  showFieldCode?: boolean;
  /** Whether to highlight the field (for editing mode) */
  highlighted?: boolean;
  /** Callback when field is clicked (for editing/updating) */
  onClick?: () => void;
}

/**
 * Base field style with subtle background to indicate dynamic content
 */
const FIELD_STYLE: CSSProperties = {
  backgroundColor: 'rgba(200, 220, 255, 0.3)',
  borderRadius: '2px',
  padding: '0 2px',
  display: 'inline',
};

/**
 * Style for highlighted/selected fields
 */
const HIGHLIGHTED_FIELD_STYLE: CSSProperties = {
  ...FIELD_STYLE,
  backgroundColor: 'rgba(100, 150, 255, 0.3)',
  outline: '1px solid rgba(100, 150, 255, 0.5)',
};

/**
 * Style for page number placeholders
 */
const PAGE_NUMBER_STYLE: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'inherit',
};

/**
 * Field component - renders dynamic field values
 */
export function Field({
  field,
  theme,
  className,
  style: additionalStyle,
  pageNumber,
  totalPages,
  showFieldCode = false,
  highlighted = false,
  onClick,
}: FieldProps): React.ReactElement {
  // Build class names
  const classNames: string[] = ['docx-field'];
  if (className) {
    classNames.push(className);
  }

  // Add field type-specific class
  classNames.push(`docx-field-${field.fieldType.toLowerCase()}`);

  // Add type category classes
  if (isPageNumberField(field)) classNames.push('docx-field-page');
  if (isTotalPagesField(field)) classNames.push('docx-field-numpages');
  if (isDateTimeField(field)) classNames.push('docx-field-datetime');
  if (isDocPropertyField(field)) classNames.push('docx-field-docprop');
  if (isReferenceField(field)) classNames.push('docx-field-reference');
  if (isMergeField(field)) classNames.push('docx-field-merge');
  if (isTocField(field)) classNames.push('docx-field-toc');

  if (highlighted) classNames.push('docx-field-highlighted');
  if (onClick) classNames.push('docx-field-clickable');

  // Combine styles
  const baseStyle = highlighted ? HIGHLIGHTED_FIELD_STYLE : FIELD_STYLE;
  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...additionalStyle,
    ...(onClick && { cursor: 'pointer' }),
  };

  // Get tooltip text (field instruction)
  const tooltipText = field.instruction;

  // Determine content to render
  let content: ReactNode;

  if (showFieldCode) {
    // Show field code (instruction) instead of result
    content = renderFieldCode(field, theme);
  } else {
    // Show field result/value
    content = renderFieldValue(field, theme, pageNumber, totalPages);
  }

  return (
    <span
      className={classNames.join(' ')}
      style={combinedStyle}
      title={tooltipText}
      onClick={onClick}
      data-field-type={field.fieldType}
      data-field-instruction={field.instruction}
    >
      {content}
    </span>
  );
}

/**
 * Render the field's display value/result
 */
function renderFieldValue(
  field: FieldType,
  theme: Theme | null | undefined,
  pageNumber?: number,
  totalPages?: number
): ReactNode {
  // Handle special fields with dynamic values
  if (isPageNumberField(field)) {
    // Page number - use provided value or placeholder
    const value = pageNumber ?? '#';
    return (
      <span className="docx-field-page-value" style={PAGE_NUMBER_STYLE}>
        {value}
      </span>
    );
  }

  if (isTotalPagesField(field)) {
    // Total pages - use provided value or placeholder
    const value = totalPages ?? '#';
    return (
      <span className="docx-field-numpages-value" style={PAGE_NUMBER_STYLE}>
        {value}
      </span>
    );
  }

  // For other fields, render their content/result runs
  if (field.type === 'simpleField') {
    return renderSimpleFieldContent(field, theme);
  } else {
    return renderComplexFieldResult(field, theme);
  }
}

/**
 * Render simple field content (child runs)
 */
function renderSimpleFieldContent(
  field: SimpleField,
  theme: Theme | null | undefined
): ReactNode {
  if (field.content.length === 0) {
    // No content - show placeholder based on field type
    return renderFieldPlaceholder(field);
  }

  return (
    <>
      {field.content.map((item, index) => {
        if ('content' in item && item.type === 'run') {
          return <Run key={index} run={item as RunType} theme={theme} />;
        }
        // Hyperlink content would be rendered here if needed
        return null;
      })}
    </>
  );
}

/**
 * Render complex field result runs
 */
function renderComplexFieldResult(
  field: ComplexField,
  theme: Theme | null | undefined
): ReactNode {
  if (field.fieldResult.length === 0) {
    // No result - show placeholder
    return renderFieldPlaceholder(field);
  }

  return (
    <>
      {field.fieldResult.map((run, index) => (
        <Run key={index} run={run} theme={theme} />
      ))}
    </>
  );
}

/**
 * Render field code (instruction) for display
 */
function renderFieldCode(
  field: FieldType,
  theme: Theme | null | undefined
): ReactNode {
  const instruction = field.instruction;

  if (field.type === 'complexField' && field.fieldCode.length > 0) {
    // Render the actual code runs
    return (
      <span className="docx-field-code">
        {field.fieldCode.map((run, index) => (
          <Run key={index} run={run} theme={theme} />
        ))}
      </span>
    );
  }

  // For simple fields or fields without code runs, show instruction text
  return (
    <span className="docx-field-code" style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
      {`{ ${instruction} }`}
    </span>
  );
}

/**
 * Render a placeholder for fields without content
 */
function renderFieldPlaceholder(field: FieldType): ReactNode {
  const parsed = parseFieldInstruction(field.instruction);

  // Generate appropriate placeholder based on field type
  switch (field.fieldType) {
    case 'PAGE':
      return '#';
    case 'NUMPAGES':
      return '#';
    case 'DATE':
    case 'TIME':
    case 'CREATEDATE':
    case 'SAVEDATE':
    case 'PRINTDATE':
      return '...';
    case 'AUTHOR':
      return '[Author]';
    case 'TITLE':
      return '[Title]';
    case 'SUBJECT':
      return '[Subject]';
    case 'FILENAME':
      return '[Filename]';
    case 'MERGEFIELD':
      // Show the merge field name
      return `«${parsed.argument ?? 'field'}»`;
    case 'REF':
    case 'PAGEREF':
    case 'NOTEREF':
      return '[Ref]';
    case 'TOC':
      return '[Table of Contents]';
    case 'INDEX':
      return '[Index]';
    default:
      return `[${field.fieldType}]`;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the display text of a field (re-exported from parser)
 */
export { getFieldDisplayValue };

/**
 * Check if a field needs updating (marked dirty)
 *
 * @param field - The field to check
 * @returns true if field is marked dirty
 */
export function isFieldDirty(field: FieldType): boolean {
  return field.dirty === true;
}

/**
 * Check if a field is locked (cannot be updated)
 *
 * @param field - The field to check
 * @returns true if field is locked
 */
export function isFieldLocked(field: FieldType): boolean {
  return field.fldLock === true;
}

/**
 * Check if a field is a simple field (vs complex)
 *
 * @param field - The field to check
 * @returns true if this is a simple field
 */
export function isSimpleField(field: FieldType): field is SimpleField {
  return field.type === 'simpleField';
}

/**
 * Check if a field is a complex field
 *
 * @param field - The field to check
 * @returns true if this is a complex field
 */
export function isComplexField(field: FieldType): field is ComplexField {
  return field.type === 'complexField';
}

/**
 * Get field category for grouping/styling
 *
 * @param field - The field to categorize
 * @returns Category string
 */
export function getFieldCategory(field: FieldType): string {
  if (isPageNumberField(field) || isTotalPagesField(field)) {
    return 'pagination';
  }
  if (isDateTimeField(field)) {
    return 'datetime';
  }
  if (isDocPropertyField(field)) {
    return 'docproperty';
  }
  if (isReferenceField(field)) {
    return 'reference';
  }
  if (isMergeField(field)) {
    return 'merge';
  }
  if (isTocField(field)) {
    return 'navigation';
  }
  return 'other';
}

/**
 * Get a human-readable description of a field
 *
 * @param field - The field to describe
 * @returns Description string
 */
export function getFieldDescription(field: FieldType): string {
  const parsed = parseFieldInstruction(field.instruction);

  switch (field.fieldType) {
    case 'PAGE':
      return 'Current page number';
    case 'NUMPAGES':
      return 'Total number of pages';
    case 'DATE':
      return 'Current date';
    case 'TIME':
      return 'Current time';
    case 'CREATEDATE':
      return 'Document creation date';
    case 'SAVEDATE':
      return 'Last save date';
    case 'AUTHOR':
      return 'Document author';
    case 'TITLE':
      return 'Document title';
    case 'FILENAME':
      return 'Document filename';
    case 'MERGEFIELD':
      return `Mail merge field: ${parsed.argument ?? 'unknown'}`;
    case 'REF':
      return `Cross-reference to: ${parsed.argument ?? 'unknown'}`;
    case 'PAGEREF':
      return `Page reference to: ${parsed.argument ?? 'unknown'}`;
    case 'TOC':
      return 'Table of Contents';
    default:
      return `Field: ${field.fieldType}`;
  }
}

/**
 * Check if field should show a placeholder value
 *
 * @param field - The field to check
 * @returns true if field has no computed value yet
 */
export function needsPlaceholder(field: FieldType): boolean {
  if (field.type === 'simpleField') {
    return field.content.length === 0;
  } else {
    return field.fieldResult.length === 0;
  }
}

export default Field;
