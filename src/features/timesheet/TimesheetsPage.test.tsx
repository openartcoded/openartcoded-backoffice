import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminUser, renderWithProviders } from '@/test/utils';
import { sessionMock } from '@/test/mocks';

vi.mock('@/auth/session', () => sessionMock(adminUser));
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  timesheetApi: {
    estimateThisMonth: vi.fn(async () => 4800),
    findAllGrouped: vi.fn(async () => ({
      2025: {
        ACME: [
          {
            id: 'a',
            name: 'December 2025',
            month: 12,
            numberOfWorkingDays: 15,
            numberOfMinutesWorked: 7200,
            closed: true,
          },
        ],
      },
      [new Date().getFullYear()]: {
        ACME: [
          { id: 'b', name: 'January', month: 1, numberOfWorkingDays: 20, numberOfMinutesWorked: 9600, closed: true },
          { id: 'c', name: 'February', month: 2, numberOfWorkingDays: 18, numberOfMinutesWorked: 8640, closed: false },
        ],
        Other: [{ id: 'd', name: 'March other', month: 3, numberOfWorkingDays: 1, numberOfMinutesWorked: 60 }],
      },
    })),
  },
}));

import { TimesheetsPage } from './TimesheetsPage';

describe('TimesheetsPage', () => {
  it('shows the timesheets of the current year for the first client, latest month first', async () => {
    renderWithProviders(<TimesheetsPage />);
    const rows = await screen.findAllByText(/January|February/);
    expect(rows.map((r) => r.textContent)).toEqual(['February', 'January']);
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(await screen.findByText(/Estimate this month/)).toHaveTextContent('4.800,00');
  });

  it('switches client and year', async () => {
    renderWithProviders(<TimesheetsPage />);
    await screen.findByText('February');
    await userEvent.click(screen.getByText('Other'));
    expect(screen.getByText('March other')).toBeInTheDocument();
    await userEvent.click(screen.getByText('2025'));
    expect(screen.getByText('No result for this year.')).toBeInTheDocument();
    await userEvent.click(screen.getByText('ACME'));
    expect(screen.getByText('December 2025')).toBeInTheDocument();
  });
});
