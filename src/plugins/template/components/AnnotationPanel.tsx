/**
 * Annotation Panel Component
 *
 * Displays all template annotations in the right margin.
 */

import { useMemo } from 'react';
import type { PluginPanelProps } from '../../../plugin-api/types';
import type { TemplatePluginState, TemplateSchema, TemplateElement } from '../types';
import { AnnotationCard, ANNOTATION_CARD_STYLES } from './AnnotationCard';
import { toTypeScriptInterface, getFullDataPath } from '../schema-inferrer';
import { setHoveredElement, setSelectedElement } from '../prosemirror-plugin';

export interface AnnotationPanelProps extends PluginPanelProps<TemplatePluginState> {
  // Additional props can be added here
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
  // Get schema from plugin state
  const schema = pluginState?.schema ?? null;
  const hoveredElementId = pluginState?.hoveredElementId;
  const selectedElementId = pluginState?.selectedElementId;

  // Get elements with paths
  const elementsWithPaths = useMemo(() => {
    if (!schema) return [];
    return getElementsWithPaths(schema);
  }, [schema]);

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

    // Find element
    const element = schema.elements.find((el) => el.id === elementId);
    if (!element) return;

    // Select in editor
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
    <div className="template-panel">
      {/* Header with stats */}
      <div className="template-panel-header">
        <h3 className="template-panel-title">Template Schema</h3>
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
      </div>

      {/* Error summary */}
      {schema.errors.length > 0 && (
        <div className="template-panel-errors">
          <div className="template-panel-errors-header">
            ⚠ {schema.errors.length} validation {schema.errors.length === 1 ? 'error' : 'errors'}
          </div>
        </div>
      )}

      {/* Annotations list */}
      <div className="template-panel-annotations">
        {elementsWithPaths.map(({ element, dataPath }) => (
          <AnnotationCard
            key={element.id}
            element={element}
            dataPath={dataPath}
            isHovered={element.id === hoveredElementId}
            isSelected={element.id === selectedElementId}
            onHover={handleHover}
            onClick={handleClick}
          />
        ))}
      </div>

      {/* TypeScript interface */}
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
  height: 100%;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.template-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
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
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  background: white;
}

.template-panel-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #212529;
}

.template-panel-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.template-panel-stats .stat {
  display: flex;
  align-items: center;
  gap: 4px;
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

.template-panel-errors {
  padding: 8px 16px;
  background: rgba(220, 53, 69, 0.1);
  border-bottom: 1px solid rgba(220, 53, 69, 0.2);
}

.template-panel-errors-header {
  font-size: 12px;
  color: #dc3545;
  font-weight: 500;
}

.template-panel-annotations {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.template-panel-schema {
  border-top: 1px solid #e9ecef;
  background: white;
}

.template-panel-schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
  background: #f1f3f4;
}

.template-panel-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.template-panel-copy-btn:hover {
  opacity: 1;
}

.template-panel-schema-code {
  margin: 0;
  padding: 12px 16px;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  overflow-x: auto;
  background: #fff;
  color: #24292e;
  max-height: 200px;
  overflow-y: auto;
}
`;
