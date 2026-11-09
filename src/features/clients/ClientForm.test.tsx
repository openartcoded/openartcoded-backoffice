import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { BillableClient } from '@/types';

vi.mock('@/hooks/notifications', () => ({ useNotificationListener: vi.fn() }));

import { ClientDetailsForm, initialRates, makeDefault } from './ClientForm';

const client: BillableClient = {
  id: 'c1',
  name: 'ACME',
  vatNumber: 'BE0123',
  address: 'Street 1',
  city: 'Brussels',
  countryCode: 'BE',
  projectName: 'Proj',
  nature: 'Consulting',
  taxRate: 21,
  maxDaysToPay: 30,
  contractStatus: 'ONGOING',
  defaultWorkingDays: ['MONDAY'],
  startDate: '2026-01-01',
  rates: [
    { id: 'r1', rate: 600, rateType: 'DAYS' },
    { id: 'r2', label: 'On call', rate: 90, rateType: 'HOURS' },
  ],
};

describe('client rates helpers', () => {
  it('migrates the legacy rate to the first rate', () => {
    expect(initialRates({ rate: 500, rateType: 'HOURS' })).toEqual([{ rate: 500, rateType: 'HOURS' }]);
    expect(initialRates({})).toEqual([{ rate: undefined, rateType: 'DAYS' }]);
    expect(initialRates(client)).toBe(client.rates);
  });

  it('moves a rate to the first position', () => {
    expect(makeDefault(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
    expect(makeDefault(['a', 'b'], 0)).toEqual(['a', 'b']);
  });
});

describe('ClientDetailsForm', () => {
  it('saves the rates, the first one mirrored in the legacy fields', async () => {
    const onSave = vi.fn();
    renderWithProviders(<ClientDetailsForm client={client} isAdmin onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Make default' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const saved = onSave.mock.calls[0][0] as BillableClient;
    expect(saved.rates?.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(saved.rate).toBe(90);
    expect(saved.rateType).toBe('HOURS');
    expect(saved.name).toBe('ACME');
    expect(saved.startDate).toBeInstanceOf(Date);
  });

  it('removes a rate but always keeps one', async () => {
    renderWithProviders(<ClientDetailsForm client={client} isAdmin onSave={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('is read only for accountants', () => {
    renderWithProviders(<ClientDetailsForm client={client} isAdmin={false} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Client Name')).toBeDisabled();
  });
});
