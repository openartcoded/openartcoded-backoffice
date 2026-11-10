import type { DateLike } from './common';

// ---------- billable clients ----------
export type RateType = 'DAYS' | 'HOURS';
export const RATE_TYPES: RateType[] = ['DAYS', 'HOURS'];

export type ContractStatus = 'NOT_STARTED_YET' | 'ONGOING' | 'DONE';
export const CONTRACT_STATUSES: ContractStatus[] = ['NOT_STARTED_YET', 'ONGOING', 'DONE'];

export type WorkingDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';
export const WORKING_DAYS: WorkingDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

export interface ClientRate {
  id?: string;
  label?: string;
  rate?: number;
  rateType?: RateType;
}

export interface BillableClient {
  id?: string;
  maxDaysToPay?: number;
  countryCode?: string;
  rate?: number;
  student?: boolean;
  taxRate?: number;
  nature?: string;
  rateType?: RateType;
  /** one or many rates, the first one is the default */
  rates?: ClientRate[];
  projectName?: string;
  vatNumber?: string;
  address?: string;
  city?: string;
  name?: string;
  emailAddress?: string;
  phoneNumber?: string;
  contractStatus?: ContractStatus;
  startDate?: DateLike | null;
  endDate?: DateLike | null;
  documentIds?: string[];
  imported?: boolean;
  importedDate?: DateLike;
  defaultWorkingDays?: WorkingDay[];
}

// ---------- invoices ----------
export type PeppolStatus = 'OLD' | 'NOT_SENT' | 'PROCESSING' | 'SUCCESS';

export interface InvoiceRow {
  projectName?: string;
  period?: string;
  nature?: string;
  total?: number;
  hoursPerDay?: number;
  amountType?: RateType;
  rateType?: RateType;
  amount?: number;
  rate?: number;
}

export interface BillTo {
  vatNumber?: string;
  address?: string;
  emailAddress?: string;
  city?: string;
  clientName?: string;
}

export interface Invoice {
  id?: string;
  creditNote?: boolean;
  creditNoteId?: string;
  creditNoteInvoiceReference?: string;
  structuredReference?: string;
  timesheetId?: string;
  seqInvoiceNumber?: number;
  peppolStatus?: PeppolStatus;
  invoiceNumber?: string;
  newInvoiceNumber?: string;
  maxDaysToPay?: number;
  dateOfInvoice?: DateLike;
  dateCreation?: DateLike;
  dueDate?: DateLike;
  billTo?: BillTo;
  invoiceTable?: InvoiceRow[];
  locked?: boolean;
  archived?: boolean;
  freemarkerTemplateId?: string | null;
  logicalDelete?: boolean;
  bookmarked?: boolean;
  bookmarkedDate?: DateLike;
  uploadedManually?: boolean;
  skipPeppol?: boolean;
  invoiceUploadId?: string;
  invoiceUBLId?: string;
  subTotal?: number;
  taxable?: number;
  taxes?: number;
  total?: number;
  taxRate?: number;
  imported?: boolean;
  importedDate?: DateLike;
  specialNote?: string;
}

export interface BackendInvoiceSummary {
  period?: string;
  amount?: number;
  hoursPerDay?: number;
  client?: string;
  amountType?: string;
  subTotal?: number;
  dateOfInvoice?: DateLike;
}

export interface PeppolValidationResult {
  valid: boolean;
  results: string;
}

// ---------- templates ----------
/** what a template renders (see the backend OaTemplateType) */
export type TemplateType =
  | 'INVOICE'
  | 'CV'
  | 'TIMESHEET'
  | 'PEPPOL_INVOICE'
  | 'PEPPOL_CREDIT_NOTE'
  | 'EMAIL'
  | 'ACTION'
  | 'SMS'
  | 'CALENDAR'
  | 'DOSSIER_REPORT';

/** V1: FreeMarker, rendered by the backend. V2: jinja, stored and rendered by the file service */
export type TemplateVersion = 'V1' | 'V2';

export type TemplateOutput = 'PDF' | 'XML' | 'TEXT';

export interface TemplateTypeInfo {
  type: TemplateType;
  output: TemplateOutput;
  /** extension of the file of a v2 template of this type */
  extension: string;
}

/** a template, whatever its version. One template per type is the default: the one rendered */
export interface OaTemplate {
  id?: string;
  name?: string;
  description?: string | null;
  type?: TemplateType;
  version?: TemplateVersion;
  /** v1 only: the uploaded FreeMarker file */
  templateUploadId?: string | null;
  /** v2 only: the template in the file service */
  fileServiceTemplateId?: string | null;
  dateCreation?: string;
  updatedDate?: string | null;
  defaultTemplate?: boolean;
  logicalDelete?: boolean;
}

/** add (no id) or overwrite (id) a template */
export interface TemplateForm {
  id?: string;
  name: string;
  description?: string;
  type: TemplateType;
  v1: boolean;
  makeDefault: boolean;
  /** optional on an overwrite keeping the version (rename only) */
  file?: File;
}

// ---------- fees / expenses ----------
export interface Fee {
  id: string;
  dateCreation?: DateLike;
  updatedDate?: DateLike;
  date?: DateLike;
  subject: string;
  body: string;
  attachmentIds: string[];
  paymentProofUploadId?: string;
  archived?: boolean;
  archivedDate?: DateLike;
  tag?: string;
  priceHVAT?: number;
  vat?: number;
  priceTot?: number;
  imported?: boolean;
  bookmarked?: boolean;
  importedDate?: DateLike;
}

export interface Label {
  id?: string | null;
  hidden?: boolean;
  name?: string;
  colorHex?: string;
  description?: string;
  priceHVAT?: number;
  vat?: number;
  noDefaultPrice?: boolean;
}

export interface FeeSearchCriteria {
  id?: string | null;
  dateBefore?: DateLike | null;
  dateAfter?: DateLike | null;
  subject?: string | null;
  body?: string | null;
  archived?: boolean;
  bookmarked?: boolean;
  tag?: string | null;
  hasPaymentProof?: boolean | null;
}

export interface FeeManualForm {
  subject: string;
  body: string;
  files: File[];
}

export interface FeeSummary {
  tag?: string;
  totalHVAT?: number;
  totalVAT?: number;
}

// ---------- dossiers ----------
export interface TvaAdvancePayment {
  datePaid?: DateLike | null;
  advance?: number;
}

export interface Dossier {
  id?: string;
  creationDate?: DateLike;
  updatedDate?: DateLike;
  name: string | null;
  tvaDue?: number;
  advancePayments?: TvaAdvancePayment[];
  description?: string;
  feeIds?: string[];
  invoiceIds?: string[];
  documentIds?: string[];
  closed?: boolean;
  closedDate?: DateLike;
  recalledForModification?: boolean;
  tvaToBePaid?: number;
  recalledForModificationDate?: DateLike;
  dossierUploadId?: string;
  imported?: boolean;
  importedDate?: DateLike;
  bookmarked?: boolean;
  comment?: string;
}

/** the closed dossiers of a year (the year of most of their invoices) */
export interface DossiersOfYear {
  year: number;
  dossiers: Dossier[];
}

export interface DossierSummary {
  closedDate: DateLike;
  name?: string;
  totalExpenses?: number;
  totalEarnings?: number;
}

// ---------- administrative documents ----------
export interface AdministrativeDocument {
  id?: string;
  dateCreation?: DateLike;
  updatedDate?: DateLike;
  title: string;
  description?: string;
  tags?: string[];
  attachmentId?: string;
  bookmarked?: boolean;
  locked?: boolean;
}

export interface AdministrativeDocumentSearchCriteria {
  dateBefore?: DateLike | null;
  dateAfter?: DateLike | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  bookmarked: boolean;
}

export interface AdministrativeDocumentForm {
  id?: string;
  title: string;
  description?: string;
  tags: string[];
  document?: File | null;
}

// ---------- personal info ----------
export interface Accountant {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  emailHook?: boolean;
  expenseReceiveEmailHook?: string;
}

export interface PersonalInfo {
  id?: string;
  countryCode?: string;
  organizationName?: string;
  vatNumber?: string;
  organizationAddress?: string;
  organizationPostCode?: string;
  organizationCity?: string;
  organizationBankAccount?: string;
  organizationBankBIC?: string;
  organizationPhoneNumber?: string;
  /** optional, empty by default */
  organizationSecondPhoneNumber?: string;
  organizationEmailAddress?: string;
  financeCharge?: number;
  ceoFullName?: string;
  note?: string;
  logoUploadId?: string;
  signatureUploadId?: string;
  initialUploadId?: string;
  maxDaysToPay?: number;
  accountants?: Accountant[];
  demoMode?: boolean;
}
