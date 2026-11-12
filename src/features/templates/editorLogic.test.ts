import { describe, expect, it } from 'vitest';
import { indent, parseContext, previewKind } from './editorLogic';

describe('previewKind', () => {
  it('shows pdf and html in a frame, the rest as text', () => {
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('text/html;charset=UTF-8')).toBe('html');
    expect(previewKind('application/xml')).toBe('text');
    expect(previewKind('text/calendar;charset=UTF-8')).toBe('text');
    expect(previewKind(undefined)).toBe('text');
  });
});

describe('parseContext', () => {
  it('accepts a json object, or nothing', () => {
    expect(parseContext('{"invoice": {"total": 1}}').context).toEqual({ invoice: { total: 1 } });
    expect(parseContext('  ')).toEqual({ context: undefined });
  });

  it('refuses what is not a json object', () => {
    expect(parseContext('[1]').error).toMatch(/json object/);
    expect(parseContext('{"a":').error).toMatch(/invalid json/);
  });
});

describe('indent', () => {
  it('inserts two spaces at the cursor', () => {
    expect(indent('ab', 1, 1, false)).toEqual({ value: 'a  b', start: 3, end: 3 });
  });

  it('indents and unindents the selected lines', () => {
    const value = 'a\nb\nc';
    const indented = indent(value, 0, 3, false);
    expect(indented.value).toBe('  a\n  b\nc');
    const back = indent(indented.value, indented.start, indented.end, true);
    expect(back.value).toBe(value);
  });

  it('unindents the line of the cursor', () => {
    expect(indent('x\n    y', 6, 6, true).value).toBe('x\n  y');
  });
});
