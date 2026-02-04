/**
 * Editor Input Manager
 *
 * Centralized input handling for all pointer events.
 * Provides single source of truth for click, drag, and focus management.
 */

import type { DomPositionIndex } from './DomPositionIndex';

/**
 * Interface for the editor that InputManager controls.
 */
export interface EditorInterface {
  /** Set selection to a position (collapsed) */
  setSelection(pos: number): void;
  /** Set selection range */
  setSelectionRange(from: number, to: number): void;
  /** Get current selection */
  getSelection(): { from: number; to: number } | null;
  /** Focus the editor */
  focus(): void;
}

/**
 * Callback for input events.
 */
export type InputEventCallback = (event: {
  type: 'click' | 'doubleClick' | 'tripleClick' | 'dragStart' | 'drag' | 'dragEnd';
  position?: number;
  from?: number;
  to?: number;
}) => void;

/**
 * Options for EditorInputManager.
 */
export interface EditorInputManagerOptions {
  /** The editor to control */
  editor: EditorInterface;
  /** Position index for click mapping */
  positionIndex: DomPositionIndex;
  /** Callback for input events */
  onInput?: InputEventCallback;
}

/**
 * EditorInputManager handles all pointer input for the paged editor.
 * It provides:
 * - Single/double/triple click detection
 * - Drag selection with anchor tracking
 * - Coordinate normalization for zoom
 * - Focus management
 */
export class EditorInputManager {
  #editor: EditorInterface;
  #positionIndex: DomPositionIndex;
  #container: HTMLElement | null = null;
  #onInput?: InputEventCallback;

  // Drag state
  #isDragging = false;
  #dragAnchor: number | null = null;

  // Multi-click detection
  #lastClickTime = 0;
  #lastClickPos: number | null = null;
  #clickCount = 0;
  static readonly MULTI_CLICK_DELAY = 500; // ms

  // Bound event handlers (for removal)
  #boundPointerDown: (e: PointerEvent) => void;
  #boundPointerMove: (e: PointerEvent) => void;
  #boundPointerUp: (e: PointerEvent) => void;
  #boundPointerLeave: (e: PointerEvent) => void;

  constructor(options: EditorInputManagerOptions) {
    this.#editor = options.editor;
    this.#positionIndex = options.positionIndex;
    this.#onInput = options.onInput;

    // Bind handlers
    this.#boundPointerDown = this.#onPointerDown.bind(this);
    this.#boundPointerMove = this.#onPointerMove.bind(this);
    this.#boundPointerUp = this.#onPointerUp.bind(this);
    this.#boundPointerLeave = this.#onPointerLeave.bind(this);
  }

  /**
   * Attach event listeners to a container element.
   */
  attach(container: HTMLElement): void {
    this.#container = container;
    container.addEventListener('pointerdown', this.#boundPointerDown);
    container.addEventListener('pointermove', this.#boundPointerMove);
    container.addEventListener('pointerup', this.#boundPointerUp);
    container.addEventListener('pointerleave', this.#boundPointerLeave);
  }

  /**
   * Detach event listeners from the container.
   */
  detach(): void {
    if (this.#container) {
      this.#container.removeEventListener('pointerdown', this.#boundPointerDown);
      this.#container.removeEventListener('pointermove', this.#boundPointerMove);
      this.#container.removeEventListener('pointerup', this.#boundPointerUp);
      this.#container.removeEventListener('pointerleave', this.#boundPointerLeave);
      this.#container = null;
    }
  }

  /**
   * Update the position index reference.
   */
  setPositionIndex(positionIndex: DomPositionIndex): void {
    this.#positionIndex = positionIndex;
  }

  /**
   * Get position from client coordinates, accounting for zoom.
   */
  #getPositionFromCoords(clientX: number, clientY: number): number | null {
    // Note: If the container is scaled, we might need to adjust coordinates
    // For now, we rely on the position index to handle this
    const result = this.#positionIndex.getPositionAtPoint(clientX, clientY);
    return result?.pmPosition ?? null;
  }

  /**
   * Handle pointer down - start selection or drag.
   */
  #onPointerDown(e: PointerEvent): void {
    // Only handle left mouse button
    if (e.button !== 0) return;

    // Focus the editor
    this.#editor.focus();

    // Get position from click
    const pos = this.#getPositionFromCoords(e.clientX, e.clientY);
    if (pos === null) return;

    // Detect multi-click
    const now = Date.now();
    const timeSinceLastClick = now - this.#lastClickTime;

    if (timeSinceLastClick < EditorInputManager.MULTI_CLICK_DELAY && this.#lastClickPos === pos) {
      this.#clickCount++;
    } else {
      this.#clickCount = 1;
    }

    this.#lastClickTime = now;
    this.#lastClickPos = pos;

    // Handle based on click count
    if (this.#clickCount === 1) {
      // Single click - position cursor and start drag
      if (e.shiftKey) {
        // Shift-click extends selection
        const current = this.#editor.getSelection();
        if (current) {
          this.#editor.setSelectionRange(current.from, pos);
        } else {
          this.#editor.setSelection(pos);
        }
      } else {
        this.#editor.setSelection(pos);
      }

      // Start drag
      this.#isDragging = true;
      this.#dragAnchor = pos;

      this.#emitEvent({ type: 'click', position: pos });
      this.#emitEvent({ type: 'dragStart', position: pos });
    } else if (this.#clickCount === 2) {
      // Double click - select word
      this.#selectWord(pos);
      this.#emitEvent({ type: 'doubleClick', position: pos });
    } else if (this.#clickCount >= 3) {
      // Triple click - select paragraph
      this.#selectParagraph(pos);
      this.#emitEvent({ type: 'tripleClick', position: pos });
      this.#clickCount = 0; // Reset after triple
    }
  }

  /**
   * Handle pointer move - extend drag selection.
   */
  #onPointerMove(e: PointerEvent): void {
    if (!this.#isDragging || this.#dragAnchor === null) return;

    const pos = this.#getPositionFromCoords(e.clientX, e.clientY);
    if (pos === null) return;

    // Extend selection from anchor to current position
    const from = Math.min(this.#dragAnchor, pos);
    const to = Math.max(this.#dragAnchor, pos);
    this.#editor.setSelectionRange(from, to);

    this.#emitEvent({ type: 'drag', from, to });
  }

  /**
   * Handle pointer up - end drag.
   */
  #onPointerUp(_e: PointerEvent): void {
    if (this.#isDragging) {
      const selection = this.#editor.getSelection();
      this.#emitEvent({
        type: 'dragEnd',
        from: selection?.from,
        to: selection?.to,
      });
    }

    this.#isDragging = false;
  }

  /**
   * Handle pointer leave - end drag if leaving container.
   */
  #onPointerLeave(_e: PointerEvent): void {
    // Don't end drag on leave - let pointerup handle it
    // This allows dragging outside the container
  }

  /**
   * Select the word at a position.
   */
  #selectWord(pos: number): void {
    // Get the text content around the position
    // This is a simplified version - a full implementation would
    // need access to the document content
    const element = this.#positionIndex.getElementAtPosition(pos);
    if (!element) {
      this.#editor.setSelection(pos);
      return;
    }

    const text = element.textContent || '';
    const pmStart = Number(element.dataset.pmStart) || 0;
    const offset = pos - pmStart;

    // Find word boundaries
    let start = offset;
    let end = offset;

    // Go back to start of word
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }

    // Go forward to end of word
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    // Convert back to PM positions
    const from = pmStart + start;
    const to = pmStart + end;

    if (from < to) {
      this.#editor.setSelectionRange(from, to);
    } else {
      this.#editor.setSelection(pos);
    }
  }

  /**
   * Select the paragraph at a position.
   */
  #selectParagraph(pos: number): void {
    // Find the paragraph element containing this position
    const element = this.#positionIndex.getElementAtPosition(pos);
    if (!element) {
      this.#editor.setSelection(pos);
      return;
    }

    // Find the paragraph container
    const paragraph = element.closest('.layout-paragraph') as HTMLElement | null;
    if (!paragraph) {
      this.#editor.setSelection(pos);
      return;
    }

    const pmStart = Number(paragraph.dataset.pmStart);
    const pmEnd = Number(paragraph.dataset.pmEnd);

    if (!isNaN(pmStart) && !isNaN(pmEnd) && pmStart < pmEnd) {
      this.#editor.setSelectionRange(pmStart, pmEnd);
    } else {
      this.#editor.setSelection(pos);
    }
  }

  /**
   * Emit an input event.
   */
  #emitEvent(event: Parameters<InputEventCallback>[0]): void {
    this.#onInput?.(event);
  }

  /**
   * Get current drag state.
   */
  isDragging(): boolean {
    return this.#isDragging;
  }

  /**
   * Get drag anchor position.
   */
  getDragAnchor(): number | null {
    return this.#dragAnchor;
  }

  /**
   * Cancel any ongoing drag.
   */
  cancelDrag(): void {
    this.#isDragging = false;
    this.#dragAnchor = null;
  }
}
