/**
 * Selection Sync Coordinator
 *
 * Ensures selection rendering only happens when layout is current.
 * Uses epoch-based synchronization to prevent stale cursor positions.
 *
 * Based on WYSIWYG Editor's SelectionSyncCoordinator pattern.
 */

type RenderCallback = () => void;

/**
 * SelectionSyncCoordinator manages the synchronization between
 * document changes and layout rendering to ensure selection
 * only renders when the DOM is up-to-date.
 *
 * Workflow:
 * 1. Document changes → setDocEpoch(++epoch)
 * 2. Layout starts → onLayoutStart()
 * 3. Layout completes → onLayoutComplete(epoch)
 * 4. Selection update requested → requestRender()
 * 5. If safe → callback is called
 */
export class SelectionSyncCoordinator {
  /** Current document state version */
  #docEpoch = 0;

  /** Last painted layout version */
  #layoutEpoch = 0;

  /** Whether layout is currently being computed/painted */
  #layoutUpdating = false;

  /** Pending render callback */
  #pendingRender: RenderCallback | null = null;

  /** Registered render callbacks */
  #renderCallbacks: Set<RenderCallback> = new Set();

  /**
   * Set the document epoch (call when document changes).
   * This should be called on every ProseMirror transaction that changes the doc.
   */
  setDocEpoch(epoch: number): void {
    this.#docEpoch = epoch;
  }

  /**
   * Increment document epoch (convenience method).
   * Returns the new epoch value.
   */
  incrementDocEpoch(): number {
    return ++this.#docEpoch;
  }

  /**
   * Get current document epoch.
   */
  getDocEpoch(): number {
    return this.#docEpoch;
  }

  /**
   * Get current layout epoch.
   */
  getLayoutEpoch(): number {
    return this.#layoutEpoch;
  }

  /**
   * Called when layout computation starts.
   */
  onLayoutStart(): void {
    this.#layoutUpdating = true;
  }

  /**
   * Called when layout computation and DOM painting completes.
   * @param epoch - The document epoch that was just painted
   */
  onLayoutComplete(epoch: number): void {
    this.#layoutEpoch = epoch;
    this.#layoutUpdating = false;

    // If there's a pending render and it's now safe, execute it
    this.#tryRender();
  }

  /**
   * Check if it's safe to render selection.
   * Safe when: layout is not updating AND layout epoch >= doc epoch
   */
  isSafeToRender(): boolean {
    return !this.#layoutUpdating && this.#layoutEpoch >= this.#docEpoch;
  }

  /**
   * Request a selection render. Will be executed when safe.
   * If already safe, executes immediately.
   */
  requestRender(): void {
    if (this.isSafeToRender()) {
      this.#executeRender();
    } else {
      // Mark that we have a pending render
      this.#pendingRender = () => this.#executeRender();
    }
  }

  /**
   * Register a callback to be called on render events.
   */
  onRender(callback: RenderCallback): () => void {
    this.#renderCallbacks.add(callback);
    return () => {
      this.#renderCallbacks.delete(callback);
    };
  }

  /**
   * Try to execute pending render if safe.
   */
  #tryRender(): void {
    if (this.#pendingRender && this.isSafeToRender()) {
      const render = this.#pendingRender;
      this.#pendingRender = null;
      render();
    }
  }

  /**
   * Execute all registered render callbacks.
   */
  #executeRender(): void {
    for (const callback of this.#renderCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('SelectionSyncCoordinator: render callback error', error);
      }
    }
  }

  /**
   * Reset the coordinator state (useful for testing or document reload).
   */
  reset(): void {
    this.#docEpoch = 0;
    this.#layoutEpoch = 0;
    this.#layoutUpdating = false;
    this.#pendingRender = null;
  }

  /**
   * Get debug info about current state.
   */
  getDebugInfo(): {
    docEpoch: number;
    layoutEpoch: number;
    layoutUpdating: boolean;
    hasPendingRender: boolean;
    isSafe: boolean;
  } {
    return {
      docEpoch: this.#docEpoch,
      layoutEpoch: this.#layoutEpoch,
      layoutUpdating: this.#layoutUpdating,
      hasPendingRender: this.#pendingRender !== null,
      isSafe: this.isSafeToRender(),
    };
  }
}
