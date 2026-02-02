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

import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DocxEditor,
  type DocxEditorRef,
  createMockAIHandler,
  type AIActionRequest,
  type AgentResponse,
  type Document,
} from '../src/index';

// ============================================================================
// DEMO APP
// ============================================================================

function DemoApp() {
  const editorRef = useRef<DocxEditorRef>(null);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [lastAction, setLastAction] = useState<string>('');

  // Mock AI handler with delay
  const mockAIHandler = useCallback(async (request: AIActionRequest): Promise<AgentResponse> => {
    setLastAction(`AI: ${request.action}`);
    const handler = createMockAIHandler(1500);
    const response = await handler(request);
    setLastAction(`AI: ${request.action} - Done`);
    return response;
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Loading...');
      const buffer = await file.arrayBuffer();
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
  const handleDocumentChange = useCallback((doc: Document) => {
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
          <h1 style={styles.title}>DOCX Editor Demo</h1>
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
          <button
            style={styles.button}
            onClick={handleSave}
            disabled={!documentBuffer}
          >
            Save
          </button>
          {status && <span style={styles.status}>{status}</span>}
          {lastAction && <span style={styles.action}>{lastAction}</span>}
        </div>
      </header>

      {/* Editor */}
      <main style={styles.main}>
        {documentBuffer ? (
          <DocxEditor
            ref={editorRef}
            documentBuffer={documentBuffer}
            onAgentRequest={mockAIHandler}
            onChange={handleDocumentChange}
            onError={handleError}
            onFontsLoaded={handleFontsLoaded}
            showToolbar={true}
            showVariablePanel={true}
            showZoomControl={true}
            initialZoom={1.0}
            variablePanelPosition="right"
          />
        ) : (
          <div style={styles.emptyState}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <h2 style={styles.emptyTitle}>No Document Loaded</h2>
            <p style={styles.emptyText}>Click "Open DOCX" to load a document</p>
            <p style={styles.emptyHint}>
              Features:
            </p>
            <ul style={styles.featureList}>
              <li>Full text formatting (bold, italic, underline, etc.)</li>
              <li>Paragraph styles and alignment</li>
              <li>Tables, images, and shapes</li>
              <li>Template variables (&#123;variable&#125;)</li>
              <li>Right-click for AI actions</li>
              <li>Zoom control</li>
            </ul>
          </div>
        )}
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
    background: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
    color: '#1a73e8',
  },
  fileName: {
    fontSize: '14px',
    color: '#666',
    padding: '4px 8px',
    background: '#f0f0f0',
    borderRadius: '4px',
  },
  fileInputLabel: {
    padding: '8px 16px',
    background: '#1a73e8',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  fileInputHidden: {
    display: 'none',
  },
  button: {
    padding: '8px 16px',
    background: '#fff',
    border: '1px solid #dadce0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  status: {
    fontSize: '13px',
    color: '#666',
    padding: '4px 8px',
    background: '#f0f0f0',
    borderRadius: '4px',
  },
  action: {
    fontSize: '13px',
    color: '#1a73e8',
    padding: '4px 8px',
    background: '#e8f0fe',
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
