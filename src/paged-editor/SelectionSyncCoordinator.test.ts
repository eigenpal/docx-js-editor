/**
 * SelectionSyncCoordinator Unit Tests
 *
 * Tests epoch-based synchronization between document changes and layout rendering.
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { SelectionSyncCoordinator } from './SelectionSyncCoordinator';

describe('SelectionSyncCoordinator', () => {
  let coordinator: SelectionSyncCoordinator;

  beforeEach(() => {
    coordinator = new SelectionSyncCoordinator();
  });

  describe('document epoch management', () => {
    it('starts with epoch 0', () => {
      expect(coordinator.getDocEpoch()).toBe(0);
    });

    it('setDocEpoch sets the epoch value', () => {
      coordinator.setDocEpoch(5);
      expect(coordinator.getDocEpoch()).toBe(5);
    });

    it('incrementDocEpoch increments and returns new value', () => {
      const result = coordinator.incrementDocEpoch();
      expect(result).toBe(1);
      expect(coordinator.getDocEpoch()).toBe(1);
    });

    it('incrementDocEpoch increments multiple times', () => {
      coordinator.incrementDocEpoch();
      coordinator.incrementDocEpoch();
      const result = coordinator.incrementDocEpoch();
      expect(result).toBe(3);
    });
  });

  describe('layout epoch management', () => {
    it('starts with layout epoch 0', () => {
      expect(coordinator.getLayoutEpoch()).toBe(0);
    });

    it('onLayoutComplete sets layout epoch', () => {
      coordinator.onLayoutComplete(5);
      expect(coordinator.getLayoutEpoch()).toBe(5);
    });
  });

  describe('layout updating state', () => {
    it('is not updating initially', () => {
      expect(coordinator.isSafeToRender()).toBe(true);
    });

    it('onLayoutStart marks as updating (not safe)', () => {
      coordinator.onLayoutStart();
      expect(coordinator.isSafeToRender()).toBe(false);
    });

    it('onLayoutComplete clears updating state', () => {
      coordinator.onLayoutStart();
      coordinator.onLayoutComplete(0);
      expect(coordinator.isSafeToRender()).toBe(true);
    });
  });

  describe('isSafeToRender', () => {
    it('is safe when layout epoch >= doc epoch and not updating', () => {
      coordinator.setDocEpoch(3);
      coordinator.onLayoutComplete(3);
      expect(coordinator.isSafeToRender()).toBe(true);
    });

    it('is safe when layout epoch > doc epoch', () => {
      coordinator.setDocEpoch(2);
      coordinator.onLayoutComplete(5);
      expect(coordinator.isSafeToRender()).toBe(true);
    });

    it('is NOT safe when layout epoch < doc epoch', () => {
      coordinator.setDocEpoch(5);
      coordinator.onLayoutComplete(3);
      expect(coordinator.isSafeToRender()).toBe(false);
    });

    it('is NOT safe when layout is updating', () => {
      coordinator.setDocEpoch(3);
      coordinator.onLayoutComplete(3);
      coordinator.onLayoutStart();
      expect(coordinator.isSafeToRender()).toBe(false);
    });

    it('is NOT safe when both updating and epoch mismatch', () => {
      coordinator.setDocEpoch(5);
      coordinator.onLayoutStart();
      expect(coordinator.isSafeToRender()).toBe(false);
    });
  });

  describe('render callbacks', () => {
    it('onRender registers a callback', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });
      coordinator.requestRender();
      expect(called).toBe(true);
    });

    it('onRender returns unsubscribe function', () => {
      let callCount = 0;
      const unsubscribe = coordinator.onRender(() => {
        callCount++;
      });

      coordinator.requestRender();
      expect(callCount).toBe(1);

      unsubscribe();
      coordinator.requestRender();
      expect(callCount).toBe(1); // Should not increment
    });

    it('multiple callbacks are called', () => {
      let count1 = 0;
      let count2 = 0;

      coordinator.onRender(() => {
        count1++;
      });
      coordinator.onRender(() => {
        count2++;
      });

      coordinator.requestRender();

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('callback errors do not prevent other callbacks', () => {
      let secondCalled = false;

      coordinator.onRender(() => {
        throw new Error('Test error');
      });
      coordinator.onRender(() => {
        secondCalled = true;
      });

      // Should not throw
      coordinator.requestRender();
      expect(secondCalled).toBe(true);
    });
  });

  describe('requestRender', () => {
    it('executes immediately when safe', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.requestRender();
      expect(called).toBe(true);
    });

    it('defers execution when not safe (updating)', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.onLayoutStart();
      coordinator.requestRender();
      expect(called).toBe(false);
    });

    it('defers execution when not safe (epoch mismatch)', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.setDocEpoch(5);
      coordinator.requestRender();
      expect(called).toBe(false);
    });

    it('pending render executes when layout completes', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.setDocEpoch(1);
      coordinator.onLayoutStart();
      coordinator.requestRender();
      expect(called).toBe(false);

      coordinator.onLayoutComplete(1);
      expect(called).toBe(true);
    });

    it('pending render requires matching epoch', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.setDocEpoch(2);
      coordinator.onLayoutStart();
      coordinator.requestRender();

      // Complete with old epoch
      coordinator.onLayoutComplete(1);
      expect(called).toBe(false);

      // Complete with matching epoch
      coordinator.onLayoutComplete(2);
      expect(called).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      coordinator.setDocEpoch(10);
      coordinator.onLayoutStart();
      coordinator.onLayoutComplete(5);
      coordinator.requestRender(); // Creates pending render

      coordinator.reset();

      expect(coordinator.getDocEpoch()).toBe(0);
      expect(coordinator.getLayoutEpoch()).toBe(0);
      expect(coordinator.isSafeToRender()).toBe(true);
    });

    it('clears pending render', () => {
      let called = false;
      coordinator.onRender(() => {
        called = true;
      });

      coordinator.setDocEpoch(5);
      coordinator.requestRender();
      expect(called).toBe(false);

      coordinator.reset();

      // After reset, should be safe but pending was cleared
      expect(coordinator.isSafeToRender()).toBe(true);

      // Complete layout - no pending render should execute
      coordinator.onLayoutComplete(0);
      expect(called).toBe(false);
    });
  });

  describe('getDebugInfo', () => {
    it('returns current state', () => {
      coordinator.setDocEpoch(3);
      coordinator.onLayoutComplete(2);

      const info = coordinator.getDebugInfo();

      expect(info.docEpoch).toBe(3);
      expect(info.layoutEpoch).toBe(2);
      expect(info.layoutUpdating).toBe(false);
      expect(info.hasPendingRender).toBe(false);
      expect(info.isSafe).toBe(false);
    });

    it('shows updating state', () => {
      coordinator.onLayoutStart();
      const info = coordinator.getDebugInfo();
      expect(info.layoutUpdating).toBe(true);
    });

    it('shows pending render', () => {
      coordinator.onRender(() => {});
      coordinator.setDocEpoch(5);
      coordinator.requestRender();

      const info = coordinator.getDebugInfo();
      expect(info.hasPendingRender).toBe(true);
    });

    it('shows safe state', () => {
      coordinator.setDocEpoch(3);
      coordinator.onLayoutComplete(3);

      const info = coordinator.getDebugInfo();
      expect(info.isSafe).toBe(true);
    });
  });

  describe('typical workflow', () => {
    it('handles document change -> layout -> render cycle', () => {
      let renderCount = 0;
      coordinator.onRender(() => {
        renderCount++;
      });

      // 1. Document changes
      const epoch = coordinator.incrementDocEpoch();
      expect(epoch).toBe(1);

      // 2. Request render (should defer - layout stale)
      coordinator.requestRender();
      expect(renderCount).toBe(0);

      // 3. Layout starts
      coordinator.onLayoutStart();
      expect(coordinator.isSafeToRender()).toBe(false);

      // 4. Another change while layout in progress
      coordinator.incrementDocEpoch();

      // 5. Layout completes with old epoch
      coordinator.onLayoutComplete(1);
      expect(renderCount).toBe(0); // Still not safe, epoch 2 > 1

      // 6. Layout starts again
      coordinator.onLayoutStart();

      // 7. Layout completes with current epoch
      coordinator.onLayoutComplete(2);
      expect(renderCount).toBe(1); // Now safe!
    });

    it('handles rapid changes gracefully', () => {
      let renderCount = 0;
      coordinator.onRender(() => {
        renderCount++;
      });

      // Rapid document changes
      for (let i = 0; i < 10; i++) {
        coordinator.incrementDocEpoch();
        coordinator.requestRender();
      }

      // Only one render should be pending
      expect(renderCount).toBe(0);

      // Layout catches up
      coordinator.onLayoutComplete(10);
      expect(renderCount).toBe(1);
    });
  });
});
