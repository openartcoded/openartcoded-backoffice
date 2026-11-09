import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { FreemarkerTemplate } from '@/types';
import { TemplatesManager } from './TemplatesManager';

const rowOf = (name: string) => screen.getByText(name).closest('.mantine-Group-root')!.parentElement!;

function setup(templates: () => FreemarkerTemplate[], extra: Partial<Parameters<typeof TemplatesManager>[0]> = {}) {
  const props = {
    queryKey: `test-${Math.random()}`,
    load: vi.fn(async () => templates()),
    add: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined),
    ...extra,
  };
  renderWithProviders(<TemplatesManager {...props} />);
  return props;
}

describe('TemplatesManager default template (invoice)', () => {
  it('marks the template flagged as default', async () => {
    setup(() => [
      { id: 'a', name: 'old' },
      { id: 'b', name: 'peppol', defaultTemplate: true },
    ], { setDefault: vi.fn(), unsetDefault: vi.fn() });
    await screen.findByText('peppol');
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(rowOf('peppol')).toHaveTextContent('Default');
    expect(screen.getByLabelText('unset default')).toBeEnabled();
    expect(screen.getAllByLabelText('set as default')).toHaveLength(1);
  });

  it('sets a template as default', async () => {
    let list: FreemarkerTemplate[] = [
      { id: 'a', name: 'old' },
      { id: 'b', name: 'peppol' },
    ];
    const setDefault = vi.fn(async (t: FreemarkerTemplate) => {
      list = list.map((x) => ({ ...x, defaultTemplate: x.id === t.id }));
    });
    setup(() => list, { setDefault, unsetDefault: vi.fn() });
    await screen.findByText('peppol');
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByLabelText('set as default')[1]);
    expect(setDefault).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    await waitFor(() => expect(rowOf('peppol')).toHaveTextContent('Default'));
  });

  it('unsets the default so the latest template is used again', async () => {
    let list: FreemarkerTemplate[] = [{ id: 'b', name: 'peppol', defaultTemplate: true }];
    const unsetDefault = vi.fn(async () => {
      list = list.map((x) => ({ ...x, defaultTemplate: false }));
    });
    setup(() => list, { setDefault: vi.fn(), unsetDefault });
    await userEvent.click(await screen.findByLabelText('unset default'));
    expect(unsetDefault).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    await waitFor(() => expect(screen.queryByText('Default')).not.toBeInTheDocument());
    expect(screen.getByLabelText('set as default')).toBeEnabled();
  });

  it('cannot delete the default template', async () => {
    setup(() => [{ id: 'b', name: 'peppol', defaultTemplate: true }], {
      setDefault: vi.fn(),
      unsetDefault: vi.fn(),
    });
    await screen.findByText('peppol');
    expect(screen.getByLabelText('delete')).toBeDisabled();
  });

  it('shows the hint', async () => {
    setup(() => [], { hint: 'uses the latest one' });
    expect(await screen.findByText('uses the latest one')).toBeInTheDocument();
  });
});

describe('TemplatesManager default template (cv)', () => {
  it('keeps a given default that cannot be unset', async () => {
    setup(() => [
      { id: 'a', name: 'classic' },
      { id: 'b', name: 'modern' },
    ], { defaultTemplateId: 'a', setDefault: vi.fn(async () => undefined) });
    await screen.findByText('classic');
    expect(rowOf('classic')).toHaveTextContent('Default');
    const buttons = screen.getAllByLabelText('set as default');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toBeDisabled();
    expect(screen.queryByLabelText('unset default')).not.toBeInTheDocument();
  });

  it('has no default buttons without setDefault', async () => {
    setup(() => [{ id: 'a', name: 'classic' }]);
    await screen.findByText('classic');
    expect(screen.queryByLabelText('set as default')).not.toBeInTheDocument();
  });
});
