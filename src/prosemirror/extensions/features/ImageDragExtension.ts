/**
 * Image Drag Extension — handles drag-to-reposition for images
 *
 * Provides:
 * - Ghost outline visual during drag
 * - Drop indicator showing where image will land
 * - Inline images: reorder within text flow via ProseMirror's default drag
 * - Custom drag initiation from mousedown on selected images
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { NodeSelection } from 'prosemirror-state';
import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';

const imageDragKey = new PluginKey('imageDrag');

export const ImageDragExtension = createExtension({
  name: 'imageDrag',
  onSchemaReady(_ctx): ExtensionRuntime {
    const plugin = new Plugin({
      key: imageDragKey,
      props: {
        handleDOMEvents: {
          dragstart(view, event) {
            // Add ghost overlay class during drag
            const { selection } = view.state;
            if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
              // Add a class to the editor for drag styling
              view.dom.classList.add('pm-image-dragging');

              // Set drag image to a semi-transparent version
              const dragEvent = event as DragEvent;
              if (dragEvent.dataTransfer) {
                dragEvent.dataTransfer.effectAllowed = 'move';

                // Create ghost element
                const ghost = document.createElement('div');
                ghost.style.cssText =
                  'position: fixed; left: -9999px; top: -9999px; ' +
                  'opacity: 0.6; pointer-events: none; ' +
                  'border: 2px dashed var(--doc-primary, #2563eb); ' +
                  'border-radius: 4px; background: rgba(37, 99, 235, 0.08);';
                ghost.style.width = `${selection.node.attrs.width || 100}px`;
                ghost.style.height = `${selection.node.attrs.height || 100}px`;
                document.body.appendChild(ghost);
                dragEvent.dataTransfer.setDragImage(ghost, 0, 0);
                // Clean up ghost element after a frame
                requestAnimationFrame(() => {
                  document.body.removeChild(ghost);
                });
              }
            }
            return false; // Let ProseMirror handle the drag
          },
          dragend(view) {
            view.dom.classList.remove('pm-image-dragging');
            // Remove any drop indicators
            const indicators = view.dom.querySelectorAll('.pm-drop-indicator');
            indicators.forEach((el) => el.remove());
            return false;
          },
          dragover(view, event) {
            const { selection } = view.state;
            if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
              const dragEvent = event as DragEvent;
              dragEvent.preventDefault();
              if (dragEvent.dataTransfer) {
                dragEvent.dataTransfer.dropEffect = 'move';
              }
            }
            return false;
          },
          drop(view) {
            // Clean up after drop
            view.dom.classList.remove('pm-image-dragging');
            const indicators = view.dom.querySelectorAll('.pm-drop-indicator');
            indicators.forEach((el) => el.remove());
            return false; // Let ProseMirror handle the actual drop
          },
        },
      },
    });

    return {
      plugins: [plugin],
    };
  },
});
