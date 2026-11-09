import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminUser, renderWithProviders } from '@/test/utils';
import type { PersonalInfo } from '@/types';

const info = vi.hoisted(() => ({
  current: {} as PersonalInfo,
}));

vi.mock('@/auth/session', () => ({
  ME_KEY: ['me'],
  PERSONAL_INFO_KEY: ['personal-info'],
  useMe: () => ({ data: adminUser }),
  usePersonalInfo: () => ({ data: info.current }),
  useIsAdmin: () => true,
  useDemoMode: () => false,
}));

vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  personalInfoApi: {
    get: vi.fn(),
    me: vi.fn(),
    save: vi.fn(async () => ({})),
  },
}));

import { personalInfoApi } from '@/api/misc';
import { PersonalInfoForm } from './PersonalInfoForm';

const base: PersonalInfo = {
  ceoFullName: 'Nordine Bittich',
  vatNumber: 'BE0123456789',
  organizationName: 'Artcoded',
  note: 'note',
  organizationAddress: 'Rue de la Loi 16',
  organizationCity: 'Bruxelles',
  organizationPostCode: '1000',
  countryCode: 'BE',
  organizationEmailAddress: 'contact@artcoded.tech',
  organizationPhoneNumber: '+32 470 12 34 56',
  organizationBankAccount: 'BE68539007547034',
  organizationBankBIC: 'GKCCBEBB',
  financeCharge: 1,
  maxDaysToPay: 30,
  accountants: [],
};

const sentForm = () => vi.mocked(personalInfoApi.save).mock.calls.at(-1)![0];

async function openContactTab() {
  await userEvent.click(screen.getByRole('tab', { name: 'Contact/Bank' }));
}

describe('PersonalInfoForm second phone', () => {
  beforeEach(() => vi.mocked(personalInfoApi.save).mockClear());

  it('is optional and sent empty when not set', async () => {
    info.current = { ...base };
    renderWithProviders(<PersonalInfoForm />);
    await openContactTab();
    expect(screen.getByLabelText('Second Phone Number')).toHaveValue('');
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(personalInfoApi.save).toHaveBeenCalled());
    expect(sentForm().get('organizationSecondPhoneNumber')).toBe('');
    expect(sentForm().get('organizationPhoneNumber')).toBe('+32 470 12 34 56');
  });

  it('shows the saved value and sends the edited one', async () => {
    info.current = { ...base, organizationSecondPhoneNumber: '+32 2 123 45 67' };
    renderWithProviders(<PersonalInfoForm />);
    await openContactTab();
    const input = screen.getByLabelText('Second Phone Number');
    expect(input).toHaveValue('+32 2 123 45 67');
    await userEvent.clear(input);
    await userEvent.type(input, '+32 475 00 00 00');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(personalInfoApi.save).toHaveBeenCalled());
    expect(sentForm().get('organizationSecondPhoneNumber')).toBe('+32 475 00 00 00');
  });
});
