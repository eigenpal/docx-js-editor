/**
 * Headless API Entry Point
 *
 * Provides document manipulation functionality without React/DOM dependencies.
 * Suitable for Node.js scripts, CLI tools, and server-side processing.
 *
 * @example
 * ```ts
 * import { DocumentAgent, parseDocx, pluginRegistry } from '@eigenpal/docx-editor/headless';
 * import { docxtemplaterPlugin } from '@eigenpal/docx-editor/core-plugins';
 *
 * // Register plugins
 * pluginRegistry.register(docxtemplaterPlugin);
 *
 * // Load and manipulate document
 * const buffer = fs.readFileSync('template.docx');
 * const agent = await DocumentAgent.fromBuffer(buffer);
 *
 * // Get document info
 * console.log('Word count:', agent.getWordCount());
 * console.log('Variables:', agent.getVariables());
 *
 * // Edit document
 * const newAgent = agent
 *   .insertText({ paragraphIndex: 0, offset: 0 }, 'Hello ')
 *   .applyStyle(0, 'Heading1');
 *
 * // Apply template variables
 * const finalAgent = await newAgent.applyVariables({
 *   customer_name: 'Jane Doe',
 *   date: '2024-02-15',
 * });
 *
 * // Export
 * const output = await finalAgent.toBuffer();
 * fs.writeFileSync('output.docx', Buffer.from(output));
 * ```
 */

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '0.1.0';

// ============================================================================
// DOCUMENT AGENT
// ============================================================================

export { DocumentAgent, createAgent, createAgentFromDocument } from './agent/DocumentAgent';
export type {
  InsertTextOptions,
  InsertTableOptions,
  InsertImageOptions,
  InsertHyperlinkOptions,
  FormattedTextSegment,
} from './agent/DocumentAgent';

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

export { executeCommand, executeCommands } from './agent/executor';

// ============================================================================
// CONTEXT BUILDERS
// ============================================================================

export {
  getAgentContext,
  getDocumentSummary,
  buildSelectionContext as buildSelectionContextFromContext,
  type AgentContextOptions,
  type SelectionContextOptions as ContextSelectionOptions,
} from './agent/context';

export {
  buildSelectionContext,
  buildExtendedSelectionContext,
  getSelectionFormattingSummary,
  type SelectionContextOptions,
  type ExtendedSelectionContext,
  type FormattingSummary,
} from './agent/selectionContext';

// ============================================================================
// TEXT UTILITIES
// ============================================================================

export {
  getParagraphText,
  getRunText,
  getHyperlinkText,
  getTableText,
  getBodyText,
  countWords,
  countCharacters,
  getBodyWordCount,
  getBodyCharacterCount,
  getTextBefore,
  getTextAfter,
  getFormattingAtPosition,
  isPositionInHyperlink,
  getHyperlinkAtPosition,
  isHeadingStyle,
  parseHeadingLevel,
  hasImages,
  hasHyperlinks,
  hasTables,
  getParagraphs,
  getParagraphAtIndex,
  getBlockIndexForParagraph,
} from './agent/text-utils';

// ============================================================================
// PARSER / SERIALIZER
// ============================================================================

export { parseDocx } from './docx/parser';
export {
  serializeDocument as serializeDocx,
  serializeDocumentBody,
  serializeSectionProperties,
} from './docx/serializer/documentSerializer';
export { repackDocx, createDocx } from './docx/rezip';

// ============================================================================
// TEMPLATE PROCESSING
// ============================================================================

export {
  processTemplate,
  processTemplateDetailed,
  processTemplateAsBlob,
  processTemplateAdvanced,
  getTemplateTags,
  validateTemplate,
  getMissingVariables,
  previewTemplate,
  createTemplateProcessor,
  type ProcessTemplateOptions,
  type ProcessTemplateResult,
  type TemplateError,
} from './utils/processTemplate';

// ============================================================================
// VARIABLE DETECTION
// ============================================================================

export {
  detectVariables,
  detectVariablesDetailed,
  detectVariablesInBody,
  detectVariablesInParagraph,
  extractVariablesFromText,
  hasTemplateVariables,
  isValidVariableName,
  sanitizeVariableName,
  formatVariable,
  parseVariable,
  replaceVariables,
  removeVariables,
  documentHasVariables,
  type VariableDetectionResult,
  type VariableOccurrence,
} from './utils/variableDetector';

// ============================================================================
// DOCUMENT CREATION
// ============================================================================

export {
  createEmptyDocument,
  createDocumentWithText,
  type CreateEmptyDocumentOptions,
} from './utils/createDocument';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  twipsToPixels,
  pixelsToTwips,
  formatPx,
  emuToPixels,
  pointsToPixels,
  halfPointsToPixels,
  pixelsToEmu,
  emuToTwips,
  twipsToEmu,
} from './utils/units';

export {
  resolveColor,
  resolveHighlightColor,
  resolveShadingColor,
  parseColorString,
  createThemeColor,
  createRgbColor,
  darkenColor,
  lightenColor,
  blendColors,
  getContrastingColor,
  isBlack,
  isWhite,
  colorsEqual,
} from './utils/colorResolver';

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

export {
  pluginRegistry,
  PluginRegistry,
  registerPlugins,
  createPluginRegistrar,
  isZodSchema,
  type CorePlugin,
  type Plugin,
  type PluginCommand,
  type CommandHandler,
  type PluginCommandHandler,
  type CommandResult,
  type PluginOptions,
  type PluginRegistrationResult,
  type McpToolDefinition,
  type ToolDefinition,
  type McpToolHandler,
  type ToolHandler,
  type McpToolResult,
  type ToolResult,
  type McpToolContent,
  type McpToolContext,
  type McpToolAnnotations,
  type McpSession,
  type LoadedDocument,
  type JsonSchema,
  type ZodSchemaLike,
  type PluginEvent,
  type PluginEventListener,
} from './core-plugins';

// ============================================================================
// TYPES
// ============================================================================

// Document types
export type {
  Document,
  DocxPackage,
  DocumentBody,
  BlockContent,
  Paragraph,
  Run,
  RunContent,
  TextContent,
  Table,
  TableRow,
  TableCell,
  Image,
  Hyperlink,
  Theme,
  Style,
  StyleDefinitions,
  TextFormatting,
  ParagraphFormatting,
  SectionProperties,
  Footnote,
  Endnote,
  ListLevel,
  NumberingDefinitions,
  Relationship,
} from './types/document';

// Agent API types
export type {
  AIAction,
  AIActionRequest,
  AgentResponse,
  AgentContext,
  SelectionContext,
  Range,
  Position,
  ParagraphContext,
  ParagraphOutline,
  SectionInfo,
  StyleInfo,
  SuggestedAction,
  AgentCommand,
  InsertTextCommand,
  ReplaceTextCommand,
  DeleteTextCommand,
  FormatTextCommand,
  FormatParagraphCommand,
  InsertTableCommand,
  InsertImageCommand,
  InsertHyperlinkCommand,
  SetVariableCommand,
  ApplyStyleCommand,
  ApplyVariablesCommand,
} from './types/agentApi';

// API functions
export {
  createCollapsedRange,
  createRange,
  isPositionInRange,
  comparePositions,
  getActionLabel,
  getActionDescription,
  createCommand,
  DEFAULT_AI_ACTIONS,
} from './types/agentApi';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export { DocumentAgent as default } from './agent/DocumentAgent';
