import { del, download, get, post } from './http';
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
};
