/**
 * Extension System Type Definitions
 *
 * Tiptap-style extension architecture for ProseMirror.
 * Three extension types:
 * - Extension: plugins, commands, keymaps (no schema)
 * - NodeExtension: adds a node spec to the schema
 * - MarkExtension: adds a mark spec to the schema
 */

import type { Schema, NodeSpec, MarkSpec } from 'prosemirror-model';
import type { Plugin as PMPlugin, Command } from 'prosemirror-state';

// ============================================================================
// PRIORITY
// ============================================================================

export type ExtensionPriority = number;

export const Priority = {
  Highest: 0,
  High: 50,
  Default: 100,
  Low: 150,
  Lowest: 200,
} as const;

// ============================================================================
// CONTEXT & RUNTIME
// ============================================================================

export interface ExtensionContext {
  schema: Schema;
}

export type CommandMap = Record<string, (...args: any[]) => Command>;
export type KeyboardShortcutMap = Record<string, Command>;

export interface ExtensionRuntime {
  commands?: CommandMap;
  keyboardShortcuts?: KeyboardShortcutMap;
  plugins?: PMPlugin[];
}

// ============================================================================
// EXTENSION CONFIGS
// ============================================================================

export interface ExtensionConfig {
  name: string;
  priority: ExtensionPriority;
  options: Record<string, unknown>;
}

export interface NodeExtensionConfig extends ExtensionConfig {
  schemaNodeName: string;
  nodeSpec: NodeSpec;
}

export interface MarkExtensionConfig extends ExtensionConfig {
  schemaMarkName: string;
  markSpec: MarkSpec;
}

// ============================================================================
// EXTENSION INSTANCES
// ============================================================================

export interface Extension {
  type: 'extension';
  config: ExtensionConfig;
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime;
}

export interface NodeExtension {
  type: 'node';
  config: NodeExtensionConfig;
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime;
}

export interface MarkExtension {
  type: 'mark';
  config: MarkExtensionConfig;
  onSchemaReady(ctx: ExtensionContext): ExtensionRuntime;
}

export type AnyExtension = Extension | NodeExtension | MarkExtension;

// ============================================================================
// DEFINITION TYPES (used by factory functions)
// ============================================================================

export interface ExtensionDefinition<TOptions = Record<string, unknown>> {
  name: string;
  priority?: ExtensionPriority;
  defaultOptions?: TOptions;
  onSchemaReady(ctx: ExtensionContext, options: TOptions): ExtensionRuntime;
}

export interface NodeExtensionDefinition<TOptions = Record<string, unknown>> {
  name: string;
  priority?: ExtensionPriority;
  defaultOptions?: TOptions;
  schemaNodeName: string;
  nodeSpec: NodeSpec | ((options: TOptions) => NodeSpec);
  onSchemaReady?(ctx: ExtensionContext, options: TOptions): ExtensionRuntime;
}

export interface MarkExtensionDefinition<TOptions = Record<string, unknown>> {
  name: string;
  priority?: ExtensionPriority;
  defaultOptions?: TOptions;
  schemaMarkName: string;
  markSpec: MarkSpec | ((options: TOptions) => MarkSpec);
  onSchemaReady?(ctx: ExtensionContext, options: TOptions): ExtensionRuntime;
}
