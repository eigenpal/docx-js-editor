/**
 * TypeScript Types for Test Scenarios
 *
 * Defines the structure of JSON-driven test scenarios for the DOCX editor.
 */

/**
 * Base action types
 */
export type ActionType =
  | 'goto'
  | 'waitForReady'
  | 'loadDocxFile'
  | 'typeText'
  | 'typeTextSlowly'
  | 'pressKey'
  | 'pressEnter'
  | 'pressShiftEnter'
  | 'pressBackspace'
  | 'pressDelete'
  | 'pressTab'
  | 'pressShiftTab'
  | 'selectAll'
  | 'selectText'
  | 'selectRange'
  | 'selectParagraph'
  | 'clearSelection'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'applyBold'
  | 'applyBoldShortcut'
  | 'applyItalic'
  | 'applyItalicShortcut'
  | 'applyUnderline'
  | 'applyUnderlineShortcut'
  | 'applyStrikethrough'
  | 'clearFormatting'
  | 'setFontFamily'
  | 'setFontSize'
  | 'setTextColor'
  | 'setHighlightColor'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'toggleBulletList'
  | 'toggleNumberedList'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'undoShortcut'
  | 'redo'
  | 'redoShortcut'
  | 'insertTable'
  | 'clickTableCell'
  | 'openFind'
  | 'openFindReplace'
  | 'find'
  | 'findNext'
  | 'findPrevious'
  | 'replace'
  | 'replaceAll'
  | 'closeFindReplace'
  | 'setZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'focus'
  | 'blur'
  | 'focusParagraph'
  | 'wait'
  | 'screenshot';

/**
 * Base assertion types
 */
export type AssertionType =
  | 'expectReady'
  | 'expectParagraphCount'
  | 'expectParagraphText'
  | 'expectParagraphContains'
  | 'expectDocumentContains'
  | 'expectDocumentNotContains'
  | 'expectTextBold'
  | 'expectTextNotBold'
  | 'expectTextItalic'
  | 'expectTextUnderlined'
  | 'expectTextStrikethrough'
  | 'expectTextFontFamily'
  | 'expectTextFontSize'
  | 'expectTextColor'
  | 'expectParagraphAlignment'
  | 'expectParagraphIsList'
  | 'expectToolbarButtonActive'
  | 'expectToolbarButtonInactive'
  | 'expectToolbarButtonEnabled'
  | 'expectToolbarButtonDisabled'
  | 'expectUndoAvailable'
  | 'expectRedoAvailable'
  | 'expectUndoNotAvailable'
  | 'expectRedoNotAvailable'
  | 'expectTableCount'
  | 'expectTableDimensions'
  | 'expectTableCellText'
  | 'expectSelectedText'
  | 'expectNoSelection'
  | 'expectVisualMatch';

/**
 * Action step definition
 */
export interface ActionStep {
  /** The action to perform */
  action: ActionType;
  /** Action arguments (varies by action type) */
  args?: Record<string, unknown>;
  /** Optional description for debugging */
  description?: string;
}

/**
 * Assertion step definition
 */
export interface AssertionStep {
  /** The assertion to perform */
  assert: AssertionType;
  /** Assertion arguments (varies by assertion type) */
  args?: Record<string, unknown>;
  /** Optional description for debugging */
  description?: string;
}

/**
 * A single test step (either action or assertion)
 */
export type TestStep = ActionStep | AssertionStep;

/**
 * Determines if a step is an action
 */
export function isActionStep(step: TestStep): step is ActionStep {
  return 'action' in step;
}

/**
 * Determines if a step is an assertion
 */
export function isAssertionStep(step: TestStep): step is AssertionStep {
  return 'assert' in step;
}

/**
 * Test scenario definition
 */
export interface TestScenario {
  /** Unique scenario name */
  name: string;
  /** Optional description */
  description?: string;
  /** Category for grouping tests */
  category?: string;
  /** Tags for filtering */
  tags?: string[];
  /** Whether this scenario should be skipped */
  skip?: boolean;
  /** Whether to run this scenario only (focus) */
  only?: boolean;
  /** Steps to execute in order */
  steps: TestStep[];
  /** Setup steps to run before main steps */
  setup?: TestStep[];
  /** Cleanup steps to run after main steps */
  cleanup?: TestStep[];
  /** Expected outcome description */
  expectedOutcome?: string;
  /** Bug ID if this is a regression test */
  bugId?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry count for flaky tests */
  retries?: number;
}

/**
 * Scenario file structure (contains multiple scenarios)
 */
export interface ScenarioFile {
  /** File-level description */
  description?: string;
  /** Default category for all scenarios in file */
  defaultCategory?: string;
  /** Default tags for all scenarios */
  defaultTags?: string[];
  /** Default setup for all scenarios */
  defaultSetup?: TestStep[];
  /** Default cleanup for all scenarios */
  defaultCleanup?: TestStep[];
  /** The scenarios */
  scenarios: TestScenario[];
}

/**
 * Typed action args for specific actions
 */
export interface TypeTextArgs {
  text: string;
}

export interface TypeTextSlowlyArgs {
  text: string;
  delay?: number;
}

export interface PressKeyArgs {
  key: string;
}

export interface SelectTextArgs {
  text: string;
}

export interface SelectRangeArgs {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
}

export interface SelectParagraphArgs {
  index: number;
}

export interface FocusParagraphArgs {
  index: number;
}

export interface SetFontFamilyArgs {
  fontFamily: string;
}

export interface SetFontSizeArgs {
  size: number;
}

export interface SetColorArgs {
  color: string;
}

export interface InsertTableArgs {
  rows: number;
  cols: number;
}

export interface ClickTableCellArgs {
  tableIndex: number;
  row: number;
  col: number;
}

export interface FindArgs {
  searchText: string;
}

export interface ReplaceArgs {
  replaceText: string;
}

export interface ReplaceAllArgs {
  searchText: string;
  replaceText: string;
}

export interface SetZoomArgs {
  level: number;
}

export interface WaitArgs {
  milliseconds: number;
}

export interface ScreenshotArgs {
  name: string;
  fullPage?: boolean;
}

export interface LoadDocxFileArgs {
  filePath: string;
}

/**
 * Typed assertion args for specific assertions
 */
export interface ExpectParagraphCountArgs {
  count: number;
}

export interface ExpectParagraphTextArgs {
  index: number;
  text: string;
}

export interface ExpectTextFormattingArgs {
  text: string;
}

export interface ExpectTextFontArgs {
  text: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
}

export interface ExpectParagraphAlignmentArgs {
  index: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

export interface ExpectParagraphIsListArgs {
  index: number;
  listType: 'bullet' | 'numbered';
}

export interface ExpectToolbarButtonArgs {
  buttonName: string;
}

export interface ExpectTableCountArgs {
  count: number;
}

export interface ExpectTableDimensionsArgs {
  tableIndex: number;
  rows: number;
  cols: number;
}

export interface ExpectTableCellTextArgs {
  tableIndex: number;
  row: number;
  col: number;
  text: string;
}

export interface ExpectSelectedTextArgs {
  text: string;
}

export interface ExpectVisualMatchArgs {
  screenshotName: string;
  maxDiffPixels?: number;
  threshold?: number;
}

/**
 * Execution result for a single step
 */
export interface StepResult {
  /** The step that was executed */
  step: TestStep;
  /** Whether the step passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  duration: number;
  /** Screenshot path if captured */
  screenshotPath?: string;
}

/**
 * Execution result for a scenario
 */
export interface ScenarioResult {
  /** The scenario that was executed */
  scenario: TestScenario;
  /** Whether the scenario passed */
  passed: boolean;
  /** Results for each step */
  stepResults: StepResult[];
  /** Total execution time */
  totalDuration: number;
  /** Error message if failed */
  error?: string;
  /** Screenshot on failure */
  failureScreenshot?: string;
}

/**
 * Filter options for running scenarios
 */
export interface ScenarioFilter {
  /** Include only scenarios with these categories */
  categories?: string[];
  /** Include only scenarios with these tags */
  tags?: string[];
  /** Exclude scenarios with these tags */
  excludeTags?: string[];
  /** Include only scenarios matching these names (regex) */
  namePattern?: string;
  /** Skip scenarios marked as skip */
  respectSkip?: boolean;
  /** Run only scenarios marked as only */
  respectOnly?: boolean;
}

/**
 * Default values for scenarios
 */
export const DEFAULT_SCENARIO_TIMEOUT = 30000;
export const DEFAULT_STEP_TIMEOUT = 10000;
export const DEFAULT_RETRIES = 0;
