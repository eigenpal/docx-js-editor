/**
 * Annotation Panel Component
 *
 * Displays template tags anchored to their positions in the document.
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { TextSelection } from 'prosemirror-state';
import type { PluginPanelProps } from '../../../plugin-api/types';
import type { TemplateTag, TagType } from '../prosemirror-plugin';
import { setHoveredElement, setSelectedElement } from '../prosemirror-plugin';

interface PluginState {
  tags: TemplateTag[];
  hoveredId?: string;
  selectedId?: string;
}

export interface AnnotationPanelProps extends PluginPanelProps<PluginState> {}

interface TagPosition {
  tag: TemplateTag;
  top: number;
}

/** Colors for tag types */
const COLORS: Record<TagType, string> = {
  variable: '#f59e0b',
  sectionStart: '#3b82f6',
  sectionEnd: '#3b82f6',
  invertedStart: '#8b5cf6',
  raw: '#ef4444',
};

/** Labels for tag types */
function getLabel(type: TagType): string {
  switch (type) {
    case 'sectionStart':
      return 'LOOP / IF';
    case 'invertedStart':
      return 'IF NOT';
    case 'raw':
      return 'HTML';
    default:
      return '';
  }
}

export function AnnotationPanel({
  editorView,
  pluginState,
  renderedDomContext,
}: AnnotationPanelProps) {
  const tags = pluginState?.tags ?? [];
  const hoveredId = pluginState?.hoveredId;
  const selectedId = pluginState?.selectedId;

  const [layoutVersion, setLayoutVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Cache last known good positions so chips never disappear during layout transitions
  const lastPositionsRef = useRef<TagPosition[]>([]);

  // Filter to show only variables and section starts (not ends or vars inside sections)
  const visibleTags = useMemo(() => {
    return tags.filter((t) => t.type !== 'sectionEnd' && !t.insideSection);
  }, [tags]);

  // Compute positions synchronously to avoid blank-frame blink
  const computePositions = useCallback((): TagPosition[] => {
    if (visibleTags.length === 0 || !renderedDomContext) {
      return lastPositionsRef.current;
    }

    const newPositions: TagPosition[] = [];
    const containerOffset = renderedDomContext.getContainerOffset();
    // Build lookup of last known positions by tag ID
    const lastPosMap = new Map<string, number>();
    for (const pos of lastPositionsRef.current) {
      lastPosMap.set(pos.tag.id, pos.top);
    }

    for (const tag of visibleTags) {
      const rects = renderedDomContext.getRectsForRange(tag.from, tag.from + 1);
      if (rects.length > 0) {
        const top = rects[0].y + containerOffset.y - 40;
        newPositions.push({ tag, top });
      } else {
        // Fallback: keep last known position so chip doesn't disappear
        const lastTop = lastPosMap.get(tag.id);
        if (lastTop !== undefined) {
          newPositions.push({ tag, top: lastTop });
        }
      }
    }

    // Sort and prevent overlaps using measured heights
    newPositions.sort((a, b) => a.top - b.top);
    const minGap = 6;

    for (let i = 1; i < newPositions.length; i++) {
      const prev = newPositions[i - 1];
      const curr = newPositions[i];

      const prevChipEl = chipRefs.current.get(prev.tag.id);
      let prevHeight = 32;
      if (prevChipEl) {
        prevHeight = prevChipEl.offsetHeight;
      } else if (prev.tag.nestedVars && prev.tag.nestedVars.length > 0) {
        prevHeight = 32 + 10 + prev.tag.nestedVars.length * 26;
      }

      if (curr.top < prev.top + prevHeight + minGap) {
        curr.top = prev.top + prevHeight + minGap;
      }
    }

    lastPositionsRef.current = newPositions;
    return newPositions;
  }, [visibleTags, renderedDomContext]);

   
  const positions = useMemo(() => computePositions(), [computePositions, layoutVersion]);

  // ResizeObserver for zoom/layout changes
  useEffect(() => {
    if (!renderedDomContext) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    });
    observer.observe(renderedDomContext.pagesContainer);
    return () => observer.disconnect();
  }, [renderedDomContext]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Second pass: recalculate once after initial render to use measured chip heights
  const lastMeasuredTagsKey = useRef<string>('');
  useEffect(() => {
    const tagsKey = visibleTags.map((t) => t.id).join(',');
    if (tagsKey && lastMeasuredTagsKey.current !== tagsKey) {
      const timer = setTimeout(() => {
        lastMeasuredTagsKey.current = tagsKey;
        setLayoutVersion((v) => v + 1);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visibleTags]);

  const handleHover = (id: string | undefined) => {
    if (editorView) setHoveredElement(editorView, id);
  };

  const handleClick = (tag: TemplateTag) => {
    if (!editorView) return;
    setSelectedElement(editorView, tag.id);
    // Select the tag in editor
    const { state } = editorView;
    const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(tag.from)));
    editorView.dispatch(tr);
    editorView.focus();
  };

  if (visibleTags.length === 0) return null;

  return (
    <div className="template-panel" ref={containerRef}>
      <div className="template-panel-annotations">
        {positions.map(({ tag, top }) => {
          const label = getLabel(tag.type);
          const color = COLORS[tag.type];
          const isSection = tag.type === 'sectionStart' || tag.type === 'invertedStart';
          const isHovered = tag.id === hoveredId;
          const isSelected = tag.id === selectedId;

          return (
            <div key={tag.id} className="template-annotation-anchor" style={{ top: `${top}px` }}>
              <div className="template-annotation-connector" />
              <div
                ref={(el) => {
                  if (el) chipRefs.current.set(tag.id, el);
                  else chipRefs.current.delete(tag.id);
                }}
                className={`template-annotation-chip ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ borderLeftColor: color }}
                onMouseEnter={() => handleHover(tag.id)}
                onMouseLeave={() => handleHover(undefined)}
                onClick={() => handleClick(tag)}
                title={
                  isSection
                    ? `${tag.rawTag}\nIterates over ${tag.name}[]. Access nested properties via ${tag.name}.property`
                    : tag.rawTag
                }
              >
                {label && (
                  <span className="template-chip-badge" style={{ background: color }}>
                    {label}
                  </span>
                )}
                {!label && (
                  <span className="template-chip-dot" style={{ color }}>
                    ●
                  </span>
                )}
                <span className="template-chip-name">{tag.name}</span>

                {isSection && tag.nestedVars && tag.nestedVars.length > 0 && (
                  <div className="template-chip-nested">
                    {tag.nestedVars.map((v, i) => (
                      <span
                        key={i}
                        className="template-nested-var"
                        title={`Access: ${tag.name}.${v}`}
                      >
                        {v.includes('.') ? v.split('.').pop() : v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ANNOTATION_PANEL_STYLES = `
.template-panel {
  display: flex;
  min-height: 100%;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
}

.template-panel-annotations {
  flex: 1;
  position: relative;
  overflow: visible;
  min-height: 100%;
  pointer-events: none;
  will-change: transform;
}

.template-panel-annotations > * {
  pointer-events: auto;
}

.template-annotation-anchor {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  transition: top 0.15s ease-out;
}

.template-annotation-connector {
  width: 20px;
  height: 1px;
  background: #d0d0d0;
  margin-top: 12px;
  margin-right: 4px;
  flex-shrink: 0;
}

.template-annotation-anchor:hover .template-annotation-connector {
  background: #3b82f6;
}

.template-annotation-chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: white;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #6c757d;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  max-width: 200px;
}

.template-annotation-chip:hover,
.template-annotation-chip.hovered {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e1;
}

.template-annotation-chip.selected {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.template-chip-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.template-chip-dot {
  font-size: 8px;
}

.template-chip-name {
  color: #334155;
  font-weight: 500;
}

.template-chip-nested {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.template-nested-var {
  font-size: 10px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 3px;
}

.template-nested-var:hover {
  background: rgba(59, 130, 246, 0.15);
  color: #1e40af;
}
`;
