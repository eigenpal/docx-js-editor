import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileLoader } from './components/FileLoader';
import { DocxViewer } from './components/DocxViewer';

function App() {
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(undefined);

  const handleFileLoaded = (loadedFile: File, buffer: ArrayBuffer) => {
    setFileName(loadedFile.name);
    setFile(loadedFile);
    setRawBuffer(buffer);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>DOCX Editor</h1>
      <FileLoader onFileLoaded={handleFileLoaded} loadedFileName={fileName} />
      {rawBuffer && (
        <p style={{ marginTop: '16px', marginBottom: '16px', color: '#666' }}>
          Buffer loaded: {rawBuffer.byteLength} bytes
        </p>
      )}
      <div style={{ marginTop: '20px' }}>
        <DocxViewer file={file} />
      </div>
    </div>
  );
}

const rootElement = document.getElementById('app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}

export * from './index';
