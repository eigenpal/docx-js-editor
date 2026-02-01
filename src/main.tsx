import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileLoader } from './components/FileLoader';

function App() {
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(undefined);

  const handleFileLoaded = (file: File, buffer: ArrayBuffer) => {
    setFileName(file.name);
    setRawBuffer(buffer);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>DOCX Editor</h1>
      <FileLoader onFileLoaded={handleFileLoaded} loadedFileName={fileName} />
      {rawBuffer && (
        <p style={{ marginTop: '16px', color: '#666' }}>
          Buffer loaded: {rawBuffer.byteLength} bytes
        </p>
      )}
    </div>
  );
}

const rootElement = document.getElementById('app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}

export * from './index';
