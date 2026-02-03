/**
 * VariableInserter Component
 *
 * UI for inserting template variables {{variable_name}} into the document:
 * - Variable name input in toolbar
 * - Insert button adds {{name}} at cursor
 * - Styled distinctively
 * - Also usable in context menu
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent, FormEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for VariableInserter component
 */
export interface VariableInserterProps {
  /** Callback when variable is inserted */
  onInsert?: (variableName: string) => void;
  /** List of existing variables for suggestions */
  existingVariables?: string[];
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Placeholder text */
  placeholder?: string;
  /** Compact mode (smaller UI) */
  compact?: boolean;
  /** Show suggestions dropdown */
  showSuggestions?: boolean;
  /** Auto-clear input after insert */
  autoClear?: boolean;
  /** Position: inline (default) or dropdown */
  variant?: 'inline' | 'dropdown' | 'compact';
}

/**
 * Props for VariableButton in toolbar
 */
export interface VariableButtonProps {
  /** Callback when variable is inserted */
  onInsert?: (variableName: string) => void;
  /** List of existing variables */
  existingVariables?: string[];
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Button label */
  label?: string;
  /** Show dropdown on click */
  showDropdown?: boolean;
}

/**
 * Props for VariableContextMenuItem
 */
export interface VariableContextMenuItemProps {
  /** Callback when variable is inserted */
  onInsert?: (variableName: string) => void;
  /** List of existing variables */
  existingVariables?: string[];
  /** Callback to close the context menu */
  onClose?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const STYLES: Record<string, CSSProperties> = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  containerCompact: {
    gap: '2px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  input: {
    padding: '4px 8px',
    paddingLeft: '24px',
    border: '1px solid var(--doc-border)',
    borderRadius: '3px',
    fontSize: '12px',
    width: '140px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  },
  inputCompact: {
    padding: '2px 6px',
    paddingLeft: '20px',
    width: '100px',
    fontSize: '11px',
  },
  inputFocused: {
    borderColor: 'var(--doc-primary)',
    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.2)',
  },
  inputDisabled: {
    backgroundColor: 'var(--doc-bg-muted)',
    cursor: 'not-allowed',
    color: 'var(--doc-text-muted)',
  },
  bracketPrefix: {
    position: 'absolute',
    left: '8px',
    color: '#e4b416',
    fontWeight: 'bold',
    fontSize: '12px',
    pointerEvents: 'none',
  },
  bracketPrefixCompact: {
    left: '6px',
    fontSize: '11px',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '4px 8px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: 'var(--doc-primary)',
    color: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    fontFamily: 'inherit',
    lineHeight: 1,
  },
  buttonCompact: {
    padding: '3px 6px',
    fontSize: '11px',
  },
  buttonHover: {
    backgroundColor: 'var(--doc-primary-dark)',
  },
  buttonDisabled: {
    backgroundColor: 'var(--doc-border)',
    cursor: 'not-allowed',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: '0',
    marginTop: '4px',
    backgroundColor: 'white',
    border: '1px solid var(--doc-border)',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    minWidth: '160px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  suggestionList: {
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
  },
  suggestionItem: {
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  suggestionItemHover: {
    backgroundColor: 'var(--doc-bg-hover)',
  },
  suggestionItemSelected: {
    backgroundColor: 'var(--doc-primary-light)',
  },
  variableTag: {
    display: 'inline-block',
    backgroundColor: '#fff8dc',
    border: '1px solid #e4b416',
    borderRadius: '3px',
    padding: '0 4px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b6914',
  },
  noSuggestions: {
    padding: '8px 12px',
    color: 'var(--doc-text-muted)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  label: {
    fontSize: '11px',
    color: 'var(--doc-text-muted)',
    marginRight: '4px',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * VariableInserter - Input and button for inserting template variables
 */
export function VariableInserter({
  onInsert,
  existingVariables = [],
  disabled = false,
  className,
  style,
  placeholder = 'variable_name',
  compact = false,
  showSuggestions = true,
  autoClear = true,
  variant: _variant = 'inline',
}: VariableInserterProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  // Filter suggestions based on input
  const suggestions = showSuggestions
    ? existingVariables.filter(
        (v) => v.toLowerCase().includes(inputValue.toLowerCase()) && v !== inputValue
      )
    : [];

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Only allow valid variable name characters
      const sanitized = sanitizeVariableName(value);
      setInputValue(sanitized);
      setSelectedIndex(-1);
      setShowDropdown(sanitized.length > 0 && suggestions.length > 0);
    },
    [suggestions.length]
  );

  // Handle form submit / insert
  const handleInsert = useCallback(
    (variableName?: string) => {
      const name = variableName || inputValue.trim();
      if (!name) return;

      if (onInsert) {
        onInsert(name);
      }

      if (autoClear) {
        setInputValue('');
      }
      setShowDropdown(false);
      setSelectedIndex(-1);
    },
    [inputValue, onInsert, autoClear]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleInsert(suggestions[selectedIndex]);
      } else {
        handleInsert();
      }
    },
    [selectedIndex, suggestions, handleInsert]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || suggestions.length === 0) {
        if (e.key === 'Escape') {
          setShowDropdown(false);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            handleInsert(suggestions[selectedIndex]);
          } else {
            handleInsert();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [showDropdown, suggestions, selectedIndex, handleInsert]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (variableName: string) => {
      handleInsert(variableName);
    },
    [handleInsert]
  );

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (inputValue && suggestions.length > 0) {
      setShowDropdown(true);
    }
  }, [inputValue, suggestions.length]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay hiding dropdown to allow click on suggestion
    setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build styles
  const containerStyle: CSSProperties = {
    ...STYLES.container,
    ...(compact ? STYLES.containerCompact : {}),
    ...style,
  };

  const inputStyle: CSSProperties = {
    ...STYLES.input,
    ...(compact ? STYLES.inputCompact : {}),
    ...(isFocused ? STYLES.inputFocused : {}),
    ...(disabled ? STYLES.inputDisabled : {}),
  };

  const buttonStyle: CSSProperties = {
    ...STYLES.button,
    ...(compact ? STYLES.buttonCompact : {}),
    ...(isButtonHovered && !disabled ? STYLES.buttonHover : {}),
    ...(disabled || !inputValue.trim() ? STYLES.buttonDisabled : {}),
  };

  const bracketPrefixStyle: CSSProperties = {
    ...STYLES.bracketPrefix,
    ...(compact ? STYLES.bracketPrefixCompact : {}),
  };

  const classNames = ['docx-variable-inserter'];
  if (className) classNames.push(className);
  if (compact) classNames.push('docx-variable-inserter-compact');
  if (disabled) classNames.push('docx-variable-inserter-disabled');

  return (
    <form
      ref={containerRef}
      className={classNames.join(' ')}
      style={containerStyle}
      onSubmit={handleSubmit}
    >
      <div style={STYLES.inputWrapper}>
        <span style={bracketPrefixStyle}>{'{'}</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          style={inputStyle}
          className="docx-variable-input"
          aria-label="Variable name"
          autoComplete="off"
        />

        {/* Suggestions dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div style={STYLES.dropdown} className="docx-variable-suggestions">
            <ul style={STYLES.suggestionList}>
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  style={{
                    ...STYLES.suggestionItem,
                    ...(index === selectedIndex ? STYLES.suggestionItemSelected : {}),
                  }}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span style={STYLES.variableTag}>{`{{${suggestion}}}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !inputValue.trim()}
        style={buttonStyle}
        className="docx-variable-insert-button"
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
        title="Insert variable at cursor"
      >
        <InsertVariableIcon />
        {!compact && <span>Insert</span>}
      </button>
    </form>
  );
}

// ============================================================================
// TOOLBAR BUTTON
// ============================================================================

/**
 * VariableButton - Button for toolbar that opens variable inserter
 */
export function VariableButton({
  onInsert,
  existingVariables = [],
  disabled = false,
  className,
  label = 'Variable',
  showDropdown: enableDropdown = true,
}: VariableButtonProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle button click
  const handleClick = useCallback(() => {
    if (enableDropdown) {
      setIsOpen((prev) => !prev);
    }
  }, [enableDropdown]);

  // Handle insert from dropdown
  const handleInsert = useCallback(
    (variableName: string) => {
      if (onInsert) {
        onInsert(variableName);
      }
      setIsOpen(false);
    },
    [onInsert]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: isHovered && !disabled ? 'var(--doc-bg-hover)' : 'transparent',
    color: disabled ? 'var(--doc-text-muted)' : 'var(--doc-text)',
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s',
    fontFamily: 'inherit',
  };

  const classNames = ['docx-variable-button'];
  if (className) classNames.push(className);
  if (isOpen) classNames.push('docx-variable-button-open');

  return (
    <div
      ref={containerRef}
      className={classNames.join(' ')}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        style={buttonStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="Insert template variable"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <VariableIcon />
        <span>{label}</span>
        {enableDropdown && <DropdownArrowIcon />}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            marginTop: '4px',
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid var(--doc-border)',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            padding: '8px',
            minWidth: '200px',
          }}
        >
          <VariableInserter
            onInsert={handleInsert}
            existingVariables={existingVariables}
            compact
            autoClear
            showSuggestions
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONTEXT MENU ITEM
// ============================================================================

/**
 * VariableContextMenuItem - Variable insertion for context menu
 */
export function VariableContextMenuItem({
  onInsert,
  existingVariables = [],
  onClose,
}: VariableContextMenuItemProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const name = inputValue.trim();
      if (!name) return;

      if (onInsert) {
        onInsert(name);
      }
      if (onClose) {
        onClose();
      }
    },
    [inputValue, onInsert, onClose]
  );

  return (
    <div className="docx-variable-context-menu" style={{ padding: '8px' }}>
      <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--doc-text-muted)' }}>
        Insert Variable
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <span style={{ color: '#e4b416', fontWeight: 'bold' }}>{'{'}</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(sanitizeVariableName(e.target.value))}
          placeholder="variable_name"
          style={{
            flex: 1,
            padding: '4px 6px',
            border: '1px solid var(--doc-border)',
            borderRadius: '3px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <span style={{ color: '#e4b416', fontWeight: 'bold' }}>{'}'}</span>
        <button
          type="submit"
          disabled={!inputValue.trim()}
          style={{
            padding: '4px 8px',
            backgroundColor: inputValue.trim() ? 'var(--doc-primary)' : 'var(--doc-border)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: '12px',
          }}
        >
          Insert
        </button>
      </form>

      {/* Show existing variables */}
      {existingVariables.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            borderTop: '1px solid var(--doc-border-light)',
            paddingTop: '8px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--doc-text-muted)', marginBottom: '4px' }}>
            Existing variables:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {existingVariables.slice(0, 5).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  if (onInsert) onInsert(v);
                  if (onClose) onClose();
                }}
                style={{
                  ...STYLES.variableTag,
                  cursor: 'pointer',
                  border: '1px solid #e4b416',
                }}
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

/**
 * Variable icon (curly braces)
 */
function VariableIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 3C2.5 3 2 4 2 5.5V6.5C2 7 1.5 7.5 1 7.5V8.5C1.5 8.5 2 9 2 9.5V10.5C2 12 2.5 13 4 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 3C13.5 3 14 4 14 5.5V6.5C14 7 14.5 7.5 15 7.5V8.5C14.5 8.5 14 9 14 9.5V10.5C14 12 13.5 13 12 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <text x="8" y="11" fontSize="7" fontWeight="bold" textAnchor="middle" fill="currentColor">
        x
      </text>
    </svg>
  );
}

/**
 * Insert variable icon
 */
function InsertVariableIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.5 2C2.4 2 2 2.7 2 3.8V4.6C2 5 1.6 5.4 1.2 5.4V6.6C1.6 6.6 2 7 2 7.4V8.2C2 9.3 2.4 10 3.5 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10.5 2C11.6 2 12 2.7 12 3.8V4.6C12 5 12.4 5.4 12.8 5.4V6.6C12.4 6.6 12 7 12 7.4V8.2C12 9.3 11.6 10 10.5 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="5" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="4" x2="7" y2="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Dropdown arrow icon
 */
function DropdownArrowIcon(): React.ReactElement {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sanitize variable name to valid format
 * - Only alphanumeric, underscore, and hyphen
 * - No spaces (converted to underscore)
 */
export function sanitizeVariableName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .substring(0, 50);
}

/**
 * Check if a variable name is valid
 */
export function isValidVariableName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > 50) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(name);
}

/**
 * Format a variable name as a template variable
 */
export function formatVariable(name: string): string {
  return `{{${name}}}`;
}

/**
 * Parse a template variable to get the name
 */
export function parseVariable(template: string): string | null {
  const match = template.match(/^\{\{(.+?)\}\}$/);
  return match ? match[1] : null;
}

/**
 * Check if a string is a template variable
 */
export function isTemplateVariable(text: string): boolean {
  return /^\{\{.+?\}\}$/.test(text);
}

/**
 * Extract all variable names from text
 */
export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{(.+?)\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
}

/**
 * Get common variable name suggestions
 */
export function getCommonVariables(): string[] {
  return [
    'client_name',
    'company_name',
    'date',
    'address',
    'email',
    'phone',
    'contract_number',
    'amount',
    'signature',
    'title',
  ];
}

export default VariableInserter;
