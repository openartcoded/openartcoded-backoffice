import { del, download, get, post } from './http';
import type {
  AdministrativeDocument,
  AdministrativeDocumentForm,
  AdministrativeDocumentSearchCriteria,
  BackendInvoiceSummary,
  BillableClient,
  ContractStatus,
  Dossier,
  DossierSummary,
  DossiersOfYear,
  Fee,
  FeeManualForm,
  FeeSearchCriteria,
  FeeSummary,
  Invoice,
  Label,
  Page,
  PeppolValidationResult,
  SortCriteria,
} from '@/types';

const sortParam = (s: SortCriteria) => `${s.property},${s.direction}`;

export const clientsApi = {
  findAll: () => get<BillableClient[]>('/api/billable-client/find-all'),
  findByContractStatus: (contractStatus: ContractStatus) =>
    get<BillableClient[]>('/api/billable-client/find-by-contract-status', { contractStatus }),
  save: (client: BillableClient) => post<BillableClient>('/api/billable-client/save', client),
  delete: (id: string) => del<void>('/api/billable-client', { id }),
  upload: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('document', file);
    fd.append('id', id);
    return post<void>('/api/billable-client/upload', fd);
  },
  deleteUpload: (id: string, uploadId: string) => del<void>('/api/billable-client/upload', { id, uploadId }),
};

const inv = '/api/invoice';
export const invoicesApi = {
  /** page is zero based */
  search: (opts: {
    archived?: boolean;
    logical?: boolean;
    bookmarked?: boolean;
    page: number;
    size: number;
    sort: SortCriteria;
  }) =>
    opts.bookmarked
      ? get<Page<Invoice>>(`${inv}/bookmarked`, { page: opts.page, size: opts.size, sort: sortParam(opts.sort) })
      : post<Page<Invoice>>(
          `${inv}/page`,
          {},
          {
            archived: !!opts.archived,
            logical: !!opts.logical,
            page: opts.page,
            size: opts.size,
            sort: sortParam(opts.sort),
          },
        ),
  findAllSummaries: () => post<BackendInvoiceSummary[]>(`${inv}/find-all-summaries`),
  findById: (id: string) => post<Invoice>(`${inv}/find-by-id`, {}, { id }),
  findByIds: async (ids: string[]) => (ids.length ? post<Invoice[]>(`${inv}/find-by-ids`, {}, { id: ids }) : []),
  toggleBookmarked: (id: string) => post<void>(`${inv}/toggle-bookmarked`, {}, { id }),
  newInvoice: () => post<Invoice>(`${inv}/new`),
  fromTemplate: (id: string) => post<Invoice>(`${inv}/from-template`, {}, { id }),
  save: (invoice: Invoice) => post<Invoice>(`${inv}/save`, invoice),
  makeCreditNote: (id: string) => post<Invoice>(`${inv}/make-credit-note`, {}, { id }),
  manualUpload: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('manualUploadFile', file);
    return post<Invoice>(`${inv}/manual-upload`, fd);
  },
  delete: (id: string, logical: boolean) => del<void>(inv, { id, logical }),
  restore: (id: string) => post<void>(`${inv}/restore`, {}, { id }),
  sendToPeppol: (id: string) => post<void>(`${inv}/send-to-peppol`, {}, { id }),
  validatePeppol: (id: string) => post<PeppolValidationResult>(`${inv}/validate-peppol`, {}, { id }),
};

const fee = '/api/fee';
export const feesApi = {
  /** page is zero based */
  search: (criteria: FeeSearchCriteria, page: number, size: number) =>
    post<Page<Fee>>(`${fee}/search`, criteria, { page, size, sort: 'date,DESC' }),
  findById: (id: string) => post<Fee>(`${fee}/find-by-id`, {}, { id }),
  findByIds: async (ids: string[]) => (ids.length ? post<Fee[]>(`${fee}/find-by-ids`, {}, { id: ids }) : []),
  updateTag: (feeIds: string[], tag: string) => post<Fee[]>(`${fee}/update-tag`, feeIds, { tag }),
  toggleBookmarked: (id: string) => post<void>(`${fee}/toggle-bookmarked`, {}, { id }),
  updatePrice: (id: string, priceHVat: number, vat: number) =>
    post<Fee>(`${fee}/update-price`, {}, { id, priceHVat, vat }),
  addAttachment: (id: string, file: File, isPaymentProof: boolean) => {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('isPaymentProof', String(isPaymentProof));
    fd.append('file', file);
    return post<Fee>(`${fee}/add-attachment`, fd);
  },
  removeAttachment: (id: string, attachmentId: string) =>
    post<Fee>(`${fee}/remove-attachment`, {}, { id, attachmentId }),
  update: (f: Fee) => post<Fee>(`${fee}/update`, f),
  manualSubmit: (form: FeeManualForm) => {
    const fd = new FormData();
    form.files.forEach((f) => fd.append('files', f));
    fd.append('subject', form.subject);
    fd.append('body', form.body);
    return post<Fee>(`${fee}/manual-submit`, fd);
  },
  delete: (id: string) => del<void>(fee, { id }),
  summaries: () => post<FeeSummary[]>(`${fee}/summaries`),
};

export const labelsApi = {
  findAll: () => post<Label[]>('/api/label/find-all'),
  updateAll: (labels: Label[]) => post<Label[]>('/api/label/update-all', labels),
};

const dos = '/api/dossier';
export const dossiersApi = {
  /** page is zero based */
  findAllPaged: (closed: boolean, page: number, size: number, sort: SortCriteria) =>
    post<Page<Dossier>>(`${dos}/find-all-paged`, {}, { closed, page, size, sort: sortParam(sort) }),
  bookmarked: (page: number, size: number, sort: SortCriteria) =>
    post<Page<Dossier>>(`${dos}/bookmarked`, {}, { page, size, sort: sortParam(sort) }),
  toggleBookmarked: (id: string) => post<void>(`${dos}/toggle-bookmarked`, {}, { id }),
  size: (id: string) => post<number>(`${dos}/size`, {}, { id }),
  fromPrevious: () => post<Dossier>(`${dos}/new-from-previous`),
  import: (file: File) => {
    const fd = new FormData();
    fd.append('zip', file);
    return post<void>(`${dos}/import`, fd);
  },
  importExample: () => download(`${dos}/import-example`),
  allSummaries: (closed: boolean) => post<DossierSummary[]>(`${dos}/find-all-summaries`, {}, { closed }),
  generateSummary: (id: string) => download(`${dos}/generate-summary`, { params: { id } }),
  /**
   * pdf report of the dossier compared with the previous years: every month of the dossier,
   * or only one month (yyyy-MM, e.g. 2026-10)
   */
  generateReport: (id: string, month?: string) =>
    download(`${dos}/generate-report`, { params: month ? { id, month } : { id } }, 'report.pdf'),
  /**
   * pdf annual report: every dossier of the year compared with the other years, and the projection of the last
   * three years (january to now for the current year)
   */
  generateAnnualReport: (year: number) =>
    download(`${dos}/generate-annual-report`, { params: { year } }, `annual-report-${year}.pdf`),
  /** the closed dossiers by year, the most recent year first */
  closedByYear: () => post<DossiersOfYear[]>(`${dos}/closed-by-year`),
  processFees: (feeIds: string[]) => post<void>(`${dos}/process-fees`, feeIds),
  removeFee: (feeId: string) => post<Dossier>(`${dos}/remove-fee`, {}, { feeId }),
  newDossier: (d: Dossier) => post<Dossier>(`${dos}/new-dossier`, d),
  updateDossier: (d: Dossier) => post<Dossier>(`${dos}/update-dossier`, d),
  recallForModification: (d: Dossier) => post<Dossier>(`${dos}/recall-for-modification`, d),
  closeActiveDossier: () => post<Dossier>(`${dos}/close-active-dossier`),
  activeDossier: () => post<Dossier | null>(`${dos}/active-dossier`),
  processInvoice: (id: string) => post<void>(`${dos}/process-invoice`, {}, { id }),
  removeInvoice: (id: string) => post<Dossier>(`${dos}/remove-invoice`, {}, { id }),
  addDocument: (id: string) => post<void>(`${dos}/add-document`, {}, { id }),
  removeDocument: (id: string) => post<Dossier>(`${dos}/remove-document`, {}, { id }),
  deleteActiveDossier: () => del<void>(`${dos}/active-dossier`),
};

const doc = '/api/administrative-document';
export const documentsApi = {
  /** page is zero based */
  search: (criteria: AdministrativeDocumentSearchCriteria, page: number, size: number) =>
    post<Page<AdministrativeDocument>>(`${doc}/search`, criteria, { page, size, sort: 'dateCreation,DESC' }),
  findByIds: async (ids: string[]) =>
    ids.length ? post<AdministrativeDocument[]>(`${doc}/find-by-ids`, {}, { id: ids }) : [],
  save: (form: AdministrativeDocumentForm) => {
    const fd = new FormData();
    if (form.document) fd.append('document', form.document);
    fd.append('title', form.title);
    if (form.id) fd.append('id', form.id);
    fd.append('description', form.description ?? '');
    fd.append('tags', (form.tags ?? []).join(','));
    return post<void>(`${doc}/save`, fd);
  },
  delete: (id: string) => del<void>(doc, { id }),
  toggleBookmarked: (id: string) => post<void>(`${doc}/toggle-bookmarked`, {}, { id }),
};

export const pdfApi = {
  split: (file: File) => {
    const fd = new FormData();
    fd.append('pdf', file);
    return download('/api/pdf/split', { method: 'POST', data: fd });
  },
  rotate: (id: string, rotation: number) => post<void>('/api/pdf/rotate', {}, { id, rotation }),
};
