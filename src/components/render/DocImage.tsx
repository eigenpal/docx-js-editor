/**
 * DocImage Component
 *
 * Renders embedded images from DOCX documents.
 * Supports both inline images (flow with text) and floating images (with text wrapping).
 *
 * Features:
 * - Renders images with correct dimensions
 * - Supports image transformations (rotation, flip)
 * - Handles text wrapping modes (inline, square, tight, behind, etc.)
 * - Alt text for accessibility
 * - Placeholder for missing image data
 */

import React from 'react';
import type { CSSProperties } from 'react';
import type { Image as ImageType } from '../../types/document';
import {
  emuToPixels,
  isInlineImage,
  isFloatingImage,
  isBehindText,
  isInFrontOfText,
  getImageWidthPx,
  getImageHeightPx,
  getWrapDistancesPx,
  isDecorativeImage,
} from '../../docx/imageParser';

/**
 * Props for the DocImage component
 */
export interface DocImageProps {
  /** The image data to render */
  image: ImageType;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether the image is selected (for editing) */
  selected?: boolean;
  /** Callback when image is clicked */
  onClick?: () => void;
  /** Callback when image loading fails */
  onError?: () => void;
  /** Callback when image loads successfully */
  onLoad?: () => void;
}

/**
 * Placeholder style for missing images
 */
const PLACEHOLDER_STYLE: CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#f0f0f0',
  border: '1px dashed #ccc',
  minWidth: '50px',
  minHeight: '50px',
  textAlign: 'center',
  color: '#666',
  fontFamily: 'sans-serif',
  fontSize: '12px',
  padding: '8px',
  boxSizing: 'border-box',
};

/**
 * Selected image style
 */
const SELECTED_STYLE: CSSProperties = {
  outline: '2px solid #0078d4',
  outlineOffset: '2px',
};

/**
 * DocImage component - renders embedded images
 */
export function DocImage({
  image,
  className,
  style: additionalStyle,
  selected = false,
  onClick,
  onError,
  onLoad,
}: DocImageProps): React.ReactElement {
  // Get image dimensions in pixels
  const width = getImageWidthPx(image);
  const height = getImageHeightPx(image);

  // Build class names
  const classNames: string[] = ['docx-image'];
  if (className) {
    classNames.push(className);
  }

  // Add positioning class
  if (isInlineImage(image)) {
    classNames.push('docx-image-inline');
  } else if (isFloatingImage(image)) {
    classNames.push('docx-image-floating');
    if (isBehindText(image)) {
      classNames.push('docx-image-behind');
    } else if (isInFrontOfText(image)) {
      classNames.push('docx-image-infront');
    }
  }

  // Add wrap type class
  classNames.push(`docx-image-wrap-${image.wrap.type}`);

  if (selected) {
    classNames.push('docx-image-selected');
  }

  // Build styles
  const imageStyle = buildImageStyle(image, selected);
  const combinedStyle: CSSProperties = {
    ...imageStyle,
    ...additionalStyle,
  };

  // Handle missing image data
  if (!image.src) {
    return (
      <span
        className={classNames.join(' ')}
        style={{
          ...PLACEHOLDER_STYLE,
          width: width > 0 ? `${width}px` : undefined,
          height: height > 0 ? `${height}px` : undefined,
          ...additionalStyle,
        }}
        onClick={onClick}
        title={image.title || image.alt || 'Image'}
      >
        [Image]
        {image.filename && <br />}
        {image.filename && <small>{image.filename}</small>}
      </span>
    );
  }

  // Accessibility attributes
  const accessibilityProps: React.ImgHTMLAttributes<HTMLImageElement> = {};

  if (isDecorativeImage(image)) {
    // Decorative images should be hidden from assistive technology
    accessibilityProps.alt = '';
    accessibilityProps.role = 'presentation';
    accessibilityProps['aria-hidden'] = true;
  } else {
    accessibilityProps.alt = image.alt || image.title || '';
    if (image.title) {
      accessibilityProps.title = image.title;
    }
  }

  return (
    <img
      src={image.src}
      className={classNames.join(' ')}
      style={combinedStyle}
      onClick={onClick}
      onError={onError}
      onLoad={onLoad}
      data-image-id={image.id}
      data-image-rid={image.rId}
      {...accessibilityProps}
    />
  );
}

/**
 * Build CSS styles for the image
 */
function buildImageStyle(image: ImageType, selected: boolean): CSSProperties {
  const style: CSSProperties = {};

  // Dimensions
  const width = getImageWidthPx(image);
  const height = getImageHeightPx(image);

  if (width > 0) {
    style.width = `${width}px`;
  }
  if (height > 0) {
    style.height = `${height}px`;
  }

  // Display mode based on wrap type
  if (isInlineImage(image)) {
    style.display = 'inline';
    style.verticalAlign = 'baseline';
  } else if (isFloatingImage(image)) {
    // Floating images are positioned by their container or use CSS float
    style.display = 'block';

    // Apply wrap margins
    const wrapDistances = getWrapDistancesPx(image);
    if (wrapDistances) {
      style.marginTop = `${wrapDistances.top}px`;
      style.marginBottom = `${wrapDistances.bottom}px`;
      style.marginLeft = `${wrapDistances.left}px`;
      style.marginRight = `${wrapDistances.right}px`;
    }

    // Apply float for square/tight/through wrapping
    if (
      image.wrap.type === 'square' ||
      image.wrap.type === 'tight' ||
      image.wrap.type === 'through'
    ) {
      // Determine float direction based on wrap text setting
      if (image.wrap.wrapText === 'left') {
        style.float = 'right';
      } else if (image.wrap.wrapText === 'right') {
        style.float = 'left';
      } else {
        // Default to left float
        style.float = 'left';
      }
    }

    // Z-index for behind/in-front
    if (isBehindText(image)) {
      style.zIndex = -1;
      style.position = 'relative';
    } else if (isInFrontOfText(image)) {
      style.zIndex = 1;
      style.position = 'relative';
    }
  }

  // Apply transformations
  const transforms: string[] = [];

  if (image.transform) {
    if (image.transform.rotation) {
      transforms.push(`rotate(${image.transform.rotation}deg)`);
    }
    if (image.transform.flipH) {
      transforms.push('scaleX(-1)');
    }
    if (image.transform.flipV) {
      transforms.push('scaleY(-1)');
    }
  }

  if (transforms.length > 0) {
    style.transform = transforms.join(' ');
  }

  // Selected state
  if (selected) {
    Object.assign(style, SELECTED_STYLE);
    style.cursor = 'pointer';
  }

  return style;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if image has valid source data
 *
 * @param image - The image to check
 * @returns true if image has renderable source
 */
export function hasImageSource(image: ImageType): boolean {
  return !!image.src;
}

/**
 * Get image aspect ratio
 *
 * @param image - The image to calculate ratio for
 * @returns Aspect ratio (width / height)
 */
export function getImageAspectRatio(image: ImageType): number {
  const width = getImageWidthPx(image);
  const height = getImageHeightPx(image);
  if (height === 0) return 1;
  return width / height;
}

/**
 * Calculate dimensions maintaining aspect ratio
 *
 * @param image - The original image
 * @param targetWidth - Target width (optional)
 * @param targetHeight - Target height (optional)
 * @returns Calculated dimensions
 */
export function calculateAspectRatioDimensions(
  image: ImageType,
  targetWidth?: number,
  targetHeight?: number
): { width: number; height: number } {
  const originalWidth = getImageWidthPx(image);
  const originalHeight = getImageHeightPx(image);
  const aspectRatio = getImageAspectRatio(image);

  if (targetWidth && targetHeight) {
    // Both specified - use as is (may distort)
    return { width: targetWidth, height: targetHeight };
  } else if (targetWidth) {
    // Scale height to match aspect ratio
    return { width: targetWidth, height: Math.round(targetWidth / aspectRatio) };
  } else if (targetHeight) {
    // Scale width to match aspect ratio
    return { width: Math.round(targetHeight * aspectRatio), height: targetHeight };
  }

  // No target - return original
  return { width: originalWidth, height: originalHeight };
}

/**
 * Check if image needs text wrapping
 *
 * @param image - The image to check
 * @returns true if text should wrap around image
 */
export function needsTextWrapping(image: ImageType): boolean {
  return (
    image.wrap.type === 'square' || image.wrap.type === 'tight' || image.wrap.type === 'through'
  );
}

/**
 * Check if image is positioned absolutely (anchored)
 *
 * @param image - The image to check
 * @returns true if image has absolute positioning
 */
export function isAbsolutelyPositioned(image: ImageType): boolean {
  return !!image.position;
}

/**
 * Get position offset in pixels for anchored images
 *
 * @param image - The image with position data
 * @returns Position offsets in pixels or null
 */
export function getPositionOffsets(image: ImageType): {
  horizontal: number;
  vertical: number;
} | null {
  if (!image.position) return null;

  return {
    horizontal: image.position.horizontal.posOffset
      ? emuToPixels(image.position.horizontal.posOffset)
      : 0,
    vertical: image.position.vertical.posOffset
      ? emuToPixels(image.position.vertical.posOffset)
      : 0,
  };
}

/**
 * Get CSS styles for absolutely positioned images
 *
 * @param image - The image with position data
 * @returns CSS properties for positioning
 */
export function getPositionStyles(image: ImageType): CSSProperties {
  if (!image.position) return {};

  const style: CSSProperties = {
    position: 'absolute',
  };

  const offsets = getPositionOffsets(image);
  if (offsets) {
    // Horizontal position
    const hRelativeTo = image.position.horizontal.relativeTo;
    const hAlign = image.position.horizontal.alignment;

    if (hAlign === 'left' || hRelativeTo === 'leftMargin') {
      style.left = `${offsets.horizontal}px`;
    } else if (hAlign === 'right' || hRelativeTo === 'rightMargin') {
      style.right = `${offsets.horizontal}px`;
    } else if (hAlign === 'center') {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    } else {
      style.left = `${offsets.horizontal}px`;
    }

    // Vertical position
    const vRelativeTo = image.position.vertical.relativeTo;
    const vAlign = image.position.vertical.alignment;

    if (vAlign === 'top' || vRelativeTo === 'topMargin') {
      style.top = `${offsets.vertical}px`;
    } else if (vAlign === 'bottom' || vRelativeTo === 'bottomMargin') {
      style.bottom = `${offsets.vertical}px`;
    } else if (vAlign === 'center') {
      style.top = '50%';
      style.transform = (style.transform || '') + ' translateY(-50%)';
    } else {
      style.top = `${offsets.vertical}px`;
    }
  }

  return style;
}

/**
 * Get a description of the image for accessibility
 *
 * @param image - The image to describe
 * @returns Accessible description
 */
export function getImageDescription(image: ImageType): string {
  if (image.alt) return image.alt;
  if (image.title) return image.title;
  if (image.filename) return `Image: ${image.filename}`;
  return 'Embedded image';
}

// Re-export utility functions from parser
export {
  isInlineImage,
  isFloatingImage,
  isBehindText,
  isInFrontOfText,
  getImageWidthPx,
  getImageHeightPx,
  isDecorativeImage,
};

export default DocImage;
