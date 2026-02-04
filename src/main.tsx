/**
 * Main entry point for the DOCX editor application
 */
import React, { useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { DocxEditor } from './components/DocxEditor';
import './index.css';

/**
 * Main App component that provides file loading and editor functionality.
 */
function App() {
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setDocumentBuffer(buffer);
      setFileName(file.name);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  }, []);

  // Handle creating a new document
  const handleNew = useCallback(() => {
    setDocumentBuffer(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with file controls */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          style={{ fontSize: '14px' }}
        />
        {documentBuffer && (
          <>
            <span style={{ color: '#666', fontSize: '14px' }}>{fileName || 'Document loaded'}</span>
            <button
              onClick={handleNew}
              style={{
                padding: '4px 12px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              New
            </button>
          </>
        )}
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DocxEditor
          documentBuffer={documentBuffer}
          showToolbar={true}
          showVariablePanel={true}
          showZoomControl={true}
          showPageNumbers={true}
          usePaginatedEditor={true}
          onError={(error) => console.error('Editor error:', error)}
        />
      </div>
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export { App };
