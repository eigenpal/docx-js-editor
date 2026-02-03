/**
 * Annotation Panel Component
 *
 * Displays template annotations anchored to their positions in the document,
 * like Google Docs comments.
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import type { PluginPanelProps } from '../../../plugin-api/types';
import type { TemplatePluginState, TemplateSchema, TemplateElement } from '../types';
import { AnnotationCard, ANNOTATION_CARD_STYLES } from './AnnotationCard';
import { toTypeScriptInterface, getFullDataPath } from '../schema-inferrer';
import { setHoveredElement, setSelectedElement } from '../prosemirror-plugin';

export interface AnnotationPanelProps extends PluginPanelProps<TemplatePluginState> {
  // Additional props can be added here
}

interface ElementPosition {
  element: TemplateElement;
  dataPath: string;
  top: number;
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
  const [showSchema, setShowSchema] = useState(false);
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
      return;
    }

    // Get the annotation panel container
    const panelContainer = containerRef.current;
    if (!panelContainer) {
      setElementPositions([]);
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

  // Get TypeScript interface
  const typeScriptInterface = useMemo(() => {
    if (!schema) return '';
    return toTypeScriptInterface(schema.dataStructure);
  }, [schema]);

  // Count statistics
  const stats = useMemo(() => {
    if (!schema) return { variables: 0, loops: 0, conditions: 0, errors: 0 };

    let variables = 0;
    let loops = 0;
    let conditions = 0;

    for (const element of schema.elements) {
      if (
        element.type === 'variable' ||
        element.type === 'nestedVariable' ||
        element.type === 'rawVariable'
      ) {
        variables++;
      } else if (element.type === 'loopStart') {
        loops++;
      } else if (element.type === 'conditionalStart' || element.type === 'invertedStart') {
        conditions++;
      }
    }

    return {
      variables,
      loops,
      conditions,
      errors: schema.errors.length,
    };
  }, [schema]);

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
    return (
      <div className="template-panel template-panel-empty">
        <div className="template-panel-empty-icon">📝</div>
        <div className="template-panel-empty-text">No template tags found</div>
        <div className="template-panel-empty-hint">
          Use {'{variable}'} for variables, {'{#list}...{/list}'} for loops
        </div>
      </div>
    );
  }

  return (
    <div className="template-panel" ref={containerRef}>
      {/* Compact header with stats */}
      <div className="template-panel-header">
        <div className="template-panel-stats">
          <span className="stat stat-variables" title="Variables">
            ● {stats.variables}
          </span>
          <span className="stat stat-loops" title="Loops">
            ⟳ {stats.loops}
          </span>
          <span className="stat stat-conditions" title="Conditions">
            ? {stats.conditions}
          </span>
          {stats.errors > 0 && (
            <span className="stat stat-errors" title="Errors">
              ⚠ {stats.errors}
            </span>
          )}
        </div>
        <button
          className="template-panel-schema-toggle"
          onClick={() => setShowSchema(!showSchema)}
          title={showSchema ? 'Hide schema' : 'Show schema'}
        >
          {showSchema ? '▼' : '▶'} Schema
        </button>
      </div>

      {/* Collapsible TypeScript interface */}
      {showSchema && (
        <div className="template-panel-schema">
          <div className="template-panel-schema-header">
            <span>Expected Data Structure</span>
            <button
              className="template-panel-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(typeScriptInterface);
              }}
              title="Copy TypeScript interface"
            >
              📋
            </button>
          </div>
          <pre className="template-panel-schema-code">{typeScriptInterface}</pre>
        </div>
      )}

      {/* Error summary */}
      {schema.errors.length > 0 && (
        <div className="template-panel-errors">
          <div className="template-panel-errors-header">
            ⚠ {schema.errors.length} validation {schema.errors.length === 1 ? 'error' : 'errors'}
          </div>
        </div>
      )}

      {/* Anchored annotations */}
      <div className="template-panel-annotations">
        {elementPositions.map(({ element, dataPath, top }) => (
          <div key={element.id} className="template-annotation-anchor" style={{ top: `${top}px` }}>
            {/* Connector line */}
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
  flex-direction: column;
  min-height: 100%;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
}

.template-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  background: #f8f9fa;
}

.template-panel-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.template-panel-empty-text {
  font-size: 14px;
  color: #495057;
  margin-bottom: 8px;
}

.template-panel-empty-hint {
  font-size: 12px;
  color: #868e96;
}

.template-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(248, 249, 250, 0.95);
  border-radius: 6px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.template-panel-stats {
  display: flex;
  gap: 10px;
  font-size: 11px;
}

.template-panel-stats .stat {
  display: flex;
  align-items: center;
  gap: 3px;
}

.stat-variables {
  color: #856404;
}

.stat-loops {
  color: #004085;
}

.stat-conditions {
  color: #155724;
}

.stat-errors {
  color: #dc3545;
}

.template-panel-schema-toggle {
  background: none;
  border: none;
  font-size: 11px;
  color: #6c757d;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
}

.template-panel-schema-toggle:hover {
  background: #e9ecef;
  color: #495057;
}

.template-panel-errors {
  padding: 6px 12px;
  background: rgba(220, 53, 69, 0.1);
  border-bottom: 1px solid rgba(220, 53, 69, 0.2);
}

.template-panel-errors-header {
  font-size: 11px;
  color: #dc3545;
  font-weight: 500;
}

.template-panel-annotations {
  flex: 1;
  position: relative;
  overflow: visible;
  min-height: 500px;
}

.template-annotation-anchor {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  padding-left: 8px;
  transition: top 0.1s ease-out;
}

.template-annotation-connector {
  width: 12px;
  height: 2px;
  background: #dee2e6;
  margin-top: 12px;
  margin-right: 4px;
  flex-shrink: 0;
}

.template-annotation-anchor:hover .template-annotation-connector {
  background: #3b82f6;
}

.template-panel-schema {
  background: white;
  border-top: 1px solid #e9ecef;
}

.template-panel-schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: #495057;
  background: #f1f3f4;
}

.template-panel-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  font-size: 12px;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.template-panel-copy-btn:hover {
  opacity: 1;
}

.template-panel-schema-code {
  margin: 0;
  padding: 8px 12px;
  font-size: 10px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  overflow-x: auto;
  background: #fff;
  color: #24292e;
  max-height: 150px;
  overflow-y: auto;
}
`;
