/**
 * Annotation Card Component
 *
 * Displays information about a single template element.
 */

import type { TemplateElement, TemplateScope, TemplateElementType } from '../types';
import { ELEMENT_COLORS, ELEMENT_ICONS } from '../types';

export interface AnnotationCardProps {
  /** The template element to display */
  element: TemplateElement;

  /** The scope this element belongs to (if any) */
  scope?: TemplateScope;

  /** Full data path for the element */
  dataPath?: string;

  /** Whether this card is currently hovered */
  isHovered?: boolean;

  /** Whether this card is currently selected */
  isSelected?: boolean;

  /** Callback when card is hovered */
  onHover?: (elementId: string | undefined) => void;

  /** Callback when card is clicked */
  onClick?: (elementId: string) => void;
}

/**
 * Get the label for an element type.
 */
function getTypeLabel(type: TemplateElementType): string {
  switch (type) {
    case 'variable':
      return 'Variable';
    case 'nestedVariable':
      return 'Nested Variable';
    case 'loopStart':
      return 'LOOP START';
    case 'loopEnd':
      return 'LOOP END';
    case 'conditionalStart':
      return 'CONDITION START';
    case 'conditionalEnd':
      return 'CONDITION END';
    case 'invertedStart':
      return 'INVERTED CONDITION';
    case 'invertedEnd':
      return 'CONDITION END';
    case 'rawVariable':
      return 'Raw HTML';
    case 'invalid':
      return 'Invalid Tag';
    default:
      return 'Unknown';
  }
}

/**
 * Get additional description for an element.
 */
function getDescription(element: TemplateElement, _scope?: TemplateScope): string {
  switch (element.type) {
    case 'variable':
    case 'nestedVariable':
      return `Type: string`;
    case 'loopStart':
      return `Iterates over: data.${element.name}[]`;
    case 'loopEnd':
      return `End of loop`;
    case 'conditionalStart':
      return `Shows if data.${element.name} is truthy`;
    case 'conditionalEnd':
      return `End of condition`;
    case 'invertedStart':
      return `Shows if data.${element.name} is falsy`;
    case 'invertedEnd':
      return `End of inverted condition`;
    case 'rawVariable':
      return `Type: HTML string (unescaped)`;
    case 'invalid':
      return element.validationError || 'Invalid template syntax';
    default:
      return '';
  }
}

export function AnnotationCard({
  element,
  scope,
  dataPath,
  isHovered = false,
  isSelected = false,
  onHover,
  onClick,
}: AnnotationCardProps) {
  const icon = ELEMENT_ICONS[element.type];
  const color = ELEMENT_COLORS[element.type];
  const label = getTypeLabel(element.type);
  const description = getDescription(element, scope);

  const isError = !element.isValid;

  return (
    <div
      className={`template-annotation-card ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''} ${isError ? 'error' : ''}`}
      style={
        {
          '--accent-color': color,
        } as React.CSSProperties
      }
      onMouseEnter={() => onHover?.(element.id)}
      onMouseLeave={() => onHover?.(undefined)}
      onClick={() => onClick?.(element.id)}
    >
      <div className="template-annotation-header">
        <span className="template-annotation-icon" style={{ color }}>
          {icon}
        </span>
        <span className="template-annotation-label">
          {label}: <strong>{element.name}</strong>
        </span>
      </div>

      <div className="template-annotation-body">
        <div className="template-annotation-description">{description}</div>

        {dataPath && (
          <div className="template-annotation-path">
            Path: <code>{dataPath}</code>
          </div>
        )}

        {element.validationError && (
          <div className="template-annotation-error">⚠ {element.validationError}</div>
        )}
      </div>
    </div>
  );
}

/**
 * CSS styles for annotation cards.
 */
export const ANNOTATION_CARD_STYLES = `
.template-annotation-card {
  background: white;
  border: 1px solid #e9ecef;
  border-left: 3px solid var(--accent-color, #6c757d);
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  font-size: 12px;
}

.template-annotation-card:hover,
.template-annotation-card.hovered {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--accent-color, #6c757d);
}

.template-annotation-card.selected {
  box-shadow: 0 0 0 2px var(--accent-color, #6c757d);
}

.template-annotation-card.error {
  border-left-color: #dc3545;
  background: #fff5f5;
}

.template-annotation-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.template-annotation-icon {
  font-size: 14px;
  font-weight: bold;
}

.template-annotation-label {
  color: #495057;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-annotation-label strong {
  color: #212529;
  font-weight: 600;
  text-transform: none;
}

.template-annotation-body {
  padding-left: 20px;
}

.template-annotation-description {
  color: #6c757d;
  font-size: 11px;
  margin-bottom: 4px;
}

.template-annotation-path {
  color: #868e96;
  font-size: 10px;
}

.template-annotation-path code {
  background: #f1f3f4;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 10px;
}

.template-annotation-error {
  color: #dc3545;
  font-size: 11px;
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(220, 53, 69, 0.1);
  border-radius: 3px;
}
`;
