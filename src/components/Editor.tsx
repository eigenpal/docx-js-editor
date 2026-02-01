import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema as baseSchema } from '../editor/schema';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';

interface EditorProps {
  readOnly?: boolean;
  placeholder?: string;
  onReady?: (view: EditorView) => void;
}

export interface EditorRef {
  view: EditorView | null;
  focus: () => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(
  { readOnly = false, placeholder = '', onReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    view: viewRef.current,
    focus: () => viewRef.current?.focus(),
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      schema: baseSchema,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(containerRef.current, {
      state,
      editable: () => !readOnly,
      attributes: {
        'data-placeholder': placeholder,
      },
    });

    viewRef.current = view;
    onReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [readOnly, placeholder]);

  return (
    <div
      ref={containerRef}
      className="prose prose-sm max-w-none min-h-[300px] p-4 focus-within:outline-none"
    />
  );
});
