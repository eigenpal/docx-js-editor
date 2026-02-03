/**
 * Schema Inferrer
 *
 * Infers a TypeScript-like data structure from template elements.
 */

import type { TemplateElement, TemplateScope, InferredDataType } from './types';

/**
 * Infer the data structure from template elements and scopes.
 */
export function inferDataStructure(
  elements: TemplateElement[],
  scopes: TemplateScope[]
): InferredDataType {
  const root: InferredDataType = {
    type: 'object',
    properties: {},
  };

  // Process top-level variables
  for (const element of elements) {
    if (!element.scopeId) {
      // Top-level variable
      addVariableToStructure(root, element.path, element);
    }
  }

  // Process scopes
  for (const scope of scopes) {
    if (!scope.parentScopeId) {
      // Top-level scope
      addScopeToStructure(root, scope);
    }
  }

  return root;
}

/**
 * Add a variable path to a data structure.
 */
function addVariableToStructure(
  structure: InferredDataType,
  path: string[],
  element: TemplateElement
): void {
  if (path.length === 0) return;

  let current = structure;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const isLast = i === path.length - 1;

    if (!current.properties) {
      current.properties = {};
    }

    if (!current.properties[segment]) {
      if (isLast) {
        // Leaf node - infer type from element
        current.properties[segment] = inferTypeFromElement(element);
      } else {
        // Intermediate node - create object
        current.properties[segment] = {
          type: 'object',
          properties: {},
        };
      }
    }

    current = current.properties[segment];
  }
}

/**
 * Infer the type of a variable from its element.
 */
function inferTypeFromElement(element: TemplateElement): InferredDataType {
  // For simple variables, assume string
  // For conditionals, assume boolean
  if (element.type === 'conditionalStart' || element.type === 'invertedStart') {
    return { type: 'boolean', optional: true };
  }

  // Default to string
  return { type: 'string' };
}

/**
 * Add a scope to the data structure.
 */
function addScopeToStructure(structure: InferredDataType, scope: TemplateScope): void {
  if (!structure.properties) {
    structure.properties = {};
  }

  const name = scope.name;

  if (scope.type === 'loop') {
    // Loop - array type
    const itemType: InferredDataType = {
      type: 'object',
      properties: {},
    };

    // Add variables inside the loop
    for (const variable of scope.variables) {
      // Remove the loop variable prefix from the path
      const path = [...variable.path];
      if (path[0] === name) {
        path.shift();
      }

      if (path.length > 0) {
        addVariableToStructure(itemType, path, variable);
      }
    }

    // Add child scopes
    for (const childScope of scope.childScopes) {
      addScopeToStructure(itemType, childScope);
    }

    structure.properties[name] = {
      type: 'array',
      items: itemType,
    };
  } else {
    // Conditional or inverted - boolean with nested properties
    const conditionalType: InferredDataType = {
      type: 'boolean',
      optional: true,
    };

    structure.properties[name] = conditionalType;

    // Add variables inside the conditional as siblings (they're available when truthy)
    for (const variable of scope.variables) {
      const path = [...variable.path];
      // Skip if it's the conditional variable itself
      if (path.length === 1 && path[0] === name) continue;

      addVariableToStructure(structure, path, variable);
      // Mark as optional since it's inside a conditional
      if (structure.properties && path.length === 1) {
        const prop = structure.properties[path[0]];
        if (prop) {
          prop.optional = true;
        }
      }
    }

    // Add child scopes
    for (const childScope of scope.childScopes) {
      addScopeToStructure(structure, childScope);
    }
  }
}

/**
 * Convert an inferred data structure to a TypeScript interface string.
 */
export function toTypeScriptInterface(
  structure: InferredDataType,
  name: string = 'TemplateData',
  indent: string = ''
): string {
  if (structure.type !== 'object') {
    return `${indent}type ${name} = ${typeToString(structure)};`;
  }

  let result = `${indent}interface ${name} {\n`;

  if (structure.properties) {
    const entries = Object.entries(structure.properties);
    for (const [propName, propType] of entries) {
      const optional = propType.optional ? '?' : '';
      const typeStr = typeToString(propType, indent + '  ');
      result += `${indent}  ${propName}${optional}: ${typeStr};\n`;
    }
  }

  result += `${indent}}`;

  return result;
}

/**
 * Convert a type to its string representation.
 */
function typeToString(type: InferredDataType, indent: string = ''): string {
  switch (type.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'unknown':
      return 'unknown';
    case 'array':
      if (type.items) {
        if (type.items.type === 'object' && type.items.properties) {
          // Inline object type
          return `Array<${inlineObjectType(type.items, indent)}>`;
        }
        return `${typeToString(type.items)}[]`;
      }
      return 'unknown[]';
    case 'object':
      if (type.properties) {
        return inlineObjectType(type, indent);
      }
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Create an inline object type.
 */
function inlineObjectType(type: InferredDataType, indent: string): string {
  if (!type.properties || Object.keys(type.properties).length === 0) {
    return '{}';
  }

  const entries = Object.entries(type.properties);
  const props = entries.map(([name, propType]) => {
    const optional = propType.optional ? '?' : '';
    return `${name}${optional}: ${typeToString(propType, indent)}`;
  });

  if (props.join(', ').length < 60) {
    return `{ ${props.join(', ')} }`;
  }

  return `{\n${indent}    ${props.join(`;\n${indent}    `)};\n${indent}  }`;
}

/**
 * Get the full data path for a variable.
 */
export function getFullDataPath(element: TemplateElement, scopes: TemplateScope[]): string {
  const parts: string[] = ['data'];

  // Find the scope ancestry
  if (element.scopeId) {
    const ancestry = getScopeAncestry(scopes, element.scopeId);
    for (const scope of ancestry) {
      if (scope.type === 'loop') {
        parts.push(`${scope.name}[]`);
      }
    }
  }

  // Add the element path
  parts.push(...element.path);

  return parts.join('.');
}

/**
 * Helper to get scope ancestry.
 */
function getScopeAncestry(scopes: TemplateScope[], scopeId: string): TemplateScope[] {
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
 * Get a summary of the data structure.
 */
export function getStructureSummary(structure: InferredDataType): string {
  if (!structure.properties) return '(empty)';

  const props = Object.keys(structure.properties);
  if (props.length === 0) return '(empty)';

  if (props.length <= 3) {
    return props.join(', ');
  }

  return `${props.slice(0, 3).join(', ')} + ${props.length - 3} more`;
}
