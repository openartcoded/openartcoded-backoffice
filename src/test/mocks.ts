import { vi } from 'vitest';
import type { User } from '@/types';

/** session hooks with a fixed user, used by vi.mock('@/auth/session', () => sessionMock(...)) */
export function sessionMock(user: User, demoMode = false) {
  return {
    ME_KEY: ['me'],
    PERSONAL_INFO_KEY: ['personal-info'],
    useMe: () => ({ data: user }),
    usePersonalInfo: () => ({ data: { demoMode } }),
    useIsAdmin: () => user.authorities.includes('ADMIN'),
    useDemoMode: () => demoMode,
  };
}

/** notification hooks doing nothing */
export const notificationsMock = () => ({
  useNotificationListener: vi.fn(),
  useNotifications: vi.fn(),
  NotificationsProvider: ({ children }: { children: unknown }) => children,
});
