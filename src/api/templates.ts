import axios from 'axios';
import { del, download, get, http, post } from './http';
import type { OaTemplate, TemplateForm, TemplateType, TemplateTypeInfo } from '@/types';

const tpl = '/api/template';

/**
 * Every template (invoice, cv, timesheet, peppol, email...). Per type: any number of v1 (FreeMarker) and v2 (jinja,
 * rendered by the file service) templates, one of them the default: the one rendered.
 */
export const templatesApi = {
  types: () => get<TemplateTypeInfo[]>(`${tpl}/types`),
  /** not deleted, latest first */
  list: (type?: TemplateType) => get<OaTemplate[]>(`${tpl}/list`, type ? { type } : undefined),
  findById: (id: string) => get<OaTemplate>(`${tpl}/find-by-id`, { id }),
  /** makes the template the default of its type (the previous default stops being one) */
  setDefault: (id: string) => post<OaTemplate>(`${tpl}/default`, {}, { id }),
  /** adds a template, or overwrites the one with this id */
  save: (form: TemplateForm) => {
    const fd = new FormData();
    if (form.id) fd.append('id', form.id);
    fd.append('name', form.name);
    if (form.description) fd.append('description', form.description);
    fd.append('type', form.type);
    fd.append('v1', String(form.v1));
    fd.append('default', String(form.makeDefault));
    if (form.file) fd.append('template', form.file);
    return post<OaTemplate>(`${tpl}/save`, fd);
  },
  /** refused for the default template */
  delete: (id: string) => del<void>(tpl, { id }),
  download: (t: OaTemplate) => download(`${tpl}/download`, { params: { id: t.id } }, t.name ?? 'template'),
  /** the variables a v2 template reads (e.g. invoice.total). Empty for a v1 template */
  variables: (id: string) => get<string[]>(`${tpl}/variables`, { id }),
  /** the source of a template, as text (to edit it) */
  source: async (id: string) =>
    (await http.get<string>(`${tpl}/download`, { params: { id }, responseType: 'text' })).data,
  /** mock data for a preview: the variables the source reads, with values of a plausible type */
  mockContext: (opts: { id?: string; source?: string; extension?: string }) =>
    post<Record<string, unknown>>(`${tpl}/mock-context`, previewForm(opts)),
  /**
   * renders a template without saving it: the given source (the one being edited) or the saved template, with the
   * given data (a mock built by the backend when omitted)
   */
  preview: async (opts: {
    id?: string;
    type: TemplateType;
    v1?: boolean;
    source?: string;
    extension?: string;
    context?: Record<string, unknown>;
  }): Promise<{ blob: Blob; contentType: string }> => {
    const fd = previewForm(opts);
    fd.append('type', opts.type);
    if (opts.v1 !== undefined) fd.append('v1', String(opts.v1));
    if (opts.context) fd.append('context', JSON.stringify(opts.context));
    try {
      const res = await http.post<Blob>(`${tpl}/preview`, fd, { responseType: 'blob' });
      const contentType = String(res.headers['content-type'] ?? res.data.type ?? '');
      return { blob: res.data, contentType };
    } catch (e) {
      throw await withBlobMessage(e);
    }
  },
};

function previewForm({ id, source, extension }: { id?: string; source?: string; extension?: string }) {
  const fd = new FormData();
  if (id) fd.append('id', id);
  if (source !== undefined) {
    fd.append('template', new File([source], `template${extension ?? '.html'}`, { type: 'text/plain' }));
  }
  return fd;
}

/** a blob error body ({"error": "..."}) read as json, so errorMessage shows the message of the backend */
async function withBlobMessage(e: unknown) {
  if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
    const text = await e.response.data.text();
    try {
      e.response.data = JSON.parse(text);
    } catch {
      e.response.data = text;
    }
  }
  return e;
}
