import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <div id="app" />;
}

const rootElement = document.getElementById('app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}

export * from './index';
