/**
 * DOCX Editor Demo
 *
 * Complete demo showing all features:
 * - Load sample or custom DOCX
 * - Full editing with toolbar
 * - Context menu AI (mock handler)
 * - Save/download
 * - Variable panel
 *
 * Routes:
 * - / - Default editor demo
 * - /docxtemplater - Template plugin demo
 */

import './styles.css';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DocxEditor,
  type DocxEditorRef,
  createEmptyDocument,
  type Document,
  PluginHost,
  templatePlugin,
} from '../src/index';

// ============================================================================
// SHARED STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: '#f8fafc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  titleLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  fileName: {
    fontSize: '13px',
    color: '#64748b',
    padding: '4px 10px',
    background: '#f1f5f9',
    borderRadius: '6px',
  },
  badge: {
    fontSize: '11px',
    color: '#fff',
    padding: '3px 8px',
    background: '#3b82f6',
    borderRadius: '4px',
    fontWeight: 500,
  },
  fileInputLabel: {
    padding: '8px 14px',
    background: '#0f172a',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.15s',
  },
  fileInputHidden: {
    display: 'none',
  },
  button: {
    padding: '8px 14px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#334155',
    transition: 'all 0.15s',
  },
  newButton: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  navLink: {
    padding: '6px 12px',
    fontSize: '13px',
    color: '#64748b',
    textDecoration: 'none',
    borderRadius: '4px',
    transition: 'all 0.15s',
  },
  navLinkActive: {
    padding: '6px 12px',
    fontSize: '13px',
    color: '#3b82f6',
    textDecoration: 'none',
    background: '#eff6ff',
    borderRadius: '4px',
    fontWeight: 500,
  },
  status: {
    fontSize: '12px',
    color: '#64748b',
    padding: '4px 8px',
    background: '#f1f5f9',
    borderRadius: '4px',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
};

// ============================================================================
// SAMPLE TEMPLATE DOCUMENT
// ============================================================================

function createTemplateDocument(): Document {
  const doc = createEmptyDocument();
  const body = doc.package.document;

  // Add template content to the first paragraph
  if (body.content.length > 0 && body.content[0].type === 'paragraph') {
    body.content[0].content = [
      {
        type: 'run',
        content: [{ type: 'text', text: 'Dear {name},' }],
      },
    ];
  }

  // Add more paragraphs with template syntax
  body.content.push(
    {
      type: 'paragraph',
      content: [],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [
            {
              type: 'text',
              text: 'Thank you for your order. Here are your items:',
            },
          ],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: '{#items}' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [
            {
              type: 'text',
              text: '  • {items.name} - ${items.price} x {items.quantity}',
            },
          ],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: '{/items}' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: '{#hasDiscount}' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: 'Discount applied: {discountPercent}%' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: '{/hasDiscount}' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: 'Total: ${total}' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: 'Best regards,' }],
        },
      ],
      formatting: {},
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'run',
          content: [{ type: 'text', text: '{company.name}' }],
        },
      ],
      formatting: {},
    }
  );

  return doc;
}

// ============================================================================
// SHARED EDITOR WRAPPER
// ============================================================================

interface EditorWrapperProps {
  editorRef: React.RefObject<DocxEditorRef>;
  currentDocument: Document | null;
  documentBuffer: ArrayBuffer | null;
  onDocumentChange: (doc: Document) => void;
  onError: (error: Error) => void;
  onFontsLoaded: () => void;
  withTemplatePlugin?: boolean;
}

function EditorWrapper({
  editorRef,
  currentDocument,
  documentBuffer,
  onDocumentChange,
  onError,
  onFontsLoaded,
  withTemplatePlugin = false,
}: EditorWrapperProps) {
  const editor = (
    <DocxEditor
      ref={editorRef}
      document={documentBuffer ? undefined : currentDocument}
      documentBuffer={documentBuffer}
      onChange={onDocumentChange}
      onError={onError}
      onFontsLoaded={onFontsLoaded}
      showToolbar={true}
      showRuler={true}
      showVariablePanel={!withTemplatePlugin}
      showZoomControl={true}
      initialZoom={1.0}
      variablePanelPosition="right"
    />
  );

  if (withTemplatePlugin) {
    return <PluginHost plugins={[templatePlugin]}>{editor}</PluginHost>;
  }

  return editor;
}

// ============================================================================
// BASE DEMO APP (shared logic)
// ============================================================================

interface BaseDemoProps {
  title: string;
  badge?: string;
  withTemplatePlugin?: boolean;
  initialDocument?: Document | null;
}

function BaseDemo({ title, badge, withTemplatePlugin = false, initialDocument }: BaseDemoProps) {
  const editorRef = useRef<DocxEditorRef>(null);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(
    () => initialDocument ?? createEmptyDocument()
  );
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('Untitled.docx');
  const [status, setStatus] = useState<string>('');
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle new document
  const handleNewDocument = useCallback(() => {
    setCurrentDocument(withTemplatePlugin ? createTemplateDocument() : createEmptyDocument());
    setDocumentBuffer(null);
    setFileName(withTemplatePlugin ? 'template.docx' : 'Untitled.docx');
    setStatus('');
  }, [withTemplatePlugin]);

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Loading...');
      const buffer = await file.arrayBuffer();
      setCurrentDocument(null);
      setDocumentBuffer(buffer);
      setFileName(file.name);
      setStatus('');
    } catch (error) {
      setStatus('Error loading file');
      console.error('Failed to load file:', error);
    }
  }, []);

  // Handle save/download
  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;

    try {
      setStatus('Saving...');
      const buffer = await editorRef.current.save();
      if (buffer) {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Saved!');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (error) {
      setStatus('Save failed');
      console.error('Failed to save:', error);
    }
  }, [fileName]);

  const handleDocumentChange = useCallback((_doc: Document) => {
    console.log('Document changed');
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('Editor error:', error);
    setStatus(`Error: ${error.message}`);
  }, []);

  const handleFontsLoaded = useCallback(() => {
    console.log('Fonts loaded');
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <a
            href="https://github.com/eigenpal/docx-js-editor"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.titleLink}
          >
            <h1 style={styles.title}>{title}</h1>
          </a>
          {badge && <span style={styles.badge}>{badge}</span>}
          {fileName && <span style={styles.fileName}>{fileName}</span>}
        </div>
        <div style={styles.headerRight}>
          {/* Navigation */}
          <a href="#/" style={currentPath === '/' ? styles.navLinkActive : styles.navLink}>
            Editor
          </a>
          <a
            href="#/docxtemplater"
            style={currentPath === '/docxtemplater' ? styles.navLinkActive : styles.navLink}
          >
            Template
          </a>
          <span style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />
          <label style={styles.fileInputLabel}>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileSelect}
              style={styles.fileInputHidden}
            />
            Open DOCX
          </label>
          <button style={styles.newButton} onClick={handleNewDocument}>
            New
          </button>
          <button style={styles.button} onClick={handleSave}>
            Save
          </button>
          {status && <span style={styles.status}>{status}</span>}
        </div>
      </header>

      <main style={styles.main}>
        <EditorWrapper
          editorRef={editorRef}
          currentDocument={currentDocument}
          documentBuffer={documentBuffer}
          onDocumentChange={handleDocumentChange}
          onError={handleError}
          onFontsLoaded={handleFontsLoaded}
          withTemplatePlugin={withTemplatePlugin}
        />
      </main>
    </div>
  );
}

// ============================================================================
// ROUTER
// ============================================================================

function Router() {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setPath(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (path === '/docxtemplater') {
    return (
      <BaseDemo
        title="docx-js-editor"
        badge="Template Plugin"
        withTemplatePlugin={true}
        initialDocument={createTemplateDocument()}
      />
    );
  }

  return <BaseDemo title="docx-js-editor" />;
}

// ============================================================================
// MOUNT
// ============================================================================

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<Router />);
}
