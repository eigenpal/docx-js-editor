/**
 * Visual Line Navigation Hook
 *
 * Implements visual-line-aware ArrowUp/ArrowDown navigation with sticky X.
 * Extracted from PagedEditor.tsx for better separation of concerns.
 *
 * This hook provides:
 * - getCaretClientX: Get the screen X of the caret at a PM position
 * - findLineElementAtPosition: Find the .layout-line element for a PM position
 * - findPositionOnLineAtClientX: Find a PM position on a line at a given screen X
 * - handlePMKeyDown: Key handler for ArrowUp/ArrowDown with sticky X
 */

import { useCallback, useRef } from 'react';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export interface VisualLineNavigationOptions {
  pagesContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVisualLineNavigation({ pagesContainerRef }: VisualLineNavigationOptions) {
  const stickyXRef = useRef<number | null>(null);
  const lastVisualLineIndexRef = useRef<number>(-1);

  /**
   * Get the client X coordinate of the caret at a PM position.
   */
  const getCaretClientX = useCallback(
    (pmPos: number): number | null => {
      if (!pagesContainerRef.current) return null;

      const spans = pagesContainerRef.current.querySelectorAll('span[data-pm-start][data-pm-end]');
      for (const span of Array.from(spans)) {
        const spanEl = span as HTMLElement;
        const pmStart = Number(spanEl.dataset.pmStart);
        const pmEnd = Number(spanEl.dataset.pmEnd);

        if (spanEl.classList.contains('layout-run-tab')) {
          if (pmPos >= pmStart && pmPos < pmEnd) {
            return spanEl.getBoundingClientRect().left;
          }
          continue;
        }

        if (pmPos >= pmStart && pmPos <= pmEnd && span.firstChild?.nodeType === Node.TEXT_NODE) {
          const textNode = span.firstChild as Text;
          const charIndex = Math.min(pmPos - pmStart, textNode.length);
          const ownerDoc = spanEl.ownerDocument;
          if (!ownerDoc) continue;
          const range = ownerDoc.createRange();
          range.setStart(textNode, charIndex);
          range.setEnd(textNode, charIndex);
          return range.getBoundingClientRect().left;
        }
      }

      // Check empty paragraphs
      const emptyRuns = pagesContainerRef.current.querySelectorAll('.layout-empty-run');
      for (const emptyRun of Array.from(emptyRuns)) {
        const paragraph = emptyRun.closest('.layout-paragraph') as HTMLElement;
        if (!paragraph) continue;
        const pmStart = Number(paragraph.dataset.pmStart);
        const pmEnd = Number(paragraph.dataset.pmEnd);
        if (pmPos >= pmStart && pmPos <= pmEnd) {
          return emptyRun.getBoundingClientRect().left;
        }
      }

      return null;
    },
    [pagesContainerRef]
  );

  /**
   * Find the visual line element (.layout-line) containing a PM position.
   */
  const findLineElementAtPosition = useCallback(
    (pmPos: number): HTMLElement | null => {
      if (!pagesContainerRef.current) return null;

      const allLines = pagesContainerRef.current.querySelectorAll('.layout-line');

      // First pass: check span ranges (most precise)
      for (const line of Array.from(allLines)) {
        const lineEl = line as HTMLElement;
        const spans = lineEl.querySelectorAll('span[data-pm-start][data-pm-end]');
        for (const span of Array.from(spans)) {
          const s = span as HTMLElement;
          const start = Number(s.dataset.pmStart);
          const end = Number(s.dataset.pmEnd);
          if (pmPos >= start && pmPos <= end) {
            return lineEl;
          }
        }
      }

      // Second pass: check paragraph ranges (handles boundary positions
      // and empty paragraphs where no spans have pm data)
      for (const line of Array.from(allLines)) {
        const lineEl = line as HTMLElement;
        const paragraph = lineEl.closest('.layout-paragraph') as HTMLElement;
        if (!paragraph) continue;
        const pStart = Number(paragraph.dataset.pmStart);
        const pEnd = Number(paragraph.dataset.pmEnd);
        if (pmPos >= pStart && pmPos <= pEnd) {
          const firstLineOfParagraph = paragraph.querySelector('.layout-line');
          if (firstLineOfParagraph === lineEl) {
            return lineEl;
          }
        }
      }

      return null;
    },
    [pagesContainerRef]
  );

  /**
   * Find the PM position on a visual line closest to a client X coordinate.
   */
  const findPositionOnLineAtClientX = useCallback(
    (lineEl: HTMLElement, clientX: number): number | null => {
      const spans = lineEl.querySelectorAll('span[data-pm-start][data-pm-end]');

      if (spans.length === 0) {
        // Empty line - return paragraph content start
        const paragraph = lineEl.closest('.layout-paragraph') as HTMLElement;
        if (paragraph?.dataset.pmStart) {
          return Number(paragraph.dataset.pmStart) + 1;
        }
        return null;
      }

      // Check each span for the target X
      for (const span of Array.from(spans)) {
        const spanEl = span as HTMLElement;
        const rect = spanEl.getBoundingClientRect();
        const pmStart = Number(spanEl.dataset.pmStart);
        const pmEnd = Number(spanEl.dataset.pmEnd);

        if (spanEl.classList.contains('layout-run-tab')) {
          if (clientX >= rect.left && clientX <= rect.right) {
            const mid = (rect.left + rect.right) / 2;
            return clientX < mid ? pmStart : pmEnd;
          }
          continue;
        }

        if (clientX >= rect.left && clientX <= rect.right) {
          const textNode = spanEl.firstChild;
          if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return pmStart;

          const text = textNode as Text;
          const ownerDoc = spanEl.ownerDocument;
          if (!ownerDoc) return pmStart;

          // Binary search for the character at clientX
          let lo = 0;
          let hi = text.length;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            const r = ownerDoc.createRange();
            r.setStart(text, mid);
            r.setEnd(text, mid);
            if (clientX < r.getBoundingClientRect().left) {
              hi = mid;
            } else {
              lo = mid + 1;
            }
          }

          // Refine: check closer boundary
          if (lo > 0 && lo <= text.length) {
            const r = ownerDoc.createRange();
            r.setStart(text, lo - 1);
            r.setEnd(text, lo - 1);
            const leftX = r.getBoundingClientRect().left;
            r.setStart(text, Math.min(lo, text.length));
            r.setEnd(text, Math.min(lo, text.length));
            const rightX = r.getBoundingClientRect().left;
            if (Math.abs(clientX - leftX) < Math.abs(clientX - rightX)) {
              return pmStart + (lo - 1);
            }
          }
          return pmStart + Math.min(lo, pmEnd - pmStart);
        }
      }

      // clientX not within any span - find closest span
      let closestSpan: HTMLElement | null = null;
      let closestDist = Infinity;
      for (const span of Array.from(spans)) {
        const spanEl = span as HTMLElement;
        const rect = spanEl.getBoundingClientRect();
        const dist = clientX < rect.left ? rect.left - clientX : clientX - rect.right;
        if (dist < closestDist) {
          closestDist = dist;
          closestSpan = spanEl;
        }
      }

      if (!closestSpan) return null;
      const rect = closestSpan.getBoundingClientRect();
      return clientX < rect.left
        ? Number(closestSpan.dataset.pmStart)
        : Number(closestSpan.dataset.pmEnd);
    },
    []
  );

  /**
   * Handle key events on the ProseMirror EditorView BEFORE PM processes them.
   * Implements visual-line-aware ArrowUp/ArrowDown with sticky X.
   */
  const handlePMKeyDown = useCallback(
    (view: EditorView, event: KeyboardEvent): boolean => {
      // Clear sticky state on non-vertical navigation
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        if (
          ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
          (event.key.length === 1 && !event.ctrlKey && !event.metaKey)
        ) {
          stickyXRef.current = null;
          lastVisualLineIndexRef.current = -1;
        }
        return false; // Let PM handle
      }

      // Don't intercept Ctrl/Meta + arrow (move to doc start/end)
      if (event.ctrlKey || event.metaKey) {
        stickyXRef.current = null;
        lastVisualLineIndexRef.current = -1;
        return false;
      }

      if (!pagesContainerRef.current) return false;

      const allLines = Array.from(pagesContainerRef.current.querySelectorAll('.layout-line'));
      if (allLines.length === 0) return false;

      const { from, anchor } = view.state.selection;

      // Set sticky X from current caret position if not already set
      if (stickyXRef.current === null) {
        const clientX = getCaretClientX(from);
        if (clientX === null) return false;
        stickyXRef.current = clientX;
      }

      // Find current line index - use tracked index if available
      let currentIndex: number;
      if (lastVisualLineIndexRef.current >= 0 && lastVisualLineIndexRef.current < allLines.length) {
        currentIndex = lastVisualLineIndexRef.current;
      } else {
        const currentLine = findLineElementAtPosition(from);
        if (!currentLine) return false;
        currentIndex = allLines.indexOf(currentLine);
        if (currentIndex === -1) return false;
      }

      // Find target line
      const targetIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= allLines.length) {
        lastVisualLineIndexRef.current = -1;
        return false;
      }

      const targetLine = allLines[targetIndex] as HTMLElement;

      // Find PM position on target line at sticky X
      const newPos = findPositionOnLineAtClientX(targetLine, stickyXRef.current);
      if (newPos === null) return false;

      // Track which line we navigated to
      lastVisualLineIndexRef.current = targetIndex;

      // Set selection
      const { state, dispatch } = view;
      const clampedPos = Math.max(0, Math.min(newPos, state.doc.content.size));

      try {
        const sel = event.shiftKey
          ? TextSelection.create(state.doc, anchor, clampedPos)
          : TextSelection.create(state.doc, clampedPos);
        dispatch(state.tr.setSelection(sel));
      } catch {
        const $newPos = state.doc.resolve(clampedPos);
        const sel = event.shiftKey
          ? TextSelection.between(state.doc.resolve(anchor), $newPos)
          : TextSelection.near($newPos);
        dispatch(state.tr.setSelection(sel));
      }

      return true;
    },
    [pagesContainerRef, getCaretClientX, findLineElementAtPosition, findPositionOnLineAtClientX]
  );

  return {
    stickyXRef,
    lastVisualLineIndexRef,
    getCaretClientX,
    findLineElementAtPosition,
    findPositionOnLineAtClientX,
    handlePMKeyDown,
  };
}
