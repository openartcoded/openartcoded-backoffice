import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing')>()),
  businessPlanApi: { generate: vi.fn() },
}));

import { businessPlanApi } from '@/api/billing';
import { BusinessPlanForm, toBusinessPlanRequest } from './BusinessPlan';

describe('business plan', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(businessPlanApi.generate).mockResolvedValue(undefined);
  });

  it('converts the form: empty fields are left out', () => {
    expect(
      toBusinessPlanRequest({
        language: 'NL',
        activity: '  ',
        loanAmount: '',
        loanMonths: '',
        loanRate: '',
        loanPurpose: '',
        refresh: false,
      }),
    ).toEqual({
      language: 'NL',
      activity: undefined,
      loanAmount: null,
      loanMonths: null,
      loanRate: null,
      loanPurpose: undefined,
    });
  });

  it('generates in french by default, with the loan, and remembers the form', async () => {
    const onDone = vi.fn();
    renderWithProviders(<BusinessPlanForm onDone={onDone} />);
    await userEvent.type(screen.getByLabelText('Activity'), 'Consultance IT');
    await userEvent.type(screen.getByLabelText('Amount'), '20000');
    await userEvent.type(screen.getByLabelText('Months'), '36');
    await userEvent.type(screen.getByLabelText('Rate'), '4.5');
    await userEvent.type(screen.getByLabelText('Purpose'), 'voiture');
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() =>
      expect(businessPlanApi.generate).toHaveBeenCalledWith(
        {
          language: 'FR',
          activity: 'Consultance IT',
          loanAmount: 20000,
          loanMonths: 36,
          loanRate: 4.5,
          loanPurpose: 'voiture',
        },
        false,
      ),
    );
    expect(onDone).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('business-plan-form')!).activity).toBe('Consultance IT');
  });

  it('asks the duration of the loan', async () => {
    renderWithProviders(<BusinessPlanForm />);
    await userEvent.click(screen.getByText('English'));
    await userEvent.type(screen.getByLabelText('Amount'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText('How many months?')).toBeInTheDocument();
    expect(businessPlanApi.generate).not.toHaveBeenCalled();
  });

  it('can ignore the cached pdf', async () => {
    renderWithProviders(<BusinessPlanForm />);
    await userEvent.click(screen.getByText('English'));
    await userEvent.click(screen.getByLabelText(/Generate again/));
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() =>
      expect(businessPlanApi.generate).toHaveBeenCalledWith(expect.objectContaining({ language: 'EN' }), true),
    );
  }, 10000);
});
