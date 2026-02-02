/**
 * VariablePanel Component
 *
 * A panel that lists detected template variables with input fields for values:
 * - Lists detected variables from document
 * - Input field for each value
 * - Apply button to process template
 * - Shows empty state when no variables
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { CSSProperties, FormEvent, ChangeEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Variable entry with name and value
 */
export interface VariableEntry {
  /** Variable name (without braces) */
  name: string;
  /** Current value */
  value: string;
  /** Whether the variable is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Description/help text */
  description?: string;
}

/**
 * Props for VariablePanel component
 */
export interface VariablePanelProps {
  /** Detected variable names */
  variables: string[];
  /** Current variable values */
  values?: Record<string, string>;
  /** Callback when values change */
  onValuesChange?: (values: Record<string, string>) => void;
  /** Callback when Apply button is clicked */
  onApply?: (values: Record<string, string>) => void;
  /** Callback when Reset button is clicked */
  onReset?: () => void;
  /** Whether Apply is in progress */
  isApplying?: boolean;
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Panel title */
  title?: string;
  /** Show empty state message */
  emptyMessage?: string;
  /** Show variable count */
  showCount?: boolean;
  /** Collapsible panel */
  collapsible?: boolean;
  /** Initially collapsed */
  defaultCollapsed?: boolean;
  /** Show search filter */
  showSearch?: boolean;
  /** Custom variable descriptions */
  descriptions?: Record<string, string>;
}

// ============================================================================
// STYLES
// ============================================================================

const STYLES: Record<string, CSSProperties> = {
  panel: {
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    color: '#333',
  },
  headerCount: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#e0e0e0',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  collapseButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#666',
    borderRadius: '4px',
    transition: 'background-color 0.15s',
  },
  body: {
    padding: '16px',
  },
  bodyCollapsed: {
    display: 'none',
  },
  searchBox: {
    marginBottom: '12px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  variableList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  variableItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  variableLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#555',
  },
  variableName: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8b6914',
    backgroundColor: '#fff8dc',
    padding: '2px 6px',
    borderRadius: '3px',
    border: '1px solid #e4b416',
  },
  variableRequired: {
    fontSize: '10px',
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  variableDescription: {
    fontSize: '11px',
    color: '#888',
    fontStyle: 'italic',
  },
  variableInput: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  variableInputFocused: {
    borderColor: '#0078d4',
    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.2)',
  },
  variableInputFilled: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#fafafa',
  },
  footerStats: {
    fontSize: '11px',
    color: '#888',
  },
  footerButtons: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s, opacity 0.15s',
  },
  buttonPrimary: {
    backgroundColor: '#0078d4',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#e0e0e0',
    color: '#333',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
    color: '#888',
  },
  emptyIcon: {
    marginBottom: '12px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    marginBottom: '4px',
  },
  emptyMessage: {
    fontSize: '12px',
    color: '#999',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * VariablePanel - Panel for managing template variable values
 */
export function VariablePanel({
  variables,
  values: externalValues = {},
  onValuesChange,
  onApply,
  onReset,
  isApplying = false,
  disabled = false,
  className,
  style,
  title = 'Template Variables',
  emptyMessage = 'No template variables found in the document.',
  showCount = true,
  collapsible = true,
  defaultCollapsed = false,
  showSearch = false,
  descriptions = {},
}: VariablePanelProps): React.ReactElement {
  // Internal state for values
  const [internalValues, setInternalValues] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Merge external and internal values
  const currentValues = useMemo(() => {
    return { ...internalValues, ...externalValues };
  }, [internalValues, externalValues]);

  // Filter variables by search
  const filteredVariables = useMemo(() => {
    if (!searchQuery) return variables;
    const query = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.toLowerCase().includes(query) || (descriptions[v] || '').toLowerCase().includes(query)
    );
  }, [variables, searchQuery, descriptions]);

  // Stats
  const filledCount = useMemo(() => {
    return variables.filter((v) => currentValues[v]?.trim()).length;
  }, [variables, currentValues]);

  // Handle value change
  const handleValueChange = useCallback(
    (variableName: string, value: string) => {
      const newValues = { ...currentValues, [variableName]: value };
      setInternalValues(newValues);

      if (onValuesChange) {
        onValuesChange(newValues);
      }
    },
    [currentValues, onValuesChange]
  );

  // Handle apply
  const handleApply = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (onApply && !disabled && !isApplying) {
        onApply(currentValues);
      }
    },
    [currentValues, onApply, disabled, isApplying]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    setInternalValues({});
    if (onReset) {
      onReset();
    }
    if (onValuesChange) {
      onValuesChange({});
    }
  }, [onReset, onValuesChange]);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Build class names
  const classNames = ['docx-variable-panel'];
  if (className) classNames.push(className);
  if (disabled) classNames.push('docx-variable-panel-disabled');
  if (isCollapsed) classNames.push('docx-variable-panel-collapsed');

  // Panel style
  const panelStyle: CSSProperties = {
    ...STYLES.panel,
    ...style,
  };

  // Empty state
  if (variables.length === 0) {
    return (
      <div className={classNames.join(' ')} style={panelStyle}>
        <div style={STYLES.header}>
          <span style={STYLES.headerTitle}>
            <VariableIcon />
            {title}
          </span>
        </div>
        <div style={STYLES.emptyState}>
          <div style={STYLES.emptyIcon}>
            <EmptyVariablesIcon />
          </div>
          <div style={STYLES.emptyTitle}>No Variables</div>
          <div style={STYLES.emptyMessage}>{emptyMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <form className={classNames.join(' ')} style={panelStyle} onSubmit={handleApply}>
      {/* Header */}
      <div style={STYLES.header}>
        <span style={STYLES.headerTitle}>
          <VariableIcon />
          {title}
          {showCount && <span style={STYLES.headerCount}>{variables.length}</span>}
        </span>
        {collapsible && (
          <button
            type="button"
            onClick={toggleCollapse}
            style={STYLES.collapseButton}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!isCollapsed}
          >
            <CollapseIcon collapsed={isCollapsed} />
          </button>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          ...STYLES.body,
          ...(isCollapsed ? STYLES.bodyCollapsed : {}),
        }}
      >
        {/* Search */}
        {showSearch && (
          <div style={STYLES.searchBox}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search variables..."
              style={STYLES.searchInput}
              disabled={disabled}
            />
          </div>
        )}

        {/* Variable list */}
        <div style={STYLES.variableList}>
          {filteredVariables.map((variableName) => (
            <VariableInputField
              key={variableName}
              name={variableName}
              value={currentValues[variableName] || ''}
              description={descriptions[variableName]}
              onChange={(value) => handleValueChange(variableName, value)}
              disabled={disabled || isApplying}
              isFocused={focusedInput === variableName}
              onFocus={() => setFocusedInput(variableName)}
              onBlur={() => setFocusedInput(null)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div style={STYLES.footer}>
          <span style={STYLES.footerStats}>
            {filledCount} of {variables.length} filled
          </span>
          <div style={STYLES.footerButtons}>
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled || isApplying}
              style={{
                ...STYLES.button,
                ...STYLES.buttonSecondary,
                ...(disabled || isApplying ? STYLES.buttonDisabled : {}),
              }}
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={disabled || isApplying}
              style={{
                ...STYLES.button,
                ...STYLES.buttonPrimary,
                ...(disabled || isApplying ? STYLES.buttonDisabled : {}),
              }}
            >
              {isApplying ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Individual variable input field
 */
interface VariableInputFieldProps {
  name: string;
  value: string;
  description?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

function VariableInputField({
  name,
  value,
  description,
  onChange,
  disabled,
  isFocused,
  onFocus,
  onBlur,
}: VariableInputFieldProps): React.ReactElement {
  const inputStyle: CSSProperties = {
    ...STYLES.variableInput,
    ...(isFocused ? STYLES.variableInputFocused : {}),
    ...(value.trim() ? STYLES.variableInputFilled : {}),
  };

  return (
    <div style={STYLES.variableItem} className="docx-variable-item">
      <label style={STYLES.variableLabel}>
        <span style={STYLES.variableName}>{`{{${name}}}`}</span>
      </label>
      {description && <span style={STYLES.variableDescription}>{description}</span>}
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`Enter value for ${name}`}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
        className="docx-variable-input"
        aria-label={`Value for ${name}`}
      />
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function VariableIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 3C2.5 3 2 4 2 5.5V6.5C2 7 1.5 7.5 1 7.5V8.5C1.5 8.5 2 9 2 9.5V10.5C2 12 2.5 13 4 13"
        stroke="#e4b416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 3C13.5 3 14 4 14 5.5V6.5C14 7 14.5 7.5 15 7.5V8.5C14.5 8.5 14 9 14 9.5V10.5C14 12 13.5 13 12 13"
        stroke="#e4b416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function EmptyVariablesIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="32" height="24" rx="2" stroke="#ccc" strokeWidth="2" fill="none" />
      <path d="M14 20H34M14 26H28" stroke="#ccc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
      }}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create initial values map from variable names
 */
export function createInitialValues(
  variables: string[],
  defaultValue = ''
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const v of variables) {
    values[v] = defaultValue;
  }
  return values;
}

/**
 * Check if all variables have values
 */
export function allVariablesFilled(variables: string[], values: Record<string, string>): boolean {
  return variables.every((v) => values[v]?.trim());
}

/**
 * Get list of empty/unfilled variables
 */
export function getEmptyVariables(variables: string[], values: Record<string, string>): string[] {
  return variables.filter((v) => !values[v]?.trim());
}

/**
 * Get list of filled variables
 */
export function getFilledVariables(variables: string[], values: Record<string, string>): string[] {
  return variables.filter((v) => values[v]?.trim());
}

/**
 * Validate variable values (basic validation)
 */
export function validateVariableValues(
  _variables: string[],
  values: Record<string, string>,
  required: string[] = []
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const v of required) {
    if (!values[v]?.trim()) {
      errors[v] = 'This field is required';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Format values for display/export
 */
export function formatValuesForExport(values: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value.trim()) {
      lines.push(`{{${key}}} = ${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * Parse values from export format
 */
export function parseValuesFromExport(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^\{\{(.+?)\}\}\s*=\s*(.*)$/);
    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

export default VariablePanel;
