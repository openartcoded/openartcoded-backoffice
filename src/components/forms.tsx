import { useState } from 'react';
import { Button, Checkbox, Group, Stack, TagsInput, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { AttachmentsField } from './attachments';
import { openModal } from './modal';
import { mailApi, smsApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { isValidEmail, isValidMobilePhone } from '@/lib/validators';
import { toast } from '@/lib/ui';
import { fromInput } from '@/lib/format';
import type { FileUpload, MailContext, MailRequest, Sms } from '@/types';

export interface MailFormProps {
  attachments?: FileUpload[];
  context?: MailContext;
  to?: (string | undefined)[];
  defaultSubject?: string;
  onSubmit: (req: MailRequest) => void;
}

export function MailForm({
  attachments: initialAttachments = [],
  context = {},
  to = [],
  defaultSubject = '',
  onSubmit,
}: MailFormProps) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const form = useForm({
    initialValues: {
      to: to.filter((t): t is string => !!t),
      subject: defaultSubject,
      body: '',
      sendingDate: '',
      bcc: false,
    },
    validate: {
      to: (v) => (!v.length ? 'at least one email is required' : v.every(isValidEmail) ? null : 'invalid email'),
      subject: (v) => (!v.trim() ? 'Required' : v.length > 50 ? 'Max 50 characters' : null),
      body: (v) => (!v.trim() ? 'Required' : null),
    },
  });

  const submit = form.onSubmit((v) => {
    const sendingDate = fromInput(v.sendingDate);
    onSubmit({
      to: v.to,
      subject: v.subject,
      body: v.body,
      bcc: v.bcc,
      sendingDate: sendingDate ? sendingDate.toUTCString() : null,
      uploadIds: attachments.map((a) => a.id),
    });
  });

  const contextEntries = Object.entries(context).filter(([, v]) => v !== undefined && v !== null);

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <TagsInput label="To" placeholder="Email, then enter" splitChars={[',', ' ']} {...form.getInputProps('to')} />
        <TextInput label="Subject" {...form.getInputProps('subject')} />
        {!!contextEntries.length && (
          <Group gap="xs">
            {contextEntries.map(([key, value]) => (
              <Button
                key={key}
                variant="default"
                size="xs"
                onClick={() => {
                  const body = form.values.body ? `${form.values.body} ` : '';
                  form.setFieldValue('body', body + String(value));
                }}
              >
                {key}
              </Button>
            ))}
          </Group>
        )}
        <Textarea label="Body" autosize minRows={4} {...form.getInputProps('body')} />
        <AttachmentsField value={attachments} onChange={setAttachments} />
        <TextInput type="datetime-local" label="Sending date" {...form.getInputProps('sendingDate')} />
        <Checkbox label="Bcc" {...form.getInputProps('bcc', { type: 'checkbox' })} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** opens the mail form and sends the mail on submit */
export function openMailForm(props: Omit<MailFormProps, 'onSubmit'>) {
  openModal({
    title: 'Send email',
    size: 'lg',
    closeOnClickOutside: false,
    render: (close) => (
      <MailForm
        {...props}
        onSubmit={async (req) => {
          close();
          try {
            await mailApi.send(req);
            toast.success('Mail will be send');
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    ),
  });
}

export function SmsForm({ phoneNumber = '', onSubmit }: { phoneNumber?: string; onSubmit: (sms: Sms) => void }) {
  const form = useForm({
    initialValues: { phoneNumber, message: '' },
    validate: {
      phoneNumber: (v) => (isValidMobilePhone(v) ? null : 'not a mobile phone'),
      message: (v) => (v.trim() ? null : 'Required'),
    },
  });
  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="sm">
        <TextInput label="Phone" data-autofocus {...form.getInputProps('phoneNumber')} />
        <Textarea label="Body" autosize minRows={3} {...form.getInputProps('message')} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function openSmsForm() {
  openModal({
    title: 'Send SMS',
    render: (close) => (
      <SmsForm
        onSubmit={async (sms) => {
          close();
          await smsApi.send(sms);
          toast.success('Sms sent');
        }}
      />
    ),
  });
}
