/**
 * Extension Factory Functions
 *
 * Creates extension instances from definitions.
 * Each factory returns a function that accepts options and returns an extension instance.
 */

import { Priority } from './types';
import type {
  Extension,
  NodeExtension,
  MarkExtension,
  ExtensionDefinition,
  NodeExtensionDefinition,
  MarkExtensionDefinition,
  ExtensionContext,
  ExtensionRuntime,
} from './types';

/**
 * Create a generic extension (plugins, commands, keymaps — no schema contribution)
 */
export function createExtension<TOptions extends Record<string, unknown> = Record<string, unknown>>(
  def: ExtensionDefinition<TOptions>
): (options?: Partial<TOptions>) => Extension {
  return (options?: Partial<TOptions>): Extension => {
    const mergedOptions = { ...def.defaultOptions, ...options } as TOptions;

    return {
      type: 'extension',
      config: {
        name: def.name,
        priority: def.priority ?? Priority.Default,
        options: mergedOptions as Record<string, unknown>,
      },
      onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
        return def.onSchemaReady(ctx, mergedOptions);
      },
    };
  };
}

/**
 * Create a node extension (contributes a NodeSpec to the schema)
 */
export function createNodeExtension<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
>(def: NodeExtensionDefinition<TOptions>): (options?: Partial<TOptions>) => NodeExtension {
  return (options?: Partial<TOptions>): NodeExtension => {
    const mergedOptions = { ...def.defaultOptions, ...options } as TOptions;
    const nodeSpec =
      typeof def.nodeSpec === 'function' ? def.nodeSpec(mergedOptions) : def.nodeSpec;

    return {
      type: 'node',
      config: {
        name: def.name,
        priority: def.priority ?? Priority.Default,
        options: mergedOptions as Record<string, unknown>,
        schemaNodeName: def.schemaNodeName,
        nodeSpec,
      },
      onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
        return def.onSchemaReady?.(ctx, mergedOptions) ?? {};
      },
    };
  };
}

/**
 * Create a mark extension (contributes a MarkSpec to the schema)
 */
export function createMarkExtension<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
>(def: MarkExtensionDefinition<TOptions>): (options?: Partial<TOptions>) => MarkExtension {
  return (options?: Partial<TOptions>): MarkExtension => {
    const mergedOptions = { ...def.defaultOptions, ...options } as TOptions;
    const markSpec =
      typeof def.markSpec === 'function' ? def.markSpec(mergedOptions) : def.markSpec;

    return {
      type: 'mark',
      config: {
        name: def.name,
        priority: def.priority ?? Priority.Default,
        options: mergedOptions as Record<string, unknown>,
        schemaMarkName: def.schemaMarkName,
        markSpec,
      },
      onSchemaReady(ctx: ExtensionContext): ExtensionRuntime {
        return def.onSchemaReady?.(ctx, mergedOptions) ?? {};
      },
    };
  };
}
