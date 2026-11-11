import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import type { FileUpload } from '@/types';

vi.mock('@/api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/files')>()),
  filesApi: { search: vi.fn(), upload: vi.fn() },
}));

import { filesApi } from '@/api/files';
import { AttachmentsField, isAccepted, PEPPOL_MIME_TYPES } from './attachments';

const pdf: FileUpload = { id: 'u1', originalFilename: 'invoice.pdf', contentType: 'application/pdf' };
const png: FileUpload = { id: 'u2', originalFilename: 'scan.png', contentType: 'image/png' };
const zip: FileUpload = { id: 'u3', originalFilename: 'sources.zip', contentType: 'application/zip' };

const page = (content: FileUpload[], totalPages = 1) => ({
  content,
  page: { size: 8, number: 0, totalElements: content.length, totalPages },
});

/** keeps the value like a parent would, and reports the changes */
function Field({
  initial = [],
  accept,
  onChange,
}: {
  initial?: FileUpload[];
  accept?: string[];
  onChange?: (f: FileUpload[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AttachmentsField
      value={value}
      accept={accept}
      onChange={(f) => {
        setValue(f);
        onChange?.(f);
      }}
    />
  );
}

describe('isAccepted', () => {
  it('accepts everything without a list, otherwise only the listed types', () => {
    expect(isAccepted(zip)).toBe(true);
    expect(isAccepted(pdf, PEPPOL_MIME_TYPES)).toBe(true);
    expect(isAccepted(zip, PEPPOL_MIME_TYPES)).toBe(false);
    expect(isAccepted({ id: 'x' }, PEPPOL_MIME_TYPES)).toBe(false);
  });
});

describe('AttachmentsField', () => {
  beforeEach(() => {
    vi.mocked(filesApi.search).mockResolvedValue(page([pdf, png, zip]));
    vi.mocked(filesApi.upload).mockImplementation(async (f: File) => ({
      id: `new-${f.name}`,
      originalFilename: f.name,
      contentType: f.type,
    }));
  });

  it('removes an attachment', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field initial={[pdf, png]} onChange={onChange} />);
    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
    expect(onChange).toHaveBeenLastCalledWith([png]);
    expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();
  });

  it('picks files from the uploads, the attached ones can not be picked again', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field initial={[pdf]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'From uploads' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose from uploads' });
    await within(dialog).findByText('scan.png');
    expect(filesApi.search).toHaveBeenCalledWith({ originalFilename: null, bookmarked: false }, 0, 8);

    // already attached
    expect(within(dialog).getByLabelText('select invoice.pdf')).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();

    await userEvent.click(within(dialog).getByText('scan.png'));
    await userEvent.click(within(dialog).getByText('sources.zip'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 2 files' }));
    expect(onChange).toHaveBeenLastCalledWith([pdf, png, zip]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('unselects a file when clicked twice', async () => {
    renderWithProviders(<Field />);
    await userEvent.click(screen.getByRole('button', { name: 'From uploads' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByText('scan.png'));
    expect(within(dialog).getByRole('button', { name: 'Add 1 file' })).toBeEnabled();
    await userEvent.click(within(dialog).getByText('scan.png'));
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('does not let pick a type that is not accepted, and flags the attached ones', async () => {
    renderWithProviders(<Field initial={[zip]} accept={PEPPOL_MIME_TYPES} />);
    expect(screen.getByText('not accepted')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'From uploads' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('scan.png');
    expect(within(dialog).getByLabelText('select scan.png')).not.toBeDisabled();
    expect(within(dialog).getByLabelText('select sources.zip')).toBeDisabled();
  });

  it('searches by file name and bookmarked', async () => {
    renderWithProviders(<Field />);
    await userEvent.click(screen.getByRole('button', { name: 'From uploads' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('scan.png');
    await userEvent.type(within(dialog).getByLabelText('search uploads'), 'scan');
    await waitFor(() =>
      expect(filesApi.search).toHaveBeenLastCalledWith({ originalFilename: 'scan', bookmarked: false }, 0, 8),
    );
    await userEvent.click(within(dialog).getByText('Bookmarked'));
    await waitFor(() =>
      expect(filesApi.search).toHaveBeenLastCalledWith({ originalFilename: 'scan', bookmarked: true }, 0, 8),
    );
  });

  it('uploads new files and attaches them', async () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(<Field initial={[pdf]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'timesheet.csv', { type: 'text/csv' });
    await userEvent.upload(input, file);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([
        pdf,
        { id: 'new-timesheet.csv', originalFilename: 'timesheet.csv', contentType: 'text/csv' },
      ]),
    );
    expect(filesApi.upload).toHaveBeenCalledWith(file);
  });

  it('only shows the list when disabled', () => {
    renderWithProviders(<AttachmentsField value={[pdf]} onChange={vi.fn()} disabled />);
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'From uploads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'remove' })).not.toBeInTheDocument();
  });
});
