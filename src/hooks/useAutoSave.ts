/**
 * useAutoSave Hook
 *
 * Automatically saves document state to localStorage at configurable intervals.
 *
 * Features:
 * - Configurable save interval (default: 30 seconds)
 * - Saves document JSON to localStorage
 * - Recovery of saved state on load
 * - Manual save trigger
 * - Last save timestamp tracking
 * - Save status callbacks
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from '../types/document';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Auto-save status
 */
export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Options for useAutoSave hook
 */
export interface UseAutoSaveOptions {
  /** Storage key for localStorage (default: 'docx-editor-autosave') */
  storageKey?: string;
  /** Save interval in milliseconds (default: 30000 - 30 seconds) */
  interval?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Maximum age of auto-save in milliseconds before it's considered stale (default: 24 hours) */
  maxAge?: number;
  /** Callback when save succeeds */
  onSave?: (timestamp: Date) => void;
  /** Callback when save fails */
  onError?: (error: Error) => void;
  /** Callback when recovery data is found */
  onRecoveryAvailable?: (savedDocument: SavedDocumentData) => void;
  /** Whether to save immediately when document changes (debounced) */
  saveOnChange?: boolean;
  /** Debounce delay for saveOnChange in milliseconds (default: 2000) */
  debounceDelay?: number;
}

/**
 * Return value of useAutoSave hook
 */
export interface UseAutoSaveReturn {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Last save timestamp */
  lastSaveTime: Date | null;
  /** Manually trigger a save */
  save: () => Promise<boolean>;
  /** Clear auto-saved data from storage */
  clearAutoSave: () => void;
  /** Check if there's recoverable data */
  hasRecoveryData: boolean;
  /** Get the saved document data for recovery */
  getRecoveryData: () => SavedDocumentData | null;
  /** Accept and apply recovered data */
  acceptRecovery: () => Document | null;
  /** Dismiss recovery (clears saved data) */
  dismissRecovery: () => void;
  /** Whether auto-save is currently enabled */
  isEnabled: boolean;
  /** Enable auto-save */
  enable: () => void;
  /** Disable auto-save */
  disable: () => void;
}

/**
 * Saved document data structure
 */
export interface SavedDocumentData {
  /** The document JSON */
  document: Document;
  /** When the document was saved */
  savedAt: string;
  /** Version for format compatibility */
  version: number;
  /** Optional document identifier */
  documentId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_STORAGE_KEY = 'docx-editor-autosave';
const DEFAULT_INTERVAL = 30000; // 30 seconds
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_DEBOUNCE_DELAY = 2000; // 2 seconds
const SAVE_VERSION = 1;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__docx_editor_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serialize document for storage
 * Excludes the original buffer to save space
 */
function serializeDocument(document: Document): string {
  const serializable = {
    ...document,
    originalBuffer: null, // Don't store the binary buffer
  };
  return JSON.stringify(serializable);
}

/**
 * Parse saved document data
 */
function parseSavedData(json: string): SavedDocumentData | null {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    if (!data.document || !data.savedAt) return null;
    if (data.version !== SAVE_VERSION) {
      // Handle version migration in future if needed
      console.warn('Auto-save data version mismatch, may need migration');
    }
    return data as SavedDocumentData;
  } catch {
    return null;
  }
}

/**
 * Check if saved data is stale (too old)
 */
function isStale(savedAt: string, maxAge: number): boolean {
  const savedTime = new Date(savedAt).getTime();
  const now = Date.now();
  return now - savedTime > maxAge;
}

// ============================================================================
// USE AUTO SAVE HOOK
// ============================================================================

/**
 * React hook for auto-saving document to localStorage
 */
export function useAutoSave(
  document: Document | null | undefined,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    interval = DEFAULT_INTERVAL,
    enabled: initialEnabled = true,
    maxAge = DEFAULT_MAX_AGE,
    onSave,
    onError,
    onRecoveryAvailable,
    saveOnChange = true,
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
  } = options;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [hasRecoveryData, setHasRecoveryData] = useState(false);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);

  const documentRef = useRef(document);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);
  const storageAvailableRef = useRef(isLocalStorageAvailable());

  // Keep document ref updated
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  /**
   * Save document to localStorage
   */
  const save = useCallback(async (): Promise<boolean> => {
    if (!storageAvailableRef.current) {
      onError?.(new Error('localStorage is not available'));
      return false;
    }

    const doc = documentRef.current;
    if (!doc) {
      return false;
    }

    setStatus('saving');

    try {
      const serialized = serializeDocument(doc);

      // Skip if document hasn't changed since last save
      if (serialized === lastSavedJsonRef.current) {
        setStatus('saved');
        return true;
      }

      const savedData: SavedDocumentData = {
        document: doc,
        savedAt: new Date().toISOString(),
        version: SAVE_VERSION,
      };

      // Serialize again with metadata (can't reuse because we stripped buffer)
      const dataToSave: SavedDocumentData = {
        document: {
          ...doc,
          originalBuffer: null as any,
        },
        savedAt: savedData.savedAt,
        version: SAVE_VERSION,
      };

      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      lastSavedJsonRef.current = serialized;

      const saveTime = new Date();
      setLastSaveTime(saveTime);
      setStatus('saved');
      onSave?.(saveTime);

      return true;
    } catch (error) {
      console.error('Auto-save failed:', error);
      setStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [storageKey, onSave, onError]);

  /**
   * Clear auto-saved data
   */
  const clearAutoSave = useCallback(() => {
    if (!storageAvailableRef.current) return;

    try {
      localStorage.removeItem(storageKey);
      setHasRecoveryData(false);
      lastSavedJsonRef.current = null;
    } catch (error) {
      console.error('Failed to clear auto-save:', error);
    }
  }, [storageKey]);

  /**
   * Get recovery data from storage
   */
  const getRecoveryData = useCallback((): SavedDocumentData | null => {
    if (!storageAvailableRef.current) return null;

    try {
      const savedJson = localStorage.getItem(storageKey);
      if (!savedJson) return null;

      const savedData = parseSavedData(savedJson);
      if (!savedData) return null;

      // Check if stale
      if (isStale(savedData.savedAt, maxAge)) {
        clearAutoSave();
        return null;
      }

      return savedData;
    } catch {
      return null;
    }
  }, [storageKey, maxAge, clearAutoSave]);

  /**
   * Accept and return recovered document
   */
  const acceptRecovery = useCallback((): Document | null => {
    const recoveryData = getRecoveryData();
    if (!recoveryData) return null;

    setHasRecoveryData(false);
    return recoveryData.document;
  }, [getRecoveryData]);

  /**
   * Dismiss recovery and clear saved data
   */
  const dismissRecovery = useCallback(() => {
    clearAutoSave();
    setHasRecoveryData(false);
  }, [clearAutoSave]);

  /**
   * Enable auto-save
   */
  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  /**
   * Disable auto-save
   */
  const disable = useCallback(() => {
    setIsEnabled(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Check for recovery data on mount
  useEffect(() => {
    if (!storageAvailableRef.current) return;

    const recoveryData = getRecoveryData();
    if (recoveryData) {
      setHasRecoveryData(true);
      onRecoveryAvailable?.(recoveryData);
    }
  }, [getRecoveryData, onRecoveryAvailable]);

  // Set up interval auto-save
  useEffect(() => {
    if (!isEnabled || !storageAvailableRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      save();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, interval, save]);

  // Debounced save on document change
  useEffect(() => {
    if (!isEnabled || !saveOnChange || !document || !storageAvailableRef.current) {
      return;
    }

    // Clear existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce timer
    debounceRef.current = setTimeout(() => {
      save();
    }, debounceDelay);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [isEnabled, saveOnChange, document, debounceDelay, save]);

  // Save on unmount if enabled
  useEffect(() => {
    return () => {
      if (isEnabled && documentRef.current && storageAvailableRef.current) {
        // Synchronous save on unmount
        try {
          const doc = documentRef.current;
          const dataToSave: SavedDocumentData = {
            document: {
              ...doc,
              originalBuffer: null as any,
            },
            savedAt: new Date().toISOString(),
            version: SAVE_VERSION,
          };
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        } catch (error) {
          console.error('Failed to save on unmount:', error);
        }
      }
    };
  }, [isEnabled, storageKey]);

  return {
    status,
    lastSaveTime,
    save,
    clearAutoSave,
    hasRecoveryData,
    getRecoveryData,
    acceptRecovery,
    dismissRecovery,
    isEnabled,
    enable,
    disable,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format last save time for display
 */
export function formatLastSaveTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

/**
 * Get auto-save status label
 */
export function getAutoSaveStatusLabel(status: AutoSaveStatus): string {
  const labels: Record<AutoSaveStatus, string> = {
    idle: 'Ready',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
  };
  return labels[status];
}

/**
 * Get storage size used by auto-save
 */
export function getAutoSaveStorageSize(storageKey: string = DEFAULT_STORAGE_KEY): number {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return 0;
    return new Blob([data]).size;
  } catch {
    return 0;
  }
}

/**
 * Format storage size for display
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if auto-save is supported in this environment
 */
export function isAutoSaveSupported(): boolean {
  return isLocalStorageAvailable();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useAutoSave;
