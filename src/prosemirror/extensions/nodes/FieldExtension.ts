/**
 * Field Extension — inline field node (PAGE, NUMPAGES, DATE, MERGEFIELD, etc.)
 *
 * Represents OOXML simple and complex fields as an atomic inline node.
 * At render time, field values are substituted (e.g., PAGE → actual page number).
 */

import { createNodeExtension } from '../create';

export const FieldExtension = createNodeExtension({
  name: 'field',
  schemaNodeName: 'field',
  nodeSpec: {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    attrs: {
      /** Field type: PAGE, NUMPAGES, DATE, MERGEFIELD, etc. */
      fieldType: { default: 'UNKNOWN' },
      /** Full field instruction (e.g., "PAGE \\* MERGEFORMAT") */
      instruction: { default: '' },
      /** Display text (the current/cached field value) */
      displayText: { default: '' },
      /** Whether this is a simple or complex field */
      fieldKind: { default: 'simple' },
      /** Field is locked */
      fldLock: { default: false },
      /** Field is dirty (needs update) */
      dirty: { default: false },
    },
    parseDOM: [
      {
        tag: 'span.docx-field',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            fieldType: el.dataset.fieldType || 'UNKNOWN',
            instruction: el.dataset.instruction || '',
            displayText: el.textContent || '',
            fieldKind: el.dataset.fieldKind || 'simple',
            fldLock: el.dataset.fldLock === 'true',
            dirty: el.dataset.dirty === 'true',
          };
        },
      },
    ],
    toDOM(node) {
      const { fieldType, instruction, displayText, fieldKind, fldLock, dirty } = node.attrs as {
        fieldType: string;
        instruction: string;
        displayText: string;
        fieldKind: string;
        fldLock: boolean;
        dirty: boolean;
      };

      // Dynamic fields show a placeholder; static fields show their display text
      let text = displayText || '';
      if (!text) {
        switch (fieldType) {
          case 'PAGE':
            text = '#';
            break;
          case 'NUMPAGES':
            text = '#';
            break;
          case 'DATE':
          case 'TIME':
          case 'CREATEDATE':
          case 'SAVEDATE':
            text = new Date().toLocaleDateString();
            break;
          case 'MERGEFIELD':
            text = `«${instruction.replace(/^MERGEFIELD\s+/i, '').replace(/\s*\\.*$/, '')}»`;
            break;
          default:
            text = `{${fieldType}}`;
        }
      }

      return [
        'span',
        {
          class: `docx-field docx-field-${fieldType.toLowerCase()}`,
          'data-field-type': fieldType,
          'data-instruction': instruction,
          'data-field-kind': fieldKind,
          ...(fldLock ? { 'data-fld-lock': 'true' } : {}),
          ...(dirty ? { 'data-dirty': 'true' } : {}),
          style: 'background: rgba(200,200,200,0.2); padding: 0 1px; border-radius: 2px;',
        },
        text,
      ];
    },
  },
});
