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
import { reorderLinks, SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  it('lists the links ordered', async () => {
    renderWithProviders(<SettingsPanel />);
    // the fallback menu is shown until the backend links are loaded
    await waitFor(() => expect(screen.getAllByLabelText('toggle visibility')).toHaveLength(2));
    const titles = screen.getAllByText(/^(Home|Invoices)$/).map((e) => e.textContent);
    expect(titles).toEqual(['Home', 'Invoices']);
  });

  it('toggles the visibility and deletes a link', async () => {
    renderWithProviders(<SettingsPanel />);
    await waitFor(() => expect(screen.getAllByLabelText('toggle visibility')).toHaveLength(2));
    await userEvent.click(screen.getAllByLabelText('toggle visibility')[1]);
    expect(settingsApi.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'b', show: false }));
    await userEvent.click(screen.getAllByLabelText('delete')[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(settingsApi.delete).toHaveBeenCalledWith('a'));
  });
});

describe('reorderLinks', () => {
  const link = (id: string, order: number) => ({ id, title: id, order, show: true, icon: 'home', routerLink: [id], roles: [] });

  it('moves a link and only returns the links whose order changed', () => {
    const { list, changed } = reorderLinks([link('a', 0), link('b', 1), link('c', 2), link('d', 3)], 3, 1);
    expect(list.map((l) => `${l.id}${l.order}`)).toEqual(['a0', 'd1', 'b2', 'c3']);
    expect(changed.map((l) => l.id)).toEqual(['d', 'b', 'c']);
  });
});
