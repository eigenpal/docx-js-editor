/**
 * Scope Tracker
 *
 * Tracks loop and conditional scope regions, matching opening
 * and closing tags to build a hierarchy of scopes.
 */

import type { TemplateElement, TemplateScope, ValidationError } from './types';

/**
 * Generate a unique scope ID.
 */
let scopeIdCounter = 0;
function generateScopeId(): string {
  return `scope-${++scopeIdCounter}`;
}

/**
 * Reset scope ID counter (for testing).
 */
export function resetScopeIdCounter(): void {
  scopeIdCounter = 0;
}

/**
 * Check if an element is a scope opener.
 */
function isScopeOpener(element: TemplateElement): boolean {
  return (
    element.type === 'loopStart' ||
    element.type === 'conditionalStart' ||
    element.type === 'invertedStart'
  );
}

/**
 * Check if an element is a scope closer.
 */
function isScopeCloser(element: TemplateElement): boolean {
  return (
    element.type === 'loopEnd' ||
    element.type === 'conditionalEnd' ||
    element.type === 'invertedEnd'
  );
}

/**
 * Get the scope type from an opener element.
 */
function getScopeType(element: TemplateElement): 'loop' | 'conditional' | 'inverted' {
  if (element.type === 'loopStart') return 'loop';
  if (element.type === 'conditionalStart') return 'conditional';
  if (element.type === 'invertedStart') return 'inverted';
  return 'loop'; // Default
}

/**
 * Match opening and closing tags to create scopes.
 * Returns the scopes and any validation errors.
 */
export function buildScopes(elements: TemplateElement[]): {
  scopes: TemplateScope[];
  errors: ValidationError[];
} {
  const scopes: TemplateScope[] = [];
  const errors: ValidationError[] = [];
  const openStack: { element: TemplateElement; scope: TemplateScope }[] = [];

  // Create a mutable copy of elements to update
  const updatedElements = [...elements];

  for (let i = 0; i < updatedElements.length; i++) {
    const element = updatedElements[i];

    if (isScopeOpener(element)) {
      // Create a new scope
      const scope: TemplateScope = {
        id: generateScopeId(),
        type: getScopeType(element),
        name: element.name,
        startElement: element,
        endElement: undefined,
        contentFrom: element.to,
        contentTo: element.to, // Will be updated when closed
        parentScopeId: openStack.length > 0 ? openStack[openStack.length - 1].scope.id : undefined,
        childScopes: [],
        variables: [],
        lineStart: element.lineNumber ?? 1,
        lineEnd: element.lineNumber ?? 1, // Will be updated
      };

      // Update element with scope info
      updatedElements[i] = {
        ...element,
        scopeId: scope.id,
        scopeDepth: openStack.length,
      };

      // Add as child of parent scope
      if (openStack.length > 0) {
        openStack[openStack.length - 1].scope.childScopes.push(scope);
      }

      openStack.push({ element: updatedElements[i], scope });
      scopes.push(scope);
    } else if (isScopeCloser(element)) {
      // Find matching opener
      let matchFound = false;

      for (let j = openStack.length - 1; j >= 0; j--) {
        if (openStack[j].element.name === element.name) {
          // Found matching opener
          const { scope } = openStack[j];

          // Update the scope
          scope.endElement = element;
          scope.contentTo = element.from;
          scope.lineEnd = element.lineNumber ?? scope.lineStart;

          // Update the closing element
          updatedElements[i] = {
            ...element,
            scopeId: scope.id,
            pairedElementId: openStack[j].element.id,
            scopeDepth: j,
          };

          // Update the opening element with the pair ID
          const openerIndex = updatedElements.findIndex((el) => el.id === openStack[j].element.id);
          if (openerIndex >= 0) {
            updatedElements[openerIndex] = {
              ...updatedElements[openerIndex],
              pairedElementId: element.id,
            };
          }

          // Remove from stack (and any unclosed scopes inside)
          for (let k = openStack.length - 1; k > j; k--) {
            // Mark unclosed scopes as invalid
            const unclosed = openStack[k];
            const unclosedIndex = updatedElements.findIndex((el) => el.id === unclosed.element.id);
            if (unclosedIndex >= 0) {
              updatedElements[unclosedIndex] = {
                ...updatedElements[unclosedIndex],
                isValid: false,
                validationError: `Unclosed tag: expected {/${unclosed.element.name}} before {/${element.name}}`,
              };
            }
            errors.push({
              message: `Unclosed tag: {#${unclosed.element.name}} has no matching closing tag`,
              severity: 'error',
              elementId: unclosed.element.id,
              from: unclosed.element.from,
              to: unclosed.element.to,
            });
          }

          openStack.splice(j);
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        // No matching opener
        updatedElements[i] = {
          ...element,
          isValid: false,
          validationError: `No matching opening tag for {/${element.name}}`,
        };
        errors.push({
          message: `No matching opening tag for {/${element.name}}`,
          severity: 'error',
          elementId: element.id,
          from: element.from,
          to: element.to,
        });
      }
    } else {
      // Regular variable - associate with current scope
      if (openStack.length > 0) {
        const currentScope = openStack[openStack.length - 1].scope;
        updatedElements[i] = {
          ...element,
          scopeId: currentScope.id,
          scopeDepth: openStack.length,
        };
        currentScope.variables.push(updatedElements[i]);
      } else {
        updatedElements[i] = {
          ...element,
          scopeDepth: 0,
        };
      }
    }
  }

  // Mark any remaining unclosed scopes as invalid
  for (const unclosed of openStack) {
    const unclosedIndex = updatedElements.findIndex((el) => el.id === unclosed.element.id);
    if (unclosedIndex >= 0) {
      updatedElements[unclosedIndex] = {
        ...updatedElements[unclosedIndex],
        isValid: false,
        validationError: `Unclosed tag: expected {/${unclosed.element.name}}`,
      };
    }
    errors.push({
      message: `Unclosed tag: {#${unclosed.element.name}} has no matching closing tag`,
      severity: 'error',
      elementId: unclosed.element.id,
      from: unclosed.element.from,
      to: unclosed.element.to,
    });
  }

  // Update elements array in place with the updated elements
  for (let i = 0; i < elements.length; i++) {
    Object.assign(elements[i], updatedElements[i]);
  }

  return { scopes, errors };
}

/**
 * Create a root scope containing all elements.
 */
export function createRootScope(
  elements: TemplateElement[],
  scopes: TemplateScope[]
): TemplateScope {
  // Collect top-level elements (those without a parent scope)
  const topLevelVariables = elements.filter(
    (el) =>
      !el.scopeId &&
      (el.type === 'variable' || el.type === 'nestedVariable' || el.type === 'rawVariable')
  );

  // Collect top-level scopes (those without a parent)
  const topLevelScopes = scopes.filter((s) => !s.parentScopeId);

  const rootScope: TemplateScope = {
    id: 'root',
    type: 'loop', // Root is always treated as a loop (single iteration)
    name: 'data',
    startElement: {
      id: 'root-start',
      type: 'loopStart',
      rawTag: '',
      name: 'data',
      path: ['data'],
      from: 0,
      to: 0,
      scopeDepth: 0,
      isValid: true,
    },
    contentFrom: 0,
    contentTo: Infinity,
    childScopes: topLevelScopes,
    variables: topLevelVariables,
    lineStart: 1,
    lineEnd: Infinity,
  };

  return rootScope;
}

/**
 * Get a scope by ID.
 */
export function getScopeById(scopes: TemplateScope[], id: string): TemplateScope | undefined {
  for (const scope of scopes) {
    if (scope.id === id) return scope;

    // Search children recursively
    const found = getScopeById(scope.childScopes, id);
    if (found) return found;
  }

  return undefined;
}

/**
 * Get the scope containing a position.
 */
export function getScopeAtPosition(
  scopes: TemplateScope[],
  pos: number
): TemplateScope | undefined {
  for (const scope of scopes) {
    if (pos >= scope.contentFrom && pos <= scope.contentTo) {
      // Check children first (more specific)
      const childScope = getScopeAtPosition(scope.childScopes, pos);
      if (childScope) return childScope;
      return scope;
    }
  }

  return undefined;
}

/**
 * Get the ancestry chain for a scope (from root to scope).
 */
export function getScopeAncestry(scopes: TemplateScope[], scopeId: string): TemplateScope[] {
  const ancestry: TemplateScope[] = [];

  function findAncestry(
    currentScopes: TemplateScope[],
    targetId: string,
    path: TemplateScope[]
  ): boolean {
    for (const scope of currentScopes) {
      const newPath = [...path, scope];

      if (scope.id === targetId) {
        ancestry.push(...newPath);
        return true;
      }

      if (findAncestry(scope.childScopes, targetId, newPath)) {
        return true;
      }
    }
    return false;
  }

  findAncestry(scopes, scopeId, []);
  return ancestry;
}

/**
 * Flatten all scopes into a single array.
 */
export function flattenScopes(scopes: TemplateScope[]): TemplateScope[] {
  const flat: TemplateScope[] = [];

  function collect(scope: TemplateScope): void {
    flat.push(scope);
    for (const child of scope.childScopes) {
      collect(child);
    }
  }

  for (const scope of scopes) {
    collect(scope);
  }

  return flat;
}
