/**
 * Generic Plugin Interface for the DOCX Editor
 *
 * This module defines the EditorPlugin interface that allows
 * external plugins to integrate with the ProseMirror-based editor.
 */

import type { Plugin as ProseMirrorPlugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { ReactNode } from 'react';

/**
 * Coordinates returned by position lookup in the rendered DOM.
 */
export interface PositionCoordinates {
  x: number;
  y: number;
  height: number;
}

/**
 * Context for accessing the rendered DOM in PagedEditor.
 *
 * This interface provides DOM-based position mapping that works with
 * the LayoutPainter output (visible pages) rather than the hidden
 * ProseMirror editor. Use this for rendering overlays, annotations,
 * and other visual elements that need to be positioned relative to
 * the actual rendered content.
 *
 * The rendered DOM uses data-pm-start/data-pm-end attributes on spans
 * to map between ProseMirror positions and DOM elements.
 */
export interface RenderedDomContext {
  /** The container element holding all rendered pages. */
  pagesContainer: HTMLElement;

  /**
   * Get pixel coordinates for a ProseMirror position in the rendered DOM.
   * Returns null if the position cannot be found.
   *
   * @param pmPos - ProseMirror document position
   * @returns Coordinates relative to the pages container, or null
   */
  getCoordinatesForPosition(pmPos: number): PositionCoordinates | null;

  /**
   * Find DOM elements that overlap with a ProseMirror position range.
   * Useful for highlighting or overlaying content.
   *
   * @param from - Start ProseMirror position
   * @param to - End ProseMirror position
   * @returns Array of DOM elements that intersect with the range
   */
  findElementsForRange(from: number, to: number): Element[];

  /**
   * Get bounding rectangles for a range of text, accounting for line wraps.
   * Returns rects relative to the pages container.
   *
   * @param from - Start ProseMirror position
   * @param to - End ProseMirror position
   * @returns Array of DOMRect-like objects for the range
   */
  getRectsForRange(
    from: number,
    to: number
  ): Array<{ x: number; y: number; width: number; height: number }>;

  /** Current zoom level (1 = 100%). */
  zoom: number;

  /**
   * Offset of the pages container from its parent viewport.
   * Use this to adjust coordinates when rendering overlays in the viewport
   * container rather than directly in the pages container.
   */
  getContainerOffset(): { x: number; y: number };
}

/**
 * Props passed to plugin panel components.
 */
export interface PluginPanelProps<TState = unknown> {
  /** Current ProseMirror editor view */
  editorView: EditorView | null;

  /** Current ProseMirror document */
  doc: ProseMirrorNode | null;

  /** Scroll editor to a specific position */
  scrollToPosition: (pos: number) => void;

  /** Select a range in the editor */
  selectRange: (from: number, to: number) => void;

  /** Plugin-specific state (managed by the plugin) */
  pluginState: TState;

  /** Width of the panel in pixels */
  panelWidth: number;

  /**
   * Context for the rendered DOM (LayoutPainter output).
   * Use this for positioning annotations relative to the visible pages.
   * May be null if layout hasn't completed yet.
   */
  renderedDomContext: RenderedDomContext | null;
}

/**
 * Configuration for plugin panel rendering.
 */
export interface PanelConfig {
  /** Where to render the panel */
  position: 'left' | 'right' | 'bottom';

  /** Default width/height of the panel */
  defaultSize: number;

  /** Minimum size */
  minSize?: number;

  /** Maximum size */
  maxSize?: number;

  /** Whether the panel is resizable */
  resizable?: boolean;

  /** Whether the panel can be collapsed */
  collapsible?: boolean;

  /** Initial collapsed state */
  defaultCollapsed?: boolean;
}

/**
 * Generic interface for editor plugins.
 *
 * Implement this interface to create custom plugins that can:
 * - Add ProseMirror plugins (decorations, keymaps, etc.)
 * - Render panels alongside the document
 * - React to editor state changes
 * - Inject custom styles
 *
 * @typeParam TState - The type of plugin-specific state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EditorPlugin<TState = any> {
  /** Unique plugin identifier */
  id: string;

  /** Display name for the plugin */
  name: string;

  /**
   * ProseMirror plugins to register with the editor.
   * These are merged with the editor's internal plugins.
   */
  proseMirrorPlugins?: ProseMirrorPlugin[];

  /**
   * React component to render in the annotation panel area.
   * Receives editor state and callbacks for interaction.
   */
  Panel?: React.ComponentType<PluginPanelProps<TState>>;

  /**
   * Configuration for the panel (position, size, etc.)
   */
  panelConfig?: PanelConfig;

  /**
   * Called when the editor state changes.
   * Use this to update plugin-specific state based on document changes.
   *
   * @param view - The current ProseMirror editor view
   * @returns The new plugin state, or undefined to keep existing state
   */
  onStateChange?: (view: EditorView) => TState | undefined;

  /**
   * Initialize plugin state when the plugin is first loaded.
   *
   * @param view - The ProseMirror editor view (may be null initially)
   * @returns Initial plugin state
   */
  initialize?: (view: EditorView | null) => TState;

  /**
   * Called when the plugin is being destroyed.
   * Use this for cleanup (subscriptions, timers, etc.)
   */
  destroy?: () => void;

  /**
   * CSS styles to inject for this plugin.
   * Can be a string of CSS or a URL to a stylesheet.
   */
  styles?: string;

  /**
   * Render an overlay on top of the rendered pages.
   * Use this for highlights, annotations, or other visual elements
   * that need to be positioned relative to the document content.
   *
   * The overlay is rendered inside the viewport, positioned absolutely
   * over the pages container.
   *
   * @param context - The rendered DOM context for position lookup
   * @param state - Current plugin state
   * @param editorView - The editor view for dispatching transactions
   * @returns React node to render as overlay, or null
   */
  renderOverlay?: (
    context: RenderedDomContext,
    state: TState,
    editorView: EditorView | null
  ) => ReactNode;
}

/**
 * Context value provided to plugins and panels.
 */
export interface PluginContext {
  /** All registered plugins */
  plugins: EditorPlugin[];

  /** Current editor view */
  editorView: EditorView | null;

  /** Set the editor view (called by editor on mount) */
  setEditorView: (view: EditorView | null) => void;

  /** Get plugin state by plugin ID */
  getPluginState: <T>(pluginId: string) => T | undefined;

  /** Update plugin state */
  setPluginState: <T>(pluginId: string, state: T) => void;

  /** Scroll to a position in the editor */
  scrollToPosition: (pos: number) => void;

  /** Select a range in the editor */
  selectRange: (from: number, to: number) => void;
}

/**
 * Props for the PluginHost component.
 */
export interface PluginHostProps {
  /** Plugins to enable */
  plugins: EditorPlugin[];

  /** The editor component (passed as child) */
  children: React.ReactElement;

  /** Class name for the host container */
  className?: string;
}

/**
 * Ref interface for the PluginHost component.
 */
export interface PluginHostRef {
  /** Get plugin state by plugin ID */
  getPluginState: <T>(pluginId: string) => T | undefined;

  /** Update plugin state for a plugin */
  setPluginState: <T>(pluginId: string, state: T) => void;

  /** Get the current editor view */
  getEditorView: () => EditorView | null;

  /** Force a refresh of all plugin states */
  refreshPluginStates: () => void;
}
