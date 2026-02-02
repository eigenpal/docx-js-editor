/**
 * Scenario Runner for JSON-Driven Tests
 *
 * Executes test scenarios defined in JSON files using the EditorPage Page Object Model.
 */

import { Page } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as assertions from '../helpers/assertions';
import * as textSelection from '../helpers/text-selection';
import {
  TestScenario,
  TestStep,
  ActionStep,
  AssertionStep,
  ScenarioResult,
  StepResult,
  ScenarioFilter,
  isActionStep,
  isAssertionStep,
  DEFAULT_STEP_TIMEOUT,
} from './scenario-types';

/**
 * Scenario Runner class
 */
export class ScenarioRunner {
  private page: Page;
  private editor: EditorPage;
  private stepTimeout: number;

  constructor(page: Page, stepTimeout: number = DEFAULT_STEP_TIMEOUT) {
    this.page = page;
    this.editor = new EditorPage(page);
    this.stepTimeout = stepTimeout;
  }

  /**
   * Run a single scenario
   */
  async runScenario(scenario: TestScenario): Promise<ScenarioResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let passed = true;
    let error: string | undefined;

    try {
      // Run setup steps
      if (scenario.setup) {
        for (const step of scenario.setup) {
          const result = await this.runStep(step);
          stepResults.push(result);
          if (!result.passed) {
            passed = false;
            error = `Setup failed: ${result.error}`;
            break;
          }
        }
      }

      // Run main steps if setup passed
      if (passed) {
        for (const step of scenario.steps) {
          const result = await this.runStep(step);
          stepResults.push(result);
          if (!result.passed) {
            passed = false;
            error = result.error;
            break;
          }
        }
      }

      // Run cleanup steps regardless of pass/fail
      if (scenario.cleanup) {
        for (const step of scenario.cleanup) {
          try {
            await this.runStep(step);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch (e) {
      passed = false;
      error = e instanceof Error ? e.message : String(e);
    }

    const totalDuration = Date.now() - startTime;

    return {
      scenario,
      passed,
      stepResults,
      totalDuration,
      error,
    };
  }

  /**
   * Run a single step
   */
  async runStep(step: TestStep): Promise<StepResult> {
    const startTime = Date.now();
    let passed = true;
    let error: string | undefined;

    try {
      if (isActionStep(step)) {
        await this.executeAction(step);
      } else if (isAssertionStep(step)) {
        await this.executeAssertion(step);
      }
    } catch (e) {
      passed = false;
      error = e instanceof Error ? e.message : String(e);
    }

    const duration = Date.now() - startTime;

    return {
      step,
      passed,
      error,
      duration,
    };
  }

  /**
   * Execute an action step
   */
  private async executeAction(step: ActionStep): Promise<void> {
    const { action, args = {} } = step;

    switch (action) {
      case 'goto':
        await this.editor.goto();
        break;

      case 'waitForReady':
        await this.editor.waitForReady();
        break;

      case 'loadDocxFile':
        await this.editor.loadDocxFile(args.filePath as string);
        break;

      case 'typeText':
        await this.editor.typeText(args.text as string);
        break;

      case 'typeTextSlowly':
        await this.editor.typeTextSlowly(args.text as string, args.delay as number);
        break;

      case 'pressKey':
        await this.page.keyboard.press(args.key as string);
        break;

      case 'pressEnter':
        await this.editor.pressEnter();
        break;

      case 'pressShiftEnter':
        await this.editor.pressShiftEnter();
        break;

      case 'pressBackspace':
        await this.editor.pressBackspace();
        break;

      case 'pressDelete':
        await this.editor.pressDelete();
        break;

      case 'pressTab':
        await this.editor.pressTab();
        break;

      case 'pressShiftTab':
        await this.editor.pressShiftTab();
        break;

      case 'selectAll':
        await this.editor.selectAll();
        break;

      case 'selectText':
        await this.editor.selectText(args.text as string);
        break;

      case 'selectRange':
        await this.editor.selectRange(
          args.paragraphIndex as number,
          args.startOffset as number,
          args.endOffset as number
        );
        break;

      case 'selectParagraph':
        await textSelection.selectParagraph(this.page, args.index as number);
        break;

      case 'clearSelection':
        await textSelection.clearSelection(this.page);
        break;

      case 'copy':
        await this.editor.copy();
        break;

      case 'cut':
        await this.editor.cut();
        break;

      case 'paste':
        await this.editor.paste();
        break;

      case 'applyBold':
        await this.editor.applyBold();
        break;

      case 'applyBoldShortcut':
        await this.editor.applyBoldShortcut();
        break;

      case 'applyItalic':
        await this.editor.applyItalic();
        break;

      case 'applyItalicShortcut':
        await this.editor.applyItalicShortcut();
        break;

      case 'applyUnderline':
        await this.editor.applyUnderline();
        break;

      case 'applyUnderlineShortcut':
        await this.editor.applyUnderlineShortcut();
        break;

      case 'applyStrikethrough':
        await this.editor.applyStrikethrough();
        break;

      case 'clearFormatting':
        await this.editor.clearFormatting();
        break;

      case 'setFontFamily':
        await this.editor.setFontFamily(args.fontFamily as string);
        break;

      case 'setFontSize':
        await this.editor.setFontSize(args.size as number);
        break;

      case 'setTextColor':
        await this.editor.setTextColor(args.color as string);
        break;

      case 'setHighlightColor':
        await this.editor.setHighlightColor(args.color as string);
        break;

      case 'alignLeft':
        await this.editor.alignLeft();
        break;

      case 'alignCenter':
        await this.editor.alignCenter();
        break;

      case 'alignRight':
        await this.editor.alignRight();
        break;

      case 'alignJustify':
        await this.editor.alignJustify();
        break;

      case 'toggleBulletList':
        await this.editor.toggleBulletList();
        break;

      case 'toggleNumberedList':
        await this.editor.toggleNumberedList();
        break;

      case 'indent':
        await this.editor.indent();
        break;

      case 'outdent':
        await this.editor.outdent();
        break;

      case 'undo':
        await this.editor.undo();
        break;

      case 'undoShortcut':
        await this.editor.undoShortcut();
        break;

      case 'redo':
        await this.editor.redo();
        break;

      case 'redoShortcut':
        await this.editor.redoShortcut();
        break;

      case 'insertTable':
        await this.editor.insertTable(args.rows as number, args.cols as number);
        break;

      case 'clickTableCell':
        await this.editor.clickTableCell(
          args.tableIndex as number,
          args.row as number,
          args.col as number
        );
        break;

      case 'openFind':
        await this.editor.openFind();
        break;

      case 'openFindReplace':
        await this.editor.openFindReplace();
        break;

      case 'find':
        await this.editor.find(args.searchText as string);
        break;

      case 'findNext':
        await this.editor.findNext();
        break;

      case 'findPrevious':
        await this.editor.findPrevious();
        break;

      case 'replace':
        await this.editor.replace(args.replaceText as string);
        break;

      case 'replaceAll':
        await this.editor.replaceAll(args.searchText as string, args.replaceText as string);
        break;

      case 'closeFindReplace':
        await this.editor.closeFindReplace();
        break;

      case 'setZoom':
        await this.editor.setZoom(args.level as number);
        break;

      case 'zoomIn':
        await this.editor.zoomIn();
        break;

      case 'zoomOut':
        await this.editor.zoomOut();
        break;

      case 'focus':
        await this.editor.focus();
        break;

      case 'blur':
        await this.editor.blur();
        break;

      case 'focusParagraph':
        await this.editor.focusParagraph(args.index as number);
        break;

      case 'wait':
        await this.page.waitForTimeout(args.milliseconds as number);
        break;

      case 'screenshot':
        await this.editor.takeScreenshot(args.name as string);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Execute an assertion step
   */
  private async executeAssertion(step: AssertionStep): Promise<void> {
    const { assert, args = {} } = step;

    switch (assert) {
      case 'expectReady':
        await this.editor.expectReady();
        break;

      case 'expectParagraphCount':
        await assertions.assertParagraphCount(this.page, args.count as number);
        break;

      case 'expectParagraphText':
        await assertions.assertParagraphExactText(
          this.page,
          args.index as number,
          args.text as string
        );
        break;

      case 'expectParagraphContains':
        await assertions.assertParagraphContainsText(
          this.page,
          args.index as number,
          args.text as string
        );
        break;

      case 'expectDocumentContains':
        await assertions.assertDocumentContainsText(this.page, args.text as string);
        break;

      case 'expectDocumentNotContains':
        await assertions.assertDocumentNotContainsText(this.page, args.text as string);
        break;

      case 'expectTextBold':
        await assertions.assertTextIsBold(this.page, args.text as string);
        break;

      case 'expectTextNotBold':
        await assertions.assertTextIsNotBold(this.page, args.text as string);
        break;

      case 'expectTextItalic':
        await assertions.assertTextIsItalic(this.page, args.text as string);
        break;

      case 'expectTextUnderlined':
        await assertions.assertTextIsUnderlined(this.page, args.text as string);
        break;

      case 'expectTextStrikethrough':
        await assertions.assertTextHasStrikethrough(this.page, args.text as string);
        break;

      case 'expectTextFontFamily':
        await assertions.assertTextHasFontFamily(
          this.page,
          args.text as string,
          args.fontFamily as string
        );
        break;

      case 'expectTextFontSize':
        await assertions.assertTextHasFontSize(
          this.page,
          args.text as string,
          args.fontSize as string
        );
        break;

      case 'expectTextColor':
        await assertions.assertTextHasColor(this.page, args.text as string, args.color as string);
        break;

      case 'expectParagraphAlignment':
        await assertions.assertParagraphAlignment(
          this.page,
          args.index as number,
          args.alignment as 'left' | 'center' | 'right' | 'justify'
        );
        break;

      case 'expectParagraphIsList':
        await assertions.assertParagraphIsList(
          this.page,
          args.index as number,
          args.listType as 'bullet' | 'numbered'
        );
        break;

      case 'expectToolbarButtonActive':
        await assertions.assertToolbarButtonActive(
          this.page,
          `toolbar-${args.buttonName as string}`
        );
        break;

      case 'expectToolbarButtonInactive':
        await assertions.assertToolbarButtonInactive(
          this.page,
          `toolbar-${args.buttonName as string}`
        );
        break;

      case 'expectToolbarButtonEnabled':
        await assertions.assertToolbarButtonEnabled(
          this.page,
          `toolbar-${args.buttonName as string}`
        );
        break;

      case 'expectToolbarButtonDisabled':
        await assertions.assertToolbarButtonDisabled(
          this.page,
          `toolbar-${args.buttonName as string}`
        );
        break;

      case 'expectUndoAvailable': {
        const canUndo = await this.editor.isUndoAvailable();
        if (!canUndo) throw new Error('Expected undo to be available');
        break;
      }

      case 'expectRedoAvailable': {
        const canRedo = await this.editor.isRedoAvailable();
        if (!canRedo) throw new Error('Expected redo to be available');
        break;
      }

      case 'expectUndoNotAvailable': {
        const canUndo = await this.editor.isUndoAvailable();
        if (canUndo) throw new Error('Expected undo to NOT be available');
        break;
      }

      case 'expectRedoNotAvailable': {
        const canRedo = await this.editor.isRedoAvailable();
        if (canRedo) throw new Error('Expected redo to NOT be available');
        break;
      }

      case 'expectTableCount': {
        const count = await this.editor.getTableCount();
        if (count !== (args.count as number)) {
          throw new Error(`Expected ${args.count} tables, found ${count}`);
        }
        break;
      }

      case 'expectTableDimensions':
        await assertions.assertTableDimensions(
          this.page,
          args.tableIndex as number,
          args.rows as number,
          args.cols as number
        );
        break;

      case 'expectTableCellText':
        await assertions.assertTableCellText(
          this.page,
          args.tableIndex as number,
          args.row as number,
          args.col as number,
          args.text as string
        );
        break;

      case 'expectSelectedText': {
        const selected = await this.editor.getSelectedText();
        if (selected !== (args.text as string)) {
          throw new Error(`Expected selected text "${args.text}", got "${selected}"`);
        }
        break;
      }

      case 'expectNoSelection': {
        const selected = await this.editor.getSelectedText();
        if (selected) {
          throw new Error(`Expected no selection, but found "${selected}"`);
        }
        break;
      }

      case 'expectVisualMatch':
        await assertions.assertVisualMatch(this.page, args.screenshotName as string, {
          maxDiffPixels: args.maxDiffPixels as number | undefined,
          threshold: args.threshold as number | undefined,
        });
        break;

      default:
        throw new Error(`Unknown assertion: ${assert}`);
    }
  }

  /**
   * Filter scenarios based on criteria
   */
  static filterScenarios(scenarios: TestScenario[], filter: ScenarioFilter): TestScenario[] {
    return scenarios.filter((scenario) => {
      // Check skip flag
      if (filter.respectSkip !== false && scenario.skip) {
        return false;
      }

      // Check only flag
      if (filter.respectOnly !== false) {
        const hasOnlyScenarios = scenarios.some((s) => s.only);
        if (hasOnlyScenarios && !scenario.only) {
          return false;
        }
      }

      // Check categories
      if (filter.categories && filter.categories.length > 0) {
        if (!scenario.category || !filter.categories.includes(scenario.category)) {
          return false;
        }
      }

      // Check tags
      if (filter.tags && filter.tags.length > 0) {
        if (!scenario.tags || !filter.tags.some((tag) => scenario.tags?.includes(tag))) {
          return false;
        }
      }

      // Check excluded tags
      if (filter.excludeTags && filter.excludeTags.length > 0) {
        if (scenario.tags && filter.excludeTags.some((tag) => scenario.tags?.includes(tag))) {
          return false;
        }
      }

      // Check name pattern
      if (filter.namePattern) {
        const regex = new RegExp(filter.namePattern, 'i');
        if (!regex.test(scenario.name)) {
          return false;
        }
      }

      return true;
    });
  }
}

/**
 * Load scenarios from a JSON file
 */
export async function loadScenarios(filePath: string): Promise<TestScenario[]> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  // Handle both single scenario array and ScenarioFile format
  if (Array.isArray(data)) {
    return data as TestScenario[];
  }

  // ScenarioFile format
  const file = data as {
    scenarios: TestScenario[];
    defaultCategory?: string;
    defaultTags?: string[];
  };
  return file.scenarios.map((scenario) => ({
    ...scenario,
    category: scenario.category || file.defaultCategory,
    tags: [...(file.defaultTags || []), ...(scenario.tags || [])],
  }));
}

/**
 * Create a test runner helper for use in Playwright tests
 */
export function createScenarioTest(page: Page) {
  const runner = new ScenarioRunner(page);

  return {
    /**
     * Run a scenario and throw if it fails
     */
    async run(scenario: TestScenario): Promise<void> {
      const result = await runner.runScenario(scenario);
      if (!result.passed) {
        throw new Error(`Scenario "${scenario.name}" failed: ${result.error}`);
      }
    },

    /**
     * Run multiple scenarios
     */
    async runAll(scenarios: TestScenario[]): Promise<ScenarioResult[]> {
      const results: ScenarioResult[] = [];
      for (const scenario of scenarios) {
        results.push(await runner.runScenario(scenario));
      }
      return results;
    },

    /**
     * Get the runner instance
     */
    runner,
  };
}
