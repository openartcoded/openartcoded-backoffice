import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@mantine/core';
import { renderWithProviders } from '@/test/utils';
import type { FileUpload } from '@/types';

vi.mock('@/api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/files')>()),
  filesApi: { search: vi.fn(), upload: vi.fn() },
}));
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  mailApi: { send: vi.fn() },
}));

import { filesApi } from '@/api/files';
import { mailApi } from '@/api/misc';
import { openMailForm } from './forms';

const pdf: FileUpload = { id: 'u1', originalFilename: 'invoice.pdf', contentType: 'application/pdf' };
const png: FileUpload = { id: 'u2', originalFilename: 'scan.png', contentType: 'image/png' };
const csv: FileUpload = { id: 'u3', originalFilename: 'hours.csv', contentType: 'text/csv' };

async function pick(...names: string[]) {
  await userEvent.click(screen.getByRole('button', { name: 'From uploads' }));
  const browser = await screen.findByRole('dialog', { name: 'Choose from uploads' });
  await within(browser).findByText(names[0]);
  for (const name of names) await userEvent.click(within(browser).getByText(name));
  await userEvent.click(within(browser).getByRole('button', { name: /^Add \d file/ }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose from uploads' })).not.toBeInTheDocument());
}

/** the send mail popup, opened by the modals manager like in the app */
describe('send mail popup attachments', () => {
  beforeEach(() => {
    vi.mocked(filesApi.search).mockResolvedValue({
      content: [pdf, png, csv],
      page: { size: 8, number: 0, totalElements: 3, totalPages: 1 },
    });
    vi.mocked(mailApi.send).mockResolvedValue(undefined as never);
  });

  it('adds several files, removes some, and keeps what was typed', async () => {
    renderWithProviders(
      <Button onClick={() => openMailForm({ attachments: [pdf], to: ['a@b.be'], defaultSubject: 'Invoice' })}>
        mail
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'mail' }));
    fireEvent.change(await screen.findByLabelText('Body'), { target: { value: 'hello' } });

    await pick('scan.png');
    // the mail form was not reset by the uploads browser
    expect(screen.getByLabelText('Body')).toHaveValue('hello');
    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();

    await pick('hours.csv');
    expect(screen.getByText('Attachments (3)')).toBeInTheDocument();

    // remove the first one (invoice.pdf)
    await userEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(mailApi.send).toHaveBeenCalled());
    expect(vi.mocked(mailApi.send).mock.calls[0][0]).toMatchObject({ body: 'hello', uploadIds: ['u2', 'u3'] });
    // two modals opened and closed (with their transitions): slower than the default 5s on CI
  }, 20000);
});
