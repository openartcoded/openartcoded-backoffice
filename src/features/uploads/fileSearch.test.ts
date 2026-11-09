import { describe, expect, it } from 'vitest';
import {
  formatValue,
  searchErrorMessage,
  skippedFiles,
  snippet,
  SNIPPET_LENGTH,
  toDisplayHit,
  uploadIdFromFileName,
} from './fileSearch';

describe('file search', () => {
  it('formats tantivy values', () => {
    expect(formatValue([{ Str: 'a' }, { str: 'b' }, 3])).toBe('a, b, 3');
    expect(formatValue(null)).toBe('');
    expect(formatValue({ other: 1 })).toBe('{"other":1}');
  });

  it('maps a hit', () => {
    expect(
      toDisplayHit({ file_name: [{ Str: 'x.xlsx' }], sheet_name: ['S1'], cell_position: ['A1'], cell_value: ['42'] }),
    ).toMatchObject({
      fileName: 'x.xlsx',
      sheet: 'S1',
      position: 'A1',
      content: '42',
      upload: null,
    });
    expect(toDisplayHit({}).fileName).toBe('Unknown file');
  });

  it('only resolves uuid file names', () => {
    expect(uploadIdFromFileName('0c1d2e3f-1234-4abc-8def-0123456789ab.xlsx')).toBe(
      '0c1d2e3f-1234-4abc-8def-0123456789ab',
    );
    expect(uploadIdFromFileName('report.xlsx')).toBeNull();
    expect(uploadIdFromFileName('0c1d2e3f-1234-4abc-8def-0123456789ab.tar/x')).toBeNull();
  });

  it('cuts long contents', () => {
    const long = 'a'.repeat(SNIPPET_LENGTH + 10);
    expect(snippet(long, false)).toHaveLength(SNIPPET_LENGTH + 1);
    expect(snippet(long, true)).toBe(long);
    expect(snippet('short', false)).toBe('short');
  });

  it('lists the skipped files', () => {
    expect(
      skippedFiles({
        discovered: 2,
        indexed: 1,
        skipped: 1,
        pending: 0,
        files: {
          'a.pdf': { digest: 'x', status: 'skipped', reason: null },
          'b.xlsx': { digest: 'y', status: 'indexed', reason: null },
        },
      }),
    ).toEqual([{ name: 'a.pdf', reason: 'No reason provided' }]);
  });

  it('describes search errors', () => {
    expect(searchErrorMessage(503)).toBe('File search is currently unavailable.');
    expect(searchErrorMessage(500)).toBe('Search failed (500).');
    expect(searchErrorMessage(undefined)).toBe('Search failed (network error).');
  });
});
