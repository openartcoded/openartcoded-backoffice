import { describe, expect, it, vi } from 'vitest';
import { NotificationBus, notificationRoute, RegisteredEvent, sortNotifications, titleWithCount } from './notificationBus';
import type { ArtcodedNotification } from '@/types';

const n = (id: string, type: string, seen = false, receivedDate = '2026-01-01T10:00:00'): ArtcodedNotification => ({
  id,
  type,
  seen,
  title: id,
  receivedDate,
});

describe('NotificationBus', () => {
  it('dispatches unseen events of the subscribed types only once', () => {
    const markSeen = vi.fn().mockResolvedValue(undefined);
    const bus = new NotificationBus(markSeen);
    const handle = vi.fn();
    bus.subscribe({ types: [RegisteredEvent.NEW_FEE], handle, markAsSeen: false });

    bus.dispatch([n('1', RegisteredEvent.NEW_FEE), n('2', RegisteredEvent.NEW_INVOICE), n('3', RegisteredEvent.NEW_FEE, true)]);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][0].map((e: ArtcodedNotification) => e.id)).toEqual(['1']);

    // same events polled again: not dispatched twice
    bus.dispatch([n('1', RegisteredEvent.NEW_FEE)]);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('marks the consumed events as seen when requested', () => {
    const markSeen = vi.fn().mockResolvedValue(undefined);
    const bus = new NotificationBus(markSeen);
    bus.subscribe({ types: [RegisteredEvent.NEW_INVOICE], handle: vi.fn(), markAsSeen: true });
    bus.dispatch([n('a', RegisteredEvent.NEW_INVOICE)]);
    expect(markSeen).toHaveBeenCalledWith('a');
  });

  it('stops dispatching after unsubscribe', () => {
    const bus = new NotificationBus(vi.fn());
    const handle = vi.fn();
    const unsubscribe = bus.subscribe({ types: ['X'], handle, markAsSeen: false });
    unsubscribe();
    bus.dispatch([n('1', 'X')]);
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('notification helpers', () => {
  it('maps notification types to routes', () => {
    expect(notificationRoute(RegisteredEvent.CV_REQUEST)).toBe('/cv/download-requests');
    expect(notificationRoute(RegisteredEvent.BILLABLE_CLIENT_ERROR)).toBe('/billable-clients');
    expect(notificationRoute('UNKNOWN')).toBeNull();
  });

  it('prefixes the title with the unseen count', () => {
    expect(titleWithCount('Tasks', 3)).toBe('(3) Tasks');
    expect(titleWithCount('(3) Tasks', 0)).toBe('Tasks');
    expect(titleWithCount('(3) Tasks', 5)).toBe('(5) Tasks');
  });

  it('sorts unseen first then newest first', () => {
    const sorted = sortNotifications([
      n('old-unseen', 'X', false, '2026-01-01T00:00:00'),
      n('seen', 'X', true, '2026-02-01T00:00:00'),
      n('new-unseen', 'X', false, '2026-01-05T00:00:00'),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['new-unseen', 'old-unseen', 'seen']);
  });
});
