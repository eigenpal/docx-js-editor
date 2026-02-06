/**
 * ShapeGallery — dropdown for inserting shapes
 *
 * Presents a grid of basic shapes that can be inserted into the document.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { MaterialSymbol } from './MaterialSymbol';

export interface ShapeInsertData {
  shapeType: string;
  width: number;
  height: number;
  fillColor?: string;
  fillType?: string;
  outlineWidth?: number;
  outlineColor?: string;
}

interface ShapeGalleryProps {
  onInsertShape: (data: ShapeInsertData) => void;
  disabled?: boolean;
}

interface ShapePreset {
  type: string;
  label: string;
  icon: string; // SVG path or simple render
  width: number;
  height: number;
}

const SHAPE_PRESETS: ShapePreset[] = [
  { type: 'rect', label: 'Rectangle', icon: 'rect', width: 120, height: 80 },
  { type: 'roundRect', label: 'Rounded Rectangle', icon: 'roundRect', width: 120, height: 80 },
  { type: 'ellipse', label: 'Oval', icon: 'ellipse', width: 100, height: 80 },
  { type: 'triangle', label: 'Triangle', icon: 'triangle', width: 100, height: 80 },
  { type: 'diamond', label: 'Diamond', icon: 'diamond', width: 80, height: 80 },
  { type: 'line', label: 'Line', icon: 'line', width: 120, height: 4 },
  { type: 'textBox', label: 'Text Box', icon: 'textBox', width: 200, height: 100 },
];

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  backgroundColor: 'white',
  border: '1px solid var(--doc-border, #d1d5db)',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
  padding: 8,
  zIndex: 1000,
  width: 200,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 4,
};

const shapeButtonStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '8px 4px',
  border: '1px solid transparent',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  fontSize: 10,
  color: 'var(--doc-text-muted, #6b7280)',
};

function renderShapePreview(icon: string): React.ReactElement {
  const size = 32;
  const svgProps = {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: { fill: '#e5e7eb', stroke: '#374151', strokeWidth: 1.5 } as CSSProperties,
  };

  switch (icon) {
    case 'rect':
      return (
        <svg {...svgProps}>
          <rect x="4" y="8" width="24" height="16" />
        </svg>
      );
    case 'roundRect':
      return (
        <svg {...svgProps}>
          <rect x="4" y="8" width="24" height="16" rx="4" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg {...svgProps}>
          <ellipse cx="16" cy="16" rx="12" ry="8" />
        </svg>
      );
    case 'triangle':
      return (
        <svg {...svgProps}>
          <polygon points="16,6 28,26 4,26" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...svgProps}>
          <polygon points="16,6 28,16 16,26 4,16" />
        </svg>
      );
    case 'line':
      return (
        <svg {...svgProps} style={{ ...svgProps.style, fill: 'none' }}>
          <line x1="4" y1="16" x2="28" y2="16" />
        </svg>
      );
    case 'textBox':
      return (
        <svg {...svgProps} style={{ ...svgProps.style, fill: 'none' }}>
          <rect x="4" y="8" width="24" height="16" strokeDasharray="4 2" />
          <text x="16" y="19" textAnchor="middle" fontSize="8" fill="#374151" stroke="none">
            T
          </text>
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <rect x="4" y="8" width="24" height="16" />
        </svg>
      );
  }
}

export function ShapeGallery({ onInsertShape, disabled }: ShapeGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInsert = (preset: ShapePreset) => {
    onInsertShape({
      shapeType: preset.type,
      width: preset.width,
      height: preset.height,
      fillColor: preset.type === 'line' ? undefined : '#e5e7eb',
      fillType: preset.type === 'line' ? 'none' : 'solid',
      outlineWidth: 1,
      outlineColor: '#374151',
    });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title="Insert shape"
        aria-label="Insert shape"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          border: 'none',
          background: isOpen ? 'var(--doc-hover, #f3f4f6)' : 'transparent',
          borderRadius: 4,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          padding: 0,
        }}
      >
        <MaterialSymbol name="shapes" size={18} />
      </button>

      {isOpen && (
        <div style={dropdownStyle}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--doc-text-muted)',
              padding: '0 4px 6px',
            }}
          >
            Insert Shape
          </div>
          <div style={gridStyle}>
            {SHAPE_PRESETS.map((preset) => (
              <button
                key={preset.type}
                type="button"
                style={shapeButtonStyle}
                onClick={() => handleInsert(preset)}
                title={preset.label}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--doc-hover, #f3f4f6)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--doc-border, #d1d5db)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                }}
              >
                {renderShapePreview(preset.icon)}
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
