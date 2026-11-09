import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { PersonalInfo } from '@/types';

const info = vi.hoisted(() => ({ current: {} as PersonalInfo }));

vi.mock('@/auth/session', () => ({
  ME_KEY: ['me'],
  PERSONAL_INFO_KEY: ['personal-info'],
  usePersonalInfo: () => ({ data: info.current }),
  useIsAdmin: () => true,
  useDemoMode: () => false,
}));

import { CompanyStamp } from './widgets';

describe('CompanyStamp', () => {
  it('shows both phone numbers on one line', () => {
    info.current = {
      organizationName: 'Artcoded',
      organizationPhoneNumber: '+32 470 12 34 56',
      organizationSecondPhoneNumber: '+32 2 123 45 67',
    };
    renderWithProviders(<CompanyStamp />);
    expect(screen.getByText('+32 470 12 34 56 · +32 2 123 45 67')).toBeInTheDocument();
  });

  it('shows only the first phone when the second one is empty', () => {
    info.current = {
      organizationName: 'Artcoded',
      organizationPhoneNumber: '+32 470 12 34 56',
      organizationSecondPhoneNumber: '',
    };
    renderWithProviders(<CompanyStamp />);
    expect(screen.getByText('+32 470 12 34 56')).toBeInTheDocument();
  });
});
