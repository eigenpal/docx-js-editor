import { useState, useRef, useCallback, useEffect } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { DocxData } from '../types';
import { parseDocx } from '../docx/parser';
import { exportDocx } from '../docx/exporter';

interface UseDocxEditorOptions {
  initialFile?: File | Blob | ArrayBuffer;
  onChange?: (hasChanges: boolean) => void;
  onLoad?: (data: DocxData) => void;
  onError?: (error: Error) => void;
}

export function useDocxEditor({
  initialFile,
  onChange,
  onLoad,
  onError,
}: UseDocxEditorOptions = {}) {
  const editorRef = useRef<{ view: EditorView | null; focus: () => void } | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [docxData, setDocxData] = useState<DocxData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Notify parent of changes
  useEffect(() => {
    onChange?.(hasChanges);
  }, [hasChanges, onChange]);

  // Load initial file
  useEffect(() => {
    if (initialFile) {
      if (initialFile instanceof File) {
        loadFile(initialFile);
      } else if (initialFile instanceof Blob) {
        loadFile(new File([initialFile], 'document.docx'));
      } else if (initialFile instanceof ArrayBuffer) {
        loadFile(new File([initialFile], 'document.docx'));
      }
    }
  }, [initialFile]);

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const data = await parseDocx(file);
      setDocxData(data);
      setHasChanges(false);
      onLoad?.(data);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [onLoad, onError]);

  const exportDocument = useCallback(async (): Promise<Blob | null> => {
    if (!docxData || !editorView) return null;

    try {
      const blob = await exportDocx(docxData, editorView.state.doc);
      return blob;
    } catch (error) {
      onError?.(error as Error);
      return null;
    }
  }, [docxData, editorView, onError]);

  const insertVariable = useCallback((
    name: string,
    prefix: string = '{',
    suffix: string = '}'
  ) => {
    if (!editorView) return;

    const { state, dispatch } = editorView;
    const { from, to } = state.selection;
    const variableText = `${prefix}${name}${suffix}`;

    const tr = state.tr.insertText(variableText, from, to);
    dispatch(tr);
  }, [editorView]);

  return {
    editorRef,
    editorView,
    setEditorView,
    docxData,
    isLoading,
    hasChanges,
    loadFile,
    exportDocument,
    insertVariable,
  };
}
