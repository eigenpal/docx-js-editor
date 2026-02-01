import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// Demo app - will be replaced with actual DocxEditor once implemented
function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => {
      setStatus('ready');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setDocumentBuffer(buffer);
      console.log('Loaded DOCX:', file.name, 'Size:', buffer.byteLength);
    } catch (error) {
      console.error('Failed to load file:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading DOCX Editor...</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error loading editor</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header / Toolbar area */}
      <header style={styles.header} data-testid="toolbar">
        <h1 style={styles.title}>DOCX Editor</h1>
        <div style={styles.toolbar}>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
          <button style={styles.button}>Bold</button>
          <button style={styles.button}>Italic</button>
          <button style={styles.button}>Underline</button>
        </div>
      </header>

      {/* Main content area */}
      <main style={styles.main}>
        {documentBuffer ? (
          <div style={styles.editor} data-testid="editor">
            <div style={styles.page} data-testid="document-viewer">
              <p style={styles.placeholder}>
                Document loaded ({documentBuffer.byteLength} bytes)
              </p>
              <p style={styles.info}>
                Parser and renderer will be implemented in upcoming tasks.
              </p>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState} data-testid="empty-state">
            <h2>No Document Loaded</h2>
            <p>Select a .docx file to get started</p>
          </div>
        )}
      </main>

      {/* Variable Panel (sidebar) */}
      <aside style={styles.sidebar} data-testid="variable-panel">
        <h3 style={styles.sidebarTitle}>Template Variables</h3>
        <p style={styles.sidebarContent}>
          Variables will appear here once a document is loaded.
        </p>
      </aside>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gridTemplateColumns: '1fr 300px',
    minHeight: '100vh',
    gap: '1px',
    background: '#ddd',
  },
  header: {
    gridColumn: '1 / -1',
    background: '#fff',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    borderBottom: '1px solid #ddd',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
  },
  toolbar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  button: {
    padding: '6px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
  fileInput: {
    fontSize: '14px',
  },
  main: {
    background: '#f0f0f0',
    padding: '20px',
    overflow: 'auto',
  },
  editor: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  page: {
    background: '#fff',
    minHeight: '600px',
    padding: '40px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  placeholder: {
    color: '#666',
    marginBottom: '10px',
  },
  info: {
    color: '#999',
    fontSize: '14px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center',
  },
  sidebar: {
    background: '#fff',
    padding: '20px',
    borderLeft: '1px solid #ddd',
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  sidebarContent: {
    color: '#666',
    fontSize: '14px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gridColumn: '1 / -1',
    height: '100vh',
    color: '#666',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gridColumn: '1 / -1',
    height: '100vh',
    color: '#c00',
  },
};

// Mount the app
const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
