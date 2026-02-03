/**
 * Template Decorations
 *
 * Creates ProseMirror decorations for template elements and scopes.
 */

import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import type { TemplateElement, TemplateScope, TemplateElementType } from './types';
import { ELEMENT_COLORS, TEMPLATE_CLASS_PREFIX } from './types';

/**
 * Create decorations for all template elements.
 */
export function createDecorations(
  state: EditorState,
  elements: TemplateElement[],
  scopes: TemplateScope[],
  hoveredElementId?: string,
  selectedElementId?: string
): DecorationSet {
  const decorations: Decoration[] = [];

  // Add element decorations
  for (const element of elements) {
    decorations.push(...createElementDecorations(element, hoveredElementId, selectedElementId));
  }

  // Add scope region decorations
  for (const scope of scopes) {
    decorations.push(...createScopeDecorations(scope));
  }

  return DecorationSet.create(state.doc, decorations);
}

/**
 * Create decorations for a single element.
 */
function createElementDecorations(
  element: TemplateElement,
  hoveredElementId?: string,
  selectedElementId?: string
): Decoration[] {
  const decorations: Decoration[] = [];
  const isHovered = element.id === hoveredElementId;
  const isSelected = element.id === selectedElementId;

  // Base classes
  const classes = [
    `${TEMPLATE_CLASS_PREFIX}-element`,
    `${TEMPLATE_CLASS_PREFIX}-${getTypeClass(element.type)}`,
  ];

  if (!element.isValid) {
    classes.push(`${TEMPLATE_CLASS_PREFIX}-invalid`);
  }

  if (isHovered) {
    classes.push(`${TEMPLATE_CLASS_PREFIX}-hovered`);
  }

  if (isSelected) {
    classes.push(`${TEMPLATE_CLASS_PREFIX}-selected`);
  }

  // Inline decoration for the tag itself
  decorations.push(
    Decoration.inline(element.from, element.to, {
      class: classes.join(' '),
      'data-element-id': element.id,
      'data-element-type': element.type,
      style: `background-color: ${getBackgroundColor(element.type, element.isValid)}; border-radius: 3px; padding: 0 2px;`,
    })
  );

  return decorations;
}

/**
 * Create decorations for a scope region.
 */
function createScopeDecorations(scope: TemplateScope): Decoration[] {
  const decorations: Decoration[] = [];

  // Only add scope decoration if the scope is closed
  if (!scope.endElement) return decorations;

  // Create a widget decoration at the start of content to show scope indicator
  decorations.push(
    Decoration.widget(scope.contentFrom, createScopeMarker(scope.type, 'start'), {
      side: -1, // Before content
      key: `scope-start-${scope.id}`,
    })
  );

  // Create a widget decoration at the end of content
  decorations.push(
    Decoration.widget(scope.contentTo, createScopeMarker(scope.type, 'end'), {
      side: 1, // After content
      key: `scope-end-${scope.id}`,
    })
  );

  return decorations;
}

/**
 * Create a scope marker DOM element.
 */
function createScopeMarker(
  type: 'loop' | 'conditional' | 'inverted',
  position: 'start' | 'end'
): () => HTMLElement {
  return () => {
    const marker = document.createElement('span');
    marker.className = `${TEMPLATE_CLASS_PREFIX}-scope-marker ${TEMPLATE_CLASS_PREFIX}-scope-${type} ${TEMPLATE_CLASS_PREFIX}-scope-${position}`;
    marker.style.cssText = `
      display: inline-block;
      width: 4px;
      height: 1em;
      background-color: ${getScopeColor(type)};
      opacity: 0.3;
      margin: 0 2px;
      vertical-align: middle;
    `;
    return marker;
  };
}

/**
 * Get CSS class for element type.
 */
function getTypeClass(type: TemplateElementType): string {
  switch (type) {
    case 'variable':
    case 'nestedVariable':
      return 'variable';
    case 'loopStart':
    case 'loopEnd':
      return 'loop';
    case 'conditionalStart':
    case 'conditionalEnd':
      return 'conditional';
    case 'invertedStart':
    case 'invertedEnd':
      return 'inverted';
    case 'rawVariable':
      return 'raw';
    case 'invalid':
      return 'invalid';
    default:
      return 'unknown';
  }
}

/**
 * Get background color for element type.
 */
function getBackgroundColor(type: TemplateElementType, isValid: boolean): string {
  if (!isValid) {
    return 'rgba(220, 53, 69, 0.2)'; // Red for invalid
  }

  const color = ELEMENT_COLORS[type];
  // Return with transparency
  return hexToRgba(color, 0.25);
}

/**
 * Get color for scope type.
 */
function getScopeColor(type: 'loop' | 'conditional' | 'inverted'): string {
  switch (type) {
    case 'loop':
      return ELEMENT_COLORS.loopStart;
    case 'conditional':
      return ELEMENT_COLORS.conditionalStart;
    case 'inverted':
      return ELEMENT_COLORS.invertedStart;
    default:
      return '#666';
  }
}

/**
 * Convert hex color to rgba.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * CSS styles for template decorations.
 */
export const TEMPLATE_DECORATION_STYLES = `
/* Template element base styles */
.${TEMPLATE_CLASS_PREFIX}-element {
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.${TEMPLATE_CLASS_PREFIX}-element:hover {
  filter: brightness(0.95);
}

/* Element type styles */
.${TEMPLATE_CLASS_PREFIX}-variable {
  color: #856404;
}

.${TEMPLATE_CLASS_PREFIX}-loop {
  color: #004085;
  font-weight: 500;
}

.${TEMPLATE_CLASS_PREFIX}-conditional {
  color: #155724;
  font-weight: 500;
}

.${TEMPLATE_CLASS_PREFIX}-inverted {
  color: #6f42c1;
  font-weight: 500;
}

.${TEMPLATE_CLASS_PREFIX}-raw {
  color: #721c24;
  font-style: italic;
}

.${TEMPLATE_CLASS_PREFIX}-invalid {
  color: #721c24;
  text-decoration: wavy underline red;
}

/* Hovered state */
.${TEMPLATE_CLASS_PREFIX}-hovered {
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.5);
}

/* Selected state */
.${TEMPLATE_CLASS_PREFIX}-selected {
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.8);
}

/* Scope markers */
.${TEMPLATE_CLASS_PREFIX}-scope-marker {
  user-select: none;
  pointer-events: none;
}

/* Scope region styles using CSS pseudo-elements would need a wrapper approach */
`;
