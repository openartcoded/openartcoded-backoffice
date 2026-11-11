import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { fmtCurrency } from '@/lib/format';
import { YearlyStats } from './charts';
import { computeInvoiceStats } from './summary';

/** fmtCurrency uses a non-breaking space before €, testing library normalizes the page text to a plain space */
const money = (v: number) => fmtCurrency(v).replace(/\s+/g, ' ');

describe('YearlyStats', () => {
  const stats = computeInvoiceStats([
    { period: '03/2025', amount: 20, amountType: 'DAYS', subTotal: 10000, client: 'A', dateOfInvoice: '2025-03-31' },
    { period: '02/2026', amount: 10, amountType: 'DAYS', subTotal: 6000, client: 'A', dateOfInvoice: '2026-02-28' },
  ]);

  it('lists the years, most recent first, the current one marked as running', () => {
    renderWithProviders(<YearlyStats stats={stats} now={new Date('2026-06-01')} />);
    const [, first, second] = screen.getAllByRole('row');
    expect(within(first).getByText('2026')).toBeInTheDocument();
    expect(within(first).getByText('so far')).toBeInTheDocument();
    expect(within(first).getByText(money(6000))).toBeInTheDocument();
    // average per day
    expect(within(first).getByText(money(600))).toBeInTheDocument();
    expect(within(second).getByText('2025')).toBeInTheDocument();
    expect(within(second).queryByText('so far')).not.toBeInTheDocument();
  });

  it('shows the all time totals in the header', () => {
    renderWithProviders(<YearlyStats stats={stats} now={new Date('2026-06-01')} />);
    expect(screen.getByText((text) => text.startsWith(`All time: ${money(16000)}`))).toBeInTheDocument();
  });

  it('has an empty state and a loading state', () => {
    const { unmount } = renderWithProviders(<YearlyStats stats={computeInvoiceStats([])} />);
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<YearlyStats />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
