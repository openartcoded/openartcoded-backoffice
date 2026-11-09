import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const toggleSeen = vi.fn();
const markAllSeen = vi.fn();
const navigate = vi.fn();

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

vi.mock('@/hooks/notifications', () => ({
  useNotifications: () => ({
    notifications: [
      { id: '1', title: 'New expense', type: 'NEW_FEE', seen: false, receivedDate: '2026-11-08T10:00:00' },
      { id: '2', title: 'Invoice generated', type: 'NEW_INVOICE', seen: true, receivedDate: '2026-11-07T10:00:00' },
    ],
    unseenCount: 1,
    toggleSeen,
    markAllSeen,
  }),
}));

import { NotificationBell } from './NotificationBell';

describe('NotificationBell', () => {
  it('shows the unseen count and navigates on click', async () => {
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText('1')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('notifications'));
    await userEvent.click(await screen.findByText('New expense'));
    expect(toggleSeen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), true);
    expect(navigate).toHaveBeenCalledWith('/fee');
  });

  it('marks all notifications as seen', async () => {
    renderWithProviders(<NotificationBell />);
    await userEvent.click(screen.getByLabelText('notifications'));
    await userEvent.click(await screen.findByLabelText('mark all as seen'));
    expect(markAllSeen).toHaveBeenCalled();
  });
});
