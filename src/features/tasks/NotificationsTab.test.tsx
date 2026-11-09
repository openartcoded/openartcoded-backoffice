import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const toggleSeen = vi.fn();
const navigate = vi.fn();

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

vi.mock('@/hooks/notifications', () => ({
  useNotifications: () => ({
    notifications: [
      { id: '1', title: 'Expense from shop', type: 'NEW_FEE', seen: false, receivedDate: '2026-11-09T10:00:00' },
      { id: '2', title: 'Invoice 42', type: 'NEW_INVOICE', seen: true, receivedDate: '2026-11-08T10:00:00' },
    ],
    unseenCount: 1,
    toggleSeen,
    markAllSeen: vi.fn(),
  }),
}));

import { NotificationsTab } from './NotificationsTab';

describe('NotificationsTab', () => {
  it('filters the unseen notifications', async () => {
    renderWithProviders(<NotificationsTab />);
    expect(screen.getByText('Invoice 42')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Unseen (1)'));
    expect(screen.queryByText('Invoice 42')).not.toBeInTheDocument();
    expect(screen.getByText('Expense from shop')).toBeInTheDocument();
  });

  it('opens the page of a notification and marks it as seen', async () => {
    renderWithProviders(<NotificationsTab />);
    await userEvent.click(screen.getAllByLabelText('Open')[0]);
    expect(toggleSeen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), true);
    expect(navigate).toHaveBeenCalledWith('/fee');
  });
});
