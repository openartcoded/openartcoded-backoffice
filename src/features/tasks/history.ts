import type { ArtcodedNotification, DateLike } from '@/types';

export type SeenFilter = 'all' | 'unseen' | 'seen';

export interface NotificationFilter {
  search: string;
  type: string | null;
  seen: SeenFilter;
}

export function filterNotifications(list: ArtcodedNotification[], f: NotificationFilter): ArtcodedNotification[] {
  const search = f.search.trim().toLowerCase();
  return list.filter(
    (n) =>
      (!f.type || n.type === f.type) &&
      (f.seen === 'all' || (f.seen === 'seen') === n.seen) &&
      (!search || n.title?.toLowerCase().includes(search) || n.correlationId?.toLowerCase().includes(search)),
  );
}

/** distinct notification types, sorted */
export const notificationTypes = (list: ArtcodedNotification[]) => [...new Set(list.map((n) => n.type).filter(Boolean))].sort();

/** NEW_FEE -> New fee */
export const typeLabel = (type: string) => (type.charAt(0) + type.slice(1).toLowerCase()).replace(/_/g, ' ');

/** human duration between two dates: 850ms, 12s, 3m 20s, 1h 05m */
export function duration(start?: DateLike | null, end?: DateLike | null): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0 || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
