import type { ArtcodedNotification } from '@/types';

/** registered event types emitted by the backend */
export const RegisteredEvent = {
  CV_REQUEST: 'CV_REQUEST',
  NEW_FEE: 'NEW_FEE',
  NEW_INVOICE: 'NEW_INVOICE',
  MEMZ_SET_VISIBLE: 'MEMZ_SET_VISIBLE',
  MEMZ_DELETED: 'MEMZ_DELETED',
  MEMZ_ADDED: 'MEMZ_ADDED',
  NEW_PROSPECT: 'NEW_PROSPECT',
  TICK_THRESHOLD: 'TICK_THRESHOLD',
  ADMINISTRATIVE_DOCUMENT_ADDED: 'ADMINISTRATIVE_DOCUMENT_ADDED',
  ADMINISTRATIVE_DOCUMENT_DELETED: 'ADMINISTRATIVE_DOCUMENT_DELETED',
  REMINDER_TASK_ADD_OR_UPDATE: 'REMINDER_TASK_ADD_OR_UPDATE',
  REMINDER_TASK_DELETE: 'REMINDER_TASK_DELETE',
  CLOSED_TIMESHEET: 'CLOSED_TIMESHEET',
  REOPENED_TIMESHEET: 'REOPENED_TIMESHEET',
  BILLABLE_CLIENT_UPLOAD_ADDED: 'BILLABLE_CLIENT_UPLOAD_ADDED',
  BILLABLE_CLIENT_UPLOAD_DELETED: 'BILLABLE_CLIENT_UPLOAD_DELETED',
  BILLABLE_CLIENT_ERROR: 'BILLABLE_CLIENT_ERROR',
} as const;

/** where to navigate when a notification is clicked */
export function notificationRoute(type: string): string | null {
  switch (type) {
    case RegisteredEvent.NEW_PROSPECT:
      return '/services';
    case RegisteredEvent.TICK_THRESHOLD:
      return '/finance';
    case RegisteredEvent.CV_REQUEST:
      return '/cv/download-requests';
    case RegisteredEvent.NEW_FEE:
      return '/fee';
    case RegisteredEvent.NEW_INVOICE:
      return '/invoice';
    case RegisteredEvent.CLOSED_TIMESHEET:
    case RegisteredEvent.REOPENED_TIMESHEET:
      return '/timesheets';
    case RegisteredEvent.MEMZ_SET_VISIBLE:
    case RegisteredEvent.MEMZ_DELETED:
    case RegisteredEvent.MEMZ_ADDED:
      return '/memzagram';
    case RegisteredEvent.BILLABLE_CLIENT_UPLOAD_ADDED:
    case RegisteredEvent.BILLABLE_CLIENT_UPLOAD_DELETED:
    case RegisteredEvent.BILLABLE_CLIENT_ERROR:
      return '/billable-clients';
    default:
      return null;
  }
}

export interface NotificationListener {
  /** event types this listener reacts to (only unseen events are dispatched) */
  types: string[];
  handle: (events: ArtcodedNotification[]) => void;
  /** mark the consumed events as seen on the backend */
  markAsSeen: boolean;
}

/**
 * Dispatches the polled notifications to the pages that registered a listener.
 * Every notification is dispatched only once.
 */
export class NotificationBus {
  private listeners = new Set<NotificationListener>();
  private alreadySent = new Set<string>();

  constructor(private markSeen: (id: string) => Promise<unknown>) {}

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(notifications: ArtcodedNotification[]) {
    const newEvents = notifications.filter((n) => !this.alreadySent.has(n.id));
    for (const listener of this.listeners) {
      const events = newEvents.filter((e) => !e.seen && listener.types.includes(e.type));
      if (!events.length) continue;
      listener.handle(events);
      if (listener.markAsSeen) {
        events.forEach((e) => this.markSeen(e.id).then(() => this.alreadySent.delete(e.id)));
      }
    }
    newEvents.forEach((e) => this.alreadySent.add(e.id));
  }

  reset() {
    this.alreadySent.clear();
  }
}

/** "(3) title" when there are unseen notifications */
export function titleWithCount(title: string, unseen: number): string {
  const clean = title.replace(/^\(\d+\)\s*/, '').trim();
  return unseen > 0 ? `(${unseen}) ${clean}` : clean;
}

/** unseen first, then newest first */
export function sortNotifications(list: ArtcodedNotification[]): ArtcodedNotification[] {
  return [...list].sort((a, b) => {
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
  });
}
