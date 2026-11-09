import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { MailForm, SmsForm } from './forms';

describe('MailForm', () => {
  it('prefills the recipients and subject, adds the context to the body', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <MailForm
        to={['client@acme.be', undefined]}
        defaultSubject="Invoice 42"
        context={{ Client: 'ACME', Period: undefined }}
        attachments={[{ id: 'u1', originalFilename: 'invoice.pdf' }]}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByDisplayValue('Invoice 42')).toBeInTheDocument();
    // only defined context values get a button
    expect(screen.queryByRole('button', { name: 'Period' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Client' }));
    expect(screen.getByLabelText('Body')).toHaveValue('ACME');

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith({
      to: ['client@acme.be'],
      subject: 'Invoice 42',
      body: 'ACME',
      bcc: false,
      sendingDate: null,
      uploadIds: ['u1'],
    });
  });

  it('removes an attachment', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<MailForm to={['a@b.be']} defaultSubject="s" attachments={[{ id: 'u1', originalFilename: 'a.pdf' }]} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText('remove attachment'));
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Body'), 'hi');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit.mock.calls[0][0].uploadIds).toEqual([]);
  });

  it('cannot be submitted without body', () => {
    renderWithProviders(<MailForm to={['a@b.be']} defaultSubject="s" onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});

describe('SmsForm', () => {
  it('only accepts mobile phone numbers', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<SmsForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Body'), 'hello');
    await userEvent.type(screen.getByLabelText('Phone'), '123');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.type(screen.getByLabelText('Phone'), '+32470123456');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith({ phoneNumber: '+32470123456', message: 'hello' }, expect.anything());
  });
});
