/** Dates coming from the backend are ISO strings (or epoch numbers); dates sent can be Date objects. */
export type DateLike = string | number | Date;

export interface Page<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

export type Direction = 'ASC' | 'DESC';

export interface SortCriteria {
  property: string;
  direction: Direction;
}

export interface User {
  id?: string;
  email?: string;
  username: string;
  authorities: string[];
}

export const ROLE_ADMIN = 'ADMIN';
export const ROLE_ACCOUNTANT = 'REGULATOR_OR_ACCOUNTANT';

export interface FileUpload {
  id: string;
  contentType?: string;
  originalFilename?: string;
  name?: string;
  size?: number;
  creationDate?: DateLike;
  publicResource?: boolean;
  correlationId?: string;
  bookmarked?: boolean;
  thumb?: boolean;
  thumbnailId?: string;
}

export interface FileUploadSearchCriteria {
  id?: string | null;
  correlationId?: string | null;
  dateBefore?: DateLike | null;
  dateAfter?: DateLike | null;
  originalFilename?: string | null;
  publicResource?: boolean | null;
  bookmarked: boolean;
}

export interface ArtcodedNotification {
  id: string;
  receivedDate: DateLike;
  seen: boolean;
  title: string;
  type: string;
  correlationId?: string;
}

export interface MenuLink {
  id?: string;
  updatedDate?: DateLike;
  order?: number;
  show?: boolean;
  description?: string | null;
  title: string;
  routerLinkActiveOptions?: { exact?: boolean };
  /** font awesome icon, e.g. ['fas', 'home'] */
  icon: [string, string] | string;
  routerLink: string[];
  numberOfTimesClicked?: number;
  roles: string[];
}

export interface Sms {
  phoneNumber: string;
  message: string;
}

export interface MailRequest {
  to: string[];
  subject: string;
  body: string;
  bcc: boolean;
  uploadIds: string[];
  sendingDate?: string | null;
}

export interface MailJob {
  id: string;
  createdDate?: DateLike;
  updatedDate?: DateLike;
  sent: boolean;
  sendingDate?: DateLike;
  markedFailed?: boolean;
  markedFailedMessage?: string;
  to: string[];
  subject: string;
  body: string;
  bcc: boolean;
  uploadIds: string[];
}

export type MailContext = Record<string, string | number | boolean | undefined | null>;
