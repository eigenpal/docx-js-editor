/**
 * Extension Manager
 *
 * Two-phase initialization:
 * 1. buildSchema() — collects NodeSpecs/MarkSpecs from extensions → new Schema
 * 2. initializeRuntime() — calls onSchemaReady() on each extension, collects plugins/commands/keymaps
 */

import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import type { Plugin as PMPlugin, Command } from 'prosemirror-state';
import type { AnyExtension, ExtensionContext, CommandMap, KeyboardShortcutMap } from './types';

export class ExtensionManager {
  private extensions: AnyExtension[];
  private schema: Schema | null = null;
  private plugins: PMPlugin[] = [];
  private commands: CommandMap = {};

  constructor(extensions: AnyExtension[]) {
    // Sort by priority (lower number = higher priority)
    this.extensions = [...extensions].sort((a, b) => a.config.priority - b.config.priority);
  }

  /**
   * Phase 1: Build schema from node/mark extensions
   */
  buildSchema(): void {
    const nodes: Record<string, NodeSpec> = {};
    const marks: Record<string, MarkSpec> = {};

    for (const ext of this.extensions) {
      if (ext.type === 'node') {
        nodes[ext.config.schemaNodeName] = ext.config.nodeSpec;
      } else if (ext.type === 'mark') {
        marks[ext.config.schemaMarkName] = ext.config.markSpec;
      }
    }

    this.schema = new Schema({ nodes, marks });
  }

  /**
   * Phase 2: Initialize runtime (plugins, commands, keymaps)
   * Must be called after buildSchema()
   */
  initializeRuntime(): void {
    if (!this.schema) {
      throw new Error('ExtensionManager: buildSchema() must be called before initializeRuntime()');
    }

    const ctx: ExtensionContext = { schema: this.schema };
    const allKeyboardShortcuts: KeyboardShortcutMap[] = [];
    const allPlugins: PMPlugin[] = [];
    const allCommands: CommandMap = {};

    for (const ext of this.extensions) {
      const runtime = ext.onSchemaReady(ctx);

      if (runtime.commands) {
        Object.assign(allCommands, runtime.commands);
      }

      if (runtime.keyboardShortcuts) {
        allKeyboardShortcuts.push(runtime.keyboardShortcuts);
      }

      if (runtime.plugins) {
        allPlugins.push(...runtime.plugins);
      }
    }

    // Build final plugin array:
    // 1. Raw plugins from extensions (in priority order)
    // 2. Merged keymap plugins (each shortcut map becomes a keymap plugin, in priority order)
    this.plugins = [...allPlugins, ...allKeyboardShortcuts.map((shortcuts) => keymap(shortcuts))];

    this.commands = allCommands;
  }

  /**
   * Get the built schema
   */
  getSchema(): Schema {
    if (!this.schema) {
      throw new Error('ExtensionManager: buildSchema() must be called first');
    }
    return this.schema;
  }

  /**
   * Get all plugins (raw + keymap merged)
   */
  getPlugins(): PMPlugin[] {
    return this.plugins;
  }

  /**
   * Get the flat command registry
   */
  getCommands(): CommandMap {
    return this.commands;
  }

  /**
   * Get a specific command by name
   */
  getCommand(name: string): ((...args: any[]) => Command) | undefined {
    return this.commands[name];
  }

  /**
   * Lifecycle: destroy
   */
  destroy(): void {
    this.plugins = [];
    this.commands = {};
  }
}
