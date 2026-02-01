import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocxEditor } from '../src/components/DocxEditor';
import '../src/styles.css';

function App() {
  const handleExport = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleError = (error: Error) => {
    console.error('DocxEditor error:', error);
    alert(`Error: ${error.message}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            DOCX Template Editor
          </h1>
          <p className="text-gray-600 mt-2">
            Load a DOCX file, edit it, insert template variables, and export.
          </p>
        </header>

        <DocxEditor
          onExport={handleExport}
          onError={handleError}
          suggestedVariables={[
            'clientName',
            'date',
            'companyName',
            'address',
            'amount',
          ]}
          className="shadow-lg"
        />

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>@eigenpal/docx-editor v0.1.0</p>
        </footer>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
