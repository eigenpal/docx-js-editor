/**
 * Annotation Panel Component
 *
 * Displays template annotations anchored to their positions in the document,
 * like Google Docs comments. Scopes (loops/conditionals) are collapsed to
 * show nested variables inline.
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import type { PluginPanelProps } from '../../../plugin-api/types';
import type { TemplatePluginState, TemplateSchema, TemplateElement } from '../types';
import { ELEMENT_COLORS } from '../types';
import { ANNOTATION_CARD_STYLES } from './AnnotationCard';
import { setHoveredElement, setSelectedElement } from '../prosemirror-plugin';

export interface AnnotationPanelProps extends PluginPanelProps<TemplatePluginState> {
  // Additional props can be added here
}

interface GroupedAnnotation {
  /** Main element (variable or scope start) */
  element: TemplateElement;
  /** Nested variables if this is a scope */
  nestedVariables: TemplateElement[];
  /** Position */
  top: number;
}

/**
 * Group elements: show scope starts with their nested variables,
 * skip scope ends and nested variables as separate items.
 */
function groupElements(schema: TemplateSchema): TemplateElement[] {
  const scopeElementIds = new Set<string>();

  // Collect IDs of elements inside scopes (nested variables) and scope ends
  for (const scope of schema.scopes) {
    // Mark all variables inside this scope
    for (const v of scope.variables) {
      scopeElementIds.add(v.id);
    }
    // Mark the end element
    if (scope.endElement) {
      scopeElementIds.add(scope.endElement.id);
    }
  }

  // Return only elements that are NOT inside a scope (top-level vars and scope starts)
  return schema.elements.filter((el) => !scopeElementIds.has(el.id));
}

/**
 * Get nested variables for a scope start element.
 */
function getNestedVariables(element: TemplateElement, schema: TemplateSchema): TemplateElement[] {
  if (
    element.type !== 'loopStart' &&
    element.type !== 'conditionalStart' &&
    element.type !== 'invertedStart'
  ) {
    return [];
  }

  // Find the scope for this element
  const scope = schema.scopes.find((s) => s.startElement.id === element.id);
  if (!scope) return [];

  return scope.variables;
}

export function AnnotationPanel({ editorView, pluginState, selectRange }: AnnotationPanelProps) {
  const schema = pluginState?.schema ?? null;
  const hoveredElementId = pluginState?.hoveredElementId;
  const selectedElementId = pluginState?.selectedElementId;

  const [annotations, setAnnotations] = useState<GroupedAnnotation[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get grouped elements (scope starts + top-level variables)
  const groupedElements = useMemo(() => {
    if (!schema) return [];
    return groupElements(schema);
  }, [schema]);

  // Find the scroll container
  const findScrollContainer = useCallback((element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;
    let current: HTMLElement | null = element.parentElement;
    while (current) {
      const style = window.getComputedStyle(current);
      if (style.overflow === 'auto' || style.overflowY === 'auto') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }, []);

  // Calculate positions
  const updatePositions = useCallback(() => {
    if (!editorView || !schema || groupedElements.length === 0) {
      setAnnotations([]);
      return;
    }

    const panelContainer = containerRef.current;
    if (!panelContainer) {
      setAnnotations([]);
      return;
    }
    const panelRect = panelContainer.getBoundingClientRect();

    const grouped: GroupedAnnotation[] = [];

    for (const element of groupedElements) {
      try {
        const coords = editorView.coordsAtPos(element.from);
        if (coords) {
          // Don't clamp - allow negative values so annotations scroll out of view
          const top = coords.top - panelRect.top;
          grouped.push({
            element,
            nestedVariables: getNestedVariables(element, schema),
            top,
          });
        }
      } catch (_e) {
        // Position might be invalid
      }
    }

    // Sort by position
    grouped.sort((a, b) => a.top - b.top);

    // Adjust positions to prevent overlaps
    const minGap = 6;
    for (let i = 1; i < grouped.length; i++) {
      const prev = grouped[i - 1];
      const curr = grouped[i];
      // Calculate previous card height: base + nested rows
      const baseHeight = prev.nestedVariables.length > 0 ? 54 : 28;
      const nestedHeight =
        prev.nestedVariables.length > 0 ? Math.ceil(prev.nestedVariables.length / 3) * 24 : 0;
      const prevHeight = baseHeight + nestedHeight + minGap;
      if (curr.top < prev.top + prevHeight) {
        curr.top = prev.top + prevHeight;
      }
    }

    setAnnotations(grouped);
  }, [editorView, schema, groupedElements]);

  // Update on scroll
  useEffect(() => {
    updatePositions();

    if (editorView) {
      const scrollContainer = findScrollContainer(editorView.dom);
      if (scrollContainer) {
        const handleScroll = () => {
          requestAnimationFrame(updatePositions);
        };
        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
      }
    }
  }, [updatePositions, editorView, findScrollContainer]);

  // Update on resize
  useEffect(() => {
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [updatePositions]);

  // Handle hover
  const handleHover = (elementId: string | undefined) => {
    if (editorView) {
      setHoveredElement(editorView, elementId);
    }
  };

  // Handle click
  const handleClick = (elementId: string) => {
    if (!editorView || !schema) return;

    const element = schema.elements.find((el) => el.id === elementId);
    if (!element) return;

    setSelectedElement(editorView, elementId);
    selectRange(element.from, element.to);
  };

  if (!schema || schema.elements.length === 0) {
    return null;
  }

  // Get color for element type
  const getColor = (el: TemplateElement) => ELEMENT_COLORS[el.type];

  // Get type info for display
  const getTypeInfo = (
    el: TemplateElement
  ): { label: string; className: string; description: string } => {
    switch (el.type) {
      case 'loopStart':
      case 'conditionalStart':
        return {
          label: 'LOOP/IF',
          className: 'section',
          description: 'Loop or conditional section',
        };
      case 'invertedStart':
        return {
          label: 'IF NOT',
          className: 'inverted',
          description: 'Inverted section (shows when falsy)',
        };
      case 'variable':
      case 'nestedVariable':
        return { label: '', className: 'variable', description: 'Variable' };
      case 'rawVariable':
        return { label: 'HTML', className: 'raw', description: 'Raw HTML' };
      default:
        return { label: '', className: 'variable', description: '' };
    }
  };

  // Check if element is a scope (loop/conditional)
  const isScope = (el: TemplateElement) =>
    el.type === 'loopStart' || el.type === 'conditionalStart' || el.type === 'invertedStart';

  return (
    <div className="template-panel" ref={containerRef}>
      <div className="template-panel-annotations">
        {annotations.map(({ element, nestedVariables, top }) => {
          const typeInfo = getTypeInfo(element);
          const hasNested = isScope(element) && nestedVariables.length > 0;

          return (
            <div
              key={element.id}
              className="template-annotation-anchor"
              style={{ top: `${top}px` }}
            >
              <div className="template-annotation-connector" />
              <div
                className={`template-annotation-chip template-chip-${typeInfo.className} ${element.id === hoveredElementId ? 'hovered' : ''} ${element.id === selectedElementId ? 'selected' : ''}`}
                style={{ '--accent-color': getColor(element) } as React.CSSProperties}
                onMouseEnter={() => handleHover(element.id)}
                onMouseLeave={() => handleHover(undefined)}
                onClick={() => handleClick(element.id)}
                title={typeInfo.description}
              >
                {/* Type badge for scopes */}
                {typeInfo.label && <span className="template-chip-badge">{typeInfo.label}</span>}

                {/* Variable name */}
                <span className="template-chip-name">{element.name}</span>

                {/* Nested variables for scopes */}
                {hasNested && (
                  <div className="template-chip-nested">
                    {nestedVariables.map((v) => (
                      <span
                        key={v.id}
                        className={`template-nested-var ${v.id === hoveredElementId ? 'hovered' : ''}`}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          handleHover(v.id);
                        }}
                        onMouseLeave={(e) => {
                          e.stopPropagation();
                          handleHover(undefined);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick(v.id);
                        }}
                        title="Variable inside scope"
                      >
                        {v.name.includes('.') ? v.name.split('.').pop() : v.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * CSS styles for the annotation panel.
 */
export const ANNOTATION_PANEL_STYLES = `
${ANNOTATION_CARD_STYLES}

.template-panel {
  display: flex;
  min-height: 100%;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
}

.template-panel-annotations {
  flex: 1;
  position: relative;
  overflow: visible;
  min-height: 100%;
  pointer-events: none;
}

.template-panel-annotations > * {
  pointer-events: auto;
}

.template-annotation-anchor {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
}

.template-annotation-connector {
  width: 20px;
  height: 1px;
  background: #d0d0d0;
  margin-top: 12px;
  margin-right: 4px;
  flex-shrink: 0;
}

.template-annotation-anchor:hover .template-annotation-connector {
  background: #3b82f6;
}

/* Annotation chip - base */
.template-annotation-chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: white;
  border: 1px solid #e2e8f0;
  border-left: 3px solid var(--accent-color, #6c757d);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  max-width: 200px;
}

.template-annotation-chip:hover,
.template-annotation-chip.hovered {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e1;
}

.template-annotation-chip.selected {
  box-shadow: 0 0 0 2px var(--accent-color, #3b82f6);
}

/* Type badge */
.template-chip-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Variable chip - simple yellow dot */
.template-chip-variable {
  border-left-color: #f59e0b;
}
.template-chip-variable .template-chip-name::before {
  content: '●';
  color: #f59e0b;
  margin-right: 4px;
  font-size: 8px;
}

/* Section chip - blue with # badge */
.template-chip-section {
  border-left-color: #3b82f6;
  background: linear-gradient(to right, #eff6ff, white);
}
.template-chip-section .template-chip-badge {
  background: #3b82f6;
  color: white;
  font-weight: 700;
  font-size: 11px;
}

/* Inverted conditional - purple with IF NOT badge */
.template-chip-inverted {
  border-left-color: #8b5cf6;
  background: linear-gradient(to right, #f5f3ff, white);
}
.template-chip-inverted .template-chip-badge {
  background: #8b5cf6;
  color: white;
}

/* Raw HTML - red */
.template-chip-raw {
  border-left-color: #ef4444;
  background: linear-gradient(to right, #fef2f2, white);
}
.template-chip-raw .template-chip-badge {
  background: #ef4444;
  color: white;
}

.template-chip-name {
  color: #334155;
  font-weight: 500;
}

/* Nested variables */
.template-chip-nested {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.template-nested-var {
  font-size: 10px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
}

.template-nested-var:hover,
.template-nested-var.hovered {
  background: rgba(59, 130, 246, 0.15);
  color: #1e40af;
}
`;
