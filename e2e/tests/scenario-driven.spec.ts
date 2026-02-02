/**
 * Scenario-Driven Tests
 *
 * Runs test scenarios from JSON files using the scenario runner.
 * This enables data-driven testing with comprehensive coverage.
 */

import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createScenarioTest } from '../agentic/scenario-runner';
import type { TestScenario } from '../agentic/scenario-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scenario files to load
const SCENARIO_FILES = [
  'text-editing.json',
  'formatting.json',
  'history.json',
  'tables.json',
  'edge-cases.json',
  'find-replace.json',
  'fonts.json',
  'colors.json',
  'alignment.json',
  'lists.json',
  'line-spacing.json',
  'paragraph-styles.json',
];

// Load all scenarios at test file load time
const allScenarios: Map<string, TestScenario[]> = new Map();

for (const file of SCENARIO_FILES) {
  const filePath = path.join(__dirname, '..', 'scenarios', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const scenarios = Array.isArray(data) ? data : data.scenarios;
    allScenarios.set(file.replace('.json', ''), scenarios);
  }
}

// Generate tests from scenarios
for (const [category, scenarios] of allScenarios) {
  test.describe(`Scenario: ${category}`, () => {
    // Check for focused tests
    const hasOnly = scenarios.some((s) => s.only);

    for (const scenario of scenarios) {
      // Skip if marked
      if (scenario.skip) {
        test.skip(scenario.name, async () => {});
        continue;
      }

      // Use test.only if scenario is marked
      const testFn = hasOnly && !scenario.only ? test.skip : scenario.only ? test.only : test;

      testFn(scenario.name, async ({ page }) => {
        // Set timeout if specified
        if (scenario.timeout) {
          test.setTimeout(scenario.timeout);
        }

        // Create test helper
        const scenarioTest = createScenarioTest(page);

        // Run the scenario
        await scenarioTest.run(scenario);
      });
    }
  });
}

// Category-specific test suites for better organization

test.describe('Text Editing Suite', () => {
  const scenarios = allScenarios.get('text-editing') || [];

  test('run all text editing scenarios', async ({ page }) => {
    const scenarioTest = createScenarioTest(page);
    const results = await scenarioTest.runAll(
      scenarios.filter((s) => !s.skip && s.tags?.includes('core'))
    );

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const failedNames = failed.map((r) => r.scenario.name).join(', ');
      throw new Error(`${failed.length} scenarios failed: ${failedNames}`);
    }
  });
});

test.describe('Formatting Suite', () => {
  const scenarios = allScenarios.get('formatting') || [];

  test('run all formatting scenarios', async ({ page }) => {
    const scenarioTest = createScenarioTest(page);
    const results = await scenarioTest.runAll(
      scenarios.filter((s) => !s.skip && s.tags?.includes('core'))
    );

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const failedNames = failed.map((r) => r.scenario.name).join(', ');
      throw new Error(`${failed.length} scenarios failed: ${failedNames}`);
    }
  });
});

test.describe('Keyboard Shortcuts Suite', () => {
  test('run all shortcut scenarios', async ({ page }) => {
    const scenarioTest = createScenarioTest(page);

    // Collect all scenarios tagged with 'shortcut'
    const shortcutScenarios: TestScenario[] = [];
    for (const scenarios of allScenarios.values()) {
      shortcutScenarios.push(...scenarios.filter((s) => !s.skip && s.tags?.includes('shortcut')));
    }

    const results = await scenarioTest.runAll(shortcutScenarios);

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const failedNames = failed.map((r) => r.scenario.name).join(', ');
      throw new Error(`${failed.length} shortcut scenarios failed: ${failedNames}`);
    }
  });
});

test.describe('Edge Cases Suite', () => {
  const scenarios = allScenarios.get('edge-cases') || [];

  test('run race condition scenarios', async ({ page }) => {
    const scenarioTest = createScenarioTest(page);
    const results = await scenarioTest.runAll(
      scenarios.filter((s) => !s.skip && s.tags?.includes('race-condition'))
    );

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const failedNames = failed.map((r) => r.scenario.name).join(', ');
      throw new Error(`${failed.length} race condition scenarios failed: ${failedNames}`);
    }
  });

  test('run boundary condition scenarios', async ({ page }) => {
    const scenarioTest = createScenarioTest(page);
    const results = await scenarioTest.runAll(
      scenarios.filter((s) => !s.skip && s.tags?.includes('boundary'))
    );

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const failedNames = failed.map((r) => r.scenario.name).join(', ');
      throw new Error(`${failed.length} boundary scenarios failed: ${failedNames}`);
    }
  });
});
