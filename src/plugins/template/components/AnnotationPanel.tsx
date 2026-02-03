/**
 * Annotation Panel Component
 *
 * Displays template annotations anchored to their positions in the document,
 * like Google Docs comments.
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import type { PluginPanelProps } from '../../../plugin-api/types';
import type { TemplatePluginState, TemplateSchema, TemplateElement, TemplateScope } from '../types';
import { ELEMENT_COLORS } from '../types';
import { AnnotationCard, ANNOTATION_CARD_STYLES } from './AnnotationCard';
import { getFullDataPath } from '../schema-inferrer';
import { setHoveredElement, setSelectedElement } from '../prosemirror-plugin';

export interface AnnotationPanelProps extends PluginPanelProps<TemplatePluginState> {
  // Additional props can be added here
}

interface ElementPosition {
  element: TemplateElement;
  dataPath: string;
  top: number;
}

interface ScopePosition {
  scope: TemplateScope;
  startTop: number;
  endTop: number;
}

/**
 * Get elements sorted by position with their data paths.
 */
function getElementsWithPaths(
  schema: TemplateSchema
): Array<{ element: TemplateElement; dataPath: string }> {
  return schema.elements.map((element) => ({
    element,
    dataPath: getFullDataPath(element, schema.scopes),
  }));
}

export function AnnotationPanel({ editorView, pluginState, selectRange }: AnnotationPanelProps) {
  const schema = pluginState?.schema ?? null;
  const hoveredElementId = pluginState?.hoveredElementId;
  const selectedElementId = pluginState?.selectedElementId;

  const [elementPositions, setElementPositions] = useState<ElementPosition[]>([]);
  const [scopePositions, setScopePositions] = useState<ScopePosition[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get elements with paths
  const elementsWithPaths = useMemo(() => {
    if (!schema) return [];
    return getElementsWithPaths(schema);
  }, [schema]);

  // Find the scroll container - look for ancestor with overflow:auto
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

  // Calculate element positions using coordsAtPos
  const updatePositions = useCallback(() => {
    if (!editorView || !schema || elementsWithPaths.length === 0) {
      setElementPositions([]);
      setScopePositions([]);
      return;
    }

    // Get the annotation panel container
    const panelContainer = containerRef.current;
    if (!panelContainer) {
      setElementPositions([]);
      setScopePositions([]);
      return;
    }
    const panelRect = panelContainer.getBoundingClientRect();

    const positions: ElementPosition[] = [];

    for (const { element, dataPath } of elementsWithPaths) {
      try {
        // Get screen coordinates for the element position
        const coords = editorView.coordsAtPos(element.from);
        if (coords) {
          // Calculate top relative to panel, accounting for where panel starts
          const top = coords.top - panelRect.top;
          positions.push({ element, dataPath, top: Math.max(0, top) });
        }
      } catch (_e) {
        // Position might be invalid after document changes
      }
    }

    // Sort by position and handle overlaps
    positions.sort((a, b) => a.top - b.top);

    // Adjust positions to prevent overlaps (minimum 36px apart for compact cards)
    const minGap = 36;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      if (curr.top < prev.top + minGap) {
        curr.top = prev.top + minGap;
      }
    }

    setElementPositions(positions);

    // Calculate scope positions (for loops and conditionals)
    const scopePos: ScopePosition[] = [];
    for (const scope of schema.scopes) {
      if (!scope.endElement) continue; // Skip unclosed scopes

      try {
        const startCoords = editorView.coordsAtPos(scope.startElement.from);
        const endCoords = editorView.coordsAtPos(scope.endElement.to);

        if (startCoords && endCoords) {
          scopePos.push({
            scope,
            startTop: Math.max(0, startCoords.top - panelRect.top),
            endTop: Math.max(0, endCoords.top - panelRect.top),
          });
        }
      } catch (_e) {
        // Position might be invalid
      }
    }

    setScopePositions(scopePos);
  }, [editorView, schema, elementsWithPaths]);

  // Update positions when editor state changes
  useEffect(() => {
    updatePositions();

    // Also update on scroll - find the scroll container
    if (editorView) {
      const scrollContainer = findScrollContainer(editorView.dom);
      if (scrollContainer) {
        const handleScroll = () => {
          // Use requestAnimationFrame for smooth updates
          requestAnimationFrame(updatePositions);
        };
        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
      }
    }
  }, [updatePositions, editorView, findScrollContainer]);

  // Update positions on window resize
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
    return null; // Don't show anything if no template tags
  }

  // Get scope color
  const getScopeColor = (type: 'loop' | 'conditional' | 'inverted') => {
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
  };

  return (
    <div className="template-panel" ref={containerRef}>
      {/* Scope indicators (vertical bars) */}
      <div className="template-panel-scopes">
        {scopePositions.map(({ scope, startTop, endTop }) => (
          <div
            key={scope.id}
            className={`template-scope-bar template-scope-${scope.type}`}
            style={{
              top: `${startTop + 8}px`,
              height: `${Math.max(20, endTop - startTop + 16)}px`,
              backgroundColor: getScopeColor(scope.type),
            }}
            title={`${scope.type}: ${scope.name}`}
          />
        ))}
      </div>

      {/* Anchored annotations */}
      <div className="template-panel-annotations">
        {elementPositions.map(({ element, dataPath, top }) => (
          <div key={element.id} className="template-annotation-anchor" style={{ top: `${top}px` }}>
            <div className="template-annotation-connector" />
            <AnnotationCard
              element={element}
              dataPath={dataPath}
              isHovered={element.id === hoveredElementId}
              isSelected={element.id === selectedElementId}
              onHover={handleHover}
              onClick={handleClick}
              compact
            />
          </div>
        ))}
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

.template-panel-scopes {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
}

.template-scope-bar {
  position: absolute;
  left: 2px;
  width: 3px;
  border-radius: 2px;
  opacity: 0.6;
}

.template-scope-bar:hover {
  opacity: 1;
}

.template-panel-annotations {
  flex: 1;
  position: relative;
  overflow: visible;
  min-height: 500px;
  margin-left: 8px;
}

.template-annotation-anchor {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
}

.template-annotation-connector {
  width: 12px;
  height: 1px;
  background: #d0d0d0;
  margin-top: 10px;
  margin-right: 4px;
  flex-shrink: 0;
}

.template-annotation-anchor:hover .template-annotation-connector {
  background: #3b82f6;
}
`;
