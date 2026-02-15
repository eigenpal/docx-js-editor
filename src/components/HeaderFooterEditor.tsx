/**
 * HeaderFooterEditor — inline overlay editor for header/footer content
 *
 * When the user double-clicks a header or footer area on a page,
 * this overlay appears with a dedicated ProseMirror EditorView.
 * The main document body is dimmed. Changes are saved back to the
 * document model when the user clicks outside or presses Escape.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { schema, singletonManager } from '../prosemirror/schema';
import { headerFooterToProseDoc } from '../prosemirror/conversion/toProseDoc';
import { proseDocToBlocks } from '../prosemirror/conversion/fromProseDoc';
import type { HeaderFooter, Paragraph, Table, StyleDefinitions } from '../types/document';

import 'prosemirror-view/style/prosemirror.css';

export interface HeaderFooterEditorProps {
  /** The header or footer being edited */
  headerFooter: HeaderFooter;
  /** Whether editing header or footer */
  position: 'header' | 'footer';
  /** Document styles for style resolution */
  styles?: StyleDefinitions | null;
  /** Width of the editing area in pixels */
  widthPx: number;
  /** Callback when editing is complete — receives updated content blocks */
  onSave: (content: Array<Paragraph | Table>) => void;
  /** Callback when editing is cancelled (Escape or click outside) */
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9998,
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
};

const editorContainerStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 9999,
  backgroundColor: 'white',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '80vh',
};

const headerBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid var(--doc-border, #e5e7eb)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--doc-text, #374151)',
};

const editorAreaStyle: CSSProperties = {
  padding: 16,
  overflow: 'auto',
  flex: 1,
  minHeight: 80,
};

const buttonBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '8px 16px',
  borderTop: '1px solid var(--doc-border, #e5e7eb)',
};

const btnBaseStyle: CSSProperties = {
  padding: '6px 16px',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
  border: '1px solid var(--doc-border, #d1d5db)',
  backgroundColor: 'white',
  color: 'var(--doc-text, #374151)',
};

const btnPrimaryStyle: CSSProperties = {
  ...btnBaseStyle,
  backgroundColor: 'var(--doc-primary, #2563eb)',
  color: 'white',
  border: '1px solid var(--doc-primary, #2563eb)',
};

export function HeaderFooterEditor({
  headerFooter,
  position,
  styles,
  widthPx,
  onSave,
  onClose,
}: HeaderFooterEditorProps): React.ReactElement {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Create ProseMirror editor on mount
  useEffect(() => {
    if (!editorContainerRef.current) return;

    // Convert header/footer content to PM document
    const pmDoc = headerFooterToProseDoc(headerFooter.content, {
      styles: styles || undefined,
    });

    // Use plugins from the singleton manager (already includes history + keymaps)
    const plugins = singletonManager.getPlugins();

    const state = EditorState.create({
      doc: pmDoc,
      schema,
      plugins,
    });

    const view = new EditorView(editorContainerRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);
        if (tr.docChanged) {
          setIsDirty(true);
        }
      },
    });

    viewRef.current = view;

    // Auto-focus the editor
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleSave = useCallback(() => {
    if (!viewRef.current) return;
    const blocks = proseDocToBlocks(viewRef.current.state.doc);
    onSave(blocks);
  }, [onSave]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      // Auto-save on close if dirty
      handleSave();
    } else {
      onClose();
    }
  }, [isDirty, handleSave, onClose]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const label = position === 'header' ? 'Edit Header' : 'Edit Footer';

  return (
    <>
      {/* Dimming overlay */}
      <div
        style={overlayStyle}
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      />

      {/* Editor dialog */}
      <div
        style={{
          ...editorContainerStyle,
          width: Math.max(widthPx + 32, 400),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div style={headerBarStyle}>
          <span>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--doc-text-muted, #9ca3af)' }}>
            {headerFooter.hdrFtrType || 'default'}
          </span>
        </div>

        {/* ProseMirror editor area */}
        <div
          style={{
            ...editorAreaStyle,
            width: widthPx,
            margin: '0 auto',
          }}
        >
          <div
            ref={editorContainerRef}
            className="hf-editor-pm"
            style={{
              minHeight: 60,
              outline: 'none',
            }}
          />
        </div>

        {/* Button bar */}
        <div style={buttonBarStyle}>
          <button type="button" style={btnBaseStyle} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={btnPrimaryStyle} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}
