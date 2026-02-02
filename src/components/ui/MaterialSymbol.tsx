/**
 * Material Symbol Icon Component
 *
 * Uses Google's Material Symbols (variable font icons)
 * https://fonts.google.com/icons
 *
 * Note: The font is loaded in demo/index.html for better performance.
 */

import type { CSSProperties } from 'react';

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
    width: `${size}px`,
    height: `${size}px`,
    ...style,
  };

  return (
    <span className={`material-symbols-outlined ${className}`} style={iconStyle} aria-hidden="true">
      {name}
    </span>
  );
}

export default MaterialSymbol;
