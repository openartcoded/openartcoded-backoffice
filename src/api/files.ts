import { del, download, fetchObjectUrl, get, http, post } from './http';
import type { FileUpload, FileUploadSearchCriteria, Page } from '@/types';

const base = '/api/resource';

export const downloadUrl = (id: string) => `${base}/download?id=${encodeURIComponent(id)}`;

export const filesApi = {
  findById: (id: string) => get<FileUpload>(`${base}/find-by-id`, { id }),
  findByIds: async (ids: string[], withThumb = false): Promise<FileUpload[]> =>
    ids.length ? get<FileUpload[]>(`${base}/find-by-ids`, { id: ids, withThumb }) : [],
  findByCorrelationId: (correlationId: string) =>
    get<FileUpload[]>(`${base}/find-by-correlation-id`, { correlationId }),
  correlationLinks: () => post<Record<string, string | null>>(`${base}/correlation-links`),
  /** page is zero based */
  search: (criteria: FileUploadSearchCriteria, page: number, size: number) =>
    post<Page<FileUpload>>(`${base}/find-all`, criteria, { page, size, sort: 'creationDate,DESC' }),
  toggleBookmarked: (id: string) => post<void>(`${base}/toggle-bookmarked`, {}, { id }),
  delete: (id: string) => del<void>(`${base}/delete-by-id`, { id }),
  upload: (file: File, publicResource = false, correlationId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (correlationId) fd.append('correlationId', correlationId);
    fd.append('publicResource', String(publicResource));
    return post<FileUpload>(`${base}/upload`, fd);
  },
  download: (id: string) => download(downloadUrl(id)),
  downloadBulk: (ids: string[]) => download(`${base}/download-bulk`, { method: 'POST', data: ids }),
  objectUrl: (id: string) => fetchObjectUrl(`${base}/download`, { id }),
  text: async (id: string) => (await http.get<string>(`${base}/download`, { params: { id }, responseType: 'text' })).data,
  /** public (unauthenticated) url, used for visible gallery images */
  publicUrl: (id: string) => `${http.defaults.baseURL ?? ''}${base}/public/download/${id}`,
};

export const isImage = (contentType?: string) => !!contentType?.includes('image/');
export const isPdf = (contentType?: string) => contentType === 'application/pdf';
export const isXml = (contentType?: string) => contentType === 'application/xml' || contentType === 'text/xml';
