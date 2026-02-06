/**
 * Image Properties Dialog
 *
 * Modal for editing image properties:
 * - Alt text for accessibility
 * - Border/outline style, color, and width
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ImagePropertiesData {
  alt?: string;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: string;
}

export interface ImagePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ImagePropertiesData) => void;
  currentData?: ImagePropertiesData;
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
  minWidth: 380,
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
  gap: 16,
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--doc-text)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const labelStyle: CSSProperties = {
  width: 60,
  fontSize: 12,
  color: 'var(--doc-text-muted)',
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  border: '1px solid var(--doc-border)',
  borderRadius: 4,
  fontSize: 12,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 60,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
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

export function ImagePropertiesDialog({
  isOpen,
  onClose,
  onApply,
  currentData,
}: ImagePropertiesDialogProps): React.ReactElement | null {
  const [alt, setAlt] = useState('');
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderStyle, setBorderStyle] = useState('solid');

  useEffect(() => {
    if (!isOpen) return;
    setAlt(currentData?.alt ?? '');
    setBorderWidth(currentData?.borderWidth ?? 0);
    setBorderColor(currentData?.borderColor ?? '#000000');
    setBorderStyle(currentData?.borderStyle ?? 'solid');
  }, [isOpen, currentData]);

  const handleApply = useCallback(() => {
    onApply({
      alt: alt || undefined,
      borderWidth: borderWidth > 0 ? borderWidth : undefined,
      borderColor: borderWidth > 0 ? borderColor : undefined,
      borderStyle: borderWidth > 0 ? borderStyle : undefined,
    });
    onClose();
  }, [alt, borderWidth, borderColor, borderStyle, onApply, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey) handleApply();
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
        aria-label="Image properties"
      >
        <div style={headerStyle}>Image Properties</div>

        <div style={bodyStyle}>
          {/* Alt Text */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Alt Text</div>
            <textarea
              style={textareaStyle}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe this image for accessibility..."
            />
          </div>

          {/* Border / Outline */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Border</div>
            <div style={rowStyle}>
              <label style={labelStyle}>Width</label>
              <input
                type="number"
                style={{ ...inputStyle, maxWidth: 80 }}
                min={0}
                max={20}
                step={0.5}
                value={borderWidth}
                onChange={(e) => setBorderWidth(Number(e.target.value) || 0)}
              />
              <span style={{ fontSize: 12, color: 'var(--doc-text-muted)' }}>px</span>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Style</label>
              <select
                style={selectStyle}
                value={borderStyle}
                onChange={(e) => setBorderStyle(e.target.value)}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="double">Double</option>
                <option value="groove">Groove</option>
                <option value="ridge">Ridge</option>
                <option value="inset">Inset</option>
                <option value="outset">Outset</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Color</label>
              <input
                type="color"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                style={{
                  width: 32,
                  height: 24,
                  padding: 0,
                  border: '1px solid var(--doc-border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                style={{ ...inputStyle, maxWidth: 90 }}
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
              />
            </div>
            {borderWidth > 0 && (
              <div
                style={{
                  marginTop: 4,
                  padding: 8,
                  border: `${borderWidth}px ${borderStyle} ${borderColor}`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: 'var(--doc-text-muted)',
                  textAlign: 'center',
                }}
              >
                Preview
              </div>
            )}
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
