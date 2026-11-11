import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminUser, renderWithProviders } from '@/test/utils';
import { sessionMock } from '@/test/mocks';
import type { Fee } from '@/types';

vi.mock('@/auth/session', () => sessionMock(adminUser));
vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing')>()),
  feesApi: { exceptional: vi.fn(), updateExceptional: vi.fn() },
}));

import { feesApi } from '@/api/billing';
import { ExceptionalExpenses, matchesFilter } from './ExceptionalExpenses';

const fee = (id: string, subject: string, priceTot: number, exceptional?: Fee['exceptional']): Fee => ({
  id,
  subject,
  body: '',
  attachmentIds: [],
  priceHVAT: priceTot,
  vat: 0,
  priceTot,
  exceptional,
});

const tax = fee('tax', 'Impôt des sociétés', 5000);
const ssc = fee('ssc', 'Cotisations sociales', 3200);
const laptop = fee('laptop', 'Laptop', 1800, 'DENIED');
const fine = fee('fine', 'Precompte', 1500, 'CONFIRMED');

describe('exceptional expenses', () => {
  beforeEach(() => {
    vi.mocked(feesApi.exceptional).mockResolvedValue({
      median: 95,
      threshold: 1000,
      factor: 5,
      minAmount: 1000,
      expenses: [tax, ssc, laptop, fine],
    });
    vi.mocked(feesApi.updateExceptional).mockResolvedValue([]);
  });

  it('filters by status', () => {
    expect(matchesFilter(tax, 'review')).toBe(true);
    expect(matchesFilter(laptop, 'review')).toBe(false);
    expect(matchesFilter(laptop, 'DENIED')).toBe(true);
    expect(matchesFilter(fine, 'CONFIRMED')).toBe(true);
    expect(matchesFilter(fine, 'all')).toBe(true);
  });

  it('shows the ones to review first, with the counts', async () => {
    renderWithProviders(<ExceptionalExpenses />);
    expect(await screen.findByText('Impôt des sociétés')).toBeInTheDocument();
    expect(screen.getByText('Cotisations sociales')).toBeInTheDocument();
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
    expect(screen.getByText('To review (2)')).toBeInTheDocument();
    expect(screen.getByText('Exceptional (1)')).toBeInTheDocument();
    expect(screen.getByText('Normal (1)')).toBeInTheDocument();
    expect(feesApi.exceptional).toHaveBeenCalledWith(5, 1000);

    await userEvent.click(screen.getByText('Normal (1)'));
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Impôt des sociétés')).not.toBeInTheDocument();
  });

  it('flags several expenses at once as exceptional', async () => {
    renderWithProviders(<ExceptionalExpenses />);
    await screen.findByText('Impôt des sociétés');
    await userEvent.click(screen.getByLabelText('select all'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exceptional' }));
    await waitFor(() => expect(feesApi.updateExceptional).toHaveBeenCalledWith(['tax', 'ssc'], 'CONFIRMED'));
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument());
  });

  it('marks big expenses as normal, or back to review', async () => {
    renderWithProviders(<ExceptionalExpenses />);
    await screen.findByText('Impôt des sociétés');
    await userEvent.click(screen.getByLabelText('select Cotisations sociales'));
    await userEvent.click(screen.getByRole('button', { name: 'Normal' }));
    await waitFor(() => expect(feesApi.updateExceptional).toHaveBeenCalledWith(['ssc'], 'DENIED'));

    await userEvent.click(screen.getByText('All'));
    const row = (await screen.findByText('Precompte')).closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(feesApi.updateExceptional).toHaveBeenLastCalledWith(['fine'], 'NONE'));
  });
});
