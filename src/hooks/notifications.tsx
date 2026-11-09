import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notificationsApi } from '@/api/misc';
import { useIsAdmin } from '@/auth/session';
import { NotificationBus, sortNotifications, titleWithCount } from '@/lib/notificationBus';
import type { ArtcodedNotification } from '@/types';

const POLL_INTERVAL = 5000;

interface NotificationsContextValue {
  notifications: ArtcodedNotification[];
  unseenCount: number;
  toggleSeen: (n: ArtcodedNotification, seen?: boolean) => Promise<void>;
  markAllSeen: () => Promise<void>;
  bus: NotificationBus;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** polls the notifications of the backend (admin only) and dispatches them to the pages */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  const [notifications, setNotifications] = useState<ArtcodedNotification[]>([]);
  const bus = useMemo(() => new NotificationBus((id) => notificationsApi.update(id, true)), []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const latest = await notificationsApi.latests();
        failures = 0;
        if (cancelled) return;
        setNotifications(sortNotifications(latest));
        bus.dispatch(latest);
      } catch (e) {
        failures++;
        console.warn('could not fetch notifications', e);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL * Math.min(1 + failures, 4));
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      bus.reset();
    };
  }, [isAdmin, bus]);

  const unseenCount = notifications.filter((n) => !n.seen).length;

  useEffect(() => {
    document.title = titleWithCount(document.title, unseenCount);
  }, [unseenCount]);

  const toggleSeen = useCallback(async (n: ArtcodedNotification, seen = !n.seen) => {
    await notificationsApi.update(n.id, seen);
    setNotifications((list) => sortNotifications(list.map((x) => (x.id === n.id ? { ...x, seen } : x))));
  }, []);

  const markAllSeen = useCallback(async () => {
    const unseen = notifications.filter((n) => !n.seen);
    await Promise.all(unseen.map((n) => notificationsApi.update(n.id, true)));
    setNotifications((list) => list.map((n) => ({ ...n, seen: true })));
  }, [notifications]);

  const value = useMemo(
    () => ({ notifications, unseenCount, toggleSeen, markAllSeen, bus }),
    [notifications, unseenCount, toggleSeen, markAllSeen, bus],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}

/**
 * Calls the handler when new (unseen) notifications of the given types arrive.
 * By default the consumed events are marked as seen.
 */
export function useNotificationListener(
  types: string[],
  handler: (events: ArtcodedNotification[]) => void,
  markAsSeen = true,
) {
  const bus = useContext(NotificationsContext)?.bus;
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const typesKey = types.join(',');
  useEffect(() => {
    if (!bus) return;
    return bus.subscribe({
      types: typesKey.split(','),
      markAsSeen,
      handle: (events) => handlerRef.current(events),
    });
  }, [bus, typesKey, markAsSeen]);
}
