import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminUser, renderWithProviders } from '@/test/utils';
import { notificationsMock, sessionMock } from '@/test/mocks';

vi.mock('@/auth/session', () => sessionMock(adminUser));
vi.mock('@/hooks/notifications', () => notificationsMock());
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  tasksApi: {
    findAll: vi.fn(async () => ([
      { id: '1', title: 'Pay taxes', description: '', disabled: false, nextDate: '2026-11-04T10:00:00' },
      { id: '2', title: 'Backup', description: '', disabled: false, actionKey: 'BACKUP', nextDate: '2026-11-05T10:00:00' },
      { id: '3', title: 'Old one', description: '', disabled: true, nextDate: '2026-11-05T11:00:00' },
    ])),
    allowedActions: vi.fn(async () => ([])),
    actionResults: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { TasksPage } from './TasksPage';

describe('TasksPage', () => {
  it('selects the first day by default', async () => {
    renderWithProviders(<TasksPage />);
    expect(await screen.findByText('Pay taxes')).toBeInTheDocument();
    expect(screen.queryByText('Backup')).not.toBeInTheDocument();
  });

  it('shows all the enabled tasks and the disabled ones on demand', async () => {
    renderWithProviders(<TasksPage />);
    await screen.findByText('Pay taxes');
    await userEvent.click(screen.getByRole('textbox', { name: 'Day' }));
    // the dropdown is still in its opening transition in jsdom (display: none): click the option directly
    fireEvent.click(await screen.findByRole('option', { name: 'All days', hidden: true }));
    expect(screen.getByText('Backup')).toBeInTheDocument();
    expect(screen.queryByText('Old one')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Hide disabled'));
    expect(screen.getByText('Old one')).toBeInTheDocument();
  });

  it('hides the actions', async () => {
    renderWithProviders(<TasksPage />);
    await screen.findByText('Pay taxes');
    await userEvent.click(screen.getByRole('textbox', { name: 'Day' }));
    // the dropdown is still in its opening transition in jsdom (display: none): click the option directly
    fireEvent.click(await screen.findByRole('option', { name: 'All days', hidden: true }));
    await userEvent.click(screen.getByLabelText('Show actions'));
    expect(screen.queryByText('Backup')).not.toBeInTheDocument();
  });

  it('searches in all the tasks', async () => {
    renderWithProviders(<TasksPage />);
    await screen.findByText('Pay taxes');
    await userEvent.type(screen.getByPlaceholderText('Search'), 'old');
    expect(screen.getByText('Old one')).toBeInTheDocument();
    expect(screen.queryByText('Pay taxes')).not.toBeInTheDocument();
  });
});
