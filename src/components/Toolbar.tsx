import React from 'react';
import type { EditorView } from 'prosemirror-view';
import type { ToolbarConfig } from '../types';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  FolderOpen,
} from 'lucide-react';
import { Button } from './ui/Button';
import { VariableInserter } from './VariableInserter';

interface ToolbarProps {
  editorView: EditorView | null;
  config?: ToolbarConfig;
  onExport?: () => void;
  onLoadFile?: (file: File) => void;
  onInsertVariable?: (name: string) => void;
  suggestedVariables?: string[];
  disabled?: boolean;
  hasDocument?: boolean;
}

const defaultConfig: ToolbarConfig = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: false,
  fontSize: true,
  fontColor: true,
  highlight: false,
  alignment: true,
  insertVariable: true,
  export: true,
  load: true,
};

export function Toolbar({
  editorView,
  config = defaultConfig,
  onExport,
  onLoadFile,
  onInsertVariable,
  suggestedVariables = [],
  disabled = false,
  hasDocument = false,
}: ToolbarProps) {
  const mergedConfig = { ...defaultConfig, ...config };

  const toggleMark = (markType: string) => {
    if (!editorView) return;
    // TODO: Implement mark toggling with ProseMirror commands
    console.log('Toggle mark:', markType);
  };

  const setAlignment = (alignment: string) => {
    if (!editorView) return;
    // TODO: Implement alignment with ProseMirror commands
    console.log('Set alignment:', alignment);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadFile) {
      onLoadFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="docx-editor-toolbar">
      {/* File operations */}
      {mergedConfig.load && (
        <label>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            asChild
          >
            <span>
              <FolderOpen className="h-4 w-4 mr-1" />
              Open
            </span>
          </Button>
        </label>
      )}

      {mergedConfig.export && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={disabled || !hasDocument}
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      )}

      <div className="w-px h-6 bg-border mx-1" />

      {/* Text formatting */}
      {mergedConfig.bold && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMark('bold')}
          disabled={disabled || !hasDocument}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
      )}

      {mergedConfig.italic && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMark('italic')}
          disabled={disabled || !hasDocument}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
      )}

      {mergedConfig.underline && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMark('underline')}
          disabled={disabled || !hasDocument}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
      )}

      {mergedConfig.strikethrough && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleMark('strikethrough')}
          disabled={disabled || !hasDocument}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
      )}

      <div className="w-px h-6 bg-border mx-1" />

      {/* Alignment */}
      {mergedConfig.alignment && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlignment('left')}
            disabled={disabled || !hasDocument}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlignment('center')}
            disabled={disabled || !hasDocument}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlignment('right')}
            disabled={disabled || !hasDocument}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </>
      )}

      <div className="flex-1" />

      {/* Variable insertion */}
      {mergedConfig.insertVariable && (
        <VariableInserter
          onInsert={onInsertVariable}
          suggestions={suggestedVariables}
          disabled={disabled || !hasDocument}
        />
      )}
    </div>
  );
}
