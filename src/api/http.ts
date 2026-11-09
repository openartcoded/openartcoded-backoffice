import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Single axios instance used by every api module.
 * Base url, token provider and the unauthorized handler are configured at bootstrap (see main.tsx).
 */
export const http = axios.create({
  // id=1&id=2 instead of id[]=1&id[]=2 (what spring expects)
  paramsSerializer: { indexes: null },
});

type TokenProvider = () => Promise<string | undefined>;

let tokenProvider: TokenProvider = async () => undefined;
let unauthorizedHandler: () => void = () => {};

export function configureHttp(opts: { baseURL: string; getToken: TokenProvider; onUnauthorized: () => void }) {
  http.defaults.baseURL = opts.baseURL;
  tokenProvider = opts.getToken;
  unauthorizedHandler = opts.onUnauthorized;
}

http.interceptors.request.use(async (cfg) => {
  const token = await tokenProvider();
  if (token) {
    cfg.headers.set('Authorization', `Bearer ${token}`);
  }
  return cfg;
});

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export async function get<T>(url: string, params?: object): Promise<T> {
  return (await http.get<T>(url, { params })).data;
}

export async function post<T>(url: string, body?: unknown, params?: object): Promise<T> {
  return (await http.post<T>(url, body ?? {}, { params })).data;
}

export async function del<T>(url: string, params?: object): Promise<T> {
  return (await http.delete<T>(url, { params })).data;
}

export async function postText(url: string, body: unknown): Promise<string> {
  return (await http.post<string>(url, body, { responseType: 'text' })).data;
}

/** extracts the filename from a content-disposition header */
export function filenameFromDisposition(header?: string | null, fallback = 'download'): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1].trim());
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** downloads an authenticated resource and triggers the browser "save as" */
export async function download(url: string, config: AxiosRequestConfig = {}) {
  const res = await http.request<Blob>({ url, method: 'GET', ...config, responseType: 'blob' });
  const header = res.headers['content-disposition'] as string | undefined;
  saveBlob(res.data, filenameFromDisposition(header));
}

/** fetches an authenticated resource as an object url (images, pdf preview, ...) */
export async function fetchObjectUrl(url: string, params?: object): Promise<string> {
  const res = await http.get<Blob>(url, { params, responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

export async function fetchBlob(url: string, params?: object): Promise<Blob> {
  return (await http.get<Blob>(url, { params, responseType: 'blob' })).data;
}

/** human readable error message from an api error */
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (typeof data === 'string' && data.length) return data;
    if (data && typeof data === 'object' && 'message' in data) return String((data as { message: unknown }).message);
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
