import { createT, en } from '@docx-editor.dev/i18n';
import {
  findNode,
  validateTreeOp,
  textFormFieldsOf,
  type OoxmlPart,
  type TreeDocOp,
  type TextFormFieldRange,
} from '@docx-editor.dev/core/store';
import type { SemanticSelection } from '@docx-editor.dev/core/layout';

interface Host {
  readonly pagesLayer: HTMLElement;
  readonly container: HTMLElement;
  part(): OoxmlPart;
  protected(paragraphId?: string): boolean;
  selection(): SemanticSelection;
  select(selection: SemanticSelection): void;
  apply(op: TreeDocOp): boolean;
  editable(): boolean;
}

/** Shared field interaction for all editor hosts. */
export function createTextFormFieldInteraction(host: Host): {
  keydown(event: KeyboardEvent): boolean;
  doubleClick(event: MouseEvent): boolean;
  annotate(ops: readonly TreeDocOp[]): readonly TreeDocOp[];
  destroy(): void;
} {
  const t = createT(en);
  const document = host.container.ownerDocument;
  let dialog: HTMLDialogElement | null = null;
  let active: { paragraphId: string; fieldNodeId: string } | null = null;
  const close = (): void => {
    dialog?.remove();
    dialog = null;
    host.pagesLayer.focus({ preventScroll: true });
  };
  function select(paragraphId: string, field: TextFormFieldRange): void {
    active = { paragraphId, fieldNodeId: field.fieldNodeId };
    host.select({
      anchor: { paragraphId, offset: field.start },
      head: { paragraphId, offset: field.end },
    });
  }
  function open(paragraphId: string, field: TextFormFieldRange): void {
    close();
    const panel = document.createElement('dialog');
    dialog = panel;
    panel.className = 'docx-text-form-dialog';
    panel.setAttribute('aria-label', t('textFormField.title'));
    const heading = document.createElement('h2');
    heading.textContent = t('textFormField.title');
    const label = document.createElement('label');
    label.textContent = t('textFormField.defaultText');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = field.defaultText;
    label.append(input);
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = t('textFormField.cancel');
    cancel.addEventListener('click', close);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.textContent = t('textFormField.apply');
    const save = (): void => {
      if (
        !host.editable() ||
        host.protected(paragraphId) ||
        !host.apply({
          op: 'setTextFormFieldDefault',
          paragraphId,
          fieldNodeId: field.fieldNodeId,
          text: input.value,
        })
      ) {
        error.textContent = t('textFormField.unavailable');
        return;
      }
      const p = findNode(host.part(), paragraphId);
      const current =
        p?.kind === 'paragraph'
          ? textFormFieldsOf(p).find((f) => f.fieldNodeId === field.fieldNodeId)
          : null;
      if (current) select(paragraphId, current);
      close();
    };
    apply.addEventListener('click', save);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      }
    });
    panel.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    panel.append(heading, label, error, cancel, apply);
    host.container.append(panel);
    panel.showModal();
    input.focus();
    input.select();
  }
  const fieldAtTarget = (
    event: MouseEvent
  ): { paragraphId: string; field: TextFormFieldRange } | null => {
    const target = event.target as Element | null;
    const span = target?.closest<HTMLElement>('[data-field-atom="form"][data-start]');
    const paragraphId = span?.closest<HTMLElement>('[data-paragraph-id]')?.dataset.paragraphId;
    if (!span || !paragraphId || !host.editable()) return null;
    const paragraph = findNode(host.part(), paragraphId);
    if (paragraph?.kind !== 'paragraph') return null;
    const offset = Number(span.dataset.start);
    const field = textFormFieldsOf(paragraph).find((f) => f.start <= offset && offset < f.end);
    if (!field) return null;
    return { paragraphId, field };
  };
  const rememberField = (event: PointerEvent): void => {
    const hit = fieldAtTarget(event);
    active = hit ? { paragraphId: hit.paragraphId, fieldNodeId: hit.field.fieldNodeId } : null;
  };
  host.pagesLayer.addEventListener('pointerdown', rememberField, { capture: true });
  const doubleClick = (event: MouseEvent): boolean => {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
    const hit = fieldAtTarget(event);
    if (!hit) return false;
    const { paragraphId, field } = hit;
    event.preventDefault();
    select(paragraphId, field);
    if (!host.protected(paragraphId)) open(paragraphId, field);
    return true;
  };
  host.pagesLayer.addEventListener('dblclick', doubleClick);
  return {
    doubleClick,
    annotate(ops) {
      return ops.map((op) => {
        if (
          !active ||
          (op.op !== 'insertText' && op.op !== 'deleteText') ||
          op.revision ||
          op.paragraphId !== active.paragraphId ||
          !host.protected(op.paragraphId)
        )
          return op;
        const p = findNode(host.part(), op.paragraphId);
        const field =
          p?.kind === 'paragraph'
            ? textFormFieldsOf(p).find((f) => f.fieldNodeId === active!.fieldNodeId)
            : null;
        const start = op.op === 'insertText' ? op.offset : op.start;
        const end = op.op === 'insertText' ? op.offset : op.end;
        return field && start >= field.start && end <= field.end
          ? { ...op, textFormFieldId: field.fieldNodeId }
          : op;
      });
    },
    keydown(event) {
      if (
        event.key !== 'Tab' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !host.editable() ||
        !host.protected(host.selection().head.paragraphId)
      )
        return false;
      const entries: { paragraphId: string; field: TextFormFieldRange }[] = [];
      const stack = [host.part().root];
      while (stack.length) {
        const node = stack.pop()!;
        if (node.kind === 'paragraph') {
          for (const field of textFormFieldsOf(node))
            if (
              host.protected(node.id) &&
              field.enabled &&
              !validateTreeOp(host.part(), {
                op: 'insertText',
                paragraphId: node.id,
                offset: field.start,
                text: 'x',
              })
            )
              entries.push({ paragraphId: node.id, field });
        } else {
          for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i]!;
            if (child.kind !== 'textValue') stack.push(child);
          }
        }
      }
      if (!entries.length) return false;
      const selected = host.selection();
      const current = selected.head;
      const activeIndex = active
        ? entries.findIndex(
            (e) =>
              e.paragraphId === active!.paragraphId &&
              e.field.fieldNodeId === active!.fieldNodeId &&
              e.field.start <= Math.min(selected.anchor.offset, current.offset) &&
              e.field.end >= Math.max(selected.anchor.offset, current.offset)
          )
        : -1;
      const index =
        activeIndex >= 0
          ? activeIndex
          : entries.findIndex(
              (e) =>
                e.paragraphId === current.paragraphId &&
                e.field.start <= Math.min(selected.anchor.offset, current.offset) &&
                e.field.end >= Math.max(selected.anchor.offset, current.offset)
            );
      const nextIndex =
        index < 0
          ? event.shiftKey
            ? entries.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + entries.length) % entries.length;
      const next = entries[nextIndex]!;
      event.preventDefault();
      select(next.paragraphId, next.field);
      return true;
    },
    destroy() {
      host.pagesLayer.removeEventListener('dblclick', doubleClick);
      host.pagesLayer.removeEventListener('pointerdown', rememberField, { capture: true });
      dialog?.remove();
      dialog = null;
    },
  };
}
