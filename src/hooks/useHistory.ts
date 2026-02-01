/**
 * History hook for undo/redo functionality
 *
 * Maintains undo/redo stacks with support for:
 * - undo() and redo() operations
 * - canUndo and canRedo state
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
 * - Grouping rapid changes to avoid cluttering history
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * History entry containing state and metadata
 */
export interface HistoryEntry<T> {
  /** The state at this point */
  state: T;
  /** Timestamp when this entry was created */
  timestamp: number;
  /** Optional description of what changed */
  description?: string;
}

/**
 * Options for the useHistory hook
 */
export interface UseHistoryOptions<T> {
  /** Maximum number of entries in history (default: 100) */
  maxEntries?: number;
  /** Time in ms to group rapid changes (default: 500) */
  groupingInterval?: number;
  /** Whether to enable keyboard shortcuts (default: true) */
  enableKeyboardShortcuts?: boolean;
  /** Custom comparison function for detecting changes */
  isEqual?: (a: T, b: T) => boolean;
  /** Callback when undo is triggered */
  onUndo?: (state: T) => void;
  /** Callback when redo is triggered */
  onRedo?: (state: T) => void;
  /** Ref to the container element for keyboard events */
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Return type of the useHistory hook
 */
export interface UseHistoryReturn<T> {
  /** Current state */
  state: T;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of entries in undo stack */
  undoCount: number;
  /** Number of entries in redo stack */
  redoCount: number;
  /** Push a new state to history */
  push: (newState: T, description?: string) => void;
  /** Undo to previous state */
  undo: () => T | undefined;
  /** Redo to next state */
  redo: () => T | undefined;
  /** Clear all history */
  clear: () => void;
  /** Reset to initial state and clear history */
  reset: (newInitialState?: T) => void;
  /** Get all undo entries (for debugging/display) */
  getUndoStack: () => HistoryEntry<T>[];
  /** Get all redo entries (for debugging/display) */
  getRedoStack: () => HistoryEntry<T>[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Default equality check using JSON stringify
 */
function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for managing undo/redo history
 */
export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions<T> = {}
): UseHistoryReturn<T> {
  const {
    maxEntries = 100,
    groupingInterval = 500,
    enableKeyboardShortcuts = true,
    isEqual = defaultIsEqual,
    onUndo,
    onRedo,
    containerRef,
  } = options;

  // Current state
  const [state, setState] = useState<T>(initialState);

  // History stacks
  const [undoStack, setUndoStack] = useState<HistoryEntry<T>[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry<T>[]>([]);

  // Track last push time for grouping
  const lastPushTimeRef = useRef<number>(0);

  // Track if we're currently in an undo/redo operation
  const isUndoRedoRef = useRef<boolean>(false);

  /**
   * Push a new state to history
   */
  const push = useCallback(
    (newState: T, description?: string) => {
      // Skip if state hasn't changed
      if (isEqual(state, newState)) {
        return;
      }

      // If this is an undo/redo operation, don't push
      if (isUndoRedoRef.current) {
        setState(newState);
        return;
      }

      const now = Date.now();
      const timeSinceLastPush = now - lastPushTimeRef.current;

      // Check if we should group with previous entry
      if (timeSinceLastPush < groupingInterval && undoStack.length > 0) {
        // Update the most recent entry instead of creating new one
        setUndoStack((prev) => {
          const newStack = [...prev];
          newStack[newStack.length - 1] = {
            state: state, // Keep the state before the grouped changes
            timestamp: now,
            description: description || newStack[newStack.length - 1].description,
          };
          return newStack;
        });
      } else {
        // Push current state to undo stack
        setUndoStack((prev) => {
          const newEntry: HistoryEntry<T> = {
            state,
            timestamp: now,
            description,
          };

          // Limit stack size
          const newStack = [...prev, newEntry];
          if (newStack.length > maxEntries) {
            return newStack.slice(newStack.length - maxEntries);
          }
          return newStack;
        });
      }

      // Clear redo stack on new change
      setRedoStack([]);

      // Update current state
      setState(newState);

      // Update last push time
      lastPushTimeRef.current = now;
    },
    [state, isEqual, groupingInterval, maxEntries, undoStack.length]
  );

  /**
   * Undo to previous state
   */
  const undo = useCallback((): T | undefined => {
    if (undoStack.length === 0) {
      return undefined;
    }

    isUndoRedoRef.current = true;

    // Pop from undo stack
    const prevEntry = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    // Push current state to redo stack
    setRedoStack((prev) => [
      ...prev,
      {
        state,
        timestamp: Date.now(),
      },
    ]);

    // Restore previous state
    setState(prevEntry.state);

    // Reset flag after state update
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);

    // Call callback
    onUndo?.(prevEntry.state);

    return prevEntry.state;
  }, [undoStack, state, onUndo]);

  /**
   * Redo to next state
   */
  const redo = useCallback((): T | undefined => {
    if (redoStack.length === 0) {
      return undefined;
    }

    isUndoRedoRef.current = true;

    // Pop from redo stack
    const nextEntry = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    // Push current state to undo stack
    setUndoStack((prev) => [
      ...prev,
      {
        state,
        timestamp: Date.now(),
      },
    ]);

    // Restore next state
    setState(nextEntry.state);

    // Reset flag after state update
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);

    // Call callback
    onRedo?.(nextEntry.state);

    return nextEntry.state;
  }, [redoStack, state, onRedo]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  /**
   * Reset to initial state and clear history
   */
  const reset = useCallback(
    (newInitialState?: T) => {
      setState(newInitialState ?? initialState);
      setUndoStack([]);
      setRedoStack([]);
      lastPushTimeRef.current = 0;
    },
    [initialState]
  );

  /**
   * Get undo stack (for debugging)
   */
  const getUndoStack = useCallback((): HistoryEntry<T>[] => {
    return [...undoStack];
  }, [undoStack]);

  /**
   * Get redo stack (for debugging)
   */
  const getRedoStack = useCallback((): HistoryEntry<T>[] => {
    return [...redoStack];
  }, [redoStack]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y or Cmd+Shift+Z for redo
      if (
        ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey)
      ) {
        event.preventDefault();
        redo();
        return;
      }
    };

    // Add listener to container or document
    const target = containerRef?.current || document;
    target.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enableKeyboardShortcuts, undo, redo, containerRef]);

  return {
    state,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    push,
    undo,
    redo,
    clear,
    reset,
    getUndoStack,
    getRedoStack,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Simplified hook that just tracks state changes automatically
 */
export function useAutoHistory<T>(
  value: T,
  options: UseHistoryOptions<T> = {}
): Omit<UseHistoryReturn<T>, 'push'> {
  const history = useHistory(value, options);

  // Automatically push when value changes
  useEffect(() => {
    history.push(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return history;
}

/**
 * Hook for document history with specialized comparison
 */
export function useDocumentHistory<T extends { package?: { body?: unknown } }>(
  document: T,
  options: Omit<UseHistoryOptions<T>, 'isEqual'> = {}
): UseHistoryReturn<T> {
  // Compare only the body content for detecting changes
  const isEqual = useCallback((a: T, b: T): boolean => {
    const bodyA = JSON.stringify(a.package?.body);
    const bodyB = JSON.stringify(b.package?.body);
    return bodyA === bodyB;
  }, []);

  return useHistory(document, { ...options, isEqual });
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Create a history manager for non-React usage
 */
export class HistoryManager<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private currentState: T;
  private maxEntries: number;
  private groupingInterval: number;
  private lastPushTime: number = 0;
  private isEqual: (a: T, b: T) => boolean;

  constructor(
    initialState: T,
    options: {
      maxEntries?: number;
      groupingInterval?: number;
      isEqual?: (a: T, b: T) => boolean;
    } = {}
  ) {
    this.currentState = initialState;
    this.maxEntries = options.maxEntries ?? 100;
    this.groupingInterval = options.groupingInterval ?? 500;
    this.isEqual = options.isEqual ?? defaultIsEqual;
  }

  get state(): T {
    return this.currentState;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(newState: T, description?: string): void {
    if (this.isEqual(this.currentState, newState)) {
      return;
    }

    const now = Date.now();
    const timeSinceLastPush = now - this.lastPushTime;

    if (timeSinceLastPush < this.groupingInterval && this.undoStack.length > 0) {
      // Group with previous entry
      this.undoStack[this.undoStack.length - 1].timestamp = now;
    } else {
      // Push new entry
      this.undoStack.push({
        state: this.currentState,
        timestamp: now,
        description,
      });

      // Limit stack size
      if (this.undoStack.length > this.maxEntries) {
        this.undoStack = this.undoStack.slice(-this.maxEntries);
      }
    }

    // Clear redo stack
    this.redoStack = [];

    // Update state
    this.currentState = newState;
    this.lastPushTime = now;
  }

  undo(): T | undefined {
    if (this.undoStack.length === 0) {
      return undefined;
    }

    const prevEntry = this.undoStack.pop()!;

    this.redoStack.push({
      state: this.currentState,
      timestamp: Date.now(),
    });

    this.currentState = prevEntry.state;
    return prevEntry.state;
  }

  redo(): T | undefined {
    if (this.redoStack.length === 0) {
      return undefined;
    }

    const nextEntry = this.redoStack.pop()!;

    this.undoStack.push({
      state: this.currentState,
      timestamp: Date.now(),
    });

    this.currentState = nextEntry.state;
    return nextEntry.state;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  reset(newInitialState?: T): void {
    this.currentState = newInitialState ?? this.currentState;
    this.undoStack = [];
    this.redoStack = [];
    this.lastPushTime = 0;
  }
}

export default useHistory;
