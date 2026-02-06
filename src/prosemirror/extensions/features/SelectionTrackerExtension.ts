/**
 * Selection Tracker Extension — wraps createSelectionTrackerPlugin
 */

import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';
import {
  createSelectionTrackerPlugin,
  extractSelectionContext,
  type SelectionChangeCallback,
} from '../../plugins/selectionTracker';

export const SelectionTrackerExtension = createExtension<{
  onSelectionChange?: SelectionChangeCallback;
}>({
  name: 'selectionTracker',
  defaultOptions: {},
  onSchemaReady(_ctx, options): ExtensionRuntime {
    return {
      plugins: [createSelectionTrackerPlugin(options.onSelectionChange)],
      commands: {
        extractSelectionContext: () => {
          // This is a query, not a command, but we expose it for convenience
          return (state, _dispatch) => {
            extractSelectionContext(state);
            return true;
          };
        },
      },
    };
  },
});
