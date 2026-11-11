import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const session = vi.hoisted(() => ({ authorities: ['ADMIN'] as string[] }));

vi.mock('@/auth/session', () => ({
  ME_KEY: ['me'],
  PERSONAL_INFO_KEY: ['personal-info'],
  useMe: () => ({ data: { username: 'nordine', authorities: session.authorities } }),
  usePersonalInfo: () => ({ data: { demoMode: false } }),
  useIsAdmin: () => session.authorities.includes('ADMIN'),
  useDemoMode: () => false,
}));

vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing')>()),
  invoicesApi: { findAllSummaries: vi.fn() },
  dossiersApi: { activeDossier: vi.fn() },
  feesApi: { search: vi.fn() },
}));
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  timesheetApi: { estimateThisMonth: vi.fn() },
}));

// charts and widgets are tested on their own
vi.mock('./charts', () => ({
  CHART_HEIGHT: 300,
  InvoicesPerMonthChart: () => <div>per-month-chart</div>,
  InvoicesPerClientChart: () => <div>per-client-chart</div>,
  DossierSummaryChart: () => <div>dossier-chart</div>,
  FeeSummaryChart: () => <div>fee-chart</div>,
  YearlyStats: () => <div>yearly-stats</div>,
}));
vi.mock('./widgets', () => ({
  CompanyStamp: () => <div>company-stamp</div>,
  MostClickedMenu: () => null,
  NotesPanel: () => <div>notes-panel</div>,
}));

import { dossiersApi, feesApi, invoicesApi } from '@/api/billing';
import { timesheetApi } from '@/api/misc';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  // restoreMocks is on (vite.config.ts): the mocked values must be set before each test
  beforeEach(() => {
    vi.mocked(invoicesApi.findAllSummaries).mockResolvedValue([]);
    vi.mocked(dossiersApi.activeDossier).mockResolvedValue(null as never);
    vi.mocked(feesApi.search).mockResolvedValue({ content: [], page: { totalElements: 0 } } as never);
    vi.mocked(timesheetApi.estimateThisMonth).mockResolvedValue(0);
  });

  it('shows the key figures, the activity, the notes, the yearly stats and the company card', async () => {
    session.authorities = ['ADMIN'];
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('per-month-chart')).toBeInTheDocument();
    expect(screen.getByText('To invoice this month')).toBeInTheDocument();
    expect(screen.getByText('notes-panel')).toBeInTheDocument();
    expect(screen.getByText('yearly-stats')).toBeInTheDocument();
    expect(screen.getByText('company-stamp')).toBeInTheDocument();
    // to do, console, logs... are in the administration page
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('switches the activity chart', async () => {
    session.authorities = ['ADMIN'];
    renderWithProviders(<HomePage />);
    await screen.findByText('per-month-chart');
    await userEvent.click(screen.getByText('Per client'));
    expect(await screen.findByText('per-client-chart')).toBeInTheDocument();
    // the totals moved to the yearly stats, always visible
    expect(screen.queryByText('Totals')).not.toBeInTheDocument();
  });

  it('does not show the company card to an accountant', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('per-month-chart')).toBeInTheDocument();
    expect(screen.queryByText('company-stamp')).not.toBeInTheDocument();
    expect(screen.queryByText('notes-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('To invoice this month')).not.toBeInTheDocument();
    // the yearly figures are for everyone, like the charts
    expect(screen.getByText('yearly-stats')).toBeInTheDocument();
  });
});
