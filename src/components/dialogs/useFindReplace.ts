/**
 * useFindReplace Hook
 *
 * React hook for managing find/replace dialog state.
 * Extracted from FindReplaceDialog.tsx.
 */

import { useState, useCallback } from 'react';
import type { FindMatch, FindOptions } from './findReplaceUtils';
import { createDefaultFindOptions } from './findReplaceUtils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for the useFindReplace hook
 */
export interface FindReplaceOptions {
  /** Whether to show replace functionality initially */
  initialReplaceMode?: boolean;
  /** Callback when matches change */
  onMatchesChange?: (matches: FindMatch[]) => void;
  /** Callback when current match changes */
  onCurrentMatchChange?: (match: FindMatch | null, index: number) => void;
}

/**
 * State for the find/replace hook
 */
export interface FindReplaceState {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current search text */
  searchText: string;
  /** Current replace text */
  replaceText: string;
  /** Find options */
  options: FindOptions;
  /** All matches found */
  matches: FindMatch[];
  /** Current match index */
  currentIndex: number;
  /** Whether in replace mode */
  replaceMode: boolean;
}

/**
 * Return type for the useFindReplace hook
 */
export interface UseFindReplaceReturn {
  /** Current state */
  state: FindReplaceState;
  /** Open the find dialog */
  openFind: (selectedText?: string) => void;
  /** Open the replace dialog */
  openReplace: (selectedText?: string) => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle dialog visibility */
  toggle: () => void;
  /** Update search text */
  setSearchText: (text: string) => void;
  /** Update replace text */
  setReplaceText: (text: string) => void;
  /** Update find options */
  setOptions: (options: Partial<FindOptions>) => void;
  /** Set search results */
  setMatches: (matches: FindMatch[], currentIndex?: number) => void;
  /** Go to next match */
  goToNextMatch: () => number;
  /** Go to previous match */
  goToPreviousMatch: () => number;
  /** Go to a specific match by index */
  goToMatch: (index: number) => void;
  /** Get current match */
  getCurrentMatch: () => FindMatch | null;
  /** Check if has matches */
  hasMatches: () => boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing find/replace dialog state
 */
export function useFindReplace(hookOptions?: FindReplaceOptions): UseFindReplaceReturn {
  const [state, setState] = useState<FindReplaceState>({
    isOpen: false,
    searchText: '',
    replaceText: '',
    options: createDefaultFindOptions(),
    matches: [],
    currentIndex: 0,
    replaceMode: hookOptions?.initialReplaceMode ?? false,
  });

  const openFind = useCallback((selectedText?: string) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      replaceMode: false,
      searchText: selectedText || prev.searchText,
      matches: [],
      currentIndex: 0,
    }));
  }, []);

  const openReplace = useCallback((selectedText?: string) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      replaceMode: true,
      searchText: selectedText || prev.searchText,
      matches: [],
      currentIndex: 0,
    }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  const setSearchText = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      searchText: text,
    }));
  }, []);

  const setReplaceText = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      replaceText: text,
    }));
  }, []);

  const setOptions = useCallback((options: Partial<FindOptions>) => {
    setState((prev) => ({
      ...prev,
      options: { ...prev.options, ...options },
    }));
  }, []);

  const setMatches = useCallback(
    (matches: FindMatch[], currentIndex: number = 0) => {
      const newIndex = Math.max(0, Math.min(currentIndex, matches.length - 1));
      setState((prev) => ({
        ...prev,
        matches,
        currentIndex: matches.length > 0 ? newIndex : 0,
      }));
      hookOptions?.onMatchesChange?.(matches);
      if (matches.length > 0) {
        hookOptions?.onCurrentMatchChange?.(matches[newIndex], newIndex);
      } else {
        hookOptions?.onCurrentMatchChange?.(null, -1);
      }
    },
    [hookOptions]
  );

  const goToNextMatch = useCallback(() => {
    let newIndex = 0;
    setState((prev) => {
      if (prev.matches.length === 0) return prev;
      newIndex = (prev.currentIndex + 1) % prev.matches.length;
      return { ...prev, currentIndex: newIndex };
    });
    return newIndex;
  }, []);

  const goToPreviousMatch = useCallback(() => {
    let newIndex = 0;
    setState((prev) => {
      if (prev.matches.length === 0) return prev;
      newIndex = prev.currentIndex === 0 ? prev.matches.length - 1 : prev.currentIndex - 1;
      return { ...prev, currentIndex: newIndex };
    });
    return newIndex;
  }, []);

  const goToMatch = useCallback((index: number) => {
    setState((prev) => {
      if (prev.matches.length === 0 || index < 0 || index >= prev.matches.length) {
        return prev;
      }
      return { ...prev, currentIndex: index };
    });
  }, []);

  const getCurrentMatch = useCallback((): FindMatch | null => {
    if (state.matches.length === 0) return null;
    return state.matches[state.currentIndex] || null;
  }, [state.matches, state.currentIndex]);

  const hasMatches = useCallback(() => state.matches.length > 0, [state.matches.length]);

  return {
    state,
    openFind,
    openReplace,
    close,
    toggle,
    setSearchText,
    setReplaceText,
    setOptions,
    setMatches,
    goToNextMatch,
    goToPreviousMatch,
    goToMatch,
    getCurrentMatch,
    hasMatches,
  };
}
