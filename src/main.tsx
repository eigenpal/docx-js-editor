/**
 * Main entry point for the DOCX editor application
 */
import { createRoot } from 'react-dom/client';

// Placeholder App component - will be replaced with DocxEditor
function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>EigenPal DOCX Editor</h1>
      <p>Loading editor...</p>
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
