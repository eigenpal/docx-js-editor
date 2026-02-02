/**
 * Material Symbol Icon Component
 *
 * Uses Google's Material Symbols (variable font icons)
 * https://fonts.google.com/icons
 */

import type { CSSProperties } from 'react';

// Load Material Symbols font
let fontLoaded = false;
function loadMaterialSymbolsFont() {
  if (fontLoaded || typeof document === 'undefined') return;
  fontLoaded = true;

  // Add preconnect links
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect2);

  // Add font stylesheet
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
  document.head.appendChild(link);

  // Add base styles
  const style = document.createElement('style');
  style.textContent = `
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }
  `;
  document.head.appendChild(style);
}

// Load font on module initialization
loadMaterialSymbolsFont();

export interface MaterialSymbolProps {
  /** Icon name from Material Symbols */
  name: string;
  /** Icon size in pixels (default: 20) */
  size?: number;
  /** Whether the icon should be filled (default: false) */
  filled?: boolean;
  /** Icon weight 100-700 (default: 400) */
  weight?: number;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * Material Symbol icon component
 *
 * @example
 * <MaterialSymbol name="format_bold" />
 * <MaterialSymbol name="format_bold" size={24} filled />
 */
export function MaterialSymbol({
  name,
  size = 20,
  filled = false,
  weight = 400,
  className = '',
  style,
}: MaterialSymbolProps) {
  const iconStyle: CSSProperties = {
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
    fontSize: `${size}px`,
    lineHeight: 1,
    userSelect: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  return (
    <span className={`material-symbols-outlined ${className}`} style={iconStyle} aria-hidden="true">
      {name}
    </span>
  );
}

export default MaterialSymbol;
