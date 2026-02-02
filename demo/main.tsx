/**
 * DOCX Editor Demo
 *
 * Complete demo showing all features:
 * - Load sample or custom DOCX
 * - Full editing with toolbar
 * - Context menu AI (mock handler)
 * - Save/download
 * - Variable panel
 */

import './styles.css';
import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { DocxEditor, type DocxEditorRef, createEmptyDocument, type Document } from '../src/index';

// ============================================================================
// DEMO APP
// ============================================================================

function DemoApp() {
  const editorRef = useRef<DocxEditorRef>(null);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(() =>
    createEmptyDocument()
  );
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('Untitled.docx');
  const [status, setStatus] = useState<string>('');

  // Handle new document
  const handleNewDocument = useCallback(() => {
    setCurrentDocument(createEmptyDocument());
    setDocumentBuffer(null);
    setFileName('Untitled.docx');
    setStatus('');
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Loading...');
      const buffer = await file.arrayBuffer();
      setCurrentDocument(null); // Clear document state so buffer takes precedence
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
        // Create download link
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

  // Handle document change
  const handleDocumentChange = useCallback((_doc: Document) => {
    console.log('Document changed');
  }, []);

  // Handle error
  const handleError = useCallback((error: Error) => {
    console.error('Editor error:', error);
    setStatus(`Error: ${error.message}`);
  }, []);

  // Handle fonts loaded
  const handleFontsLoaded = useCallback(() => {
    console.log('Fonts loaded');
  }, []);

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <a
            href="https://github.com/eigenpal/docx-js-editor"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.titleLink}
          >
            <h1 style={styles.title}>docx-js-editor</h1>
          </a>
          {fileName && <span style={styles.fileName}>{fileName}</span>}
        </div>
        <div style={styles.headerRight}>
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

      {/* Editor */}
      <main style={styles.main}>
        <DocxEditor
          ref={editorRef}
          document={documentBuffer ? undefined : currentDocument}
          documentBuffer={documentBuffer}
          onChange={handleDocumentChange}
          onError={handleError}
          onFontsLoaded={handleFontsLoaded}
          showToolbar={true}
          showVariablePanel={true}
          showZoomControl={true}
          initialZoom={1.0}
          variablePanelPosition="right"
        />
      </main>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
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
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: 500,
    margin: '24px 0 8px',
    color: '#333',
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#999',
    marginBottom: '12px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '13px',
    color: '#666',
    textAlign: 'left',
  },
};

// ============================================================================
// MOUNT
// ============================================================================

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<DemoApp />);
}
