import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
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
  invoicesApi: { findAllSummaries: vi.fn().mockResolvedValue([]) },
  dossiersApi: { activeDossier: vi.fn().mockResolvedValue(null) },
  feesApi: { search: vi.fn().mockResolvedValue({ content: [], page: { totalElements: 0 } }) },
}));
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  timesheetApi: { estimateThisMonth: vi.fn().mockResolvedValue(0) },
}));

// charts and widgets are tested on their own
vi.mock('./charts', () => ({
  CHART_HEIGHT: 340,
  InvoicesPerMonthChart: () => <div>per-month-chart</div>,
  InvoicesPerClientChart: () => <div>per-client-chart</div>,
  DossierSummaryChart: () => <div>dossier-chart</div>,
  FeeSummaryChart: () => <div>fee-chart</div>,
  InvoiceStatsPanel: () => <div>stats-panel</div>,
}));
vi.mock('./widgets', () => ({
  CompanyStamp: () => <div>company-stamp</div>,
  MostClickedMenu: () => null,
}));

import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows the key figures, the charts and the company card on a single page', async () => {
    session.authorities = ['ADMIN'];
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('per-month-chart')).toBeInTheDocument();
    expect(screen.getByText('company-stamp')).toBeInTheDocument();
    expect(screen.getByText('To invoice this month')).toBeInTheDocument();
    // the rest moved to the administration page
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('does not show the company card to an accountant', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('per-month-chart')).toBeInTheDocument();
    expect(screen.queryByText('company-stamp')).not.toBeInTheDocument();
    expect(screen.queryByText('To invoice this month')).not.toBeInTheDocument();
  });
});
