/**
 * DocxEditor Helper Components
 *
 * Small presentational components used by DocxEditor for
 * loading, placeholder, and error states.
 */

import React from 'react';
import type { Document } from '../types/document';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Default loading indicator
 */
export function DefaultLoadingIndicator(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '20px',
        color: 'var(--doc-text-muted)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--doc-border)',
          borderTopColor: 'var(--doc-primary)',
          borderRadius: '50%',
          animation: 'docx-spin 0.8s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes docx-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ fontSize: '14px' }}>Loading document...</div>
    </div>
  );
}

/**
 * Default placeholder
 */
export function DefaultPlaceholder(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--doc-text-placeholder)',
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <div style={{ marginTop: '16px' }}>No document loaded</div>
    </div>
  );
}

/**
 * Parse error display
 */
export function ParseError({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div style={{ color: 'var(--doc-error)', marginBottom: '16px' }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16v.01" />
        </svg>
      </div>
      <h3 style={{ color: 'var(--doc-error)', marginBottom: '8px' }}>Failed to Load Document</h3>
      <p style={{ color: 'var(--doc-text-muted)', maxWidth: '400px' }}>{message}</p>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract variable names from document
 */
export function extractVariableNames(doc: Document): string[] {
  const variables = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;

  const extractFromParagraph = (paragraph: any) => {
    for (const item of paragraph.content || []) {
      if (item.type === 'run') {
        for (const content of item.content || []) {
          if (content.type === 'text') {
            let match;
            while ((match = regex.exec(content.text)) !== null) {
              variables.add(match[1].trim());
            }
          }
        }
      }
    }
  };

  const body = doc.package.document;
  for (const block of body.content || []) {
    if (block.type === 'paragraph') {
      extractFromParagraph(block);
    }
  }

  return Array.from(variables);
}

/**
 * Extract current variable values (placeholders with current text)
 */
export function extractVariables(doc: Document): Record<string, string> {
  const values: Record<string, string> = {};
  const names = extractVariableNames(doc);

  for (const name of names) {
    values[name] = ''; // Default empty
  }

  return values;
}
