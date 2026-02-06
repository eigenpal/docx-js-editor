/**
 * Table Properties Dialog
 *
 * Modal for editing table-level settings:
 * - Preferred width (twips or percentage)
 * - Alignment (left, center, right)
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TableProperties {
  width?: number | null;
  widthType?: string | null;
  justification?: 'left' | 'center' | 'right' | null;
}

export interface TablePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (props: TableProperties) => void;
  currentProps?: {
    width?: number;
    widthType?: string;
    justification?: string;
  };
}

// ============================================================================
// STYLES
// ============================================================================

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const dialogStyle: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  minWidth: 360,
  maxWidth: 440,
  width: '100%',
  margin: 20,
};

const headerStyle: CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: '1px solid var(--doc-border)',
  fontSize: 16,
  fontWeight: 600,
};

const bodyStyle: CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const labelStyle: CSSProperties = {
  width: 80,
  fontSize: 13,
  color: 'var(--doc-text-muted)',
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  border: '1px solid var(--doc-border)',
  borderRadius: 4,
  fontSize: 13,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const footerStyle: CSSProperties = {
  padding: '12px 20px 16px',
  borderTop: '1px solid var(--doc-border)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const btnStyle: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  border: '1px solid var(--doc-border)',
  borderRadius: 4,
  cursor: 'pointer',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TablePropertiesDialog({
  isOpen,
  onClose,
  onApply,
  currentProps,
}: TablePropertiesDialogProps): React.ReactElement | null {
  const [width, setWidth] = useState<number>(currentProps?.width || 0);
  const [widthType, setWidthType] = useState<string>(currentProps?.widthType || 'auto');
  const [justification, setJustification] = useState<string>(currentProps?.justification || 'left');

  useEffect(() => {
    if (isOpen) {
      setWidth(currentProps?.width || 0);
      setWidthType(currentProps?.widthType || 'auto');
      setJustification(currentProps?.justification || 'left');
    }
  }, [isOpen, currentProps]);

  const handleApply = useCallback(() => {
    const props: TableProperties = {};
    if (widthType === 'auto') {
      props.width = null;
      props.widthType = 'auto';
    } else {
      props.width = width;
      props.widthType = widthType;
    }
    props.justification = justification as 'left' | 'center' | 'right';
    onApply(props);
    onClose();
  }, [width, widthType, justification, onApply, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') handleApply();
    },
    [onClose, handleApply]
  );

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Table properties"
      >
        <div style={headerStyle}>Table Properties</div>

        <div style={bodyStyle}>
          {/* Width type */}
          <div style={rowStyle}>
            <label style={labelStyle}>Width type</label>
            <select
              style={selectStyle}
              value={widthType}
              onChange={(e) => setWidthType(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="dxa">Fixed (twips)</option>
              <option value="pct">Percentage</option>
            </select>
          </div>

          {/* Width value */}
          {widthType !== 'auto' && (
            <div style={rowStyle}>
              <label style={labelStyle}>Width</label>
              <input
                type="number"
                style={inputStyle}
                min={0}
                step={widthType === 'pct' ? 5 : 100}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 0)}
              />
              <span style={{ fontSize: 11, color: 'var(--doc-text-muted)' }}>
                {widthType === 'pct' ? '(50ths of %)' : 'tw'}
              </span>
            </div>
          )}

          {/* Alignment */}
          <div style={rowStyle}>
            <label style={labelStyle}>Alignment</label>
            <select
              style={selectStyle}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        <div style={footerStyle}>
          <button type="button" style={btnStyle} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...btnStyle,
              backgroundColor: 'var(--doc-primary)',
              color: 'white',
              borderColor: 'var(--doc-primary)',
            }}
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
