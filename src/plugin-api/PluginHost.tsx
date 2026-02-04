/**
 * PluginHost Component
 *
 * Wraps the editor and renders plugin panels.
 * Completely decoupled from editor internals.
 */

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  cloneElement,
} from 'react';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Plugin as ProseMirrorPlugin } from 'prosemirror-state';
import type { EditorPlugin, PluginHostProps, PluginHostRef, PanelConfig } from './types';

// Default panel configuration
const DEFAULT_PANEL_CONFIG: Required<PanelConfig> = {
  position: 'right',
  defaultSize: 280,
  minSize: 200,
  maxSize: 500,
  resizable: true,
  collapsible: true,
  defaultCollapsed: false,
};

/**
 * Injects CSS styles into the document head.
 */
function injectStyles(pluginId: string, css: string): () => void {
  const styleId = `plugin-styles-${pluginId}`;

  // Remove existing styles if any
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }

  // Inject new styles
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);

  // Return cleanup function
  return () => {
    const el = document.getElementById(styleId);
    if (el) {
      el.remove();
    }
  };
}

// Default styles for PluginHost - defined here so it can be used in the component
const PLUGIN_HOST_STYLES = `
.plugin-host {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: visible;
  position: relative;
}

.plugin-host-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: visible;
}


.plugin-panels-left,
.plugin-panels-right {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: #f8f9fa;
  border-color: #e9ecef;
}

.plugin-panels-left {
  border-right: 1px solid #e9ecef;
}

.plugin-panels-right {
  border-left: 1px solid #e9ecef;
}

.plugin-panels-bottom {
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.plugin-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease, height 0.2s ease;
}

.plugin-panel.collapsed {
  overflow: visible;
}

.plugin-panel-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #6c757d;
  white-space: nowrap;
}

.plugin-panel.collapsed .plugin-panel-toggle {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-direction: column;
  height: 100%;
  padding: 8px 6px;
}

.plugin-panel-toggle:hover {
  background: #e9ecef;
  color: #495057;
}

.plugin-panel-toggle-icon {
  font-weight: bold;
  font-size: 14px;
}

.plugin-panel.collapsed .plugin-panel-toggle-icon {
  transform: rotate(90deg);
}

.plugin-panel-toggle-label {
  font-weight: 500;
}

.plugin-panel-content {
  flex: 1;
  overflow: auto;
}

/* Overlay panels - positioned absolutely over the editor, outside the page */
.plugin-panels-overlay-right {
  position: absolute;
  top: 0;
  right: 50%;
  margin-right: -600px; /* Position outside the ~816px page width / 2 + gap */
  bottom: 0;
  width: 220px;
  pointer-events: none;
  z-index: 10;
  overflow: visible;
  clip: unset;
}

.plugin-panel-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-shrink: 0;
  pointer-events: none;
  background: transparent;
  overflow: visible;
  clip: unset;
}

.plugin-panel-overlay.collapsed {
  display: none;
}

.plugin-panel-overlay-content {
  flex: 1;
  overflow: visible;
  position: relative;
  clip: unset;
}

/* Plugin overlay container for rendering highlights/decorations */
.plugin-overlays-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
}

.plugin-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.plugin-overlay > * {
  pointer-events: auto;
}
`;

/**
 * PluginHost Component
 *
 * Wraps the editor and provides:
 * - Plugin state management
 * - Panel rendering for each plugin
 * - CSS injection for plugin styles
 * - Callbacks for editor interaction
 */
export const PluginHost = forwardRef<PluginHostRef, PluginHostProps>(function PluginHost(
  { plugins, children, className = '' },
  ref
) {
  // Editor view reference
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  // Rendered DOM context (received from PagedEditor)
  const [renderedDomContext, setRenderedDomContext] = useState<
    import('./types').RenderedDomContext | null
  >(null);

  // Plugin states (map of pluginId -> state)
  const pluginStatesRef = useRef<Map<string, unknown>>(new Map());
  // State version counter - incremented when plugin states change, used as dependency for overlays
  const [stateVersion, setStateVersion] = useState(0);
  const forceUpdate = useCallback(() => setStateVersion((v) => v + 1), []);

  // Panel collapsed states
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    for (const plugin of plugins) {
      const config = { ...DEFAULT_PANEL_CONFIG, ...plugin.panelConfig };
      if (config.defaultCollapsed) {
        collapsed.add(plugin.id);
      }
    }
    return collapsed;
  });

  // Panel sizes (for resizable panels)
  const [panelSizes] = useState<Map<string, number>>(() => {
    const sizes = new Map<string, number>();
    for (const plugin of plugins) {
      const config = { ...DEFAULT_PANEL_CONFIG, ...plugin.panelConfig };
      sizes.set(plugin.id, config.defaultSize);
    }
    return sizes;
  });

  // Initialize plugin states
  useEffect(() => {
    for (const plugin of plugins) {
      if (plugin.initialize && !pluginStatesRef.current.has(plugin.id)) {
        pluginStatesRef.current.set(plugin.id, plugin.initialize(editorView));
      }
    }
    forceUpdate();
  }, [plugins, editorView]);

  // Inject base PluginHost styles
  useEffect(() => {
    const cleanup = injectStyles('plugin-host-base', PLUGIN_HOST_STYLES);
    return cleanup;
  }, []);

  // Inject plugin styles
  useEffect(() => {
    const cleanupFns: (() => void)[] = [];

    for (const plugin of plugins) {
      if (plugin.styles) {
        cleanupFns.push(injectStyles(plugin.id, plugin.styles));
      }
    }

    return () => {
      for (const cleanup of cleanupFns) {
        cleanup();
      }
    };
  }, [plugins]);

  // Call plugin destroy on unmount
  useEffect(() => {
    return () => {
      for (const plugin of plugins) {
        if (plugin.destroy) {
          plugin.destroy();
        }
      }
    };
  }, [plugins]);

  // Update plugin states when editor state changes
  useEffect(() => {
    if (!editorView) return;

    // We need to hook into state changes - use DOM events
    // as a lightweight way to detect changes
    const updatePluginStates = () => {
      for (const plugin of plugins) {
        if (plugin.onStateChange) {
          const newState = plugin.onStateChange(editorView);
          if (newState !== undefined) {
            pluginStatesRef.current.set(plugin.id, newState);
          }
        }
      }
      forceUpdate();
    };

    // Initial state update
    updatePluginStates();

    // Listen for editor updates via DOM events
    const editorDom = editorView.dom;
    editorDom.addEventListener('input', updatePluginStates);
    editorDom.addEventListener('focus', updatePluginStates);
    editorDom.addEventListener('click', updatePluginStates);

    // Debounced update for transactions (hover/select from panels)
    let pendingUpdate: number | null = null;
    const debouncedUpdate = () => {
      if (pendingUpdate) cancelAnimationFrame(pendingUpdate);
      pendingUpdate = requestAnimationFrame(updatePluginStates);
    };

    // Wrap dispatch to catch hover/select transactions from panels
    const originalDispatch = editorView.dispatch.bind(editorView);
    editorView.dispatch = (tr) => {
      originalDispatch(tr);
      // Update on non-doc-changing transactions (hover/select) or after doc changes
      debouncedUpdate();
    };

    return () => {
      editorDom.removeEventListener('input', updatePluginStates);
      editorDom.removeEventListener('focus', updatePluginStates);
      editorDom.removeEventListener('click', updatePluginStates);
      if (pendingUpdate) cancelAnimationFrame(pendingUpdate);
      editorView.dispatch = originalDispatch;
    };
  }, [editorView, plugins]);

  // Callbacks for panel interaction
  const scrollToPosition = useCallback(
    (pos: number) => {
      if (!editorView) return;

      // Get the coordinates for the position
      const coords = editorView.coordsAtPos(pos);
      if (coords) {
        // Scroll the editor to show the position
        editorView.dom.scrollIntoView({ block: 'center', inline: 'nearest' });

        // Also set selection to the position
        const { state } = editorView;
        const resolved = state.doc.resolve(Math.min(pos, state.doc.content.size));
        const tr = state.tr.setSelection(TextSelection.near(resolved));
        editorView.dispatch(tr);
        editorView.focus();
      }
    },
    [editorView]
  );

  const selectRange = useCallback(
    (from: number, to: number) => {
      if (!editorView) return;

      const { state } = editorView;
      const maxPos = state.doc.content.size;
      const safeFrom = Math.max(0, Math.min(from, maxPos));
      const safeTo = Math.max(0, Math.min(to, maxPos));
      const tr = state.tr.setSelection(TextSelection.create(state.doc, safeFrom, safeTo));
      editorView.dispatch(tr);
      editorView.focus();
    },
    [editorView]
  );

  // Get plugin state helper
  const getPluginState = useCallback(<T,>(pluginId: string): T | undefined => {
    return pluginStatesRef.current.get(pluginId) as T | undefined;
  }, []);

  // Set plugin state helper
  const setPluginState = useCallback(<T,>(pluginId: string, state: T) => {
    pluginStatesRef.current.set(pluginId, state);
    forceUpdate();
  }, []);

  // Refresh all plugin states
  const refreshPluginStates = useCallback(() => {
    if (!editorView) return;

    for (const plugin of plugins) {
      if (plugin.onStateChange) {
        const newState = plugin.onStateChange(editorView);
        if (newState !== undefined) {
          pluginStatesRef.current.set(plugin.id, newState);
        }
      }
    }
    forceUpdate();
  }, [editorView, plugins]);

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      getPluginState,
      setPluginState,
      getEditorView: () => editorView,
      refreshPluginStates,
    }),
    [getPluginState, setPluginState, editorView, refreshPluginStates]
  );

  // Collect all ProseMirror plugins from plugins
  const externalProseMirrorPlugins = useMemo(() => {
    const pmPlugins: ProseMirrorPlugin[] = [];
    for (const plugin of plugins) {
      if (plugin.proseMirrorPlugins) {
        pmPlugins.push(...plugin.proseMirrorPlugins);
      }
    }
    return pmPlugins;
  }, [plugins]);

  // Handle panel collapse toggle
  const togglePanelCollapsed = useCallback((pluginId: string) => {
    setCollapsedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }, []);

  // Generate overlay elements for plugins that have renderOverlay
  const pluginOverlays = useMemo(() => {
    if (!renderedDomContext) return null;

    const overlays = plugins
      .filter((plugin) => plugin.renderOverlay)
      .map((plugin) => {
        const pluginState = pluginStatesRef.current.get(plugin.id);
        return (
          <div key={`overlay-${plugin.id}`} className="plugin-overlay" data-plugin-id={plugin.id}>
            {plugin.renderOverlay!(renderedDomContext, pluginState, editorView)}
          </div>
        );
      });

    return overlays.length > 0 ? overlays : null;
  }, [renderedDomContext, plugins, stateVersion, editorView]);

  // Callback to receive rendered DOM context from editor
  const handleRenderedDomContextReady = useCallback(
    (context: import('./types').RenderedDomContext) => {
      setRenderedDomContext(context);
      // Call original callback if any
      const originalCallback = (children.props as Record<string, unknown>)
        ?.onRenderedDomContextReady;
      if (typeof originalCallback === 'function') {
        originalCallback(context);
      }
    },
    [children.props]
  );

  // Clone the child editor with additional props
  const editorElement = useMemo(() => {
    return cloneElement(children, {
      externalPlugins: externalProseMirrorPlugins,
      pluginOverlays,
      onRenderedDomContextReady: handleRenderedDomContextReady,
      onEditorViewReady: (view: EditorView) => {
        setEditorView(view);
        // Call original callback if any
        const originalCallback = (children.props as Record<string, unknown>)?.onEditorViewReady;
        if (typeof originalCallback === 'function') {
          originalCallback(view);
        }
      },
    });
  }, [children, externalProseMirrorPlugins, pluginOverlays, handleRenderedDomContextReady]);

  // Group plugins by panel position
  const pluginsByPosition = useMemo(() => {
    const left: EditorPlugin[] = [];
    const right: EditorPlugin[] = [];
    const bottom: EditorPlugin[] = [];

    for (const plugin of plugins) {
      if (!plugin.Panel) continue;
      const position = plugin.panelConfig?.position ?? 'right';
      if (position === 'left') left.push(plugin);
      else if (position === 'bottom') bottom.push(plugin);
      else right.push(plugin);
    }

    return { left, right, bottom };
  }, [plugins]);

  // Render a plugin panel
  const renderPanel = (plugin: EditorPlugin) => {
    if (!plugin.Panel) return null;

    const config = { ...DEFAULT_PANEL_CONFIG, ...plugin.panelConfig };
    const isCollapsed = collapsedPanels.has(plugin.id);
    const size = panelSizes.get(plugin.id) ?? config.defaultSize;

    const Panel = plugin.Panel;
    const pluginState = pluginStatesRef.current.get(plugin.id);

    return (
      <div
        key={plugin.id}
        className={`plugin-panel plugin-panel-${config.position} ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          [config.position === 'bottom' ? 'height' : 'width']: isCollapsed ? '32px' : `${size}px`,
          minWidth:
            config.position !== 'bottom'
              ? isCollapsed
                ? '32px'
                : `${config.minSize}px`
              : undefined,
          maxWidth: config.position !== 'bottom' ? `${config.maxSize}px` : undefined,
          minHeight:
            config.position === 'bottom'
              ? isCollapsed
                ? '32px'
                : `${config.minSize}px`
              : undefined,
          maxHeight: config.position === 'bottom' ? `${config.maxSize}px` : undefined,
        }}
        data-plugin-id={plugin.id}
      >
        {config.collapsible && (
          <button
            className="plugin-panel-toggle"
            onClick={() => togglePanelCollapsed(plugin.id)}
            title={isCollapsed ? `Show ${plugin.name}` : `Hide ${plugin.name}`}
            aria-label={isCollapsed ? `Show ${plugin.name}` : `Hide ${plugin.name}`}
          >
            <span className="plugin-panel-toggle-icon">{isCollapsed ? '›' : '‹'}</span>
            {isCollapsed && <span className="plugin-panel-toggle-label">{plugin.name}</span>}
          </button>
        )}
        {!isCollapsed && (
          <div className="plugin-panel-content">
            <Panel
              editorView={editorView}
              doc={editorView?.state.doc ?? null}
              scrollToPosition={scrollToPosition}
              selectRange={selectRange}
              pluginState={pluginState}
              panelWidth={size}
              renderedDomContext={renderedDomContext ?? null}
            />
          </div>
        )}
      </div>
    );
  };

  // Render right panels as overlay inside editor
  const renderRightPanelOverlay = (plugin: EditorPlugin) => {
    if (!plugin.Panel) return null;

    const config = { ...DEFAULT_PANEL_CONFIG, ...plugin.panelConfig };
    const isCollapsed = collapsedPanels.has(plugin.id);
    const size = panelSizes.get(plugin.id) ?? config.defaultSize;

    const Panel = plugin.Panel;
    const pluginState = pluginStatesRef.current.get(plugin.id);

    return (
      <div
        key={plugin.id}
        className={`plugin-panel-overlay ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '32px' : `${size}px`,
        }}
        data-plugin-id={plugin.id}
      >
        {config.collapsible && (
          <button
            className="plugin-panel-toggle"
            onClick={() => togglePanelCollapsed(plugin.id)}
            title={isCollapsed ? `Show ${plugin.name}` : `Hide ${plugin.name}`}
            aria-label={isCollapsed ? `Show ${plugin.name}` : `Hide ${plugin.name}`}
          >
            <span className="plugin-panel-toggle-icon">{isCollapsed ? '‹' : '›'}</span>
          </button>
        )}
        {!isCollapsed && (
          <div className="plugin-panel-overlay-content">
            <Panel
              editorView={editorView}
              doc={editorView?.state.doc ?? null}
              scrollToPosition={scrollToPosition}
              selectRange={selectRange}
              pluginState={pluginState}
              panelWidth={size}
              renderedDomContext={renderedDomContext ?? null}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`plugin-host ${className}`}>
      {/* Left panels */}
      {pluginsByPosition.left.length > 0 && (
        <div className="plugin-panels-left">{pluginsByPosition.left.map(renderPanel)}</div>
      )}

      {/* Main editor area */}
      <div className="plugin-host-editor">
        {editorElement}

        {/* Bottom panels */}
        {pluginsByPosition.bottom.length > 0 && (
          <div className="plugin-panels-bottom">{pluginsByPosition.bottom.map(renderPanel)}</div>
        )}
      </div>

      {/* Right panels as floating overlay */}
      {pluginsByPosition.right.length > 0 && (
        <div className="plugin-panels-overlay-right">
          {pluginsByPosition.right.map(renderRightPanelOverlay)}
        </div>
      )}
    </div>
  );
});

// Export the styles constant for external use
export { PLUGIN_HOST_STYLES };

export default PluginHost;
