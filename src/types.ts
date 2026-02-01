import type { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';

export interface DocxEditorProps {
  /** Initial file to load */
  initialFile?: File | Blob | ArrayBuffer;

  /** Callback when document is exported */
  onExport?: (blob: Blob, filename: string) => void;

  /** Callback when document changes */
  onChange?: (hasChanges: boolean) => void;

  /** Callback when document is loaded */
  onLoad?: (data: DocxData) => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Toolbar configuration - true for all, false for none */
  toolbar?: ToolbarConfig | boolean;

  /** Additional CSS class */
  className?: string;

  /** Inline styles */
  style?: React.CSSProperties;

  /** Read-only mode */
  readOnly?: boolean;

  /** Placeholder text when empty */
  placeholder?: string;

  /** Variable prefix (default: '{') */
  variablePrefix?: string;

  /** Variable suffix (default: '}') */
  variableSuffix?: string;

  /** Suggested variable names for autocomplete */
  suggestedVariables?: string[];
}

export interface ToolbarConfig {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: boolean;
  fontColor?: boolean;
  highlight?: boolean;
  alignment?: boolean;
  insertVariable?: boolean;
  export?: boolean;
  load?: boolean;
}

export interface DocxData {
  /** Original file name */
  filename: string;

  /** Raw files from DOCX zip */
  files: Map<string, string | Uint8Array>;

  /** Parsed document.xml content */
  documentXml: string;

  /** Media files (images) */
  media: Map<string, Blob>;

  /** Styles from styles.xml */
  stylesXml?: string;

  /** Theme from theme1.xml */
  themeXml?: string;
}

export interface EditorContextValue {
  view: EditorView | null;
  state: EditorState | null;
  docxData: DocxData | null;
  isLoading: boolean;
  hasChanges: boolean;
}
