/**
 * Response Preview Component
 *
 * Shows AI response preview with diff view before applying changes.
 * Allows user to accept, reject, or edit the response.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AIAction, AgentResponse } from '../types/agentApi';
import { getActionLabel } from '../types/agentApi';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Response preview props
 */
export interface ResponsePreviewProps {
  /** Original selected text */
  originalText: string;
  /** AI response (or null if loading/error) */
  response: AgentResponse | null;
  /** Action that was performed */
  action: AIAction;
  /** Whether the response is loading */
  isLoading: boolean;
  /** Error message if request failed */
  error?: string;
  /** Callback when user accepts the change */
  onAccept: (newText: string) => void;
  /** Callback when user rejects the change */
  onReject: () => void;
  /** Callback when user wants to retry */
  onRetry?: () => void;
  /** Allow editing before accepting */
  allowEdit?: boolean;
  /** Show diff view */
  showDiff?: boolean;
  /** Additional className */
  className?: string;
  /** Position for the preview */
  position?: { x: number; y: number };
}

/**
 * Diff segment for rendering
 */
interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

// ============================================================================
// ICONS
// ============================================================================

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 8l4 4 6-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 8a6 6 0 0111.318-2.828M14 8a6 6 0 01-11.318 2.828"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 2v4h-4M3 14v-4h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11 2l3 3-9 9H2v-3l9-9z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <circle cx="10" cy="10" r="8" stroke="#e0e0e0" strokeWidth="2" fill="none" />
    <path
      d="M10 2a8 8 0 018 8"
      stroke="#1a73e8"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  </svg>
);

// ============================================================================
// DIFF CALCULATION
// ============================================================================

/**
 * Calculate simple word-level diff between two texts
 */
function calculateDiff(original: string, modified: string): DiffSegment[] {
  const segments: DiffSegment[] = [];

  // Split into words while preserving whitespace
  const originalWords = original.split(/(\s+)/);
  const modifiedWords = modified.split(/(\s+)/);

  // Simple LCS-based diff (not optimal but sufficient for short texts)
  let i = 0;
  let j = 0;

  while (i < originalWords.length || j < modifiedWords.length) {
    if (i >= originalWords.length) {
      // Remaining words in modified are additions
      segments.push({ type: 'added', text: modifiedWords.slice(j).join('') });
      break;
    }
    if (j >= modifiedWords.length) {
      // Remaining words in original are removals
      segments.push({ type: 'removed', text: originalWords.slice(i).join('') });
      break;
    }

    if (originalWords[i] === modifiedWords[j]) {
      // Same word
      segments.push({ type: 'same', text: originalWords[i] });
      i++;
      j++;
    } else {
      // Find next matching word
      const nextMatchInModified = modifiedWords.indexOf(originalWords[i], j);
      const nextMatchInOriginal = originalWords.indexOf(modifiedWords[j], i);

      if (nextMatchInModified === -1 && nextMatchInOriginal === -1) {
        // No match found - treat as replacement
        segments.push({ type: 'removed', text: originalWords[i] });
        segments.push({ type: 'added', text: modifiedWords[j] });
        i++;
        j++;
      } else if (
        nextMatchInOriginal !== -1 &&
        (nextMatchInModified === -1 || nextMatchInOriginal - i <= nextMatchInModified - j)
      ) {
        // Addition
        segments.push({ type: 'added', text: modifiedWords[j] });
        j++;
      } else {
        // Removal
        segments.push({ type: 'removed', text: originalWords[i] });
        i++;
      }
    }
  }

  // Merge consecutive segments of the same type
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    if (merged.length > 0 && merged[merged.length - 1].type === segment.type) {
      merged[merged.length - 1].text += segment.text;
    } else {
      merged.push(segment);
    }
  }

  return merged;
}

// ============================================================================
// DIFF VIEW COMPONENT
// ============================================================================

interface DiffViewProps {
  original: string;
  modified: string;
}

const DiffView: React.FC<DiffViewProps> = ({ original, modified }) => {
  const segments = calculateDiff(original, modified);

  return (
    <div className="docx-response-diff" style={{ lineHeight: 1.6, fontSize: '14px' }}>
      {segments.map((segment, index) => {
        let style: React.CSSProperties = {};

        switch (segment.type) {
          case 'removed':
            style = {
              textDecoration: 'line-through',
              color: '#d32f2f',
              backgroundColor: '#ffebee',
            };
            break;
          case 'added':
            style = {
              color: '#2e7d32',
              backgroundColor: '#e8f5e9',
            };
            break;
          default:
            break;
        }

        return (
          <span key={index} style={style}>
            {segment.text}
          </span>
        );
      })}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ResponsePreview: React.FC<ResponsePreviewProps> = ({
  originalText,
  response,
  action,
  isLoading,
  error,
  onAccept,
  onReject,
  onRetry,
  allowEdit = true,
  showDiff = true,
  className = '',
  position,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get the new text from response
  const newText = response?.newText || '';

  // Initialize edited text when response changes
  useEffect(() => {
    if (newText) {
      setEditedText(newText);
    }
  }, [newText]);

  // Focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditedText(newText);
        } else {
          onReject();
        }
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAccept();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, newText, onReject]);

  const handleAccept = useCallback(() => {
    const textToAccept = isEditing ? editedText : newText;
    onAccept(textToAccept);
  }, [isEditing, editedText, newText, onAccept]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedText(newText);
  }, [newText]);

  // Calculate container style
  const containerStyle: React.CSSProperties = {
    position: position ? 'fixed' : 'relative',
    ...(position && {
      left: position.x,
      top: position.y,
    }),
    width: '400px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    background: '#fff',
    border: '1px solid #dadce0',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    zIndex: 10000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className={`docx-response-preview docx-response-preview-loading ${className}`}
        style={containerStyle}
      >
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <LoadingSpinner />
          <div style={{ color: '#5f6368', fontSize: '14px' }}>{getActionLabel(action)}...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        ref={containerRef}
        className={`docx-response-preview docx-response-preview-error ${className}`}
        style={containerStyle}
      >
        <div style={{ padding: '16px' }}>
          <div
            style={{
              padding: '12px',
              background: '#fce8e6',
              borderRadius: '4px',
              color: '#c5221f',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 16px',
                  border: '1px solid #dadce0',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <RefreshIcon />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={onReject}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                background: '#e0e0e0',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No response yet
  if (!response || !newText) {
    return null;
  }

  return (
    <div ref={containerRef} className={`docx-response-preview ${className}`} style={containerStyle}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 500, fontSize: '14px', color: '#202124' }}>
          {getActionLabel(action)} Result
        </div>
        <button
          type="button"
          onClick={onReject}
          style={{
            display: 'flex',
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#5f6368',
          }}
          title="Close (Esc)"
        >
          <XIcon />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '16px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {isEditing ? (
          <div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#5f6368' }}>
              Edit the result before accepting:
            </div>
            <textarea
              ref={textareaRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                border: '1px solid #1a73e8',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        ) : showDiff ? (
          <div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#5f6368' }}>Changes:</div>
            <DiffView original={originalText} modified={newText} />
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#5f6368' }}>Original:</div>
            <div
              style={{
                padding: '8px 12px',
                background: '#f5f5f5',
                borderRadius: '4px',
                marginBottom: '16px',
                textDecoration: 'line-through',
                color: '#9e9e9e',
                fontSize: '13px',
              }}
            >
              {originalText}
            </div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#5f6368' }}>New:</div>
            <div
              style={{
                padding: '8px 12px',
                background: '#e8f5e9',
                borderRadius: '4px',
                color: '#2e7d32',
                fontSize: '13px',
              }}
            >
              {newText}
            </div>
          </div>
        )}

        {/* Warnings */}
        {response.warnings && response.warnings.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              padding: '8px 12px',
              background: '#fff8e1',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#f9a825',
            }}
          >
            {response.warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          {allowEdit && !isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#5f6368',
              }}
            >
              <EditIcon />
              Edit
            </button>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                padding: '6px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#5f6368',
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onReject}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 16px',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#5f6368',
            }}
          >
            <XIcon />
            Reject
          </button>
          <button
            type="button"
            onClick={handleAccept}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#1a73e8',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#fff',
            }}
          >
            <CheckIcon />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HOOK FOR RESPONSE PREVIEW
// ============================================================================

/**
 * State for response preview
 */
export interface ResponsePreviewState {
  isVisible: boolean;
  originalText: string;
  response: AgentResponse | null;
  action: AIAction;
  isLoading: boolean;
  error?: string;
  position?: { x: number; y: number };
}

/**
 * Hook to manage response preview state
 */
export function useResponsePreview() {
  const [state, setState] = useState<ResponsePreviewState>({
    isVisible: false,
    originalText: '',
    response: null,
    action: 'rewrite',
    isLoading: false,
  });

  const showPreview = useCallback(
    (originalText: string, action: AIAction, position?: { x: number; y: number }) => {
      setState({
        isVisible: true,
        originalText,
        response: null,
        action,
        isLoading: true,
        position,
      });
    },
    []
  );

  const setResponse = useCallback((response: AgentResponse) => {
    setState((prev) => ({
      ...prev,
      response,
      isLoading: false,
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  const hidePreview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  return {
    state,
    showPreview,
    setResponse,
    setError,
    hidePreview,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a mock response for testing
 */
export function createMockResponse(newText: string, warnings?: string[]): AgentResponse {
  return {
    success: true,
    newText,
    warnings,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(error: string): AgentResponse {
  return {
    success: false,
    error,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ResponsePreview;
