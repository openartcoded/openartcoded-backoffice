import { useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, Group, Menu, Pagination, Stack, Table, Tabs, TagsInput, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle, useUploads } from '@/components/common';
import { AttachmentList } from '@/components/files';
import { openModal } from '@/components/modal';
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
    <Tabs defaultValue="general" className={demoMode ? 'blur' : undefined}>
      <Tabs.List>
        <Tabs.Tab value="general">General</Tabs.Tab>
        <Tabs.Tab value="attachments">Attachments</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="general" pt="sm">
        <Stack gap="sm">
          <TextInput label="Id" value={mail.id} disabled />
          <TagsInput label="To" value={to} onChange={setTo} disabled={mail.sent} splitChars={[',']} />
          <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} disabled={mail.sent} />
          <Textarea label="Body" autosize minRows={4} value={body} onChange={(e) => setBody(e.currentTarget.value)} disabled={mail.sent} />
          <TextInput label="Total Attachments" value={String(mail.uploadIds?.length ?? 0)} disabled />
          <TextInput label="Creation Date" value={fmtDateTime(mail.createdDate)} disabled />
          <TextInput label="Updated Date" value={fmtDateTime(mail.updatedDate)} disabled />
          <TextInput label="Failed" value={mail.markedFailed ? 'Yes' : 'No'} disabled />
          <Textarea label="Failed Message" placeholder="N/A" autosize value={mail.markedFailedMessage ?? ''} disabled />
          <TextInput label="Sent" value={mail.sent ? 'Yes' : 'No'} disabled />
          {mail.sendingDate && <TextInput label="Sending Date" value={fmtDateTime(mail.sendingDate)} disabled />}
          <Group justify="flex-end">
            <Button disabled={mail.sent} onClick={() => onUpdate({ ...mail, subject, body, to })}>
              Submit
            </Button>
            <Button color="yellow" disabled={mail.sent || !mail.markedFailed} onClick={() => onRetry(mail)}>
              Retry
            </Button>
          </Group>
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="attachments" pt="sm">
        <AttachmentList files={uploads} />
      </Tabs.Panel>
    </Tabs>
  );
}

export function MailsPage() {
  const demoMode = useDemoMode();
  const [page, setPage] = useState(1);
  const { data: mails, refetch } = useQuery({ queryKey: ['mails', page], queryFn: () => mailApi.findAll(page - 1, PAGE_SIZE) });

  const open = (mail: MailJob) =>
    openModal({
      title: `Mail Job #${mail.id}`,
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
    if (await confirm('Are you sure you want to delete this mail?')) {
      await mailApi.delete(m.id);
      refetch();
    }
  };

  return (
    <>
      <PageTitle title="Mails" />
      {mails && (
        <>
          <Table className={demoMode ? 'blur' : undefined}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sending Date</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th visibleFrom="md">To</Table.Th>
                <Table.Th>Sent</Table.Th>
                <Table.Th>Failed</Table.Th>
                <Table.Th w={60}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!mails.content.length && (
                <Table.Tr>
                  <Table.Td colSpan={6}>No Content</Table.Td>
                </Table.Tr>
              )}
              {mails.content.map((m) => (
                <Table.Tr key={m.id} className="clickable" onClick={() => open(m)}>
                  <Table.Td>{fmtDate(m.sendingDate)}</Table.Td>
                  <Table.Td>{m.subject}</Table.Td>
                  <Table.Td visibleFrom="md">
                    <Group gap={4}>
                      {m.to?.map((t) => (
                        <Badge key={t} variant="light" tt="none">
                          {t}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.sent} readOnly aria-label="sent" />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.markedFailed} readOnly aria-label="failed" color="red" />
                  </Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="default" aria-label="mail actions">
                          <Icon icon="ellipsis-v" />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<Icon icon="eye" />} onClick={() => open(m)}>
                          Open
                        </Menu.Item>
                        {!m.sent && (
                          <Menu.Item leftSection={<Icon icon="trash" />} color="red" onClick={() => remove(m)}>
                            Delete
                          </Menu.Item>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {mails.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={mails.page.totalPages} />
            </Group>
          )}
        </>
      )}
    </>
  );
}
