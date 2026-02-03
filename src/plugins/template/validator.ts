/**
 * Template Validator
 *
 * Validates template elements and scopes for common errors.
 */

import type { TemplateElement, TemplateScope, ValidationError } from './types';

/**
 * Validate all template elements.
 */
export function validateElements(elements: TemplateElement[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const element of elements) {
    // Check for existing validation errors from parsing
    if (!element.isValid && element.validationError) {
      errors.push({
        message: element.validationError,
        severity: 'error',
        elementId: element.id,
        from: element.from,
        to: element.to,
      });
    }

    // Validate variable names
    if (!isValidVariableName(element.name)) {
      errors.push({
        message: `Invalid variable name: "${element.name}"`,
        severity: 'error',
        elementId: element.id,
        from: element.from,
        to: element.to,
      });
    }

    // Warn about deeply nested paths
    if (element.path.length > 5) {
      errors.push({
        message: `Deeply nested path (${element.path.length} levels): ${element.name}`,
        severity: 'warning',
        elementId: element.id,
        from: element.from,
        to: element.to,
      });
    }
  }

  return errors;
}

/**
 * Validate all scopes.
 */
export function validateScopes(scopes: TemplateScope[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const scope of scopes) {
    // Check for unclosed scopes
    if (!scope.endElement) {
      errors.push({
        message: `Unclosed ${scope.type}: {#${scope.name}} has no matching {/${scope.name}}`,
        severity: 'error',
        elementId: scope.startElement.id,
        from: scope.startElement.from,
        to: scope.startElement.to,
      });
    }

    // Warn about empty scopes
    if (scope.variables.length === 0 && scope.childScopes.length === 0) {
      errors.push({
        message: `Empty ${scope.type}: {#${scope.name}} contains no variables or nested sections`,
        severity: 'warning',
        elementId: scope.startElement.id,
        from: scope.contentFrom,
        to: scope.contentTo,
      });
    }

    // Warn about very deep nesting
    if (getNestedDepth(scope) > 5) {
      errors.push({
        message: `Deeply nested scope (${getNestedDepth(scope)} levels): {#${scope.name}}`,
        severity: 'warning',
        elementId: scope.startElement.id,
        from: scope.startElement.from,
        to: scope.startElement.to,
      });
    }

    // Recursively validate child scopes
    errors.push(...validateScopes(scope.childScopes));
  }

  return errors;
}

/**
 * Check if a variable name is valid.
 */
export function isValidVariableName(name: string): boolean {
  // Must not be empty
  if (!name || name.length === 0) return false;

  // Check each path segment
  const segments = name.split('.');
  for (const segment of segments) {
    // Must start with letter or underscore
    if (!/^[a-zA-Z_]/.test(segment)) return false;

    // Must only contain letters, numbers, underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) return false;

    // Reserved words
    const reserved = ['this', 'true', 'false', 'null', 'undefined'];
    if (reserved.includes(segment.toLowerCase())) return false;
  }

  return true;
}

/**
 * Get the maximum nesting depth of a scope.
 */
export function getNestedDepth(scope: TemplateScope): number {
  if (scope.childScopes.length === 0) return 1;

  let maxChildDepth = 0;
  for (const child of scope.childScopes) {
    const childDepth = getNestedDepth(child);
    if (childDepth > maxChildDepth) {
      maxChildDepth = childDepth;
    }
  }

  return 1 + maxChildDepth;
}

/**
 * Find duplicate variable declarations.
 */
export function findDuplicateVariables(elements: TemplateElement[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, TemplateElement>();

  for (const element of elements) {
    if (
      element.type === 'variable' ||
      element.type === 'nestedVariable' ||
      element.type === 'rawVariable'
    ) {
      const existing = seen.get(element.name);
      if (existing) {
        // Duplicate found - this is usually fine, just informational
        // Only warn if in different scopes
        if (element.scopeId !== existing.scopeId) {
          errors.push({
            message: `Variable "${element.name}" used in multiple scopes`,
            severity: 'warning',
            elementId: element.id,
            from: element.from,
            to: element.to,
          });
        }
      } else {
        seen.set(element.name, element);
      }
    }
  }

  return errors;
}

/**
 * Check for potentially unused loop variables.
 */
export function checkLoopVariables(scopes: TemplateScope[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const scope of scopes) {
    if (scope.type === 'loop') {
      // Check if any variables reference the loop variable
      const loopVarName = scope.name;
      let usesLoopVar = false;

      for (const variable of scope.variables) {
        if (variable.path[0] === loopVarName || variable.name === loopVarName) {
          usesLoopVar = true;
          break;
        }
      }

      if (!usesLoopVar && scope.variables.length > 0) {
        errors.push({
          message: `Loop {#${loopVarName}} doesn't seem to use loop variable. Use {${loopVarName}.property} for loop item properties.`,
          severity: 'warning',
          elementId: scope.startElement.id,
          from: scope.startElement.from,
          to: scope.startElement.to,
        });
      }
    }

    // Recurse into children
    errors.push(...checkLoopVariables(scope.childScopes));
  }

  return errors;
}

/**
 * Perform all validations.
 */
export function validateAll(
  elements: TemplateElement[],
  scopes: TemplateScope[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...validateElements(elements));
  errors.push(...validateScopes(scopes));
  errors.push(...findDuplicateVariables(elements));
  errors.push(...checkLoopVariables(scopes));

  // Sort by position
  errors.sort((a, b) => a.from - b.from);

  // Remove duplicates
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.message}-${error.from}-${error.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
