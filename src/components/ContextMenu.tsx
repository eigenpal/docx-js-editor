/**
 * Context Menu Component
 *
 * Right-click context menu for AI actions on selected text.
 * Shows AI options like rewrite, expand, summarize, translate, etc.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { AIAction, SelectionContext } from '../types/agentApi';
import { getActionLabel, getActionDescription, DEFAULT_AI_ACTIONS } from '../types/agentApi';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context menu props
 */
export interface ContextMenuProps {
  /** Whether the menu is visible */
  isOpen: boolean;
  /** Menu position */
  position: { x: number; y: number };
  /** Selected text */
  selectedText: string;
  /** Selection context for AI operations */
  selectionContext?: SelectionContext;
  /** Callback when an action is selected */
  onAction: (action: AIAction, customPrompt?: string) => void;
  /** Callback when menu is closed */
  onClose: () => void;
  /** Available actions (defaults to DEFAULT_AI_ACTIONS) */
  actions?: AIAction[];
  /** Whether to show custom prompt option */
  showCustomPrompt?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Context menu item props
 */
interface MenuItemProps {
  action: AIAction;
  onClick: () => void;
  isHighlighted: boolean;
  onMouseEnter: () => void;
}

/**
 * Custom prompt dialog props
 */
interface CustomPromptDialogProps {
  isOpen: boolean;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
  selectedText: string;
}

// ============================================================================
// ICONS
// ============================================================================

const AskAIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4v4M8 10v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const RewriteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13 3L3 13M3 3h4v4M13 13h-4v-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SummarizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4h10M3 8h7M3 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TranslateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 3h6M5 3v6M3 5c0 2 1 4 2 4s2-2 2-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M9 7l3 6M15 7l-3 6M10 11h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ExplainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 1.5-2 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="8" cy="12" r="0.5" fill="currentColor" />
  </svg>
);

const GrammarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 12l3-8 3 8M5 10h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6l2 2-2 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FormalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 7h4M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const CasualIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M6 9c.5.5 1 1 2 1s1.5-.5 2-1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="6" cy="7" r="0.5" fill="currentColor" />
    <circle cx="10" cy="7" r="0.5" fill="currentColor" />
  </svg>
);

const CustomIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Get icon for an action
 */
function getActionIcon(action: AIAction): React.ReactNode {
  switch (action) {
    case 'askAI':
      return <AskAIIcon />;
    case 'rewrite':
      return <RewriteIcon />;
    case 'expand':
      return <ExpandIcon />;
    case 'summarize':
      return <SummarizeIcon />;
    case 'translate':
      return <TranslateIcon />;
    case 'explain':
      return <ExplainIcon />;
    case 'fixGrammar':
      return <GrammarIcon />;
    case 'makeFormal':
      return <FormalIcon />;
    case 'makeCasual':
      return <CasualIcon />;
    case 'custom':
      return <CustomIcon />;
    default:
      return null;
  }
}

// ============================================================================
// MENU ITEM COMPONENT
// ============================================================================

const MenuItem: React.FC<MenuItemProps> = ({ action, onClick, isHighlighted, onMouseEnter }) => {
  const label = getActionLabel(action);
  const description = getActionDescription(action);
  const icon = getActionIcon(action);

  return (
    <button
      type="button"
      className={`docx-context-menu-item ${isHighlighted ? 'docx-context-menu-item-highlighted' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      title={description}
      role="menuitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        background: isHighlighted ? '#e8f0fe' : 'transparent',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#202124',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', color: '#5f6368' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

// ============================================================================
// CUSTOM PROMPT DIALOG
// ============================================================================

const CustomPromptDialog: React.FC<CustomPromptDialogProps> = ({
  isOpen,
  onSubmit,
  onClose,
  selectedText,
}) => {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="docx-custom-prompt-dialog"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        padding: '8px',
        background: '#fff',
        borderTop: '1px solid #e0e0e0',
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#5f6368' }}>
          Selected: "{selectedText.slice(0, 50)}
          {selectedText.length > 50 ? '...' : ''}"
        </div>
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter custom prompt..."
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!prompt.trim()}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              background: prompt.trim() ? '#1a73e8' : '#e0e0e0',
              color: prompt.trim() ? '#fff' : '#9e9e9e',
              cursor: prompt.trim() ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// MAIN CONTEXT MENU COMPONENT
// ============================================================================

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  selectedText,
  selectionContext: _selectionContext,
  onAction,
  onClose,
  actions = DEFAULT_AI_ACTIONS,
  showCustomPrompt = true,
  className = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showPromptDialog, setShowPromptDialog] = useState(false);

  // All available actions including custom
  const allActions = showCustomPrompt ? [...actions, 'custom' as AIAction] : actions;

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (showPromptDialog) {
            setShowPromptDialog(false);
          } else {
            onClose();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % allActions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + allActions.length) % allActions.length);
          break;
        case 'Enter':
          e.preventDefault();
          const action = allActions[highlightedIndex];
          if (action === 'custom') {
            setShowPromptDialog(true);
          } else {
            onAction(action);
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, allActions, onAction, onClose, showPromptDialog]);

  // Reset highlighted index when menu opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setShowPromptDialog(false);
    }
  }, [isOpen]);

  // Position the menu to stay within viewport
  const getMenuStyle = useCallback((): React.CSSProperties => {
    const menuWidth = 200;
    const menuHeight = allActions.length * 36 + 16; // Approximate height

    let x = position.x;
    let y = position.y;

    // Adjust for viewport boundaries
    if (typeof window !== 'undefined') {
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }
      if (x < 10) x = 10;
      if (y < 10) y = 10;
    }

    return {
      position: 'fixed',
      top: y,
      left: x,
      minWidth: menuWidth,
      background: '#fff',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
      zIndex: 10000,
      padding: '4px 0',
      overflow: 'hidden',
    };
  }, [position, allActions.length]);

  const handleActionClick = (action: AIAction) => {
    if (action === 'custom') {
      setShowPromptDialog(true);
    } else {
      onAction(action);
      onClose();
    }
  };

  const handleCustomPromptSubmit = (prompt: string) => {
    onAction('custom', prompt);
    onClose();
  };

  if (!isOpen || !selectedText) return null;

  return (
    <div
      ref={menuRef}
      className={`docx-context-menu ${className}`}
      style={getMenuStyle()}
      role="menu"
      aria-label="AI actions menu"
    >
      {/* Header showing selected text preview */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e0e0e0',
          fontSize: '11px',
          color: '#5f6368',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        "{selectedText.slice(0, 30)}
        {selectedText.length > 30 ? '...' : ''}"
      </div>

      {/* Menu items */}
      <div role="group">
        {allActions.map((action, index) => (
          <MenuItem
            key={action}
            action={action}
            onClick={() => handleActionClick(action)}
            isHighlighted={index === highlightedIndex}
            onMouseEnter={() => setHighlightedIndex(index)}
          />
        ))}
      </div>

      {/* Custom prompt dialog */}
      {showCustomPrompt && (
        <CustomPromptDialog
          isOpen={showPromptDialog}
          onSubmit={handleCustomPromptSubmit}
          onClose={() => setShowPromptDialog(false)}
          selectedText={selectedText}
        />
      )}
    </div>
  );
};

// ============================================================================
// HOOK FOR CONTEXT MENU
// ============================================================================

/**
 * Hook to manage context menu state
 */
export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionContext, setSelectionContext] = useState<SelectionContext | undefined>();

  const openMenu = useCallback(
    (e: React.MouseEvent | MouseEvent, text: string, context?: SelectionContext) => {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setSelectedText(text);
      setSelectionContext(context);
      setIsOpen(true);
    },
    []
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    position,
    selectedText,
    selectionContext,
    openMenu,
    closeMenu,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get action shortcuts
 */
export function getActionShortcut(action: AIAction): string | undefined {
  const shortcuts: Partial<Record<AIAction, string>> = {
    rewrite: 'Ctrl+Shift+R',
    summarize: 'Ctrl+Shift+S',
    translate: 'Ctrl+Shift+T',
    fixGrammar: 'Ctrl+Shift+G',
  };
  return shortcuts[action];
}

/**
 * Check if action is available for selection
 */
export function isActionAvailable(
  _action: AIAction,
  selectedText: string,
  _selectionContext?: SelectionContext
): boolean {
  if (!selectedText || selectedText.trim().length === 0) {
    return false;
  }

  // All actions are available for any non-empty selection
  return true;
}

/**
 * Get default actions for selection
 */
export function getDefaultActions(): AIAction[] {
  return [...DEFAULT_AI_ACTIONS];
}

/**
 * Get all available actions
 */
export function getAllActions(): AIAction[] {
  return [
    'askAI',
    'rewrite',
    'expand',
    'summarize',
    'translate',
    'explain',
    'fixGrammar',
    'makeFormal',
    'makeCasual',
    'custom',
  ];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ContextMenu;
