/**
 * Template Parser
 *
 * Parses docxtemplater syntax from a ProseMirror document.
 * Supports:
 * - Variables: {name}, {user.email}
 * - Loops: {#items}...{/items}
 * - Conditionals: {#isActive}...{/isActive}
 * - Inverted conditionals: {^isActive}...{/isActive}
 * - Raw HTML: {@html}
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { TemplateElement, TemplateElementType } from './types';

/**
 * Regular expression to match docxtemplater tags.
 * Matches: {name}, {#name}, {/name}, {^name}, {@name}, {user.property}
 */
const TAG_REGEX = /\{([#/^@]?)([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}/g;

/**
 * Generate a unique ID for elements.
 */
let idCounter = 0;
function generateId(): string {
  return `tpl-${++idCounter}`;
}

/**
 * Reset ID counter (for testing).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Determine the element type from the tag prefix.
 */
function getElementType(prefix: string, name: string, isClosing: boolean): TemplateElementType {
  if (prefix === '#') {
    return isClosing ? 'conditionalEnd' : 'loopStart';
  }
  if (prefix === '/') {
    // This is a closing tag - type depends on what it's closing
    return 'loopEnd'; // Will be refined during scope matching
  }
  if (prefix === '^') {
    return isClosing ? 'invertedEnd' : 'invertedStart';
  }
  if (prefix === '@') {
    return 'rawVariable';
  }

  // Simple variable - check if nested
  if (name.includes('.')) {
    return 'nestedVariable';
  }
  return 'variable';
}

/**
 * Parse path segments from a variable name.
 */
function parsePath(name: string): string[] {
  return name.split('.');
}

/**
 * Parse template elements from a text string.
 */
export function parseText(
  text: string,
  basePosition: number,
  scopeDepth: number = 0
): TemplateElement[] {
  const elements: TemplateElement[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    const [rawTag, prefix, name] = match;
    const from = basePosition + match.index;
    const to = from + rawTag.length;

    const isClosingTag = prefix === '/';
    const type = getElementType(prefix, name, isClosingTag);
    const path = parsePath(name);

    const element: TemplateElement = {
      id: generateId(),
      type,
      rawTag,
      name,
      path,
      from,
      to,
      scopeDepth,
      isValid: true, // Will be validated later
    };

    elements.push(element);
  }

  return elements;
}

/**
 * Parse all template elements from a ProseMirror document.
 */
export function parseDocument(doc: ProseMirrorNode): TemplateElement[] {
  const elements: TemplateElement[] = [];

  // Walk the document tree
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const nodeElements = parseText(node.text, pos, 0);
      elements.push(...nodeElements);
    }
    return true; // Continue traversing
  });

  // Sort by position
  elements.sort((a, b) => a.from - b.from);

  return elements;
}

/**
 * Get line number for a position in the document.
 */
export function getLineNumber(doc: ProseMirrorNode, pos: number): number {
  let lineNumber = 1;

  doc.descendants((node, nodePos) => {
    if (nodePos >= pos) {
      return false; // Stop traversing
    }

    if (node.type.name === 'paragraph' || node.type.name === 'hardBreak') {
      lineNumber++;
    }

    return true;
  });

  return lineNumber;
}

/**
 * Add line numbers to elements.
 */
export function addLineNumbers(
  elements: TemplateElement[],
  doc: ProseMirrorNode
): TemplateElement[] {
  return elements.map((element) => ({
    ...element,
    lineNumber: getLineNumber(doc, element.from),
  }));
}

/**
 * Check if a string contains any template tags.
 */
export function containsTemplateTags(text: string): boolean {
  TAG_REGEX.lastIndex = 0;
  return TAG_REGEX.test(text);
}

/**
 * Extract just the tag names from a text (without positions).
 */
export function extractTagNames(text: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;

  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    names.push(match[2]);
  }

  return names;
}

/**
 * Get the text content of a ProseMirror document.
 */
export function getDocumentText(doc: ProseMirrorNode): string {
  return doc.textContent;
}

/**
 * Find all elements at a specific position.
 */
export function findElementsAtPosition(
  elements: TemplateElement[],
  pos: number
): TemplateElement[] {
  return elements.filter((el) => pos >= el.from && pos <= el.to);
}

/**
 * Find an element by its ID.
 */
export function findElementById(
  elements: TemplateElement[],
  id: string
): TemplateElement | undefined {
  return elements.find((el) => el.id === id);
}

/**
 * Get elements by type.
 */
export function getElementsByType(
  elements: TemplateElement[],
  type: TemplateElementType
): TemplateElement[] {
  return elements.filter((el) => el.type === type);
}

/**
 * Get all unique variable names.
 */
export function getUniqueVariableNames(elements: TemplateElement[]): string[] {
  const names = new Set<string>();

  for (const el of elements) {
    if (el.type === 'variable' || el.type === 'nestedVariable' || el.type === 'rawVariable') {
      names.add(el.name);
    }
  }

  return Array.from(names).sort();
}
