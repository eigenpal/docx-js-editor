import React, { useState, useCallback } from 'react';

interface FileLoaderProps {
  onFileLoaded: (file: File, buffer: ArrayBuffer) => void;
  loadedFileName?: string;
}

export function FileLoader({
  onFileLoaded,
  loadedFileName,
}: FileLoaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const readFileAsArrayBuffer = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      onFileLoaded(file, buffer);
    };
    reader.readAsArrayBuffer(file);
  }, [onFileLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
      readFileAsArrayBuffer(file);
    }
  }, [readFileAsArrayBuffer]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const dropZoneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: '32px',
    border: `2px dashed ${isDragOver ? '#0066cc' : '#ccc'}`,
    borderRadius: '8px',
    backgroundColor: isDragOver ? '#f0f8ff' : '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={dropZoneStyle}
      >
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>
          Drop a DOCX file here
        </p>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
          or click to browse
        </p>

        <label>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <span style={buttonStyle}>Select File</span>
        </label>
      </div>

      {loadedFileName && (
        <p style={{ marginTop: '12px', fontSize: '14px', color: '#333' }}>
          Loaded: <strong>{loadedFileName}</strong>
        </p>
      )}
    </div>
  );
}
