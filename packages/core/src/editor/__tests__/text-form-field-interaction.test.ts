import { expect, test } from 'bun:test';
import {
  readOoxmlPart,
  applyTreeOp,
  textFormFieldsOf,
  type OoxmlParagraphNode,
} from '@docx-editor.dev/core/store';
import { createTextFormFieldInteraction } from '../surface-text-form-fields.ts';

function setup(
  protectedForm = false,
  emptyFirst = false,
  separator = ' and ',
  emptySecond = false
) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const field = (name: string) =>
    `<w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:name w:val="${name}"/><w:textInput><w:default w:val="Sample"/></w:textInput></w:ffData></w:fldChar></w:r><w:r><w:instrText> FORMTEXT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Sample</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const parsed = readOoxmlPart(
    `<w:document xmlns:w="${W}"><w:body><w:p>${emptyFirst ? field('InputA').replace('<w:t>Sample</w:t>', '') : field('InputA')}${separator ? `<w:r><w:t>${separator}</w:t></w:r>` : ''}${emptySecond ? field('InputB').replace('<w:t>Sample</w:t>', '') : field('InputB')}</w:p></w:body></w:document>`,
    {
      name: '/word/document.xml',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    }
  );
  if (!parsed.ok) throw new Error(parsed.reason);
  let part = parsed.part;
  const body = part.root.children[0]!;
  if (body.kind === 'textValue') throw new Error('body');
  const paragraph = body.children[0] as OoxmlParagraphNode;
  let selection = {
    anchor: { paragraphId: paragraph.id, offset: 0 },
    head: { paragraphId: paragraph.id, offset: 6 },
  };
  const container = document.createElement('div');
  const pagesLayer = document.createElement('div');
  const span = document.createElement('span');
  span.dataset.fieldAtom = 'form';
  span.dataset.start = '0';
  span.dataset.paragraphId = paragraph.id;
  span.textContent = 'Sample';
  pagesLayer.append(span);
  container.append(pagesLayer);
  document.body.append(container);
  const interaction = createTextFormFieldInteraction({
    container,
    pagesLayer,
    part: () => part,
    protected: () => protectedForm,
    selection: () => selection,
    select: (value) => {
      selection = value;
    },
    editable: () => true,
    apply(op) {
      const result = applyTreeOp(part, op);
      if (result.ok) part = result.part;
      return result.ok;
    },
  });
  return {
    container,
    span,
    interaction,
    selection: () => selection,
    part: () => part,
    cleanup() {
      interaction.destroy();
      container.remove();
    },
  };
}

test('double click edits the field default through shared core UI', () => {
  const host = setup();
  try {
    host.span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const panel = host.container.querySelector('dialog');
    expect(panel).not.toBeNull();
    const input = panel!.querySelector('input')!;
    expect(input.value).toBe('Sample');
    input.value = 'Updated';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.container.querySelector('dialog')).toBeNull();
    const body = host.part().root.children[0]!;
    if (body.kind === 'textValue') throw new Error('body');
    expect(textFormFieldsOf(body.children[0] as OoxmlParagraphNode)[0]?.defaultText).toBe(
      'Updated'
    );
  } finally {
    host.cleanup();
  }
});

test('protected Tab selects the next field and double click does not expose defaults', () => {
  const host = setup(true);
  try {
    host.span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.container.querySelector('dialog')).toBeNull();
    expect(
      host.interaction.keydown(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    ).toBe(true);
    expect(host.selection().anchor.offset).toBe(11);
    expect(host.selection().head.offset).toBe(17);
  } finally {
    host.cleanup();
  }
});

test('double click skips an earlier empty field', () => {
  const host = setup(false, true);
  try {
    host.span.dataset.start = '5';
    host.span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.selection().anchor.offset).toBe(5);
    expect(host.selection().head.offset).toBe(11);
    expect(host.container.querySelector('dialog')).not.toBeNull();
  } finally {
    host.cleanup();
  }
});

test('modified double click retains the ordinary selection gesture', () => {
  const host = setup();
  try {
    host.span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, shiftKey: true }));
    expect(host.container.querySelector('dialog')).toBeNull();
  } finally {
    host.cleanup();
  }
});

test('protected field identity survives successive typing operations', () => {
  const host = setup(true);
  try {
    host.span.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const paragraphId = host.selection().head.paragraphId;
    const first = host.interaction.annotate([
      { op: 'insertText', paragraphId, offset: 6, text: 'A' },
    ])[0]!;
    expect(first).toHaveProperty('textFormFieldId');
    const second = host.interaction.annotate([
      { op: 'insertText', paragraphId, offset: 6, text: 'B' },
    ])[0]!;
    expect(second).toHaveProperty(
      'textFormFieldId',
      (first as { textFormFieldId: string }).textFormFieldId
    );
  } finally {
    host.cleanup();
  }
});

test('a visible field beside an empty field keeps its own options identity', () => {
  const host = setup(false, true, '');
  try {
    host.span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.selection().head.offset).toBe(6);
  } finally {
    host.cleanup();
  }
});

test('Tab cycles distinct adjacent empty fields by identity', () => {
  const host = setup(true, true, '', true);
  try {
    const identities: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      host.interaction.keydown(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
      const paragraphId = host.selection().head.paragraphId;
      const op = host.interaction.annotate([
        { op: 'insertText', paragraphId, offset: 0, text: 'X' },
      ])[0] as { textFormFieldId?: string };
      identities.push(op.textFormFieldId);
    }
    expect(identities[0]).toBeDefined();
    expect(identities[0]).not.toBe(identities[1]);
    expect(identities[0]).toBe(identities[2]);
  } finally {
    host.cleanup();
  }
});
