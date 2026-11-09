import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  settingsApi: {
    menuLinks: vi.fn(async () => ([
      { id: 'b', title: 'Invoices', order: 2, show: true, icon: ['fas', 'file-invoice'], routerLink: ['invoice'], roles: [] },
      { id: 'a', title: 'Home', order: 1, show: true, icon: ['fas', 'home'], routerLink: [''], roles: [] },
    ])),
    save: vi.fn(async () => ({})),
    delete: vi.fn(async () => (undefined)),
    importAll: vi.fn(),
  },
}));

import { settingsApi } from '@/api/misc';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  it('lists the links ordered and swaps the order of two links', async () => {
    renderWithProviders(<SettingsPanel />);
    // the fallback menu is shown until the backend links are loaded
    await waitFor(() => expect(screen.getAllByLabelText('toggle visibility')).toHaveLength(2));
    const titles = screen.getAllByText(/Home|Invoices/).map((e) => e.textContent);
    expect(titles).toEqual(['Home', 'Invoices']);
    await userEvent.click(screen.getAllByLabelText('down')[0]);
    await waitFor(() => expect(settingsApi.save).toHaveBeenCalledTimes(2));
    expect(settingsApi.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', order: 2 }));
    expect(settingsApi.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', order: 1 }));
  });

  it('toggles the visibility and deletes a link', async () => {
    renderWithProviders(<SettingsPanel />);
    await waitFor(() => expect(screen.getAllByLabelText('toggle visibility')).toHaveLength(2));
    await userEvent.click(screen.getAllByLabelText('toggle visibility')[1]);
    expect(settingsApi.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', show: false }));
    await userEvent.click(screen.getAllByLabelText('delete')[0]);
    expect(settingsApi.delete).toHaveBeenCalledWith('a');
  });
});
