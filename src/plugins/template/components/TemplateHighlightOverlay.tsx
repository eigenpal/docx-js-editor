/**
 * Template Highlight Overlay Component
 *
 * Renders highlight rectangles for template tags on the visible pages.
 * Uses RenderedDomContext to get accurate positioning.
 */

import { useMemo } from 'react';
import type { RenderedDomContext } from '../../../plugin-api/types';
import type { TemplateTag, TagType } from '../prosemirror-plugin';

interface TemplateHighlightOverlayProps {
  context: RenderedDomContext;
  tags: TemplateTag[];
  hoveredId?: string;
  selectedId?: string;
  onHover?: (id: string | undefined) => void;
  onSelect?: (id: string) => void;
}

/** Colors for tag types (matching AnnotationPanel) */
const HIGHLIGHT_COLORS: Record<TagType, string> = {
  variable: 'rgba(245, 158, 11, 0.3)',
  sectionStart: 'rgba(59, 130, 246, 0.3)',
  sectionEnd: 'rgba(59, 130, 246, 0.3)',
  invertedStart: 'rgba(139, 92, 246, 0.3)',
  raw: 'rgba(239, 68, 68, 0.3)',
};

const HOVER_COLORS: Record<TagType, string> = {
  variable: 'rgba(245, 158, 11, 0.5)',
  sectionStart: 'rgba(59, 130, 246, 0.5)',
  sectionEnd: 'rgba(59, 130, 246, 0.5)',
  invertedStart: 'rgba(139, 92, 246, 0.5)',
  raw: 'rgba(239, 68, 68, 0.5)',
};

interface HighlightRect {
  tagId: string;
  tagType: TagType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function TemplateHighlightOverlay({
  context,
  tags,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: TemplateHighlightOverlayProps) {
  // Get container offset for viewport-level positioning
  const containerOffset = useMemo(() => context.getContainerOffset(), [context]);

  // Compute highlight rectangles for all tags
  const highlights = useMemo(() => {
    const rects: HighlightRect[] = [];

    for (const tag of tags) {
      const tagRects = context.getRectsForRange(tag.from, tag.to);
      for (const rect of tagRects) {
        rects.push({
          tagId: tag.id,
          tagType: tag.type,
          // Add container offset to position in viewport space
          x: rect.x + containerOffset.x,
          y: rect.y + containerOffset.y,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    return rects;
  }, [context, tags, containerOffset]);

  // Show all highlights, with enhanced styling for hovered/selected
  if (highlights.length === 0) {
    return null;
  }

  return (
    <div className="template-highlight-overlay">
      {highlights.map((rect, index) => {
        const isHovered = rect.tagId === hoveredId;
        const isSelected = rect.tagId === selectedId;
        const color =
          isHovered || isSelected ? HOVER_COLORS[rect.tagType] : HIGHLIGHT_COLORS[rect.tagType];

        return (
          <div
            key={`${rect.tagId}-${index}`}
            className={`template-highlight ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: color,
              borderRadius: 2,
              cursor: 'pointer',
            }}
            onMouseEnter={() => onHover?.(rect.tagId)}
            onMouseLeave={() => onHover?.(undefined)}
            onClick={() => onSelect?.(rect.tagId)}
          />
        );
      })}
    </div>
  );
}

export const TEMPLATE_HIGHLIGHT_OVERLAY_STYLES = `
.template-highlight-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: visible;
}

.template-highlight {
  pointer-events: auto;
  transition: background-color 0.1s ease;
}

.template-highlight:hover,
.template-highlight.hovered {
  filter: brightness(0.9);
}

.template-highlight.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.6);
}
`;
