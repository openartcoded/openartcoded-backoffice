/** how a preview is shown: a pdf / an html page in a frame, the rest as text */
export type PreviewKind = 'pdf' | 'html' | 'text';

export function previewKind(contentType?: string | null): PreviewKind {
  const ct = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (ct === 'application/pdf') return 'pdf';
  if (ct === 'text/html') return 'html';
  return 'text';
}

/** the mock data typed in the editor, as a json object (an error message when it is not one) */
export function parseContext(text: string): { context?: Record<string, unknown>; error?: string } {
  if (!text.trim()) return { context: undefined };
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'the preview data must be a json object: { "invoice": { ... } }' };
    }
    return { context: value as Record<string, unknown> };
  } catch (e) {
    return { error: `invalid json: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const INDENT = '  ';

/**
 * tab in the source editor: indents (shift: unindents) the selected lines, or inserts two spaces.
 * Returns the new value and selection.
 */
export function indent(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): { value: string; start: number; end: number } {
  const multiline = value.slice(start, end).includes('\n');
  if (!multiline && !outdent) {
    return {
      value: value.slice(0, start) + INDENT + value.slice(end),
      start: start + INDENT.length,
      end: start + INDENT.length,
    };
  }
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lines = value.slice(lineStart, end).split('\n');
  let removedFirst = 0;
  let delta = 0;
  const changed = lines.map((line, i) => {
    if (!outdent) {
      delta += INDENT.length;
      return INDENT + line;
    }
    const removed = line.startsWith(INDENT) ? INDENT.length : line.startsWith(' ') || line.startsWith('\t') ? 1 : 0;
    if (i === 0) removedFirst = removed;
    delta -= removed;
    return line.slice(removed);
  });
  const next = value.slice(0, lineStart) + changed.join('\n') + value.slice(end);
  const newStart = outdent ? Math.max(lineStart, start - removedFirst) : start + INDENT.length;
  return { value: next, start: newStart, end: end + delta };
}

/** text of a blob (FileReader where Blob.text is missing, e.g. jsdom) */
export function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
