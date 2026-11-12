import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { OaTemplate, TemplateTypeInfo } from '@/types';

const api = vi.hoisted(() => ({
  source: vi.fn(),
  mockContext: vi.fn(),
  preview: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@/api/templates', () => ({ templatesApi: api }));

import { TemplateEditor } from './TemplateEditor';
import { blobText } from './editorLogic';

const TEMPLATE: OaTemplate = { id: 'sms', name: 'sms jinja', type: 'SMS', version: 'V2' };
const TYPES: TemplateTypeInfo[] = [{ type: 'SMS', output: 'TEXT', extension: '.txt' }];

const renderEditor = (onSaved = vi.fn(), onClose = vi.fn()) =>
  renderWithProviders(<TemplateEditor template={TEMPLATE} types={TYPES} onSaved={onSaved} onClose={onClose} />);

describe('TemplateEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.source.mockResolvedValue('{{ actionKey }}: {{ actionResult.status }}');
    api.mockContext.mockResolvedValue({ actionKey: 'actionKey', actionResult: { status: 'status' } });
    api.preview.mockResolvedValue({ blob: new Blob(['DUMP: SUCCESS']), contentType: 'text/plain;charset=UTF-8' });
    api.save.mockResolvedValue({ id: 'sms' });
  });

  it('previews the source being edited with mock data, without saving it', async () => {
    renderEditor();
    const editor = await screen.findByLabelText('template source');
    expect(editor).toHaveValue('{{ actionKey }}: {{ actionResult.status }}');
    fireEvent.change(editor, { target: { value: '{{ actionKey }} -> {{ actionResult.status }}' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Preview \(/ }));

    expect(await screen.findByText('DUMP: SUCCESS')).toBeInTheDocument();
    expect(api.mockContext).toHaveBeenCalledWith({
      source: '{{ actionKey }} -> {{ actionResult.status }}',
      extension: '.txt',
    });
    expect(api.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sms',
        type: 'SMS',
        v1: false,
        source: '{{ actionKey }} -> {{ actionResult.status }}',
        context: { actionKey: 'actionKey', actionResult: { status: 'status' } },
      }),
    );
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves the source as the file of the template', async () => {
    const onSaved = vi.fn();
    renderEditor(onSaved);
    const editor = await screen.findByLabelText('template source');
    const save = screen.getByRole('button', { name: /Save/ });
    expect(save).toBeDisabled();
    fireEvent.change(editor, { target: { value: 'new {{ actionKey }}' } });

    await userEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const form = api.save.mock.calls[0][0];
    expect(form).toMatchObject({ id: 'sms', name: 'sms jinja', type: 'SMS', v1: false, makeDefault: false });
    expect(form.file.name).toBe('sms jinja.txt');
    expect(await blobText(form.file)).toBe('new {{ actionKey }}');
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('shows the error of a template that cannot be rendered', async () => {
    api.preview.mockRejectedValue(new Error('could not render the template: unknown filter'));
    renderEditor();
    await screen.findByLabelText('template source');

    await userEvent.click(screen.getByRole('button', { name: /Preview \(/ }));

    expect(await screen.findByText(/unknown filter/)).toBeInTheDocument();
  });

  it('does not preview with invalid preview data', async () => {
    renderEditor();
    await screen.findByLabelText('template source');
    await userEvent.click(screen.getByRole('tab', { name: /Preview data/ }));
    fireEvent.change(screen.getByLabelText('preview data'), { target: { value: '{ nope' } });

    await userEvent.click(screen.getByRole('button', { name: /Preview \(/ }));

    expect(screen.getByText(/invalid json/)).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
  });
});
