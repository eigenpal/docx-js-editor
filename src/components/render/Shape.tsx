/**
 * Shape Component
 *
 * Renders shapes and drawing objects from DOCX documents.
 * Uses SVG for basic shapes (rectangles, ovals, lines) and CSS for positioning.
 *
 * Features:
 * - Basic shape rendering using SVG
 * - Fill (solid, gradient)
 * - Stroke/outline (color, width, style)
 * - Arrow heads on lines
 * - Text content inside shapes
 * - Positioning (inline or floating)
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Shape as ShapeType, ShapeOutline, Paragraph } from '../../types/document';
import {
  isLineShape,
  isTextBoxShape,
  hasTextContent,
  getShapeWidthPx,
  getShapeHeightPx,
  getShapeDimensionsPx,
  isFloatingShape,
  hasFill,
  hasOutline,
  getOutlineWidthPx,
  resolveFillColor,
  resolveOutlineColor,
} from '../../docx/shapeParser';
import { emuToPixels } from '../../docx/imageParser';

/**
 * Props for the Shape component
 */
export interface ShapeProps {
  /** The shape data to render */
  shape: ShapeType;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether the shape is selected (for editing) */
  selected?: boolean;
  /** Callback when shape is clicked */
  onClick?: () => void;
  /** Render function for text content paragraphs */
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode;
}

/**
 * Selected shape style
 */
const SELECTED_STYLE: CSSProperties = {
  outline: '2px solid #0078d4',
  outlineOffset: '2px',
};

/**
 * Shape component - renders drawing objects using SVG
 */
export function Shape({
  shape,
  className,
  style: additionalStyle,
  selected = false,
  onClick,
  renderParagraph,
}: ShapeProps): React.ReactElement {
  // Get dimensions
  const { width, height } = getShapeDimensionsPx(shape);

  // Build class names
  const classNames: string[] = ['docx-shape'];
  if (className) {
    classNames.push(className);
  }
  classNames.push(`docx-shape-${shape.shapeType}`);

  if (isLineShape(shape)) {
    classNames.push('docx-shape-line');
  }
  if (isTextBoxShape(shape)) {
    classNames.push('docx-shape-textbox');
  }
  if (isFloatingShape(shape)) {
    classNames.push('docx-shape-floating');
  }
  if (selected) {
    classNames.push('docx-shape-selected');
  }

  // Build container styles
  const containerStyle: CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    width: `${width}px`,
    height: `${height}px`,
    ...(selected && SELECTED_STYLE),
    ...(onClick && { cursor: 'pointer' }),
    ...additionalStyle,
  };

  // Render shape based on type
  let shapeContent: ReactNode;

  if (isLineShape(shape)) {
    shapeContent = renderLine(shape, width, height);
  } else {
    shapeContent = renderBasicShape(shape, width, height);
  }

  // Render text content if present
  let textContent: ReactNode = null;
  if (hasTextContent(shape) && shape.textBody) {
    textContent = renderTextBody(shape, width, height, renderParagraph);
  }

  return (
    <div
      className={classNames.join(' ')}
      style={containerStyle}
      onClick={onClick}
      data-shape-type={shape.shapeType}
      data-shape-id={shape.id}
    >
      {shapeContent}
      {textContent}
    </div>
  );
}

/**
 * Render a line shape
 */
function renderLine(shape: ShapeType, width: number, height: number): ReactNode {
  const strokeColor = resolveOutlineColor(shape) || '#000000';
  const strokeWidth = getOutlineWidthPx(shape) || 1;
  const strokeDasharray = getStrokeDasharray(shape.outline);

  // Simple line from corner to corner
  // For diagonal lines, we draw from (0,0) to (width, height)
  // For horizontal/vertical, we adjust
  let x1 = 0,
    y1 = 0,
    x2 = width,
    y2 = height;

  // If line is mostly horizontal
  if (height < strokeWidth * 2) {
    y1 = height / 2;
    y2 = height / 2;
  }
  // If line is mostly vertical
  if (width < strokeWidth * 2) {
    x1 = width / 2;
    x2 = width / 2;
  }

  return (
    <svg
      width={width}
      height={height}
      className="docx-shape-svg"
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <defs>{renderArrowMarkers(shape.outline, strokeColor)}</defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerStart={shape.outline?.headEnd?.type !== 'none' ? 'url(#arrowhead-start)' : undefined}
        markerEnd={shape.outline?.tailEnd?.type !== 'none' ? 'url(#arrowhead-end)' : undefined}
      />
    </svg>
  );
}

/**
 * Render a basic shape (rect, ellipse, etc.)
 */
function renderBasicShape(shape: ShapeType, width: number, height: number): ReactNode {
  const strokeColor = hasOutline(shape) ? resolveOutlineColor(shape) : undefined;
  const strokeWidth = hasOutline(shape) ? getOutlineWidthPx(shape) || 1 : 0;
  const strokeDasharray = getStrokeDasharray(shape.outline);

  // Determine fill — gradient or solid
  const isGradient = shape.fill?.type === 'gradient' && shape.fill.gradient;
  const gradId = isGradient ? `grad-${shape.id || 'shape'}` : undefined;
  const fillColor = isGradient ? undefined : resolveFillColor(shape);
  const fillValue = gradId ? `url(#${gradId})` : fillColor || 'none';

  // Calculate SVG viewBox to account for stroke
  const padding = strokeWidth;
  const svgWidth = width;
  const svgHeight = height;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  let shapeElement: ReactNode;

  switch (shape.shapeType) {
    case 'ellipse':
      shapeElement = (
        <ellipse
          cx={svgWidth / 2}
          cy={svgHeight / 2}
          rx={innerWidth / 2}
          ry={innerHeight / 2}
          fill={fillValue}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
      break;

    case 'roundRect':
      const cornerRadius = Math.min(innerWidth, innerHeight) * 0.1; // 10% radius
      shapeElement = (
        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={fillValue}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
      break;

    case 'triangle':
      const triPoints = [
        `${svgWidth / 2},${padding}`,
        `${svgWidth - padding},${svgHeight - padding}`,
        `${padding},${svgHeight - padding}`,
      ].join(' ');
      shapeElement = (
        <polygon
          points={triPoints}
          fill={fillValue}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
      break;

    case 'rightArrow':
    case 'leftArrow':
      shapeElement = renderArrowShape(
        shape,
        svgWidth,
        svgHeight,
        padding,
        fillValue,
        strokeColor,
        strokeWidth,
        strokeDasharray
      );
      break;

    case 'star5':
      shapeElement = renderStar(
        5,
        svgWidth,
        svgHeight,
        padding,
        fillValue,
        strokeColor,
        strokeWidth,
        strokeDasharray
      );
      break;

    case 'rect':
    default:
      // Default to rectangle
      shapeElement = (
        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          fill={fillValue}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      );
      break;
  }

  // Apply transforms
  const transforms: string[] = [];
  if (shape.transform) {
    if (shape.transform.rotation) {
      transforms.push(`rotate(${shape.transform.rotation} ${svgWidth / 2} ${svgHeight / 2})`);
    }
    if (shape.transform.flipH) {
      transforms.push(`scale(-1, 1) translate(${-svgWidth}, 0)`);
    }
    if (shape.transform.flipV) {
      transforms.push(`scale(1, -1) translate(0, ${-svgHeight})`);
    }
  }

  // Build gradient defs if needed
  let gradientDef: ReactNode = null;
  if (isGradient && gradId && shape.fill?.gradient) {
    const g = shape.fill.gradient;
    const stops = g.stops.map((s, i) => (
      <stop
        key={i}
        offset={`${Math.round(s.position / 1000)}%`}
        stopColor={s.color.rgb ? `#${s.color.rgb}` : '#000000'}
      />
    ));

    if (g.type === 'radial' || g.type === 'rectangular' || g.type === 'path') {
      gradientDef = (
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          {stops}
        </radialGradient>
      );
    } else {
      const angle = g.angle || 0;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x1 = Math.round(50 + 50 * Math.cos(rad + Math.PI));
      const y1 = Math.round(50 + 50 * Math.sin(rad + Math.PI));
      const x2 = Math.round(50 + 50 * Math.cos(rad));
      const y2 = Math.round(50 + 50 * Math.sin(rad));
      gradientDef = (
        <linearGradient id={gradId} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
          {stops}
        </linearGradient>
      );
    }
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="docx-shape-svg"
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {gradientDef && <defs>{gradientDef}</defs>}
      <g transform={transforms.length > 0 ? transforms.join(' ') : undefined}>{shapeElement}</g>
    </svg>
  );
}

/**
 * Render arrow shape
 */
function renderArrowShape(
  shape: ShapeType,
  width: number,
  height: number,
  padding: number,
  fillColor: string | undefined,
  strokeColor: string | undefined,
  strokeWidth: number,
  strokeDasharray: string | undefined
): ReactNode {
  const isLeft = shape.shapeType === 'leftArrow';
  const arrowHeadWidth = width * 0.3;
  const shaftHeight = height * 0.4;
  const shaftY = (height - shaftHeight) / 2;

  let points: string;
  if (isLeft) {
    points = [
      `${arrowHeadWidth},${padding}`,
      `${padding},${height / 2}`,
      `${arrowHeadWidth},${height - padding}`,
      `${arrowHeadWidth},${shaftY + shaftHeight}`,
      `${width - padding},${shaftY + shaftHeight}`,
      `${width - padding},${shaftY}`,
      `${arrowHeadWidth},${shaftY}`,
    ].join(' ');
  } else {
    points = [
      `${width - arrowHeadWidth},${padding}`,
      `${width - padding},${height / 2}`,
      `${width - arrowHeadWidth},${height - padding}`,
      `${width - arrowHeadWidth},${shaftY + shaftHeight}`,
      `${padding},${shaftY + shaftHeight}`,
      `${padding},${shaftY}`,
      `${width - arrowHeadWidth},${shaftY}`,
    ].join(' ');
  }

  return (
    <polygon
      points={points}
      fill={fillColor || 'none'}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
    />
  );
}

/**
 * Render a star shape
 */
function renderStar(
  points: number,
  width: number,
  height: number,
  padding: number,
  fillColor: string | undefined,
  strokeColor: string | undefined,
  strokeWidth: number,
  strokeDasharray: string | undefined
): ReactNode {
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2 - padding;
  const innerRadius = outerRadius * 0.4;

  const starPoints: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    starPoints.push(`${x},${y}`);
  }

  return (
    <polygon
      points={starPoints.join(' ')}
      fill={fillColor || 'none'}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
    />
  );
}

/**
 * Render arrow markers for lines
 */
function renderArrowMarkers(outline: ShapeOutline | undefined, color: string): ReactNode {
  if (!outline) return null;

  const markers: ReactNode[] = [];

  if (outline.headEnd && outline.headEnd.type !== 'none') {
    markers.push(
      <marker
        key="arrowhead-start"
        id="arrowhead-start"
        markerWidth="10"
        markerHeight="7"
        refX="0"
        refY="3.5"
        orient="auto-start-reverse"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
      </marker>
    );
  }

  if (outline.tailEnd && outline.tailEnd.type !== 'none') {
    markers.push(
      <marker
        key="arrowhead-end"
        id="arrowhead-end"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
      </marker>
    );
  }

  return markers;
}

/**
 * Get stroke dasharray for line style
 */
function getStrokeDasharray(outline: ShapeOutline | undefined): string | undefined {
  if (!outline?.style) return undefined;

  switch (outline.style) {
    case 'dot':
    case 'sysDot':
      return '2,2';
    case 'dash':
    case 'sysDash':
      return '4,2';
    case 'lgDash':
      return '8,4';
    case 'dashDot':
    case 'sysDashDot':
      return '4,2,2,2';
    case 'lgDashDot':
      return '8,4,2,4';
    case 'lgDashDotDot':
    case 'sysDashDotDot':
      return '8,4,2,4,2,4';
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * Render text body content inside shape
 */
function renderTextBody(
  shape: ShapeType,
  _width: number,
  _height: number,
  renderParagraph?: (paragraph: Paragraph, index: number) => ReactNode
): ReactNode {
  if (!shape.textBody) return null;

  const textStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  };

  // Apply text margins
  if (shape.textBody.margins) {
    textStyle.padding = `${emuToPixels(shape.textBody.margins.top) || 0}px ${emuToPixels(shape.textBody.margins.right) || 0}px ${emuToPixels(shape.textBody.margins.bottom) || 0}px ${emuToPixels(shape.textBody.margins.left) || 0}px`;
  }

  // Apply anchor/vertical alignment
  switch (shape.textBody.anchor) {
    case 'middle':
      textStyle.justifyContent = 'center';
      break;
    case 'bottom':
      textStyle.justifyContent = 'flex-end';
      break;
    case 'top':
    default:
      textStyle.justifyContent = 'flex-start';
      break;
  }

  return (
    <div className="docx-shape-text" style={textStyle}>
      {shape.textBody.content.map((paragraph, index) => {
        if (renderParagraph) {
          return renderParagraph(paragraph, index);
        }
        // Default placeholder if no render function provided
        return (
          <div key={index} className="docx-shape-text-paragraph">
            [Text]
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if shape has any visual content
 *
 * @param shape - The shape to check
 * @returns true if shape has fill, outline, or text
 */
export function hasVisualContent(shape: ShapeType): boolean {
  return hasFill(shape) || hasOutline(shape) || hasTextContent(shape);
}

/**
 * Get shape description for accessibility
 *
 * @param shape - The shape to describe
 * @returns Accessible description
 */
export function getShapeDescription(shape: ShapeType): string {
  const typeName = shape.shapeType.replace(/([A-Z])/g, ' $1').trim();
  if (shape.name) {
    return `${typeName}: ${shape.name}`;
  }
  return typeName;
}

/**
 * Check if shape is a basic rectangle
 *
 * @param shape - The shape to check
 * @returns true if shape is rect or roundRect
 */
export function isRectangleShape(shape: ShapeType): boolean {
  return shape.shapeType === 'rect' || shape.shapeType === 'roundRect';
}

/**
 * Check if shape is an ellipse/circle
 *
 * @param shape - The shape to check
 * @returns true if shape is ellipse
 */
export function isEllipseShape(shape: ShapeType): boolean {
  return shape.shapeType === 'ellipse';
}

/**
 * Check if shape is a polygon (triangle, star, etc.)
 *
 * @param shape - The shape to check
 * @returns true if shape uses polygon rendering
 */
export function isPolygonShape(shape: ShapeType): boolean {
  return (
    shape.shapeType === 'triangle' ||
    shape.shapeType.startsWith('star') ||
    shape.shapeType.includes('Arrow') ||
    shape.shapeType === 'pentagon' ||
    shape.shapeType === 'hexagon'
  );
}

// Re-export utility functions from parser
export {
  isLineShape,
  isTextBoxShape,
  hasTextContent,
  getShapeWidthPx,
  getShapeHeightPx,
  getShapeDimensionsPx,
  isFloatingShape,
  hasFill,
  hasOutline,
  getOutlineWidthPx,
  resolveFillColor,
  resolveOutlineColor,
};

export default Shape;
