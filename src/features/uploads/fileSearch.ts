import type { FileSearchHit, FileSearchStats, FileUpload } from '@/types';

export interface DisplayHit {
  fileName: string;
  sheet: string;
  position: string;
  context: string;
  content: string;
  upload: FileUpload | null;
}

export const SNIPPET_LENGTH = 250;

/** tantivy serializes each stored field as an array of typed values ({ Str: '...' }) */
export function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('Str' in obj) return formatValue(obj.Str);
    if ('str' in obj) return formatValue(obj.str);
    return JSON.stringify(value);
  }
  return '';
}

export function toDisplayHit(hit: FileSearchHit): DisplayHit {
  return {
    fileName: formatValue(hit.file_name) || 'Unknown file',
    sheet: formatValue(hit.sheet_name),
    position: formatValue(hit.cell_position),
    context: formatValue(hit.cell_ctx),
    content: formatValue(hit.cell_value),
    upload: null,
  };
}

/**
 * The index stores file names, not upload ids. Only exact uuid file names (with an optional extension)
 * are resolved through the upload api, a file name is never assumed to be an id otherwise.
 */
export function uploadIdFromFileName(fileName: string): string | null {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.[^./]+)?$/i.exec(fileName);
  return match ? match[1] : null;
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

export function searchErrorMessage(status?: number, message?: string): string {
  if (status === 502 || status === 503) return 'File search is currently unavailable.';
  if (message === 'Unexpected response from file-search.') return message;
  return `Search failed (${status || 'network error'}).`;
}
