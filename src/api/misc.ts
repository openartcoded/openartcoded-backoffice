import { del, download, get, http, post, postText } from './http';
import type {
  ActionMetadata,
  ActionResult,
  ArtcodedNotification,
  BackendInfo,
  Channel,
  Curriculum,
  DownloadCvRequest,
  FileSearchParams,
  FileSearchResult,
  FileSearchStats,
  FormContact,
  HealthIndicator,
  MailJob,
  MailRequest,
  Memz,
  MenuLink,
  Message,
  Page,
  PersonalInfo,
  Portfolio,
  Post,
  PostIt,
  PostSearchCriteria,
  ReminderTask,
  Script,
  Sms,
  Tick,
  Timesheet,
  TimesheetPeriod,
  TimesheetSettings,
  TimesheetSettingsForm,
  TimesheetStats,
  TimesheetsByYearAndClient,
  Todo,
  UnreadMessagesCounter,
  User,
  UserScript,
} from '@/types';

export const personalInfoApi = {
  get: () => get<PersonalInfo>('/api/personal-info'),
  me: () => get<User>('/api/personal-info/@me'),
  save: (fd: FormData) => post<PersonalInfo>('/api/personal-info/submit', fd),
};

export const notificationsApi = {
  latests: () => get<ArtcodedNotification[]>('/api/notification'),
  update: (id: string, seen: boolean) => post<void>('/api/notification', {}, { id, seen }),
  delete: (id: string) => del<void>('/api/notification', { id }),
};

const menu = '/api/settings/menu-link';
export const settingsApi = {
  menuLinks: () => get<MenuLink[]>(menu),
  save: (link: MenuLink) => post<MenuLink>(`${menu}/save`, link),
  clicked: (id: string) => post<void>(`${menu}/clicked`, {}, { id }),
  top3: () => get<MenuLink[]>(`${menu}/top-3`),
  importAll: (links: MenuLink[]) => post<void>(`${menu}/import`, links),
  delete: (id: string) => del<void>(menu, { id }),
};

export const cacheApi = {
  findAll: () => post<string[]>('/api/cache/find-all'),
  clear: (name: string) => del<{ message: string }>('/api/cache/clear', { name }),
};

export const smsApi = { send: (sms: Sms) => post<void>('/api/sms', sms) };

export const mailApi = {
  send: (req: MailRequest) => post<void>('/api/mail/send', req),
  update: (job: MailJob) => post<MailJob>('/api/mail/update', job),
  retry: (job: MailJob) => post<MailJob>('/api/mail/retry', job),
  delete: (id: string) => del<void>('/api/mail/delete', { id }),
  /** page is zero based */
  findAll: (page: number, size: number) =>
    get<Page<MailJob>>('/api/mail/find-all', { page, size, sort: 'creationDate,DESC' }),
};

export const infoApi = {
  buildInfo: () => get<BackendInfo>('/api/actuator/info'),
  health: () => get<HealthIndicator>('/api/actuator/health'),
  logs: async () => (await http.get<string>('/api/actuator/logfile', { responseType: 'text' })).data,
};

export const todoApi = {
  findAll: () => get<Todo[]>('/api/todo'),
  save: (t: Todo) => post<Todo>('/api/todo', t),
  delete: (id: string) => del<void>('/api/todo', { id }),
};

export const postItApi = {
  findAll: () => get<PostIt[]>('/api/post-it'),
  save: (p: PostIt) => post<PostIt>('/api/post-it', p),
  delete: (id: string) => del<void>('/api/post-it', { id }),
};

export const scriptApi = {
  loaded: () => post<Script[]>('/api/script'),
  bindings: () => post<Record<string, string>>('/api/script/bindings'),
  userScripts: () => get<UserScript[]>('/api/script/user-script'),
  saveUserScript: (s: UserScript) => post<UserScript>('/api/script/user-script', s),
  deleteUserScript: (id: string) => del<void>('/api/script/user-script', { id }),
  run: (script: string) => postText('/api/script/run', { script }),
};

const rt = '/api/reminder-task';
export const tasksApi = {
  findAll: () => get<ReminderTask[]>(`${rt}/find-all`),
  nextTen: () => get<ReminderTask[]>(`${rt}/find-next-ten-tasks`),
  allowedActions: () => get<ActionMetadata[]>(`${rt}/allowed-actions`),
  /** page is zero based */
  actionResults: (key: string, page: number, size: number) =>
    get<Page<ActionResult>>(`${rt}/action-results`, { key, page, size }),
  save: (t: ReminderTask) => post<void>(`${rt}/save`, t),
  delete: (id: string) => del<void>(rt, { id }),
  validateCron: (cronExpression: string) =>
    get<{ valid: boolean }>(`${rt}/validate-cron-expression`, { cronExpression }),
};

const ts = '/api/timesheet';
export const timesheetApi = {
  findAllGrouped: () => get<TimesheetsByYearAndClient>(ts),
  findById: (id: string) => get<Timesheet>(`${ts}/by-id`, { id }),
  estimateThisMonth: () => get<number>(`${ts}/estimate-total-to-be-invoiced-this-month`),
  estimateTotal: (id: string) => get<number>(`${ts}/estimate-total`, { id }),
  savePeriod: (id: string, period: TimesheetPeriod) => post<TimesheetPeriod>(`${ts}/save-period`, period, { id }),
  /** changes ONLY the rate of a period, allowed even when the timesheet is released */
  updatePeriodRate: (id: string, periodId: string, rateId?: string) =>
    post<TimesheetPeriod>(`${ts}/period-rate`, {}, rateId ? { id, periodId, rateId } : { id, periodId }),
  close: (id: string) => post<void>(`${ts}/close`, {}, { id }),
  reopen: (id: string) => post<void>(`${ts}/reopen`, {}, { id }),
  generateInvoice: (id: string) => post<Timesheet>(`${ts}/generate-invoice`, {}, { id }),
  updateSettings: (s: TimesheetSettingsForm) => post<TimesheetSettings>(`${ts}/settings`, s),
  /** hours worked per year, month and client (cached by the backend) */
  stats: () => get<TimesheetStats>(`${ts}/stats`),
  delete: (id: string) => del<void>(ts, { id }),
};

const rep = '/api/report';
export const reportApi = {
  save: (fd: FormData) => post<Post>(`${rep}/submit`, fd),
  newPost: () => post<Post>(`${rep}/new-post`),
  toggleBookmarked: (id: string) => post<void>(`${rep}/toggle-bookmarked`, {}, { id }),
  delete: (id: string) => del<{ message?: string }>(rep, { id }),
  tags: () => get<string[]>(`${rep}/tags`),
  addAttachment: (id: string, files: File[]) => {
    const fd = new FormData();
    fd.append('id', id);
    files.forEach((f) => fd.append('files', f));
    return post<Post>(`${rep}/add-attachment`, fd);
  },
  toggleProcessAttachment: (id: string, attachmentId: string) =>
    post<Post>(`${rep}/toggle-process-attachment`, {}, { id, attachmentId }),
  removeAttachment: (id: string, attachmentId: string) =>
    post<Post>(`${rep}/remove-attachment`, {}, { id, attachmentId }),
  /** page is zero based */
  search: (criteria: PostSearchCriteria, page: number, size: number) =>
    post<Page<Post>>(`${rep}/admin-search`, criteria, { page, size, sort: 'updatedDate,DESC' }),
  subscribe: (id: string) => post<Channel>(`${rep}/channel/subscribe`, {}, { id }),
  unreadCount: () => post<UnreadMessagesCounter[]>(`${rep}/channel/unread-count`),
  singleUnreadCount: (id: string) => post<number>(`${rep}/channel/single-unread-count`, {}, { id }),
  setChannelToRead: (id: string) => post<Channel>(`${rep}/channel/read`, {}, { id }),
  postMessage: (id: string, message: string, files: File[]) => {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('message', message);
    files.forEach((f) => fd.append('files', f));
    return post<Message>(`${rep}/channel/post`, fd);
  },
  deleteMessage: (id: string, messageId: string) => del<void>(`${rep}/channel/message`, { id, messageId }),
  updatePostIts: (id: string, postIts: { todos: PostIt[]; inProgress: PostIt[]; done: PostIt[] }) =>
    post<Post>(`${rep}/update-post-it`, postIts, { id }),
  getChannel: (id: string) => post<Channel>(`${rep}/channel/get`, {}, { id }),
  getPost: (id: string) => post<Post>(`${rep}/post-by-id`, {}, { id }),
  generatePdf: (id: string) => download(`${rep}/generate-pdf`, { params: { id } }),
};

const cv = '/api/cv';
export const cvApi = {
  full: () => post<Curriculum>(`${cv}/full`),
  update: (c: Curriculum) => post<Curriculum>(`${cv}/update`, c),
  downloadRequests: () => post<DownloadCvRequest[]>(`${cv}/download-requests`),
  deleteDownloadRequest: (id: string) => del<void>(`${cv}/download-requests`, { id }),
  downloadAsAdmin: () => download(`${cv}/admin-download`),
};

export const memzApi = {
  save: (fd: FormData) => post<Memz>('/api/memzagram/submit', fd),
  /** page is zero based */
  adminFindAll: (page: number, size: number) =>
    get<Page<Memz>>('/api/memzagram/all', { page, size, sort: 'updatedDate,DESC' }),
  delete: (id: string) => del<void>('/api/memzagram', { id }),
};

export const contactApi = {
  findAll: () => post<FormContact[]>('/api/form-contact/find-all'),
  delete: (id: string) => del<void>('/api/form-contact', { id }),
};

export const financeApi = {
  chart: (tick: string, interval = '1d', range = '5d') =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get<any>(`/proxy/yahoo-finance/chart/${encodeURIComponent(tick)}`, { interval, range, region: 'EU' }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search: (q: string) => get<any>('/proxy/yahoo-finance/search', { q }),
};

const pf = '/api/finance/portfolio';
export const portfolioApi = {
  findAll: () => post<Portfolio[]>(`${pf}/find-all`),
  save: (p: Portfolio) => post<Portfolio>(`${pf}/save`, p),
  delete: (id: string) => del<void>(pf, { id }),
  updateTicks: (id: string, ticks: Tick[]) => post<void>(`${pf}/update-ticks`, ticks, { id }),
  deleteTick: (id: string, symbol: string) => del<void>(`${pf}/tick`, { id, symbol }),
};

export const fileSearchApi = {
  stats: () => get<FileSearchStats>('/api/file-search/stats'),
  /** page is zero based. Empty parameters are not sent */
  search: (params: FileSearchParams) =>
    get<FileSearchResult>(
      '/api/file-search/v2/search',
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')),
    ),
};

const rdf = '/api/toolbox/public/rdf';
export const toolboxApi = {
  allowedLanguages: () => get<string[]>(`${rdf}/allowed-languages`),
  allowedExtensions: () => get<string[]>(`${rdf}/allowed-extensions`),
  modelToLang: (model: string, langOfModel: string, lang: string) => {
    const fd = new FormData();
    fd.append('model', model);
    fd.append('langOfModel', langOfModel);
    fd.append('lang', lang);
    return postText(`${rdf}/model-to-lang`, fd);
  },
  shaclValidation: (modelFile: File, shaclFile: File) => {
    const fd = new FormData();
    fd.append('modelFile', modelFile);
    fd.append('shaclFile', shaclFile);
    return postText(`${rdf}/shacl-validation`, fd);
  },
  fileToFile: (file: File, lang: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('lang', lang);
    return download(`${rdf}/file-to-lang`, { method: 'POST', data: fd });
  },
  xpath: (expression: string, data: string) => {
    const fd = new FormData();
    fd.append('expression', expression);
    fd.append('data', data);
    return postText('/api/toolbox/public/xpath/evaluate', fd);
  },
};
