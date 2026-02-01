import React, { useEffect, useRef } from 'react';
import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

interface DocxViewerProps {
  file: File | null;
}

export function DocxViewer({ file }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const superdocRef = useRef<SuperDoc | null>(null);

  useEffect(() => {
    // Clean up previous instance if it exists
    if (superdocRef.current) {
      superdocRef.current.destroy();
      superdocRef.current = null;
    }

    // Don't initialize if no file or no container
    if (!file || !containerRef.current) {
      return;
    }

    // Clear the container before mounting
    containerRef.current.innerHTML = '';

    // Initialize SuperDoc with the File object
    const superdoc = new SuperDoc({
      selector: containerRef.current,
      document: file,
      documentMode: 'editing',
      onReady: (event: unknown) => {
        console.log('SuperDoc is ready', event);
      },
      onEditorCreate: (event: unknown) => {
        console.log('Editor created', event);
      },
    });

    superdocRef.current = superdoc;

    // Cleanup on unmount or when file changes
    return () => {
      if (superdocRef.current) {
        superdocRef.current.destroy();
        superdocRef.current = null;
      }
    };
  }, [file]);

  if (!file) {
    return (
      <div style={placeholderStyle}>
        <p style={{ fontSize: '16px', color: '#666' }}>
          No document loaded. Please select a DOCX file.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
    />
  );
}

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  backgroundColor: '#fafafa',
};

const containerStyle: React.CSSProperties = {
  minHeight: '600px',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
};
