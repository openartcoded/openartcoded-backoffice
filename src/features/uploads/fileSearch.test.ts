import { describe, expect, it } from 'vitest';
import type { FileSearchV2Hit } from '@/types';
import {
  canSearch,
  emptySearchForm,
  hitLocation,
  hitTitle,
  kindIcon,
  searchErrorMessage,
  skippedFiles,
  snippet,
  snippetParts,
  SNIPPET_LENGTH,
  toSearchParams,
} from './fileSearch';

const hit = (h: Partial<FileSearchV2Hit>): FileSearchV2Hit => ({
  score: 1,
  fileName: 'a.pdf',
  originFileName: 'a.pdf',
  extracted: false,
  kind: 'pdf',
  extension: 'pdf',
  positions: [],
  context: [],
  content: '',
  snippetHtml: '',
  matches: 1,
  ...h,
});

describe('file search', () => {
  it('needs a text or a filter', () => {
    expect(canSearch(emptySearchForm)).toBe(false);
    expect(canSearch({ ...emptySearchForm, q: '  ' })).toBe(false);
    expect(canSearch({ ...emptySearchForm, q: 'facture' })).toBe(true);
    expect(canSearch({ ...emptySearchForm, kinds: ['pdf'] })).toBe(true);
    expect(canSearch({ ...emptySearchForm, modifiedTo: '2026-10-31' })).toBe(true);
  });

  it('sends only the filters set', () => {
    expect(toSearchParams({ ...emptySearchForm, q: ' facture ' }, 0)).toEqual({
      q: 'facture',
      mode: 'smart',
      kinds: undefined,
      fields: undefined,
      extensions: undefined,
      modified_from: undefined,
      modified_to: undefined,
      fuzziness: undefined,
      page: 0,
      per_page: 20,
      group_by_file: true,
    });
    const params = toSearchParams(
      {
        ...emptySearchForm,
        q: 'x',
        mode: 'fuzzy',
        kinds: ['pdf', 'spreadsheet'],
        fields: ['content', 'sheet'],
        extensions: '.PDF, xlsx  csv',
        modifiedFrom: '2026-01-01',
        fuzziness: '2',
        groupByFile: false,
        perPage: 50,
      },
      3,
    );
    expect(params).toMatchObject({
      kinds: 'pdf,spreadsheet',
      fields: 'content,sheet',
      extensions: 'pdf,xlsx,csv',
      modified_from: '2026-01-01',
      fuzziness: 2,
      page: 3,
      per_page: 50,
      group_by_file: false,
    });
    // every field: no field filter; typos only for the smart and fuzzy modes
    const all = toSearchParams(
      {
        ...emptySearchForm,
        q: 'x',
        mode: 'exact',
        fields: ['content', 'file_name', 'sheet', 'context'],
        fuzziness: '1',
      },
      0,
    );
    expect(all.fields).toBeUndefined();
    expect(all.fuzziness).toBeUndefined();
  });

  it('renders the snippet as text, never as html', () => {
    expect(snippetParts('…de la <b>Facture</b> &amp; co &lt;script&gt;<b>2026</b>')).toEqual([
      { text: '…de la ', highlighted: false },
      { text: 'Facture', highlighted: true },
      { text: ' & co <script>', highlighted: false },
      { text: '2026', highlighted: true },
    ]);
    expect(snippetParts('<img src=x onerror=alert(1)>')).toEqual([
      { text: '<img src=x onerror=alert(1)>', highlighted: false },
    ]);
    expect(snippetParts('')).toEqual([]);
  });

  it('titles and locations of hits', () => {
    expect(hitTitle(hit({ upload: { id: 'u', originalFilename: 'receipt.pdf' } }))).toBe('receipt.pdf');
    expect(
      hitTitle(
        hit({
          fileName: 'facture.pdf',
          originFileName: 'u.zip',
          extracted: true,
          upload: { id: 'u', originalFilename: 'factures-2026.zip' },
        }),
      ),
    ).toBe('facture.pdf in factures-2026.zip');
    expect(hitTitle(hit({ fileName: 'notes.txt' }))).toBe('notes.txt');
    expect(hitLocation(hit({ sheetName: 'Sheet1', positions: ['A2', 'B2', 'C2', 'D2', 'E2'] }))).toBe(
      'Sheet1 · A2, B2, C2, D2…',
    );
    expect(hitLocation(hit({ positions: ['chunk 3'] }))).toBe('chunk 3');
    expect(kindIcon('spreadsheet')).toBe('list');
    expect(kindIcon('unknown')).toBe('file');
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
    expect(searchErrorMessage(400, 'invalid regex: unclosed group')).toBe('invalid regex: unclosed group');
    expect(searchErrorMessage(503)).toBe('File search is currently unavailable.');
    expect(searchErrorMessage(500)).toBe('Search failed (500).');
    expect(searchErrorMessage(undefined)).toBe('Search failed (network error).');
  });
});
