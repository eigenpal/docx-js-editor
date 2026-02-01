import type { DocxEditorProps } from '../types';
import { Toolbar } from './Toolbar';
import { Editor } from './Editor';
import { FileLoader } from './FileLoader';
import { useDocxEditor } from '../hooks/useDocxEditor';

/**
 * Main DocxEditor component
 *
 * A WYSIWYG DOCX editor with toolbar and variable insertion support.
 */
export function DocxEditor({
  initialFile,
  onExport,
  onChange,
  onLoad,
  onError,
  toolbar = true,
  className = '',
  style,
  readOnly = false,
  placeholder = 'Start typing or load a document...',
  variablePrefix = '{',
  variableSuffix = '}',
  suggestedVariables = [],
}: DocxEditorProps) {
  const {
    editorRef,
    editorView,
    docxData,
    isLoading,
    loadFile,
    exportDocument,
    insertVariable,
  } = useDocxEditor({
    initialFile,
    onChange,
    onLoad,
    onError,
  });

  const handleExport = async () => {
    try {
      const blob = await exportDocument();
      if (blob && onExport) {
        const filename = docxData?.filename || 'document.docx';
        onExport(blob, filename);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const showToolbar = toolbar !== false;

  return (
    <div className={`docx-editor ${className}`} style={style}>
      {showToolbar && (
        <Toolbar
          editorView={editorView}
          config={typeof toolbar === 'object' ? toolbar : undefined}
          onExport={handleExport}
          onLoadFile={loadFile}
          onInsertVariable={(name) => insertVariable(name, variablePrefix, variableSuffix)}
          suggestedVariables={suggestedVariables}
          disabled={isLoading || readOnly}
          hasDocument={!!docxData}
        />
      )}

      <div className="docx-editor-content">
        {!docxData && !isLoading && (
          <FileLoader onFileLoad={loadFile} />
        )}

        <Editor
          ref={editorRef}
          readOnly={readOnly}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
