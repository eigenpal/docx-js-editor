/**
 * Drop Cursor Extension — shows a visual indicator when dragging content
 *
 * Uses prosemirror-dropcursor to display a cursor line at the drop position
 * when dragging images or other content within the editor.
 */

import { dropCursor } from 'prosemirror-dropcursor';
import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';

export const DropCursorExtension = createExtension({
  name: 'dropCursor',
  onSchemaReady(): ExtensionRuntime {
    return {
      plugins: [
        dropCursor({
          color: 'var(--doc-primary, #4285f4)',
          width: 2,
        }),
      ],
    };
  },
});
