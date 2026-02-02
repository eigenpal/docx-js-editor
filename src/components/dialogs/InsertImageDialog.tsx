/**
 * Insert Image Dialog Component
 *
 * Modal dialog for inserting images into the document.
 * Supports file upload with preview and basic sizing options.
 *
 * Features:
 * - File input for image selection
 * - Drag and drop support
 * - Image preview
 * - Width/height controls with aspect ratio lock
 * - Alt text input
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, DragEvent, ChangeEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Image data for insertion
 */
export interface ImageData {
  /** Base64 data URL or external URL */
  src: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Alt text for accessibility */
  alt?: string;
  /** Original file name */
  fileName?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * Props for InsertImageDialog
 */
export interface InsertImageDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when image is inserted */
  onInsert: (data: ImageData) => void;
  /** Maximum width in pixels (default: 800) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 600) */
  maxHeight?: number;
  /** Accepted file types (default: image/*) */
  accept?: string;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

// ============================================================================
// STYLES
// ============================================================================

const DIALOG_OVERLAY_STYLE: CSSProperties = {
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

const DIALOG_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  minWidth: '450px',
  maxWidth: '600px',
  width: '100%',
  margin: '20px',
  maxHeight: '90vh',
  overflow: 'auto',
};

const DIALOG_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #e0e0e0',
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: '#333',
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  color: '#666',
  padding: '4px 8px',
  lineHeight: 1,
};

const DIALOG_BODY_STYLE: CSSProperties = {
  padding: '20px',
};

const DROP_ZONE_STYLE: CSSProperties = {
  border: '2px dashed #ccc',
  borderRadius: '8px',
  padding: '40px 20px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background-color 0.2s',
  marginBottom: '16px',
};

const DROP_ZONE_ACTIVE_STYLE: CSSProperties = {
  ...DROP_ZONE_STYLE,
  borderColor: '#1a73e8',
  backgroundColor: '#f0f7ff',
};

const DROP_ZONE_WITH_IMAGE_STYLE: CSSProperties = {
  ...DROP_ZONE_STYLE,
  padding: '20px',
  borderStyle: 'solid',
  borderColor: '#1a73e8',
};

const PREVIEW_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  maxHeight: '250px',
  overflow: 'hidden',
};

const PREVIEW_IMAGE_STYLE: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '250px',
  objectFit: 'contain',
  borderRadius: '4px',
};

const DROP_ZONE_ICON_STYLE: CSSProperties = {
  fontSize: '48px',
  color: '#999',
  marginBottom: '12px',
};

const DROP_ZONE_TEXT_STYLE: CSSProperties = {
  fontSize: '14px',
  color: '#666',
  marginBottom: '8px',
};

const DROP_ZONE_SUBTEXT_STYLE: CSSProperties = {
  fontSize: '12px',
  color: '#999',
};

const FORM_GROUP_STYLE: CSSProperties = {
  marginBottom: '16px',
};

const LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#333',
};

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const SIZE_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const SIZE_INPUT_STYLE: CSSProperties = {
  width: '100px',
  padding: '8px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
  textAlign: 'center',
};

const LOCK_BUTTON_STYLE: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '16px',
};

const LOCK_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...LOCK_BUTTON_STYLE,
  backgroundColor: '#1a73e8',
  borderColor: '#1a73e8',
  color: '#fff',
};

const FILE_INFO_STYLE: CSSProperties = {
  fontSize: '12px',
  color: '#666',
  marginTop: '8px',
  textAlign: 'center',
};

const DIALOG_FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '16px 20px',
  borderTop: '1px solid #e0e0e0',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#1a73e8',
  color: '#ffffff',
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#f0f0f0',
  color: '#333',
  border: '1px solid #ccc',
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: '#ccc',
  color: '#666',
  cursor: 'not-allowed',
};

// ============================================================================
// ICONS
// ============================================================================

/**
 * Image Icon
 */
function ImageIcon(): React.ReactElement {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="36" height="28" rx="2" stroke="#999" strokeWidth="2" fill="none" />
      <circle cx="16" cy="20" r="4" stroke="#999" strokeWidth="2" fill="none" />
      <path d="M6 32L16 24L26 34L36 22L42 28" stroke="#999" strokeWidth="2" fill="none" />
    </svg>
  );
}

/**
 * Lock Icon
 */
function LockIcon({ locked }: { locked: boolean }): React.ReactElement {
  if (locked) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 6V4a4 4 0 0 0-8 0v2H3v8h10V6h-1zm-6-2a2 2 0 0 1 4 0v2H6V4zm6 8H4V8h8v4z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6V4a2 2 0 0 0-4 0v2H4v8h8V6h-2zM6 4a2 2 0 0 1 4 0v2h-2V4H6v2H4v2H6V4zm4 8H6V8h4v4z" />
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * InsertImageDialog - Modal for inserting images with preview and sizing
 */
export function InsertImageDialog({
  isOpen,
  onClose,
  onInsert,
  maxWidth = 800,
  maxHeight = 600,
  accept = 'image/*',
  className,
  style,
}: InsertImageDialogProps): React.ReactElement | null {
  // State
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [altText, setAltText] = useState('');
  const [aspectLocked, setAspectLocked] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setImageData(null);
      setIsDragging(false);
      setWidth(0);
      setHeight(0);
      setAltText('');
      setAspectLocked(true);
      setOriginalAspectRatio(1);
      setError(null);
    }
  }, [isOpen]);

  /**
   * Process a file and load image data
   */
  const processFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large (max 10MB)');
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;

      // Load image to get dimensions
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        // Scale down if exceeds max dimensions
        if (w > maxWidth || h > maxHeight) {
          const scaleW = maxWidth / w;
          const scaleH = maxHeight / h;
          const scale = Math.min(scaleW, scaleH);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        setWidth(w);
        setHeight(h);
        setOriginalAspectRatio(img.width / img.height);
        setImageData({
          src,
          width: w,
          height: h,
          fileName: file.name,
          mimeType: file.type,
        });
      };
      img.src = src;
    };

    reader.onerror = () => {
      setError('Failed to read image file');
    };

    reader.readAsDataURL(file);
  }, [maxWidth, maxHeight]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  /**
   * Handle drop zone click
   */
  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  /**
   * Handle width change
   */
  const handleWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value, 10) || 0;
    setWidth(newWidth);

    if (aspectLocked && originalAspectRatio) {
      setHeight(Math.round(newWidth / originalAspectRatio));
    }
  }, [aspectLocked, originalAspectRatio]);

  /**
   * Handle height change
   */
  const handleHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newHeight = parseInt(e.target.value, 10) || 0;
    setHeight(newHeight);

    if (aspectLocked && originalAspectRatio) {
      setWidth(Math.round(newHeight * originalAspectRatio));
    }
  }, [aspectLocked, originalAspectRatio]);

  /**
   * Handle insert
   */
  const handleInsert = useCallback(() => {
    if (imageData) {
      onInsert({
        ...imageData,
        width,
        height,
        alt: altText || undefined,
      });
    }
  }, [imageData, width, height, altText, onInsert]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && imageData && !e.shiftKey) {
      e.preventDefault();
      handleInsert();
    }
  }, [onClose, imageData, handleInsert]);

  /**
   * Handle overlay click
   */
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  /**
   * Clear current image
   */
  const handleClear = useCallback(() => {
    setImageData(null);
    setWidth(0);
    setHeight(0);
    setAltText('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const canInsert = imageData !== null && width > 0 && height > 0;

  // Get drop zone style
  const getDropZoneStyle = (): CSSProperties => {
    if (imageData) return DROP_ZONE_WITH_IMAGE_STYLE;
    if (isDragging) return DROP_ZONE_ACTIVE_STYLE;
    return DROP_ZONE_STYLE;
  };

  return (
    <div
      className={`docx-insert-image-dialog-overlay ${className || ''}`}
      style={{ ...DIALOG_OVERLAY_STYLE, ...style }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-image-dialog-title"
    >
      <div
        ref={dialogRef}
        className="docx-insert-image-dialog"
        style={DIALOG_CONTENT_STYLE}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="docx-insert-image-dialog-header" style={DIALOG_HEADER_STYLE}>
          <h2 id="insert-image-dialog-title" style={DIALOG_TITLE_STYLE}>
            Insert Image
          </h2>
          <button
            type="button"
            className="docx-insert-image-dialog-close"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="docx-insert-image-dialog-body" style={DIALOG_BODY_STYLE}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Drop zone / Preview */}
          <div
            className="docx-insert-image-dropzone"
            style={getDropZoneStyle()}
            onClick={handleDropZoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Click or drag to upload image"
          >
            {imageData ? (
              <div style={PREVIEW_CONTAINER_STYLE}>
                <img
                  src={imageData.src}
                  alt={altText || 'Preview'}
                  style={PREVIEW_IMAGE_STYLE}
                />
              </div>
            ) : (
              <>
                <div style={DROP_ZONE_ICON_STYLE}>
                  <ImageIcon />
                </div>
                <div style={DROP_ZONE_TEXT_STYLE}>
                  Click to select or drag and drop an image
                </div>
                <div style={DROP_ZONE_SUBTEXT_STYLE}>
                  PNG, JPG, GIF up to 10MB
                </div>
              </>
            )}
          </div>

          {/* File info */}
          {imageData?.fileName && (
            <div style={FILE_INFO_STYLE}>
              {imageData.fileName}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#1a73e8',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Size controls */}
          {imageData && (
            <>
              <div style={FORM_GROUP_STYLE}>
                <label style={LABEL_STYLE}>Dimensions</label>
                <div style={SIZE_ROW_STYLE}>
                  <span style={{ fontSize: '14px', color: '#666' }}>Width:</span>
                  <input
                    type="number"
                    value={width}
                    onChange={handleWidthChange}
                    min={1}
                    max={maxWidth}
                    style={SIZE_INPUT_STYLE}
                  />
                  <span style={{ fontSize: '14px', color: '#666' }}>px</span>
                  <button
                    type="button"
                    onClick={() => setAspectLocked(!aspectLocked)}
                    style={aspectLocked ? LOCK_BUTTON_ACTIVE_STYLE : LOCK_BUTTON_STYLE}
                    title={aspectLocked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    <LockIcon locked={aspectLocked} />
                  </button>
                  <span style={{ fontSize: '14px', color: '#666' }}>Height:</span>
                  <input
                    type="number"
                    value={height}
                    onChange={handleHeightChange}
                    min={1}
                    max={maxHeight}
                    style={SIZE_INPUT_STYLE}
                  />
                  <span style={{ fontSize: '14px', color: '#666' }}>px</span>
                </div>
              </div>

              <div style={FORM_GROUP_STYLE}>
                <label htmlFor="insert-image-alt" style={LABEL_STYLE}>
                  Alt Text (optional)
                </label>
                <input
                  id="insert-image-alt"
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image for accessibility"
                  style={INPUT_STYLE}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="docx-insert-image-dialog-footer" style={DIALOG_FOOTER_STYLE}>
          <button
            type="button"
            className="docx-insert-image-dialog-cancel"
            style={SECONDARY_BUTTON_STYLE}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="docx-insert-image-dialog-insert"
            style={canInsert ? PRIMARY_BUTTON_STYLE : DISABLED_BUTTON_STYLE}
            onClick={handleInsert}
            disabled={!canInsert}
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing Insert Image dialog state
 */
export function useInsertImageDialog(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a file is a valid image
 */
export function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get supported image extensions
 */
export function getSupportedImageExtensions(): string[] {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
}

/**
 * Get accept string for file input
 */
export function getImageAcceptString(): string {
  return 'image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml';
}

/**
 * Calculate scaled dimensions to fit within bounds
 */
export function calculateFitDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  const scaleX = maxWidth / originalWidth;
  const scaleY = maxHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY);

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * Convert data URL to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binaryString = atob(parts[1]);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * Get image dimensions from a data URL
 */
export function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InsertImageDialog;
