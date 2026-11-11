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

import { DEFAULT_SORT, TemplatesPage, filterTemplates, nextSort, sortTemplates } from './TemplatesPage';

const renderPage = (route = '/templates') => renderWithProviders(<TemplatesPage />, { route, path: '/templates' });

const ids = (templates: OaTemplate[]) => templates.map((t) => t.id);
/** template names, in the order of the table */
const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].querySelector('p')?.textContent);

describe('sortTemplates', () => {
  it('puts the default templates on top by default, then by type (display order), then the latest', () => {
    expect(ids(sortTemplates(TEMPLATES))).toEqual(['inv-v2', 'email', 'inv-old']);
  });

  it('sorts on a column, ties by type then latest', () => {
    expect(ids(sortTemplates(TEMPLATES, { key: 'name', desc: false }))).toEqual(['email', 'inv-old', 'inv-v2']);
    expect(ids(sortTemplates(TEMPLATES, { key: 'name', desc: true }))).toEqual(['inv-v2', 'inv-old', 'email']);
    expect(ids(sortTemplates(TEMPLATES, { key: 'updated', desc: true }))).toEqual(['inv-v2', 'email', 'inv-old']);
    expect(ids(sortTemplates(TEMPLATES, { key: 'version', desc: false }))).toEqual(['inv-old', 'email', 'inv-v2']);
    expect(ids(sortTemplates(TEMPLATES, { key: 'type', desc: true }))).toEqual(['email', 'inv-v2', 'inv-old']);
  });

  it('cycles ascending, descending, then back to the default order', () => {
    const asc = nextSort(DEFAULT_SORT, 'name');
    expect(asc).toEqual({ key: 'name', desc: false });
    const desc = nextSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', desc: true });
    expect(nextSort(desc, 'name')).toEqual(DEFAULT_SORT);
    expect(nextSort(desc, 'type')).toEqual({ key: 'type', desc: false });
  });
});

describe('filterTemplates', () => {
  it('searches the name, the description and the type', () => {
    expect(ids(filterTemplates(TEMPLATES, { search: 'JINJA' }))).toEqual(['inv-v2']);
    expect(ids(filterTemplates(TEMPLATES, { search: 'new one' }))).toEqual(['inv-v2']);
    expect(ids(filterTemplates(TEMPLATES, { search: 'email' }))).toEqual(['email']);
    expect(ids(filterTemplates(TEMPLATES, { search: '  ' }))).toEqual(ids(TEMPLATES));
  });

  it('filters on the version and the default', () => {
    expect(ids(filterTemplates(TEMPLATES, { version: 'V1' }))).toEqual(['email', 'inv-old']);
    expect(ids(filterTemplates(TEMPLATES, { defaultOnly: true }))).toEqual(['email', 'inv-v2']);
    expect(ids(filterTemplates(TEMPLATES, { version: 'V1', defaultOnly: true }))).toEqual(['email']);
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

  it('shows the default templates on top, and sorts when clicking a column', async () => {
    renderPage();
    await screen.findByText('invoice jinja');
    expect(rowNames()).toEqual(['invoice jinja', 'email bundled', 'invoice 2022']);

    await userEvent.click(screen.getByRole('button', { name: 'sort by name' }));
    expect(rowNames()).toEqual(['email bundled', 'invoice 2022', 'invoice jinja']);
    await userEvent.click(screen.getByRole('button', { name: 'sort by name' }));
    expect(rowNames()).toEqual(['invoice jinja', 'invoice 2022', 'email bundled']);
    // third click: back to the default order
    await userEvent.click(screen.getByRole('button', { name: 'sort by name' }));
    expect(rowNames()).toEqual(['invoice jinja', 'email bundled', 'invoice 2022']);
  });

  it('filters the rows on a search, without calling the backend again', async () => {
    renderPage();
    await screen.findByText('invoice jinja');
    await userEvent.type(screen.getByLabelText('search'), '2022');
    expect(rowNames()).toEqual(['invoice 2022']);
    expect(screen.getByText('1 of 3 templates')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('shows only the default templates', async () => {
    renderPage();
    await screen.findByText('invoice jinja');
    await userEvent.click(screen.getByLabelText('Default only'));
    expect(rowNames()).toEqual(['invoice jinja', 'email bundled']);
  });

  it('filters and sorts from the url', async () => {
    renderPage('/templates?version=V1&sort=updated&desc=true');
    await screen.findByText('invoice 2022');
    expect(rowNames()).toEqual(['email bundled', 'invoice 2022']);
  });

  it('says when no template matches the filters', async () => {
    renderPage('/templates?q=nothing');
    expect(await screen.findByText('No template matches the filters')).toBeInTheDocument();
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
