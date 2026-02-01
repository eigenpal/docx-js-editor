// Main exports for @eigenpal/docx-editor

// Components
export { DocxEditor } from './components/DocxEditor';
export { Toolbar } from './components/Toolbar';
export { Editor } from './components/Editor';
export { FileLoader } from './components/FileLoader';
export { VariableInserter } from './components/VariableInserter';

// Hooks
export { useDocxEditor } from './hooks/useDocxEditor';

// Utilities
export { parseDocx } from './docx/parser';
export { serializeDocx } from './docx/serializer';
export { exportDocx } from './docx/exporter';

// Types
export type { DocxEditorProps, ToolbarConfig, DocxData } from './types';
