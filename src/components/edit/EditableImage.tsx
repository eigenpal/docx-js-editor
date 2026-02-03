/**
 * EditableImage Component
 *
 * Provides image editing capabilities for the DOCX editor:
 * - Resize handles on corners and edges
 * - Maintains aspect ratio (unless shift held)
 * - Click to select, show controls
 * - Delete key removes image
 * - Keyboard accessibility
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { Image as ImageType, ImageSize } from '../../types/document';
import {
  getImageWidthPx,
  getImageHeightPx,
  isInlineImage,
  isFloatingImage,
  isBehindText,
  isInFrontOfText,
  isDecorativeImage,
  getWrapDistancesPx,
} from '../../docx/imageParser';
import { pixelsToEmu } from '../../utils/units';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resize handle positions
 */
export type ResizeHandle =
  | 'nw' // Northwest (top-left)
  | 'n' // North (top-center)
  | 'ne' // Northeast (top-right)
  | 'e' // East (right-center)
  | 'se' // Southeast (bottom-right)
  | 's' // South (bottom-center)
  | 'sw' // Southwest (bottom-left)
  | 'w'; // West (left-center)

/**
 * Props for EditableImage component
 */
export interface EditableImageProps {
  /** The image data to render */
  image: ImageType;
  /** Index in the document/run for identification */
  imageIndex?: number;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Whether the image is currently selected */
  selected?: boolean;
  /** Callback when image is selected */
  onSelect?: (imageIndex: number) => void;
  /** Callback when image is deselected */
  onDeselect?: () => void;
  /** Callback when image is resized */
  onResize?: (newSize: ImageSize) => void;
  /** Callback when image is deleted */
  onDelete?: () => void;
  /** Callback when image properties change */
  onChange?: (updatedImage: ImageType) => void;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

/**
 * Internal state for resize drag operation
 */
interface ResizeDragState {
  /** Which handle is being dragged */
  handle: ResizeHandle;
  /** Starting mouse position */
  startX: number;
  startY: number;
  /** Starting image dimensions */
  startWidth: number;
  startHeight: number;
  /** Whether aspect ratio is locked */
  lockAspectRatio: boolean;
  /** Original aspect ratio */
  aspectRatio: number;
}

// ============================================================================
// STYLES
// ============================================================================

const STYLES: Record<string, CSSProperties> = {
  container: {
    position: 'relative',
    display: 'inline-block',
    userSelect: 'none',
  },
  containerFloating: {
    display: 'block',
  },
  image: {
    display: 'block',
    maxWidth: '100%',
    cursor: 'pointer',
  },
  imageSelected: {
    outline: '2px solid var(--doc-primary)',
    outlineOffset: '2px',
  },
  handle: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    backgroundColor: 'var(--doc-primary)',
    border: '1px solid white',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    zIndex: 10,
    boxSizing: 'border-box',
  },
  handleCorner: {
    width: '10px',
    height: '10px',
  },
  handleEdge: {
    width: '8px',
    height: '8px',
  },
  handleNW: {
    top: '-5px',
    left: '-5px',
    cursor: 'nw-resize',
  },
  handleN: {
    top: '-4px',
    left: '50%',
    transform: 'translateX(-50%)',
    cursor: 'n-resize',
  },
  handleNE: {
    top: '-5px',
    right: '-5px',
    cursor: 'ne-resize',
  },
  handleE: {
    top: '50%',
    right: '-4px',
    transform: 'translateY(-50%)',
    cursor: 'e-resize',
  },
  handleSE: {
    bottom: '-5px',
    right: '-5px',
    cursor: 'se-resize',
  },
  handleS: {
    bottom: '-4px',
    left: '50%',
    transform: 'translateX(-50%)',
    cursor: 's-resize',
  },
  handleSW: {
    bottom: '-5px',
    left: '-5px',
    cursor: 'sw-resize',
  },
  handleW: {
    top: '50%',
    left: '-4px',
    transform: 'translateY(-50%)',
    cursor: 'w-resize',
  },
  placeholder: {
    display: 'inline-block',
    backgroundColor: 'var(--doc-bg-muted)',
    border: '1px dashed var(--doc-border)',
    minWidth: '50px',
    minHeight: '50px',
    textAlign: 'center',
    color: 'var(--doc-text-muted)',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    padding: '8px',
    boxSizing: 'border-box',
  },
  dimensionIndicator: {
    position: 'absolute',
    bottom: '-24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 20,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * EditableImage - Image with resize handles and editing support
 */
export function EditableImage({
  image,
  imageIndex = 0,
  editable = true,
  selected = false,
  onSelect,
  onDeselect,
  onResize,
  onDelete,
  onChange,
  minWidth = 20,
  minHeight = 20,
  maxWidth = 2000,
  maxHeight = 2000,
  className,
  style: additionalStyle,
}: EditableImageProps): React.ReactElement {
  // Current dimensions (can be modified during resize)
  const [currentWidth, setCurrentWidth] = useState(() => getImageWidthPx(image));
  const [currentHeight, setCurrentHeight] = useState(() => getImageHeightPx(image));
  const [isResizing, setIsResizing] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);

  // Refs for drag handling
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<ResizeDragState | null>(null);

  // Update dimensions when image changes
  useEffect(() => {
    if (!isResizing) {
      setCurrentWidth(getImageWidthPx(image));
      setCurrentHeight(getImageHeightPx(image));
    }
  }, [image, isResizing]);

  // Handle click to select
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!editable) return;
      e.stopPropagation();
      if (onSelect) {
        onSelect(imageIndex);
      }
    },
    [editable, imageIndex, onSelect]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!editable || !selected) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (onDelete) {
            onDelete();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (onDeselect) {
            onDeselect();
          }
          break;
        // Arrow keys for nudging (could be added)
      }
    },
    [editable, selected, onDelete, onDeselect]
  );

  // Start resize drag
  const handleResizeStart = useCallback(
    (handle: ResizeHandle) => (e: MouseEvent) => {
      if (!editable || !selected) return;

      e.preventDefault();
      e.stopPropagation();

      const initialWidth = currentWidth;
      const initialHeight = currentHeight;

      dragStateRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: initialWidth,
        startHeight: initialHeight,
        lockAspectRatio: !e.shiftKey, // Shift unlocks aspect ratio
        aspectRatio: initialWidth / initialHeight || 1,
      };

      setIsResizing(true);
      setShowDimensions(true);

      // Add document-level event listeners
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    },
    [editable, selected, currentWidth, currentHeight]
  );

  // Handle resize movement
  const handleResizeMove = useCallback(
    (e: globalThis.MouseEvent) => {
      if (!dragStateRef.current) return;

      const state = dragStateRef.current;
      const deltaX = e.clientX - state.startX;
      const deltaY = e.clientY - state.startY;

      // Update lock based on shift key state
      state.lockAspectRatio = !e.shiftKey;

      let newWidth = state.startWidth;
      let newHeight = state.startHeight;

      // Calculate new dimensions based on which handle is being dragged
      switch (state.handle) {
        case 'e':
          newWidth = state.startWidth + deltaX;
          if (state.lockAspectRatio) {
            newHeight = newWidth / state.aspectRatio;
          }
          break;
        case 'w':
          newWidth = state.startWidth - deltaX;
          if (state.lockAspectRatio) {
            newHeight = newWidth / state.aspectRatio;
          }
          break;
        case 's':
          newHeight = state.startHeight + deltaY;
          if (state.lockAspectRatio) {
            newWidth = newHeight * state.aspectRatio;
          }
          break;
        case 'n':
          newHeight = state.startHeight - deltaY;
          if (state.lockAspectRatio) {
            newWidth = newHeight * state.aspectRatio;
          }
          break;
        case 'se':
          newWidth = state.startWidth + deltaX;
          newHeight = state.startHeight + deltaY;
          if (state.lockAspectRatio) {
            // Use the larger delta to determine size
            const widthRatio = newWidth / state.startWidth;
            const heightRatio = newHeight / state.startHeight;
            if (widthRatio > heightRatio) {
              newHeight = newWidth / state.aspectRatio;
            } else {
              newWidth = newHeight * state.aspectRatio;
            }
          }
          break;
        case 'sw':
          newWidth = state.startWidth - deltaX;
          newHeight = state.startHeight + deltaY;
          if (state.lockAspectRatio) {
            const widthRatio = newWidth / state.startWidth;
            const heightRatio = newHeight / state.startHeight;
            if (widthRatio > heightRatio) {
              newHeight = newWidth / state.aspectRatio;
            } else {
              newWidth = newHeight * state.aspectRatio;
            }
          }
          break;
        case 'ne':
          newWidth = state.startWidth + deltaX;
          newHeight = state.startHeight - deltaY;
          if (state.lockAspectRatio) {
            const widthRatio = newWidth / state.startWidth;
            const heightRatio = newHeight / state.startHeight;
            if (widthRatio > heightRatio) {
              newHeight = newWidth / state.aspectRatio;
            } else {
              newWidth = newHeight * state.aspectRatio;
            }
          }
          break;
        case 'nw':
          newWidth = state.startWidth - deltaX;
          newHeight = state.startHeight - deltaY;
          if (state.lockAspectRatio) {
            const widthRatio = newWidth / state.startWidth;
            const heightRatio = newHeight / state.startHeight;
            if (widthRatio > heightRatio) {
              newHeight = newWidth / state.aspectRatio;
            } else {
              newWidth = newHeight * state.aspectRatio;
            }
          }
          break;
      }

      // Clamp to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      setCurrentWidth(Math.round(newWidth));
      setCurrentHeight(Math.round(newHeight));
    },
    [minWidth, minHeight, maxWidth, maxHeight]
  );

  // End resize drag
  const handleResizeEnd = useCallback(() => {
    if (!dragStateRef.current) return;

    // Remove document-level event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);

    // Notify of resize
    if (onResize) {
      const newSize: ImageSize = {
        width: pixelsToEmu(currentWidth),
        height: pixelsToEmu(currentHeight),
      };
      onResize(newSize);
    }

    // Also call onChange with updated image
    if (onChange) {
      const updatedImage: ImageType = {
        ...image,
        size: {
          width: pixelsToEmu(currentWidth),
          height: pixelsToEmu(currentHeight),
        },
      };
      onChange(updatedImage);
    }

    dragStateRef.current = null;
    setIsResizing(false);

    // Hide dimensions after a delay
    setTimeout(() => {
      setShowDimensions(false);
    }, 1000);
  }, [currentWidth, currentHeight, image, onResize, onChange, handleResizeMove]);

  // Build class names
  const classNames: string[] = ['docx-editable-image'];
  if (className) {
    classNames.push(className);
  }
  if (isInlineImage(image)) {
    classNames.push('docx-editable-image-inline');
  } else if (isFloatingImage(image)) {
    classNames.push('docx-editable-image-floating');
    if (isBehindText(image)) {
      classNames.push('docx-editable-image-behind');
    } else if (isInFrontOfText(image)) {
      classNames.push('docx-editable-image-infront');
    }
  }
  if (selected) {
    classNames.push('docx-editable-image-selected');
  }
  if (isResizing) {
    classNames.push('docx-editable-image-resizing');
  }

  // Build container styles
  const containerStyle: CSSProperties = {
    ...STYLES.container,
    ...(isFloatingImage(image) ? STYLES.containerFloating : {}),
    ...additionalStyle,
  };

  // Apply wrap margins for floating images
  if (isFloatingImage(image)) {
    const wrapDistances = getWrapDistancesPx(image);
    if (wrapDistances) {
      containerStyle.marginTop = `${wrapDistances.top}px`;
      containerStyle.marginBottom = `${wrapDistances.bottom}px`;
      containerStyle.marginLeft = `${wrapDistances.left}px`;
      containerStyle.marginRight = `${wrapDistances.right}px`;
    }
  }

  // Build image styles
  const imageStyle: CSSProperties = {
    ...STYLES.image,
    width: `${currentWidth}px`,
    height: `${currentHeight}px`,
    ...(selected ? STYLES.imageSelected : {}),
  };

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
    imageStyle.transform = transforms.join(' ');
  }

  // Accessibility props
  const accessibilityProps: React.ImgHTMLAttributes<HTMLImageElement> = {};
  if (isDecorativeImage(image)) {
    accessibilityProps.alt = '';
    accessibilityProps.role = 'presentation';
    accessibilityProps['aria-hidden'] = true;
  } else {
    accessibilityProps.alt = image.alt || image.title || '';
    if (image.title) {
      accessibilityProps.title = image.title;
    }
  }

  // Render placeholder if no source
  if (!image.src) {
    return (
      <div
        ref={containerRef}
        className={classNames.join(' ')}
        style={containerStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={editable && selected ? 0 : -1}
        role="img"
        aria-label="Image placeholder"
      >
        <span
          style={{
            ...STYLES.placeholder,
            width: `${currentWidth}px`,
            height: `${currentHeight}px`,
          }}
        >
          [Image]
          {image.filename && (
            <>
              <br />
              <small>{image.filename}</small>
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classNames.join(' ')}
      style={containerStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={editable && selected ? 0 : -1}
      role="img"
      aria-label={image.alt || image.title || 'Editable image'}
      data-image-index={imageIndex}
    >
      <img
        src={image.src}
        style={imageStyle}
        draggable={false}
        data-image-id={image.id}
        data-image-rid={image.rId}
        {...accessibilityProps}
      />

      {/* Resize handles - only show when selected and editable */}
      {editable && selected && (
        <>
          {/* Corner handles */}
          <ResizeHandleComponent position="nw" onMouseDown={handleResizeStart('nw')} />
          <ResizeHandleComponent position="ne" onMouseDown={handleResizeStart('ne')} />
          <ResizeHandleComponent position="se" onMouseDown={handleResizeStart('se')} />
          <ResizeHandleComponent position="sw" onMouseDown={handleResizeStart('sw')} />

          {/* Edge handles */}
          <ResizeHandleComponent position="n" onMouseDown={handleResizeStart('n')} />
          <ResizeHandleComponent position="e" onMouseDown={handleResizeStart('e')} />
          <ResizeHandleComponent position="s" onMouseDown={handleResizeStart('s')} />
          <ResizeHandleComponent position="w" onMouseDown={handleResizeStart('w')} />
        </>
      )}

      {/* Dimension indicator during resize */}
      {showDimensions && (
        <div style={STYLES.dimensionIndicator}>
          {currentWidth} × {currentHeight}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Individual resize handle
 */
interface ResizeHandleComponentProps {
  position: ResizeHandle;
  onMouseDown: (e: MouseEvent) => void;
}

function ResizeHandleComponent({
  position,
  onMouseDown,
}: ResizeHandleComponentProps): React.ReactElement {
  const isCorner = ['nw', 'ne', 'se', 'sw'].includes(position);

  const handleStyle: CSSProperties = {
    ...STYLES.handle,
    ...(isCorner ? STYLES.handleCorner : STYLES.handleEdge),
    ...(STYLES[`handle${position.toUpperCase()}` as keyof typeof STYLES] as CSSProperties),
  };

  return (
    <div
      className={`docx-resize-handle docx-resize-handle-${position}`}
      style={handleStyle}
      onMouseDown={onMouseDown}
      role="slider"
      aria-label={`Resize ${position}`}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an image is resizable
 */
export function isResizableImage(image: ImageType): boolean {
  return !!image.src && image.size.width > 0 && image.size.height > 0;
}

/**
 * Get the original aspect ratio of an image
 */
export function getOriginalAspectRatio(image: ImageType): number {
  if (image.originalSize) {
    if (image.originalSize.height === 0) return 1;
    return image.originalSize.width / image.originalSize.height;
  }
  if (image.size.height === 0) return 1;
  return image.size.width / image.size.height;
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
export function calculateProportionalSize(
  originalWidth: number,
  originalHeight: number,
  newWidth?: number,
  newHeight?: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight || 1;

  if (newWidth !== undefined && newHeight !== undefined) {
    return { width: newWidth, height: newHeight };
  } else if (newWidth !== undefined) {
    return { width: newWidth, height: Math.round(newWidth / aspectRatio) };
  } else if (newHeight !== undefined) {
    return { width: Math.round(newHeight * aspectRatio), height: newHeight };
  }

  return { width: originalWidth, height: originalHeight };
}

/**
 * Create an updated image with new size
 */
export function resizeImage(image: ImageType, newSize: ImageSize): ImageType {
  return {
    ...image,
    size: newSize,
  };
}

/**
 * Create an updated image with percentage scale
 */
export function scaleImage(image: ImageType, scale: number): ImageType {
  return {
    ...image,
    size: {
      width: Math.round(image.size.width * scale),
      height: Math.round(image.size.height * scale),
    },
  };
}

/**
 * Reset image to original size
 */
export function resetImageSize(image: ImageType): ImageType {
  if (!image.originalSize) return image;
  return {
    ...image,
    size: { ...image.originalSize },
  };
}

/**
 * Get the bounding box of an image in pixels
 */
export function getImageBounds(image: ImageType): {
  width: number;
  height: number;
} {
  return {
    width: getImageWidthPx(image),
    height: getImageHeightPx(image),
  };
}

/**
 * Check if a point is within an image's bounds
 */
export function isPointInImage(
  image: ImageType,
  x: number,
  y: number,
  imageX: number,
  imageY: number
): boolean {
  const bounds = getImageBounds(image);
  return x >= imageX && x <= imageX + bounds.width && y >= imageY && y <= imageY + bounds.height;
}

export default EditableImage;
