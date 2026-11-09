import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { adminUser, renderWithProviders } from '@/test/utils';
import { notificationsMock, sessionMock } from '@/test/mocks';

vi.mock('@/auth/session', () => sessionMock(adminUser));
vi.mock('@/hooks/notifications', () => notificationsMock());
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  timesheetApi: {
    findById: vi.fn(async () => ({
      id: 't1',
      clientId: 'c1',
      clientName: 'ACME',
      year: 2026,
      monthEnum: 'NOVEMBER',
      closed: false,
      numberOfWorkingDays: 1,
      numberOfHoursWorked: '08:00',
      settings: { minHoursPerDay: 4, maxHoursPerDay: 9 },
      periods: [{ id: 'p1', date: '2026-11-09', dayOfWeek: 'MONDAY', periodType: 'WORKING_DAY', duration: 480, durationInHours: '08:00', rateId: 'r2' }],
    })),
    estimateTotal: vi.fn(async () => 880),
  },
}));
vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing')>()),
  clientsApi: {
    findAll: vi.fn(async () => [
      {
        id: 'c1',
        name: 'ACME',
        rates: [
          { id: 'r1', label: 'connecting', rate: 93.75, rateType: 'HOURS' },
          { id: 'r2', label: 'new rate', rate: 110, rateType: 'HOURS' },
        ],
      },
    ]),
  },
}));

import { TimesheetDetailPage } from './TimesheetDetailPage';

describe('TimesheetDetailPage', () => {
  it('lets each working day pick one of the rates of the client', async () => {
    renderWithProviders(<TimesheetDetailPage />, { route: '/timesheets/timesheet/t1', path: '/timesheets/timesheet/:id' });
    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('new rate - 110€/hours')).toBeInTheDocument();
    expect(screen.getByText(/880,00\s*€ to invoice/)).toBeInTheDocument();
  });
});
