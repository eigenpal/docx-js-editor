/**
 * Image Position Dialog
 *
 * Modal for editing image positioning settings:
 * - Horizontal: alignment or offset, relative to page/column/margin/paragraph
 * - Vertical: alignment or offset, relative to page/margin/paragraph/line
 * - Distance from text (top/bottom/left/right)
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ImagePositionData {
  horizontal?: {
    relativeTo?: string;
    posOffset?: number;
    align?: string;
  };
  vertical?: {
    relativeTo?: string;
    posOffset?: number;
    align?: string;
  };
  distTop?: number;
  distBottom?: number;
  distLeft?: number;
  distRight?: number;
}

export interface ImagePositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ImagePositionData) => void;
  currentData?: ImagePositionData;
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
  minWidth: 400,
  maxWidth: 480,
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
  width: 75,
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

export function ImagePositionDialog({
  isOpen,
  onClose,
  onApply,
  currentData,
}: ImagePositionDialogProps): React.ReactElement | null {
  const [hMode, setHMode] = useState<'align' | 'offset'>('align');
  const [hAlign, setHAlign] = useState('center');
  const [hRelativeTo, setHRelativeTo] = useState('column');
  const [hOffset, setHOffset] = useState(0);

  const [vMode, setVMode] = useState<'align' | 'offset'>('align');
  const [vAlign, setVAlign] = useState('top');
  const [vRelativeTo, setVRelativeTo] = useState('paragraph');
  const [vOffset, setVOffset] = useState(0);

  const [distTop, setDistTop] = useState(0);
  const [distBottom, setDistBottom] = useState(0);
  const [distLeft, setDistLeft] = useState(0);
  const [distRight, setDistRight] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const h = currentData?.horizontal;
    const v = currentData?.vertical;
    if (h?.align) {
      setHMode('align');
      setHAlign(h.align);
    } else if (h?.posOffset != null) {
      setHMode('offset');
      setHOffset(h.posOffset);
    }
    if (h?.relativeTo) setHRelativeTo(h.relativeTo);

    if (v?.align) {
      setVMode('align');
      setVAlign(v.align);
    } else if (v?.posOffset != null) {
      setVMode('offset');
      setVOffset(v.posOffset);
    }
    if (v?.relativeTo) setVRelativeTo(v.relativeTo);

    setDistTop(currentData?.distTop ?? 0);
    setDistBottom(currentData?.distBottom ?? 0);
    setDistLeft(currentData?.distLeft ?? 0);
    setDistRight(currentData?.distRight ?? 0);
  }, [isOpen, currentData]);

  const handleApply = useCallback(() => {
    const data: ImagePositionData = {};
    data.horizontal = {
      relativeTo: hRelativeTo,
      ...(hMode === 'align' ? { align: hAlign } : { posOffset: hOffset }),
    };
    data.vertical = {
      relativeTo: vRelativeTo,
      ...(vMode === 'align' ? { align: vAlign } : { posOffset: vOffset }),
    };
    data.distTop = distTop;
    data.distBottom = distBottom;
    data.distLeft = distLeft;
    data.distRight = distRight;
    onApply(data);
    onClose();
  }, [
    hMode,
    hAlign,
    hRelativeTo,
    hOffset,
    vMode,
    vAlign,
    vRelativeTo,
    vOffset,
    distTop,
    distBottom,
    distLeft,
    distRight,
    onApply,
    onClose,
  ]);

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
        aria-label="Image position"
      >
        <div style={headerStyle}>Image Position</div>

        <div style={bodyStyle}>
          {/* Horizontal positioning */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Horizontal</div>
            <div style={rowStyle}>
              <label style={labelStyle}>Position</label>
              <select
                style={selectStyle}
                value={hMode}
                onChange={(e) => setHMode(e.target.value as 'align' | 'offset')}
              >
                <option value="align">Alignment</option>
                <option value="offset">Offset</option>
              </select>
            </div>
            {hMode === 'align' ? (
              <div style={rowStyle}>
                <label style={labelStyle}>Align</label>
                <select
                  style={selectStyle}
                  value={hAlign}
                  onChange={(e) => setHAlign(e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            ) : (
              <div style={rowStyle}>
                <label style={labelStyle}>Offset (px)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={hOffset}
                  onChange={(e) => setHOffset(Number(e.target.value) || 0)}
                />
              </div>
            )}
            <div style={rowStyle}>
              <label style={labelStyle}>Relative to</label>
              <select
                style={selectStyle}
                value={hRelativeTo}
                onChange={(e) => setHRelativeTo(e.target.value)}
              >
                <option value="page">Page</option>
                <option value="column">Column</option>
                <option value="margin">Margin</option>
                <option value="character">Character</option>
              </select>
            </div>
          </div>

          {/* Vertical positioning */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Vertical</div>
            <div style={rowStyle}>
              <label style={labelStyle}>Position</label>
              <select
                style={selectStyle}
                value={vMode}
                onChange={(e) => setVMode(e.target.value as 'align' | 'offset')}
              >
                <option value="align">Alignment</option>
                <option value="offset">Offset</option>
              </select>
            </div>
            {vMode === 'align' ? (
              <div style={rowStyle}>
                <label style={labelStyle}>Align</label>
                <select
                  style={selectStyle}
                  value={vAlign}
                  onChange={(e) => setVAlign(e.target.value)}
                >
                  <option value="top">Top</option>
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            ) : (
              <div style={rowStyle}>
                <label style={labelStyle}>Offset (px)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={vOffset}
                  onChange={(e) => setVOffset(Number(e.target.value) || 0)}
                />
              </div>
            )}
            <div style={rowStyle}>
              <label style={labelStyle}>Relative to</label>
              <select
                style={selectStyle}
                value={vRelativeTo}
                onChange={(e) => setVRelativeTo(e.target.value)}
              >
                <option value="page">Page</option>
                <option value="margin">Margin</option>
                <option value="paragraph">Paragraph</option>
                <option value="line">Line</option>
              </select>
            </div>
          </div>

          {/* Distance from text */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Distance from text (px)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, width: 45 }}>Top</label>
                <input
                  type="number"
                  style={inputStyle}
                  min={0}
                  value={distTop}
                  onChange={(e) => setDistTop(Number(e.target.value) || 0)}
                />
              </div>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, width: 45 }}>Bottom</label>
                <input
                  type="number"
                  style={inputStyle}
                  min={0}
                  value={distBottom}
                  onChange={(e) => setDistBottom(Number(e.target.value) || 0)}
                />
              </div>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, width: 45 }}>Left</label>
                <input
                  type="number"
                  style={inputStyle}
                  min={0}
                  value={distLeft}
                  onChange={(e) => setDistLeft(Number(e.target.value) || 0)}
                />
              </div>
              <div style={rowStyle}>
                <label style={{ ...labelStyle, width: 45 }}>Right</label>
                <input
                  type="number"
                  style={inputStyle}
                  min={0}
                  value={distRight}
                  onChange={(e) => setDistRight(Number(e.target.value) || 0)}
                />
              </div>
            </div>
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
