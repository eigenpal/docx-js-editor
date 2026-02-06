/**
 * Footnote & Endnote Properties Dialog
 *
 * Edits position, numbering format, start number, and restart rules.
 */

import React, { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type {
  FootnoteProperties,
  EndnoteProperties,
  FootnotePosition,
  EndnotePosition,
  NoteNumberRestart,
  NumberFormat,
} from '../../types/document';

// ============================================================================
// TYPES
// ============================================================================

export interface FootnotePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (footnoteProps: FootnoteProperties, endnoteProps: EndnoteProperties) => void;
  footnotePr?: FootnoteProperties;
  endnotePr?: EndnoteProperties;
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
  padding: 24,
  minWidth: 400,
  maxWidth: 500,
};

const sectionStyle: CSSProperties = {
  marginBottom: 16,
  padding: 12,
  border: '1px solid #e0e0e0',
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 8,
};

const inputStyle: CSSProperties = {
  width: 60,
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 8,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
};

const buttonStyle: CSSProperties = {
  padding: '6px 16px',
  border: '1px solid #ccc',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  backgroundColor: 'white',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#2563eb',
  color: 'white',
  border: '1px solid #2563eb',
};

// ============================================================================
// NUMBER FORMAT OPTIONS
// ============================================================================

const numberFormatOptions: { value: NumberFormat; label: string }[] = [
  { value: 'decimal', label: '1, 2, 3, ...' },
  { value: 'lowerRoman', label: 'i, ii, iii, ...' },
  { value: 'upperRoman', label: 'I, II, III, ...' },
  { value: 'lowerLetter', label: 'a, b, c, ...' },
  { value: 'upperLetter', label: 'A, B, C, ...' },
  { value: 'chicago', label: '*, \u2020, \u2021, ...' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function FootnotePropertiesDialog({
  isOpen,
  onClose,
  onApply,
  footnotePr,
  endnotePr,
}: FootnotePropertiesDialogProps): React.ReactElement | null {
  const [fnPosition, setFnPosition] = useState<FootnotePosition>(
    footnotePr?.position ?? 'pageBottom'
  );
  const [fnNumFmt, setFnNumFmt] = useState<NumberFormat>(footnotePr?.numFmt ?? 'decimal');
  const [fnNumStart, setFnNumStart] = useState<number>(footnotePr?.numStart ?? 1);
  const [fnRestart, setFnRestart] = useState<NoteNumberRestart>(
    footnotePr?.numRestart ?? 'continuous'
  );

  const [enPosition, setEnPosition] = useState<EndnotePosition>(endnotePr?.position ?? 'docEnd');
  const [enNumFmt, setEnNumFmt] = useState<NumberFormat>(endnotePr?.numFmt ?? 'lowerRoman');
  const [enNumStart, setEnNumStart] = useState<number>(endnotePr?.numStart ?? 1);
  const [enRestart, setEnRestart] = useState<NoteNumberRestart>(
    endnotePr?.numRestart ?? 'continuous'
  );

  const handleApply = useCallback(() => {
    onApply(
      { position: fnPosition, numFmt: fnNumFmt, numStart: fnNumStart, numRestart: fnRestart },
      { position: enPosition, numFmt: enNumFmt, numStart: enNumStart, numRestart: enRestart }
    );
    onClose();
  }, [
    fnPosition,
    fnNumFmt,
    fnNumStart,
    fnRestart,
    enPosition,
    enNumFmt,
    enNumStart,
    enRestart,
    onApply,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Footnote & Endnote Properties</h3>

        {/* Footnote section */}
        <div style={sectionStyle}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Footnotes</h4>

          <label style={labelStyle}>Position</label>
          <select
            style={selectStyle}
            value={fnPosition}
            onChange={(e) => setFnPosition(e.target.value as FootnotePosition)}
          >
            <option value="pageBottom">Bottom of page</option>
            <option value="beneathText">Below text</option>
          </select>

          <label style={labelStyle}>Number format</label>
          <select
            style={selectStyle}
            value={fnNumFmt}
            onChange={(e) => setFnNumFmt(e.target.value as NumberFormat)}
          >
            {numberFormatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>
              <label style={labelStyle}>Start at</label>
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={fnNumStart}
                onChange={(e) => setFnNumStart(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Numbering</label>
              <select
                style={selectStyle}
                value={fnRestart}
                onChange={(e) => setFnRestart(e.target.value as NoteNumberRestart)}
              >
                <option value="continuous">Continuous</option>
                <option value="eachSect">Restart each section</option>
                <option value="eachPage">Restart each page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Endnote section */}
        <div style={sectionStyle}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Endnotes</h4>

          <label style={labelStyle}>Position</label>
          <select
            style={selectStyle}
            value={enPosition}
            onChange={(e) => setEnPosition(e.target.value as EndnotePosition)}
          >
            <option value="docEnd">End of document</option>
            <option value="sectEnd">End of section</option>
          </select>

          <label style={labelStyle}>Number format</label>
          <select
            style={selectStyle}
            value={enNumFmt}
            onChange={(e) => setEnNumFmt(e.target.value as NumberFormat)}
          >
            {numberFormatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>
              <label style={labelStyle}>Start at</label>
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={enNumStart}
                onChange={(e) => setEnNumStart(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Numbering</label>
              <select
                style={selectStyle}
                value={enRestart}
                onChange={(e) => setEnRestart(e.target.value as NoteNumberRestart)}
              >
                <option value="continuous">Continuous</option>
                <option value="eachSect">Restart each section</option>
              </select>
            </div>
          </div>
        </div>

        <div style={buttonRowStyle}>
          <button style={buttonStyle} onClick={onClose}>
            Cancel
          </button>
          <button style={primaryButtonStyle} onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
