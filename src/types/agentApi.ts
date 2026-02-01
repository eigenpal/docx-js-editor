/**
 * Agent API Types
 *
 * TypeScript interfaces for the agent API:
 * - Position and Range types
 * - Command types for document manipulation
 * - Context types for AI agents
 */

import type { TextFormatting, ParagraphFormatting, Table, Image, Hyperlink } from './document';

// ============================================================================
// POSITION & RANGE
// ============================================================================

/**
 * Position within a document
 */
export interface Position {
  /** Index of the paragraph (0-indexed) */
  paragraphIndex: number;
  /** Offset within the paragraph in characters */
  offset: number;
  /** Optional: Content index within paragraph (run, hyperlink, etc.) */
  contentIndex?: number;
  /** Optional: Section index */
  sectionIndex?: number;
}

/**
 * Range within a document
 */
export interface Range {
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Whether the range is collapsed (cursor position) */
  collapsed?: boolean;
}

/**
 * Create a collapsed range (cursor) at a position
 */
export function createCollapsedRange(position: Position): Range {
  return {
    start: position,
    end: position,
    collapsed: true,
  };
}

/**
 * Create a range from two positions
 */
export function createRange(start: Position, end: Position): Range {
  return {
    start,
    end,
    collapsed:
      start.paragraphIndex === end.paragraphIndex && start.offset === end.offset,
  };
}

/**
 * Check if a position is within a range
 */
export function isPositionInRange(position: Position, range: Range): boolean {
  // Before range start
  if (
    position.paragraphIndex < range.start.paragraphIndex ||
    (position.paragraphIndex === range.start.paragraphIndex &&
      position.offset < range.start.offset)
  ) {
    return false;
  }

  // After range end
  if (
    position.paragraphIndex > range.end.paragraphIndex ||
    (position.paragraphIndex === range.end.paragraphIndex &&
      position.offset > range.end.offset)
  ) {
    return false;
  }

  return true;
}

/**
 * Compare two positions
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function comparePositions(a: Position, b: Position): -1 | 0 | 1 {
  if (a.paragraphIndex < b.paragraphIndex) return -1;
  if (a.paragraphIndex > b.paragraphIndex) return 1;
  if (a.offset < b.offset) return -1;
  if (a.offset > b.offset) return 1;
  return 0;
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Base command interface
 */
export interface BaseCommand {
  /** Command type */
  type: string;
  /** Unique command ID (for undo tracking) */
  id?: string;
}

/**
 * Insert text at a position
 */
export interface InsertTextCommand extends BaseCommand {
  type: 'insertText';
  /** Position to insert at */
  position: Position;
  /** Text to insert */
  text: string;
  /** Optional formatting for the inserted text */
  formatting?: TextFormatting;
}

/**
 * Replace text in a range
 */
export interface ReplaceTextCommand extends BaseCommand {
  type: 'replaceText';
  /** Range to replace */
  range: Range;
  /** Replacement text */
  text: string;
  /** Optional formatting for the new text */
  formatting?: TextFormatting;
}

/**
 * Delete text in a range
 */
export interface DeleteTextCommand extends BaseCommand {
  type: 'deleteText';
  /** Range to delete */
  range: Range;
}

/**
 * Apply formatting to a range
 */
export interface FormatTextCommand extends BaseCommand {
  type: 'formatText';
  /** Range to format */
  range: Range;
  /** Formatting to apply */
  formatting: Partial<TextFormatting>;
}

/**
 * Apply paragraph formatting
 */
export interface FormatParagraphCommand extends BaseCommand {
  type: 'formatParagraph';
  /** Paragraph index */
  paragraphIndex: number;
  /** Formatting to apply */
  formatting: Partial<ParagraphFormatting>;
}

/**
 * Apply a named style to a paragraph
 */
export interface ApplyStyleCommand extends BaseCommand {
  type: 'applyStyle';
  /** Paragraph index */
  paragraphIndex: number;
  /** Style ID to apply */
  styleId: string;
}

/**
 * Insert a table at a position
 */
export interface InsertTableCommand extends BaseCommand {
  type: 'insertTable';
  /** Position to insert at */
  position: Position;
  /** Number of rows */
  rows: number;
  /** Number of columns */
  columns: number;
  /** Optional table data */
  data?: string[][];
  /** Optional header row */
  hasHeader?: boolean;
}

/**
 * Insert an image at a position
 */
export interface InsertImageCommand extends BaseCommand {
  type: 'insertImage';
  /** Position to insert at */
  position: Position;
  /** Image source (base64 or URL) */
  src: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Alt text */
  alt?: string;
}

/**
 * Insert a hyperlink at a range
 */
export interface InsertHyperlinkCommand extends BaseCommand {
  type: 'insertHyperlink';
  /** Range to make into a hyperlink */
  range: Range;
  /** URL of the hyperlink */
  url: string;
  /** Display text (replaces range text if provided) */
  displayText?: string;
  /** Tooltip */
  tooltip?: string;
}

/**
 * Remove a hyperlink but keep the text
 */
export interface RemoveHyperlinkCommand extends BaseCommand {
  type: 'removeHyperlink';
  /** Range containing the hyperlink */
  range: Range;
}

/**
 * Insert a paragraph break
 */
export interface InsertParagraphBreakCommand extends BaseCommand {
  type: 'insertParagraphBreak';
  /** Position to break at */
  position: Position;
}

/**
 * Merge paragraphs
 */
export interface MergeParagraphsCommand extends BaseCommand {
  type: 'mergeParagraphs';
  /** First paragraph index */
  paragraphIndex: number;
  /** Number of paragraphs to merge with */
  count: number;
}

/**
 * Split a paragraph
 */
export interface SplitParagraphCommand extends BaseCommand {
  type: 'splitParagraph';
  /** Position to split at */
  position: Position;
}

/**
 * Set template variable value
 */
export interface SetVariableCommand extends BaseCommand {
  type: 'setVariable';
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
}

/**
 * Apply all template variables
 */
export interface ApplyVariablesCommand extends BaseCommand {
  type: 'applyVariables';
  /** Variable values */
  values: Record<string, string>;
}

/**
 * Union of all command types
 */
export type AgentCommand =
  | InsertTextCommand
  | ReplaceTextCommand
  | DeleteTextCommand
  | FormatTextCommand
  | FormatParagraphCommand
  | ApplyStyleCommand
  | InsertTableCommand
  | InsertImageCommand
  | InsertHyperlinkCommand
  | RemoveHyperlinkCommand
  | InsertParagraphBreakCommand
  | MergeParagraphsCommand
  | SplitParagraphCommand
  | SetVariableCommand
  | ApplyVariablesCommand;

/**
 * Get command type
 */
export type CommandType = AgentCommand['type'];

// ============================================================================
// CONTEXT
// ============================================================================

/**
 * Document context for AI agents
 */
export interface AgentContext {
  /** Total paragraph count */
  paragraphCount: number;
  /** Total word count (approximate) */
  wordCount: number;
  /** Total character count */
  characterCount: number;
  /** Detected template variables */
  variables: string[];
  /** Variable count */
  variableCount: number;
  /** Available styles */
  availableStyles: StyleInfo[];
  /** Content outline (first N chars per paragraph) */
  outline: ParagraphOutline[];
  /** Document sections info */
  sections: SectionInfo[];
  /** Has tables */
  hasTables: boolean;
  /** Has images */
  hasImages: boolean;
  /** Has hyperlinks */
  hasHyperlinks: boolean;
  /** Document language */
  language?: string;
}

/**
 * Style information for context
 */
export interface StyleInfo {
  /** Style ID */
  id: string;
  /** Display name */
  name: string;
  /** Style type */
  type: 'paragraph' | 'character' | 'table';
  /** Is built-in style */
  builtIn?: boolean;
}

/**
 * Paragraph outline for context
 */
export interface ParagraphOutline {
  /** Paragraph index */
  index: number;
  /** First N characters */
  preview: string;
  /** Paragraph style */
  style?: string;
  /** Is heading */
  isHeading?: boolean;
  /** Heading level (1-9) */
  headingLevel?: number;
  /** Is list item */
  isListItem?: boolean;
  /** Is empty paragraph */
  isEmpty?: boolean;
}

/**
 * Section information
 */
export interface SectionInfo {
  /** Section index */
  index: number;
  /** Number of paragraphs */
  paragraphCount: number;
  /** Page size */
  pageSize?: { width: number; height: number };
  /** Is landscape */
  isLandscape?: boolean;
  /** Has header */
  hasHeader?: boolean;
  /** Has footer */
  hasFooter?: boolean;
}

// ============================================================================
// SELECTION CONTEXT
// ============================================================================

/**
 * Context about the current selection
 */
export interface SelectionContext {
  /** Selected text */
  selectedText: string;
  /** Selection range */
  range: Range;
  /** Current formatting of selection */
  formatting: Partial<TextFormatting>;
  /** Current paragraph formatting */
  paragraphFormatting: Partial<ParagraphFormatting>;
  /** Text before selection (context) */
  textBefore: string;
  /** Text after selection (context) */
  textAfter: string;
  /** Paragraph containing selection */
  paragraph: ParagraphContext;
  /** Is selection within a table */
  inTable?: boolean;
  /** Is selection within a hyperlink */
  inHyperlink?: boolean;
  /** Suggested actions based on selection */
  suggestedActions?: SuggestedAction[];
}

/**
 * Paragraph context for selection
 */
export interface ParagraphContext {
  /** Paragraph index */
  index: number;
  /** Full paragraph text */
  fullText: string;
  /** Paragraph style */
  style?: string;
  /** Word count */
  wordCount: number;
}

/**
 * Suggested action for context menu
 */
export interface SuggestedAction {
  /** Action ID */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Icon name */
  icon?: string;
  /** Priority (higher = more prominent) */
  priority?: number;
}

// ============================================================================
// RESPONSE
// ============================================================================

/**
 * Response from an agent action
 */
export interface AgentResponse {
  /** Success status */
  success: boolean;
  /** New text to insert (for rewrite/expand/etc.) */
  newText?: string;
  /** New formatted content */
  newContent?: AgentContent[];
  /** Commands to execute */
  commands?: AgentCommand[];
  /** Error message if failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
  /** Metadata about the response */
  metadata?: Record<string, unknown>;
}

/**
 * Content block in agent response
 */
export interface AgentContent {
  /** Content type */
  type: 'text' | 'paragraph' | 'table' | 'image';
  /** Text content */
  text?: string;
  /** Formatting */
  formatting?: Partial<TextFormatting>;
  /** Paragraph formatting */
  paragraphFormatting?: Partial<ParagraphFormatting>;
  /** Table data (for table type) */
  tableData?: string[][];
  /** Image src (for image type) */
  imageSrc?: string;
}

// ============================================================================
// AI ACTIONS
// ============================================================================

/**
 * AI action types for context menu
 */
export type AIAction =
  | 'askAI'
  | 'rewrite'
  | 'expand'
  | 'summarize'
  | 'translate'
  | 'explain'
  | 'fixGrammar'
  | 'makeFormal'
  | 'makeCasual'
  | 'custom';

/**
 * AI action request
 */
export interface AIActionRequest {
  /** Action type */
  action: AIAction;
  /** Selection context */
  context: SelectionContext;
  /** Custom prompt (for 'custom' action) */
  customPrompt?: string;
  /** Target language (for 'translate' action) */
  targetLanguage?: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Get action label
 */
export function getActionLabel(action: AIAction): string {
  const labels: Record<AIAction, string> = {
    askAI: 'Ask AI',
    rewrite: 'Rewrite',
    expand: 'Expand',
    summarize: 'Summarize',
    translate: 'Translate',
    explain: 'Explain',
    fixGrammar: 'Fix Grammar',
    makeFormal: 'Make Formal',
    makeCasual: 'Make Casual',
    custom: 'Custom Prompt',
  };
  return labels[action];
}

/**
 * Get action description
 */
export function getActionDescription(action: AIAction): string {
  const descriptions: Record<AIAction, string> = {
    askAI: 'Ask AI a question about this text',
    rewrite: 'Rewrite this text in a different way',
    expand: 'Expand this text with more details',
    summarize: 'Summarize this text to be shorter',
    translate: 'Translate this text to another language',
    explain: 'Explain what this text means',
    fixGrammar: 'Fix grammar and spelling errors',
    makeFormal: 'Make the tone more formal',
    makeCasual: 'Make the tone more casual',
    custom: 'Enter a custom prompt',
  };
  return descriptions[action];
}

/**
 * Default AI actions for context menu
 */
export const DEFAULT_AI_ACTIONS: AIAction[] = [
  'askAI',
  'rewrite',
  'expand',
  'summarize',
  'translate',
  'explain',
];

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Command handler function type
 */
export type CommandHandler<T extends AgentCommand = AgentCommand> = (
  command: T
) => Promise<boolean>;

/**
 * AI request handler function type
 */
export type AIRequestHandler = (
  request: AIActionRequest
) => Promise<AgentResponse>;

/**
 * Create a command with generated ID
 */
export function createCommand<T extends AgentCommand>(
  command: Omit<T, 'id'>
): T {
  return {
    ...command,
    id: generateCommandId(),
  } as T;
}

/**
 * Generate a unique command ID
 */
function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  createCollapsedRange,
  createRange,
  isPositionInRange,
  comparePositions,
  getActionLabel,
  getActionDescription,
  createCommand,
  DEFAULT_AI_ACTIONS,
};
