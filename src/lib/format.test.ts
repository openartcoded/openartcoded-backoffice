import { describe, expect, it } from 'vitest';
import { bytesToHuman, fmtCurrency, fmtDate, fromInput, slugify, titleCase, toInputDate, trim } from './format';

describe('format', () => {
  it('formats dates', () => {
    expect(fmtDate('2026-03-05T10:20:00')).toBe('05/03/2026');
    expect(fmtDate('2026-03-05T10:20:00', 'DD/MM/YYYY HH:mm')).toBe('05/03/2026 10:20');
    expect(fmtDate(null)).toBe('');
    expect(fmtDate('not a date')).toBe('');
  });

  it('converts dates for inputs', () => {
    expect(toInputDate(new Date(2026, 0, 9))).toBe('2026-01-09');
    expect(toInputDate(undefined)).toBe('');
    expect(fromInput('')).toBeNull();
    expect(fromInput('2026-01-09')?.getFullYear()).toBe(2026);
  });

  it('formats currency the german/belgian way', () => {
    expect(fmtCurrency(1234.5)).toMatch(/1\.234,50\s€/);
    expect(fmtCurrency(undefined)).toBe('');
  });

  it('converts bytes to a human readable size', () => {
    expect(bytesToHuman(512)).toBe('512 B');
    expect(bytesToHuman(2048)).toBe('2.0 KiB');
    expect(bytesToHuman(1_500_000, true)).toBe('1.5 MB');
  });

  it('trims long text', () => {
    expect(trim('hello world', 5)).toBe('hello...');
    expect(trim('hello', 5)).toBe('hello');
    expect(trim('hello world', 3, false)).toBe('hel');
  });

  it('slugifies titles', () => {
    expect(slugify('  Hello World! 2026 ')).toBe('hello-world-2026');
    expect(slugify('a -- b')).toBe('a-b');
  });

  it('title cases', () => {
    expect(titleCase('hello WORLD')).toBe('Hello World');
  });
});
