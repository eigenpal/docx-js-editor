/**
 * Extension System — Barrel Export
 */

// Types
export { Priority } from './types';
export type {
  ExtensionPriority,
  ExtensionContext,
  CommandMap,
  KeyboardShortcutMap,
  ExtensionRuntime,
  ExtensionConfig,
  NodeExtensionConfig,
  MarkExtensionConfig,
  Extension,
  NodeExtension,
  MarkExtension,
  AnyExtension,
  ExtensionDefinition,
  NodeExtensionDefinition,
  MarkExtensionDefinition,
} from './types';

// Factories
export { createExtension, createNodeExtension, createMarkExtension } from './create';

// Manager
export { ExtensionManager } from './ExtensionManager';

// StarterKit
export { createStarterKit } from './StarterKit';
export type { StarterKitOptions } from './StarterKit';
