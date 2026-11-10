import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { renderWithProviders } from '@/test/utils';
import type { OaTemplate, TemplateTypeInfo } from '@/types';

const TEMPLATES: OaTemplate[] = [
  {
    id: 'email',
    name: 'email bundled',
    type: 'EMAIL',
    version: 'V1',
    defaultTemplate: true,
    dateCreation: '2026-01-01',
  },
  { id: 'inv-old', name: 'invoice 2022', type: 'INVOICE', version: 'V1', dateCreation: '2022-12-01' },
  {
    id: 'inv-v2',
    name: 'invoice jinja',
    description: 'the new one',
    type: 'INVOICE',
    version: 'V2',
    defaultTemplate: true,
    dateCreation: '2026-11-01',
  },
];

const TYPES: TemplateTypeInfo[] = [
  { type: 'INVOICE', output: 'PDF', extension: '.html' },
  { type: 'CV', output: 'PDF', extension: '.html' },
  { type: 'EMAIL', output: 'TEXT', extension: '.html' },
];

const api = vi.hoisted(() => ({
  types: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  setDefault: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  download: vi.fn(),
  variables: vi.fn(),
}));
vi.mock('@/api/templates', () => ({ templatesApi: api }));

import { TemplatesPage, sortTemplates } from './TemplatesPage';

const renderPage = (route = '/templates') => renderWithProviders(<TemplatesPage />, { route, path: '/templates' });

describe('sortTemplates', () => {
  it('groups by type (display order), default first, then latest', () => {
    expect(sortTemplates(TEMPLATES).map((t) => t.id)).toEqual(['inv-v2', 'inv-old', 'email']);
  });
});

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.types.mockResolvedValue(TYPES);
    api.list.mockResolvedValue(TEMPLATES);
    api.save.mockResolvedValue({});
    api.setDefault.mockResolvedValue({});
  });

  it('lists every template with its type, version and default', async () => {
    renderPage();
    const row = (await screen.findByText('invoice jinja')).closest('tr')!;
    expect(within(row).getByText('Default')).toBeInTheDocument();
    expect(within(row).getByText('Invoice')).toBeInTheDocument();
    expect(within(row).getByText('v2 · Jinja')).toBeInTheDocument();
    expect(within(row).getByText('the new one')).toBeInTheDocument();
    // the default cannot be set as default again
    expect(within(row).queryByLabelText('Set as default')).not.toBeInTheDocument();
    const old = screen.getByText('invoice 2022').closest('tr')!;
    expect(within(old).getByText('v1 · FreeMarker')).toBeInTheDocument();
    expect(within(old).queryByText('Default')).not.toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith(undefined);
  });

  it('filters on the type of the url', async () => {
    renderPage('/templates?type=CV');
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('CV'));
  });

  it('makes a template the default of its type', async () => {
    renderPage();
    const old = (await screen.findByText('invoice 2022')).closest('tr')!;
    await userEvent.click(within(old).getByLabelText('Set as default'));
    expect(api.setDefault).toHaveBeenCalledWith('inv-old');
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it('cannot delete the default template', async () => {
    renderPage();
    const row = (await screen.findByText('invoice jinja')).closest('tr')!;
    await userEvent.click(within(row).getByLabelText('more actions'));
    expect(await screen.findByRole('menuitem', { name: /make another one the default first/ })).toBeDisabled();
  });

  it('adds a v2 template by default, optionally as the default one', async () => {
    renderPage('/templates?type=INVOICE');
    await screen.findByText('invoice jinja');
    await userEvent.click(screen.getByRole('button', { name: 'New template' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/uploaded as/)).toHaveTextContent('.html');
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'invoice 2027');
    await userEvent.click(within(dialog).getByLabelText('Use as default'));
    const file = new File(['{{ invoice.total|currency }}'], 'invoice.html', { type: 'text/html' });
    await userEvent.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith({
        id: undefined,
        name: 'invoice 2027',
        description: undefined,
        type: 'INVOICE',
        v1: false,
        makeDefault: true,
        file,
      }),
    );
  });

  it('renames a template without a new file, but needs one to switch its version', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('invoice 2022'));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    // v1 -> v2: the file must be a jinja template
    await userEvent.click(within(dialog).getByLabelText('FreeMarker template (v1)'));
    expect(save).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText('FreeMarker template (v1)'));
    await userEvent.clear(within(dialog).getByLabelText(/Name/));
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'invoice 2022 (old)');
    await userEvent.click(save);

    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inv-old',
          name: 'invoice 2022 (old)',
          type: 'INVOICE',
          v1: true,
          file: undefined,
        }),
      ),
    );
  });

  it('shows why the backend refused an operation', async () => {
    const err = new AxiosError('Request failed');
    err.response = {
      data: { error: 'the file service cannot render TIMESHEET templates' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    api.setDefault.mockRejectedValue(err);
    renderPage();
    const old = (await screen.findByText('invoice 2022')).closest('tr')!;
    await userEvent.click(within(old).getByLabelText('Set as default'));
    expect(await screen.findByText('the file service cannot render TIMESHEET templates')).toBeInTheDocument();
  });
});
