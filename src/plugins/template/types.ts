/**
 * Template Plugin Types
 *
 * Types for docxtemplater syntax detection, schema inference,
 * and annotation rendering.
 */

/**
 * Types of template elements supported.
 */
export type TemplateElementType =
  | 'variable' // {name}
  | 'nestedVariable' // {user.firstName}
  | 'loopStart' // {#items}
  | 'loopEnd' // {/items}
  | 'conditionalStart' // {#isActive}
  | 'conditionalEnd' // {/isActive}
  | 'invertedStart' // {^isActive}
  | 'invertedEnd' // {/isActive}
  | 'rawVariable' // {@html}
  | 'invalid'; // Unclosed or malformed

/**
 * Represents a single template element in the document.
 */
export interface TemplateElement {
  /** Unique identifier */
  id: string;

  /** Type of template element */
  type: TemplateElementType;

  /** The raw tag text including delimiters (e.g., "{#items}") */
  rawTag: string;

  /** The name portion of the tag (e.g., "items") */
  name: string;

  /** Path segments for nested properties (e.g., ["user", "firstName"]) */
  path: string[];

  /** Start position in ProseMirror document */
  from: number;

  /** End position in ProseMirror document */
  to: number;

  /** ID of the matching element (for loop/conditional matching) */
  pairedElementId?: string;

  /** ID of the scope this element belongs to */
  scopeId?: string;

  /** Nesting depth (0 = root level) */
  scopeDepth: number;

  /** Whether the element is valid */
  isValid: boolean;

  /** Validation error message if invalid */
  validationError?: string;

  /** Line number in the document (for annotation positioning) */
  lineNumber?: number;
}

/**
 * Represents a scope (region between {#tag} and {/tag}).
 */
export interface TemplateScope {
  /** Unique identifier */
  id: string;

  /** Type of scope */
  type: 'loop' | 'conditional' | 'inverted';

  /** Name of the scope (e.g., "items" for {#items}) */
  name: string;

  /** The opening element */
  startElement: TemplateElement;

  /** The closing element (undefined if unclosed) */
  endElement?: TemplateElement;

  /** Start position after the opening tag */
  contentFrom: number;

  /** End position before the closing tag */
  contentTo: number;

  /** Parent scope ID (for nesting) */
  parentScopeId?: string;

  /** Child scopes contained within */
  childScopes: TemplateScope[];

  /** Variables declared/used within this scope */
  variables: TemplateElement[];

  /** Line number where the scope starts */
  lineStart: number;

  /** Line number where the scope ends */
  lineEnd: number;
}

/**
 * The complete template schema extracted from a document.
 */
export interface TemplateSchema {
  /** All template elements found */
  elements: TemplateElement[];

  /** All scopes (flat list) */
  scopes: TemplateScope[];

  /** The root scope containing top-level elements */
  rootScope: TemplateScope;

  /** Inferred data structure */
  dataStructure: InferredDataType;

  /** Validation errors found */
  errors: ValidationError[];
}

/**
 * Inferred TypeScript-like type for template data.
 */
export interface InferredDataType {
  /** The data type */
  type: 'object' | 'array' | 'string' | 'boolean' | 'number' | 'unknown';

  /** Properties for object types */
  properties?: Record<string, InferredDataType>;

  /** Item type for array types */
  items?: InferredDataType;

  /** Whether the property is optional (for conditionals) */
  optional?: boolean;

  /** Description or documentation */
  description?: string;
}

/**
 * Validation error for template elements.
 */
export interface ValidationError {
  /** Error message */
  message: string;

  /** Severity level */
  severity: 'error' | 'warning';

  /** Related element ID */
  elementId?: string;

  /** Position in document */
  from: number;

  /** End position */
  to: number;
}

/**
 * State managed by the template plugin.
 */
export interface TemplatePluginState {
  /** The current template schema */
  schema: TemplateSchema | null;

  /** Whether parsing is in progress */
  isParsing: boolean;

  /** Last parse error */
  parseError?: string;

  /** Currently hovered element ID (for highlighting) */
  hoveredElementId?: string;

  /** Currently selected element ID */
  selectedElementId?: string;

  /** Whether to show validation errors */
  showErrors: boolean;

  /** Whether annotations are expanded */
  annotationsExpanded: boolean;
}

/**
 * Colors for different element types.
 */
export const ELEMENT_COLORS: Record<TemplateElementType, string> = {
  variable: '#ffd700', // Yellow
  nestedVariable: '#ffd700', // Yellow
  loopStart: '#4a90d9', // Blue
  loopEnd: '#4a90d9', // Blue
  conditionalStart: '#28a745', // Green
  conditionalEnd: '#28a745', // Green
  invertedStart: '#9f7aea', // Purple
  invertedEnd: '#9f7aea', // Purple
  rawVariable: '#ff6b6b', // Red-ish
  invalid: '#dc3545', // Red
};

/**
 * Icons for different element types.
 */
export const ELEMENT_ICONS: Record<TemplateElementType, string> = {
  variable: '●',
  nestedVariable: '●',
  loopStart: '⟳',
  loopEnd: '⟳',
  conditionalStart: '?',
  conditionalEnd: '?',
  invertedStart: '!',
  invertedEnd: '!',
  rawVariable: '@',
  invalid: '⚠',
};

/**
 * CSS class prefix for template elements.
 */
export const TEMPLATE_CLASS_PREFIX = 'docx-template';
