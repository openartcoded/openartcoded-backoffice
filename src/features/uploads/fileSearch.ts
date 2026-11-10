import type {
  FileSearchField,
  FileSearchKind,
  FileSearchMode,
  FileSearchParams,
  FileSearchStats,
  FileSearchV2Hit,
} from '@/types';

export const SNIPPET_LENGTH = 250;

export const MODES: { value: FileSearchMode; label: string; description: string }[] = [
  { value: 'smart', label: 'Smart', description: 'every word, its beginning or with a typo' },
  { value: 'exact', label: 'Exact words', description: 'every word exactly' },
  { value: 'prefix', label: 'Word beginnings', description: 'every word or its beginning (factur → facture)' },
  { value: 'fuzzy', label: 'Typos', description: 'every word, letters may differ' },
  { value: 'phrase', label: 'Exact phrase', description: 'the words in this order' },
  { value: 'regex', label: 'Regular expression', description: 'a word matching it, e.g. inv-?202[56]' },
  { value: 'query', label: 'Query syntax', description: 'invoice AND (2026 OR 2027), cell_ctx:amount' },
];

export const KINDS: { value: FileSearchKind; label: string; icon: string }[] = [
  { value: 'pdf', label: 'PDF', icon: 'file-pdf' },
  { value: 'spreadsheet', label: 'Spreadsheets', icon: 'list' },
  { value: 'csv', label: 'CSV', icon: 'file-code' },
  { value: 'document', label: 'Documents', icon: 'file-lines' },
  { value: 'image', label: 'Images', icon: 'file-image' },
  { value: 'text', label: 'Text', icon: 'file' },
];

export const FIELDS: { value: FileSearchField; label: string }[] = [
  { value: 'content', label: 'Content' },
  { value: 'file_name', label: 'File names' },
  { value: 'sheet', label: 'Sheet names' },
  { value: 'context', label: 'Column labels' },
];

export const kindIcon = (kind: string) => KINDS.find((k) => k.value === kind)?.icon ?? 'file';
export const kindLabel = (kind: string) => KINDS.find((k) => k.value === kind)?.label ?? kind;

/** what the search form holds */
export interface SearchFormValues {
  q: string;
  mode: FileSearchMode;
  kinds: FileSearchKind[];
  fields: FileSearchField[];
  extensions: string;
  modifiedFrom: string;
  modifiedTo: string;
  /** '' : automatic */
  fuzziness: string;
  groupByFile: boolean;
  perPage: number;
}

export const emptySearchForm: SearchFormValues = {
  q: '',
  mode: 'smart',
  kinds: [],
  fields: [],
  extensions: '',
  modifiedFrom: '',
  modifiedTo: '',
  fuzziness: '',
  groupByFile: true,
  perPage: 20,
};

/** a text or a filter is needed to search */
export function canSearch(v: SearchFormValues): boolean {
  return !!(v.q.trim() || v.kinds.length || v.extensions.trim() || v.modifiedFrom || v.modifiedTo);
}

/** the parameters of the api for the form and a page (empty filters left out, every field = no field filter) */
export function toSearchParams(v: SearchFormValues, page: number): FileSearchParams {
  const extensions = v.extensions
    .split(/[\s,]+/)
    .map((e) => e.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  const fuzzy = v.mode === 'smart' || v.mode === 'fuzzy';
  return {
    q: v.q.trim(),
    mode: v.mode,
    kinds: v.kinds.length ? v.kinds.join(',') : undefined,
    fields: v.fields.length && v.fields.length < FIELDS.length ? v.fields.join(',') : undefined,
    extensions: extensions.length ? extensions.join(',') : undefined,
    modified_from: v.modifiedFrom || undefined,
    modified_to: v.modifiedTo || undefined,
    fuzziness: fuzzy && v.fuzziness !== '' ? Number(v.fuzziness) : undefined,
    page,
    per_page: v.perPage,
    group_by_file: v.groupByFile,
  };
}

export interface SnippetPart {
  text: string;
  highlighted: boolean;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * The snippet of the file search (html escaped, matching words in <b>) as text parts: rendered as text by react,
 * never as html.
 */
export function snippetParts(html: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let highlighted = false;
  for (const piece of (html ?? '').split(/(<\/?b>)/i)) {
    if (/^<b>$/i.test(piece)) {
      highlighted = true;
    } else if (/^<\/b>$/i.test(piece)) {
      highlighted = false;
    } else if (piece) {
      parts.push({ text: piece.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e), highlighted });
    }
  }
  return parts;
}

/** "facture.pdf" or, for a file of an archive, "facture.pdf in factures-2026.zip" */
export function hitTitle(hit: FileSearchV2Hit): string {
  const upload = hit.upload?.originalFilename || hit.originFileName;
  if (hit.extracted) return `${hit.fileName} in ${upload}`;
  return hit.upload?.originalFilename || hit.fileName || 'Unknown file';
}

/** where the match is: "Sheet1 · A2, B2" or "chunk 3" (first cells only) */
export function hitLocation(hit: FileSearchV2Hit, maxPositions = 4): string {
  const positions =
    hit.positions.length > maxPositions
      ? `${hit.positions.slice(0, maxPositions).join(', ')}…`
      : hit.positions.join(', ');
  return [hit.sheetName, positions].filter(Boolean).join(' · ');
}

export function snippet(content: string, expanded: boolean): string {
  if (expanded || content.length <= SNIPPET_LENGTH) return content;
  return `${content.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

export function skippedFiles(stats?: FileSearchStats | null) {
  return Object.entries(stats?.files ?? {})
    .filter(([, e]) => e.status === 'skipped')
    .map(([name, e]) => ({ name, reason: e.reason || 'No reason provided' }));
}

/** the message of a failed search: the reason of a 400 (wrong regex, date...), otherwise generic */
export function searchErrorMessage(status?: number, message?: string): string {
  if (status === 400 && message) return message;
  if (status === 502 || status === 503) return 'File search is currently unavailable.';
  return `Search failed (${status || 'network error'}).`;
}
