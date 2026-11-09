import { useState } from 'react';
import { Alert, Button, Group, Pagination, Stack, Table, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { useUploads } from '@/components/common';
import { EmptyRow, FormSection, PageHeader, RowActions, StatusBadge, StickyFooter } from '@/components/ui';
import { AttachmentList } from '@/components/files';
import { openDrawer } from '@/components/drawer';
import { mailApi } from '@/api/misc';
import { useDemoMode } from '@/auth/session';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { MailJob } from '@/types';

const PAGE_SIZE = 10;

export function MailDetail({ mail, onUpdate, onRetry }: { mail: MailJob; onUpdate: (m: MailJob) => void; onRetry: (m: MailJob) => void }) {
  const demoMode = useDemoMode();
  const [subject, setSubject] = useState(mail.subject);
  const [body, setBody] = useState(mail.body);
  const [to, setTo] = useState(mail.to ?? []);
  const { data: uploads = [] } = useUploads(mail.uploadIds ?? []);
  return (
    <Stack gap="xl" className={demoMode ? 'blur' : undefined}>
      <Stack gap={6}>
        <Group gap="xs">
          {mail.sent ? <StatusBadge value="SUCCESS" label="Sent" /> : mail.markedFailed ? <StatusBadge value="FAILURE" label="Failed" /> : <StatusBadge value="PENDING" label="Scheduled" />}
        </Group>
        <Text size="xs" c="dimmed">
          Created {fmtDateTime(mail.createdDate)} · updated {fmtDateTime(mail.updatedDate)}
          {mail.sendingDate ? ` · sending ${fmtDateTime(mail.sendingDate)}` : ''} · id {mail.id}
        </Text>
      </Stack>
      {mail.markedFailed && (
        <Alert color="red" title="Sending failed">
          <Text size="sm" className="pre-wrap">
            {mail.markedFailedMessage || 'No details.'}
          </Text>
        </Alert>
      )}
      <FormSection title="Message">
        <TagsInput label="To" value={to} onChange={setTo} disabled={mail.sent} splitChars={[',']} />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} disabled={mail.sent} />
        <Textarea label="Body" autosize minRows={4} value={body} onChange={(e) => setBody(e.currentTarget.value)} disabled={mail.sent} />
      </FormSection>
      <FormSection title={`Attachments (${mail.uploadIds?.length ?? 0})`}>
        <AttachmentList files={uploads} />
      </FormSection>
      {!mail.sent && (
        <StickyFooter>
          <Button variant="default" leftSection={<Icon icon="sync" />} disabled={!mail.markedFailed} onClick={() => onRetry(mail)}>
            Retry
          </Button>
          <Button onClick={() => onUpdate({ ...mail, subject, body, to })}>Save</Button>
        </StickyFooter>
      )}
    </Stack>
  );
}

export function MailsPage() {
  const demoMode = useDemoMode();
  const [page, setPage] = useState(1);
  const { data: mails, refetch } = useQuery({ queryKey: ['mails', page], queryFn: () => mailApi.findAll(page - 1, PAGE_SIZE) });

  const open = (mail: MailJob) =>
    openDrawer({
      title: mail.subject || 'Mail',
      size: 'xl',
      closeOnClickOutside: false,
      render: () => (
        <MailDetail
          mail={mail}
          onUpdate={async (m) => {
            await mailApi.update(m);
            toast.success('Mail job updated');
            refetch();
          }}
          onRetry={async (m) => {
            await mailApi.retry(m);
            toast.success('Will retry send mail');
            refetch();
          }}
        />
      ),
    });

  const remove = async (m: MailJob) => {
    if (await confirm('Delete this scheduled mail?')) {
      await mailApi.delete(m.id);
      refetch();
    }
  };

  const status = (m: MailJob) =>
    m.sent ? (
      <StatusBadge value="SUCCESS" label="Sent" />
    ) : m.markedFailed ? (
      <StatusBadge value="FAILURE" label="Failed" />
    ) : (
      <StatusBadge value="PENDING" label="Scheduled" />
    );

  return (
    <>
      <PageHeader title="Mails" description="Emails sent or scheduled by the backoffice." />
      {mails && (
        <div>
          <Table.ScrollContainer minWidth={560}>
            <Table className={`clickable-rows ${demoMode ? 'blur' : ''}`}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th visibleFrom="md">To</Table.Th>
                  <Table.Th>Sending date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {!mails.content.length && <EmptyRow colSpan={5} icon="envelope" title="No mail" />}
                {mails.content.map((m) => (
                  <Table.Tr key={m.id} onClick={() => open(m)}>
                    <Table.Td fw={500}>{m.subject}</Table.Td>
                    <Table.Td visibleFrom="md" c="dimmed">
                      <Text size="sm" lineClamp={1}>
                        {m.to?.join(', ')}
                      </Text>
                    </Table.Td>
                    <Table.Td>{fmtDate(m.sendingDate)}</Table.Td>
                    <Table.Td>{status(m)}</Table.Td>
                    <Table.Td>
                      <RowActions groups={[[{ label: 'Delete', icon: 'trash', color: 'red', hidden: !!m.sent, onClick: () => remove(m) }]]} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {mails.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={mails.page.totalPages} />
            </Group>
          )}
        </div>
      )}
    </>
  );
}
