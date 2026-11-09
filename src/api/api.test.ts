import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./http', () => ({
  get: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue([]),
  del: vi.fn().mockResolvedValue(undefined),
  postText: vi.fn().mockResolvedValue(''),
  download: vi.fn().mockResolvedValue(undefined),
  fetchObjectUrl: vi.fn(),
  fetchBlob: vi.fn(),
  http: { defaults: { baseURL: 'http://backend' }, get: vi.fn() },
}));

import { del, download, get, post } from './http';
import { dossiersApi, feesApi, invoicesApi, documentsApi } from './billing';
import { filesApi } from './files';
import { reportApi, tasksApi, timesheetApi } from './misc';

describe('api modules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches fees with zero based page and date sort', async () => {
    await feesApi.search({ archived: false }, 2, 10);
    expect(post).toHaveBeenCalledWith('/api/fee/search', { archived: false }, { page: 2, size: 10, sort: 'date,DESC' });
  });

  it('updates the tag of fees by name', async () => {
    await feesApi.updateTag(['1', '2'], 'TELECOM');
    expect(post).toHaveBeenCalledWith('/api/fee/update-tag', ['1', '2'], { tag: 'TELECOM' });
  });

  it('builds the manual submit form data', async () => {
    const file = new File(['x'], 'a.pdf');
    await feesApi.manualSubmit({ subject: 's', body: 'b', files: [file] });
    const fd = vi.mocked(post).mock.calls[0][1] as FormData;
    expect(fd.get('subject')).toBe('s');
    expect(fd.get('body')).toBe('b');
    expect(fd.getAll('files')).toHaveLength(1);
  });

  it('uses the bookmarked endpoint for bookmarked invoices', async () => {
    await invoicesApi.search({ bookmarked: true, page: 0, size: 10, sort: { property: 'dateCreation', direction: 'DESC' } });
    expect(get).toHaveBeenCalledWith('/api/invoice/bookmarked', { page: 0, size: 10, sort: 'dateCreation,DESC' });
  });

  it('pages invoices with the archived / logical flags', async () => {
    await invoicesApi.search({ archived: true, page: 1, size: 5, sort: { property: 'dateOfInvoice', direction: 'ASC' } });
    expect(post).toHaveBeenCalledWith('/api/invoice/page', {}, { archived: true, logical: false, page: 1, size: 5, sort: 'dateOfInvoice,ASC' });
  });

  it('does not call the backend for an empty list of ids', async () => {
    expect(await filesApi.findByIds([])).toEqual([]);
    expect(await invoicesApi.findByIds([])).toEqual([]);
    expect(await feesApi.findByIds([])).toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('passes repeated ids to find-by-ids', async () => {
    await filesApi.findByIds(['a', 'b'], true);
    expect(get).toHaveBeenCalledWith('/api/resource/find-by-ids', { id: ['a', 'b'], withThumb: true });
  });

  it('deletes invoices logically or for real', async () => {
    await invoicesApi.delete('42', true);
    expect(del).toHaveBeenCalledWith('/api/invoice', { id: '42', logical: true });
  });

  it('removes a fee from the active dossier', async () => {
    await dossiersApi.removeFee('f1');
    expect(post).toHaveBeenCalledWith('/api/dossier/remove-fee', {}, { feeId: 'f1' });
  });

  it('downloads the dossier summary', async () => {
    await dossiersApi.generateSummary('d1');
    expect(download).toHaveBeenCalledWith('/api/dossier/generate-summary', { params: { id: 'd1' } });
  });

  it('saves documents as form data with comma separated tags', async () => {
    await documentsApi.save({ id: 'x', title: 't', description: 'd', tags: ['a', 'b'], document: null });
    const fd = vi.mocked(post).mock.calls[0][1] as FormData;
    expect(fd.get('tags')).toBe('a,b');
    expect(fd.get('id')).toBe('x');
    expect(fd.has('document')).toBe(false);
  });

  it('only sends the rate id of a period when given', async () => {
    await timesheetApi.updatePeriodRate('t', 'p');
    expect(post).toHaveBeenLastCalledWith('/api/timesheet/period-rate', {}, { id: 't', periodId: 'p' });
    await timesheetApi.updatePeriodRate('t', 'p', 'r');
    expect(post).toHaveBeenLastCalledWith('/api/timesheet/period-rate', {}, { id: 't', periodId: 'p', rateId: 'r' });
  });

  it('validates cron expressions', async () => {
    await tasksApi.validateCron('0 0 * * * *');
    expect(get).toHaveBeenCalledWith('/api/reminder-task/validate-cron-expression', { cronExpression: '0 0 * * * *' });
  });

  it('posts channel messages with files', async () => {
    await reportApi.postMessage('p1', 'hello', [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]);
    const fd = vi.mocked(post).mock.calls[0][1] as FormData;
    expect(fd.get('message')).toBe('hello');
    expect(fd.getAll('files')).toHaveLength(2);
  });

  it('builds the public download url', () => {
    expect(filesApi.publicUrl('abc')).toBe('http://backend/api/resource/public/download/abc');
  });
});
