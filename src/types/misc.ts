import type { DateLike } from './common';

// ---------- timesheets ----------
export type PeriodType = 'SICKNESS' | 'PUBLIC_HOLIDAYS' | 'AUTHORIZED_HOLIDAYS' | 'WORKING_DAY' | 'WEEKEND';
export const PERIOD_TYPES: PeriodType[] = [
  'SICKNESS',
  'PUBLIC_HOLIDAYS',
  'AUTHORIZED_HOLIDAYS',
  'WORKING_DAY',
  'WEEKEND',
];

export interface TimesheetSettings {
  id?: string;
  maxHoursPerDay?: number;
  minHoursPerDay?: number;
  defaultProjectName?: string;
}

export interface TimesheetSettingsForm {
  timesheetId: string;
  clientId: string;
  maxHoursPerDay?: number;
  minHoursPerDay?: number;
}

export interface TimesheetPeriod {
  id?: string;
  date?: DateLike;
  duration?: number;
  durationInHours?: string;
  shortDescription?: string;
  projectName?: string;
  /** id of the client's rate chosen for this row, empty means the default rate of the client */
  rateId?: string;
  morningStartTime?: DateLike | null;
  morningEndTime?: DateLike | null;
  afternoonStartTime?: DateLike | null;
  afternoonEndTime?: DateLike | null;
  periodType?: PeriodType;
  dayOfWeek?: string;
}

export interface Timesheet {
  id?: string;
  invoiceId?: string;
  dateCreation?: DateLike;
  name?: string;
  periods?: TimesheetPeriod[];
  closed?: boolean;
  uploadId?: string;
  student?: boolean;
  settings?: TimesheetSettings;
  clientId?: string;
  clientName?: string;
  year?: number;
  month?: number;
  monthEnum?: string;
  numberOfWorkingDays?: number;
  numberOfMinutesWorked?: number;
  numberOfHoursWorked?: string;
}

/** year -> client name -> timesheets */
export type TimesheetsByYearAndClient = Record<string, Record<string, Timesheet[]>>;

// ---------- reminder tasks ----------
export type ActionParameterType =
  'INTEGER' | 'LONG' | 'STRING' | 'BIG_STRING' | 'BOOLEAN' | 'DOUBLE' | 'BIGDECIMAL' | 'BIGINTEGER' | 'OPTION';

export interface ActionParameter {
  key?: string;
  required?: boolean;
  value?: string | null;
  parameterType?: ActionParameterType;
  description?: string;
  options?: Record<string, string>;
}

export interface ActionMetadata {
  key?: string;
  title?: string;
  description?: string;
  allowedParameters?: ActionParameter[];
  defaultCronValue?: string;
}

export interface ReminderTask {
  id?: string;
  inAppNotification?: boolean;
  dateCreation?: DateLike;
  calendarDate?: DateLike | null;
  lastExecutionDate?: DateLike;
  updatedDate?: DateLike;
  nextDate?: DateLike;
  specificDate?: DateLike | null;
  cronExpression?: string | null;
  title: string;
  description: string;
  disabled: boolean;
  sendMail?: boolean;
  sendSms?: boolean;
  persistResult?: boolean;
  actionKey?: string | null;
  customActionName?: string | null;
  actionParameters?: ActionParameter[] | null;
}

export type StatusType = 'SUCCESS' | 'FAILURE' | 'UNKNOWN';

export interface ActionResult {
  status?: StatusType;
  actionKey?: string;
  id?: string;
  createdDate?: DateLike;
  finishedDate?: DateLike;
  startedDate?: DateLike;
  messages?: string[];
  parameters?: ActionParameter[];
}

// ---------- reports ----------
export type PostStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING' | 'DONE' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type PostItType = 'TODOS' | 'IN_PROGRESS' | 'DONE';

export interface PostIt {
  id?: string;
  creationDate?: DateLike;
  updatedDate?: DateLike;
  note: string;
}

export interface Post {
  id?: string;
  author?: string;
  description: string;
  unreadCount?: number;
  title: string;
  priority?: Priority;
  dueDate?: DateLike;
  bookmarked?: boolean;
  content?: string;
  creationDate?: DateLike;
  attachmentIds?: string[];
  processedAttachmentIds?: string[];
  updatedDate?: DateLike;
  coverId?: string;
  tags?: string[];
  status?: PostStatus;
  todos?: PostIt[];
  inProgress?: PostIt[];
  done?: PostIt[];
}

export interface Message {
  id?: string;
  creationDate?: DateLike;
  emailFrom?: string;
  content?: string;
  attachmentIds?: string[];
  read?: boolean;
}

export interface Channel {
  id: string;
  subscribers: string[];
  messages: Message[];
  creationDate?: DateLike;
  correlationId?: string;
  updatedDate?: DateLike;
}

export interface UnreadMessagesCounter {
  status: PostStatus;
  subscriber: string;
  counter: number;
}

export interface PostSearchCriteria {
  title?: string | null;
  priority?: Priority | null;
  content?: string | null;
  tag?: string | null;
  bookmarked?: boolean | null;
  status?: PostStatus | null;
}

// ---------- curriculum ----------
export interface Person {
  firstname?: string;
  lastname?: string;
  title?: string;
  phoneNumber?: string;
  birthdate?: DateLike | null;
  emailAddress?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  address?: string;
  website?: string;
}

export interface PersonalProject {
  name?: string | null;
  url?: string | null;
  description?: string | null;
}

export interface Skill {
  name: string;
  softSkill: boolean;
  hardSkill: boolean;
  tags: string[];
  priority?: number;
}

export interface Experience {
  uuid?: string;
  from: DateLike | null;
  to?: DateLike | null;
  current: boolean;
  title: string;
  description: string[];
  company: string;
}

export interface Hobby {
  title: string;
}

export interface ScholarHistory {
  from: DateLike | null;
  to?: DateLike | null;
  current: boolean;
  title: string;
  school: string;
}

export interface Curriculum {
  id?: string;
  experiences?: Experience[];
  skills?: Skill[];
  personalProjects?: PersonalProject[];
  scholarHistories?: ScholarHistory[];
  hobbies?: Hobby[];
  person?: Person;
  introduction?: string;
  freemarkerTemplateId?: string;
  updatedDate?: DateLike;
}

export interface DownloadCvRequest {
  id?: string;
  email: string;
  phoneNumber?: string;
  htmlContent?: string;
  dailyRate?: boolean;
  availability?: boolean;
  dateReceived?: DateLike;
}

// ---------- finance ----------
export interface Tick {
  addedDate?: DateLike;
  priceWhenAdded: number;
  symbol?: string;
  currency: string;
}

export interface Portfolio {
  id?: string;
  dateCreation?: DateLike;
  updatedDate?: DateLike;
  name: string;
  principal?: boolean;
  ticks?: Tick[];
}

// ---------- home / misc ----------
export interface Todo {
  id?: string;
  title: string;
  done: boolean;
}

export interface MemoDate {
  id?: string;
  dateSince?: DateLike;
  label?: string;
}

export interface Memz {
  id?: string;
  title: string;
  description: string;
  createdDate?: DateLike;
  updatedDate?: DateLike;
  dateOfVisibility?: DateLike;
  visible: boolean;
  imageUploadId?: string;
  thumbnailUploadId?: string;
  viewsCount?: number;
}

export interface FormContact {
  id?: string;
  fullName: string;
  bestTimeToCall: string;
  email: string;
  phoneNumber: string;
  subject: string;
  body: string;
  creationDate?: DateLike;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  consumeEvent: boolean;
}

export interface UserScript {
  id?: string;
  content: string;
  creationDate?: DateLike;
  updatedDate?: DateLike;
}

export interface BackendInfo {
  build: { version?: string; time?: DateLike; name?: string; artifact?: string };
  [key: string]: unknown;
}

export interface HealthComponent {
  status: string;
  details?: Record<string, unknown>;
}

export interface HealthIndicator {
  status: string;
  components?: {
    diskSpace?: { status: string; details: { total: number; free: number } };
    jms?: HealthComponent;
    mail?: HealthComponent;
    mongo?: HealthComponent;
    redis?: HealthComponent;
    [key: string]: unknown;
  };
}

// ---------- file search (rust/tantivy proxy) ----------
/** pdf, spreadsheet, csv, document, image, text */
export type FileSearchKind = 'pdf' | 'spreadsheet' | 'csv' | 'document' | 'image' | 'text';

/** how the words are matched (see the file-search README) */
export type FileSearchMode = 'smart' | 'exact' | 'prefix' | 'fuzzy' | 'phrase' | 'regex' | 'query';

export type FileSearchField = 'content' | 'file_name' | 'sheet' | 'context';

/** query parameters of /api/file-search/v2/search */
export interface FileSearchParams {
  q: string;
  mode: FileSearchMode;
  fields?: string;
  kinds?: string;
  extensions?: string;
  modified_from?: string;
  modified_to?: string;
  fuzziness?: number;
  page: number;
  per_page: number;
  group_by_file: boolean;
  snippet_chars?: number;
}

/** the upload of a hit (the archive for a file extracted from it) */
export interface FileSearchUpload {
  id: string;
  originalFilename?: string | null;
  contentType?: string | null;
  size?: number;
  creationDate?: string | null;
  correlationId?: string | null;
  /** what the upload belongs to: "Expense 'Hosting'"... */
  correlationLabel?: string | null;
}

export interface FileSearchV2Hit {
  score: number;
  /** the file indexed: the upload, or a file of an uploaded archive */
  fileName: string;
  originFileName: string;
  extracted: boolean;
  kind: FileSearchKind | string;
  extension: string;
  sheetName?: string | null;
  /** cells (A2, B2...) or chunk ("chunk 3") */
  positions: string[];
  /** column labels */
  context: string[];
  content: string;
  /** html escaped, the matching words in <b> */
  snippetHtml: string;
  /** yyyy-mm-dd */
  modifiedAt?: string | null;
  /** matching rows / chunks in the file */
  matches: number;
  upload?: FileSearchUpload | null;
}

export interface FileSearchResult {
  hits: FileSearchV2Hit[];
  page: number;
  perPage: number;
  hasMore: boolean;
  totalMatches: number;
  tookMs: number;
}

export interface FileIngestionEntry {
  digest: string;
  status: string;
  reason: string | null;
}

export interface FileSearchStats {
  discovered: number;
  indexed: number;
  skipped: number;
  duplicate?: number;
  pending: number;
  /** indexed files per kind */
  kinds?: Partial<Record<FileSearchKind, number>>;
  files: Record<string, FileIngestionEntry>;
}

/** hours worked, from the timesheets: one row per year, month and client */
export interface TimesheetStats {
  years: number[];
  /** most worked first */
  clients: string[];
  rows: { year: number; month: number; client: string; minutes: number; days: number }[];
  /**
   * per year, the calendar days with hours worked (a day counts once, however many hours).
   * Only the years with a timesheet every month, and the current year
   */
  workedDays: Record<number, number>;
}
