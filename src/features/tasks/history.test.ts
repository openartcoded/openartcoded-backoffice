import { describe, expect, it } from 'vitest';
import type { ArtcodedNotification } from '@/types';
import { duration, filterNotifications, notificationTypes, typeLabel } from './history';

const n = (id: string, type: string, seen: boolean, title = id): ArtcodedNotification => ({
  id,
  type,
  seen,
  title,
  receivedDate: '2026-11-09T10:00:00',
});
const list = [
  n('1', 'NEW_FEE', false, 'Expense from shop'),
  n('2', 'NEW_INVOICE', true, 'Invoice 42'),
  n('3', 'NEW_FEE', true, 'Expense from bank'),
];

describe('notifications history', () => {
  it('filters on type, seen and text', () => {
    expect(filterNotifications(list, { search: '', type: null, seen: 'all' })).toHaveLength(3);
    expect(filterNotifications(list, { search: '', type: 'NEW_FEE', seen: 'all' }).map((x) => x.id)).toEqual([
      '1',
      '3',
    ]);
    expect(filterNotifications(list, { search: '', type: null, seen: 'unseen' }).map((x) => x.id)).toEqual(['1']);
    expect(filterNotifications(list, { search: 'BANK', type: null, seen: 'seen' }).map((x) => x.id)).toEqual(['3']);
  });

  it('lists the types and labels them', () => {
    expect(notificationTypes(list)).toEqual(['NEW_FEE', 'NEW_INVOICE']);
    expect(typeLabel('NEW_FEE')).toBe('New fee');
  });

  it('formats a duration', () => {
    const start = new Date(2026, 10, 9, 10, 0, 0);
    const at = (ms: number) => new Date(start.getTime() + ms);
    expect(duration(start, at(850))).toBe('850ms');
    expect(duration(start, at(12_000))).toBe('12s');
    expect(duration(start, at(200_000))).toBe('3m 20s');
    expect(duration(start, at(3_900_000))).toBe('1h 05m');
    expect(duration(start, undefined)).toBe('');
  });
});
