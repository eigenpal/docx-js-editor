/**
 * Plugin Registry
 *
 * Central registry for core plugins. Manages plugin lifecycle,
 * collects command handlers from all plugins, and aggregates
 * MCP tool definitions for the MCP server.
 */

import type {
  CorePlugin,
  CommandHandler,
  McpToolDefinition,
  PluginEvent,
  PluginEventListener,
  PluginRegistrationResult,
  PluginOptions,
} from './types';

// ============================================================================
// PLUGIN REGISTRY
// ============================================================================

/**
 * Plugin Registry - manages core plugins
 *
 * @example
 * ```ts
 * import { pluginRegistry, docxtemplaterPlugin } from '@eigenpal/docx-editor/core-plugins';
 *
 * // Register plugins
 * pluginRegistry.register(docxtemplaterPlugin);
 *
 * // Get all MCP tools for MCP server
 * const tools = pluginRegistry.getMcpTools();
 *
 * // Get command handler for executor
 * const handler = pluginRegistry.getCommandHandler('insertTemplateVariable');
 * ```
 */
export class PluginRegistry {
  private plugins: Map<string, CorePlugin> = new Map();
  private commandHandlers: Map<string, { pluginId: string; handler: CommandHandler }> = new Map();
  private eventListeners: Set<PluginEventListener> = new Set();
  private initialized: Set<string> = new Set();

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  /**
   * Register a plugin
   *
   * @param plugin - The plugin to register
   * @param options - Optional configuration
   * @returns Registration result
   */
  register(plugin: CorePlugin, options?: PluginOptions): PluginRegistrationResult {
    const warnings: string[] = [];

    // Validate plugin
    if (!plugin.id) {
      return { success: false, error: 'Plugin must have an id' };
    }

    if (this.plugins.has(plugin.id)) {
      return { success: false, error: `Plugin '${plugin.id}' is already registered` };
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          return {
            success: false,
            error: `Plugin '${plugin.id}' requires '${depId}' which is not registered`,
          };
        }
      }
    }

    // Register command handlers
    if (plugin.commandHandlers) {
      for (const [commandType, handler] of Object.entries(plugin.commandHandlers)) {
        if (this.commandHandlers.has(commandType)) {
          const existing = this.commandHandlers.get(commandType)!;
          warnings.push(
            `Command '${commandType}' from '${plugin.id}' overrides handler from '${existing.pluginId}'`
          );
        }
        this.commandHandlers.set(commandType, { pluginId: plugin.id, handler });
      }
    }

    // Store plugin
    this.plugins.set(plugin.id, plugin);

    // Initialize if needed
    if (plugin.initialize && !this.initialized.has(plugin.id)) {
      try {
        const result = plugin.initialize();
        if (result instanceof Promise) {
          // Handle async initialization
          result
            .then(() => {
              this.initialized.add(plugin.id);
            })
            .catch((err) => {
              this.emit({ type: 'error', pluginId: plugin.id, error: err as Error });
            });
        } else {
          this.initialized.add(plugin.id);
        }
      } catch (err) {
        this.emit({ type: 'error', pluginId: plugin.id, error: err as Error });
      }
    }

    // Log if debug enabled
    if (options?.debug) {
      console.log(`[PluginRegistry] Registered plugin: ${plugin.id}`);
    }

    // Emit event
    this.emit({ type: 'registered', plugin });

    return {
      success: true,
      plugin,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Unregister a plugin
   *
   * @param pluginId - ID of the plugin to unregister
   * @returns Whether unregistration succeeded
   */
  unregister(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    // Check if other plugins depend on this one
    for (const [id, p] of this.plugins) {
      if (p.dependencies?.includes(pluginId)) {
        console.warn(`Cannot unregister '${pluginId}': '${id}' depends on it`);
        return false;
      }
    }

    // Remove command handlers
    for (const [commandType, { pluginId: pid }] of this.commandHandlers) {
      if (pid === pluginId) {
        this.commandHandlers.delete(commandType);
      }
    }

    // Call destroy if available
    if (plugin.destroy) {
      try {
        const result = plugin.destroy();
        if (result instanceof Promise) {
          result.catch((err) => {
            this.emit({ type: 'error', pluginId, error: err as Error });
          });
        }
      } catch (err) {
        this.emit({ type: 'error', pluginId, error: err as Error });
      }
    }

    // Remove plugin
    this.plugins.delete(pluginId);
    this.initialized.delete(pluginId);

    // Emit event
    this.emit({ type: 'unregistered', pluginId });

    return true;
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get a registered plugin by ID
   *
   * @param id - Plugin ID
   * @returns The plugin or undefined
   */
  get(id: string): CorePlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of all plugins
   */
  getAll(): CorePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered
   *
   * @param id - Plugin ID
   * @returns Whether the plugin is registered
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get number of registered plugins
   */
  get size(): number {
    return this.plugins.size;
  }

  // ==========================================================================
  // COMMAND HANDLERS
  // ==========================================================================

  /**
   * Get a command handler for a command type
   *
   * @param commandType - The command type
   * @returns The handler or undefined
   */
  getCommandHandler(commandType: string): CommandHandler | undefined {
    const entry = this.commandHandlers.get(commandType);
    return entry?.handler;
  }

  /**
   * Get all registered command types
   *
   * @returns Array of command type strings
   */
  getCommandTypes(): string[] {
    return Array.from(this.commandHandlers.keys());
  }

  /**
   * Check if a command type has a handler
   *
   * @param commandType - The command type
   * @returns Whether a handler exists
   */
  hasCommandHandler(commandType: string): boolean {
    return this.commandHandlers.has(commandType);
  }

  // ==========================================================================
  // MCP TOOLS
  // ==========================================================================

  /**
   * Get all MCP tools from all registered plugins
   *
   * @returns Array of MCP tool definitions
   */
  getMcpTools(): McpToolDefinition[] {
    const tools: McpToolDefinition[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.mcpTools) {
        tools.push(...plugin.mcpTools);
      }
    }

    return tools;
  }

  /**
   * Get MCP tools from a specific plugin
   *
   * @param pluginId - Plugin ID
   * @returns Array of MCP tool definitions
   */
  getMcpToolsForPlugin(pluginId: string): McpToolDefinition[] {
    const plugin = this.plugins.get(pluginId);
    return plugin?.mcpTools || [];
  }

  /**
   * Get an MCP tool by name
   *
   * @param toolName - Tool name
   * @returns The tool definition or undefined
   */
  getMcpTool(toolName: string): McpToolDefinition | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.mcpTools) {
        const tool = plugin.mcpTools.find((t) => t.name === toolName);
        if (tool) return tool;
      }
    }
    return undefined;
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Add an event listener
   *
   * @param listener - Event listener function
   */
  addEventListener(listener: PluginEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove an event listener
   *
   * @param listener - Event listener function
   */
  removeEventListener(listener: PluginEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: PluginEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[PluginRegistry] Event listener error:', err);
      }
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Clear all registered plugins
   *
   * Useful for testing or resetting state.
   */
  clear(): void {
    // Call destroy on all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        try {
          plugin.destroy();
        } catch {
          // Ignore errors during clear
        }
      }
    }

    this.plugins.clear();
    this.commandHandlers.clear();
    this.initialized.clear();
  }

  /**
   * Get registry state for debugging
   */
  getDebugInfo(): {
    plugins: string[];
    commandTypes: string[];
    mcpTools: string[];
    initialized: string[];
  } {
    return {
      plugins: Array.from(this.plugins.keys()),
      commandTypes: Array.from(this.commandHandlers.keys()),
      mcpTools: this.getMcpTools().map((t) => t.name),
      initialized: Array.from(this.initialized),
    };
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

/**
 * Global plugin registry instance
 *
 * Use this for registering plugins and accessing their capabilities.
 */
export const pluginRegistry = new PluginRegistry();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Register multiple plugins at once
 *
 * @param plugins - Array of plugins to register
 * @returns Array of registration results
 */
export function registerPlugins(
  plugins: CorePlugin[],
  options?: PluginOptions
): PluginRegistrationResult[] {
  return plugins.map((plugin) => pluginRegistry.register(plugin, options));
}

/**
 * Create a plugin registration helper with options pre-configured
 *
 * @param options - Default options for plugin registration
 * @returns Registration function
 */
export function createPluginRegistrar(options: PluginOptions) {
  return (plugin: CorePlugin) => pluginRegistry.register(plugin, options);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default pluginRegistry;
