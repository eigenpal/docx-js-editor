import { Schema } from 'prosemirror-model';

/**
 * Basic ProseMirror schema for DOCX editing
 */
export const schema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    text: {
      group: 'inline',
    },
  },
  marks: {
    bold: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        {
          style: 'font-weight',
          getAttrs: (value) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
        },
      ],
      toDOM() {
        return ['strong', 0];
      },
    },
    italic: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style=italic' },
      ],
      toDOM() {
        return ['em', 0];
      },
    },
    underline: {
      parseDOM: [
        { tag: 'u' },
        { style: 'text-decoration=underline' },
      ],
      toDOM() {
        return ['u', 0];
      },
    },
    strikethrough: {
      parseDOM: [
        { tag: 's' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM() {
        return ['s', 0];
      },
    },
    fontSize: {
      attrs: { size: {} },
      parseDOM: [
        {
          style: 'font-size',
          getAttrs: (value) => ({ size: value }),
        },
      ],
      toDOM(mark) {
        return ['span', { style: `font-size: ${mark.attrs.size}` }, 0];
      },
    },
    fontColor: {
      attrs: { color: {} },
      parseDOM: [
        {
          style: 'color',
          getAttrs: (value) => ({ color: value }),
        },
      ],
      toDOM(mark) {
        return ['span', { style: `color: ${mark.attrs.color}` }, 0];
      },
    },
    highlight: {
      attrs: { color: { default: 'yellow' } },
      parseDOM: [
        {
          style: 'background-color',
          getAttrs: (value) => ({ color: value }),
        },
      ],
      toDOM(mark) {
        return ['span', { style: `background-color: ${mark.attrs.color}` }, 0];
      },
    },
  },
});
