import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Alert, Button, Group, Menu, Pagination, Table, Tabs, Text, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, FullscreenSection, ImportedInfo, PageTitle, ThumbnailPreview, useUploads } from '@/components/common';
import { openFileViewer } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { TemplatesManager } from '@/components/TemplatesManager';
import { dossiersApi, invoicesApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { errorMessage } from '@/api/http';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fmtCurrency, fmtDate } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Invoice, SortCriteria } from '@/types';
import { canMakeCreditNote, invoiceMailContext } from './logic';
import { openInvoiceDetail, type InvoiceFormResult } from './InvoiceDetail';

const PAGE_SIZE = 10;

type Mode = { bookmarked?: boolean; archived?: boolean; logical?: boolean };

function SortHeader({ label, property, sort, onSort }: { label: string; property: string; sort: SortCriteria; onSort: (p: string) => void }) {
  const active = sort.property === property;
  return (
    <UnstyledButton onClick={() => onSort(property)} fw={700} fz="sm">
      <Group gap={4} wrap="nowrap">
        {label}
        <Icon icon={!active ? 'arrows-up-down' : sort.direction === 'ASC' ? 'arrow-up' : 'arrow-down'} color={active ? undefined : 'gray'} />
      </Group>
    </UnstyledButton>
  );
}

export function InvoiceTable({ mode }: { mode: Mode }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortCriteria>({ property: 'dateCreation', direction: 'DESC' });
  const key = ['invoices', mode, page, sort];
  const { data: invoices, refetch } = useQuery({
    queryKey: key,
    queryFn: () => invoicesApi.search({ ...mode, page: page - 1, size: PAGE_SIZE, sort }),
  });
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const { data: uploads = [] } = useUploads(invoices?.content.map((i) => i.invoiceUploadId).filter((id): id is string => !!id));
  const thumbnailOf = (i: Invoice) => uploads.find((u) => u.id === i.invoiceUploadId)?.thumbnailId;
  const unprocessed = !mode.bookmarked && !mode.archived && !mode.logical;

  useNotificationListener([RegisteredEvent.NEW_INVOICE], () => refetch());

  const save = async ({ invoice, manualUploadFile }: InvoiceFormResult) => {
    try {
      const saved = await invoicesApi.save(invoice);
      if (saved.uploadedManually && manualUploadFile && saved.id) await invoicesApi.manualUpload(saved.id, manualUploadFile);
      toast.success('Invoice created. Will be generated soon');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const open = (invoice: Invoice) => openInvoiceDetail(invoice, isAdmin ? save : undefined);

  const newInvoice = async () => {
    if (!isAdmin || mode.archived || (invoices?.content.length ?? 0) > 0) return;
    open(await invoicesApi.newInvoice());
  };
  useHotkeys(unprocessed ? [['ctrl+k', newInvoice]] : []);

  const withUpload = async (id: string | undefined, fn: (u: Awaited<ReturnType<typeof filesApi.findById>>) => void) => {
    if (id) fn(await filesApi.findById(id));
  };

  const toggleBookmark = async (invoice: Invoice) => {
    await invoicesApi.toggleBookmarked(invoice.id!);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  const remove = async (invoice: Invoice) => {
    if (await confirm(`Are you sure you want to delete the invoice (${mode.logical ? 'REALLY' : 'logically'}) ?`)) {
      await invoicesApi.delete(invoice.id!, !mode.logical);
      refetch();
    }
  };

  const restore = async (invoice: Invoice) => {
    if (await confirm('Are you sure you want to restore this invoice?', { danger: false })) {
      await invoicesApi.restore(invoice.id!);
      refetch();
    }
  };

  const sendToPeppol = async (invoice: Invoice) => {
    if (invoice.peppolStatus !== 'NOT_SENT') return;
    if (await confirm('Are you sure you want to send this invoice to peppol?', { danger: false })) {
      await invoicesApi.sendToPeppol(invoice.id!);
      toast.success('peppol xml sent');
      refetch();
    }
  };

  const process = async (invoice: Invoice) => {
    if (!(await confirm('Process this invoice?', { danger: false }))) return;
    if (invoice.peppolStatus === 'NOT_SENT' && !(await confirm("You didn't send the Peppol XML. Are you sure?"))) return;
    await dossiersApi.processInvoice(invoice.id!);
    refetch();
    client.invalidateQueries({ queryKey: ['active-dossier'] });
  };

  const openTemplates = () =>
    openModal({
      title: 'Invoice Templates',
      size: 'lg',
      render: () => (
        <TemplatesManager
          queryKey="invoice"
          load={invoicesApi.listTemplates}
          add={invoicesApi.addTemplate}
          remove={(t) => invoicesApi.deleteTemplate(t.id!)}
        />
      ),
    });

  const toggleSort = (property: string) => setSort((s) => ({ property, direction: s.direction === 'ASC' ? 'DESC' : 'ASC' }));

  return (
    <>
      {unprocessed && !activeDossier && (
        <Alert color="red" icon={<Icon icon="times" />} mb="sm">
          No active dossier!
        </Alert>
      )}
      <Group justify="space-between" mb="sm">
        <Text c="dimmed">{!mode.bookmarked && !mode.logical && activeDossier && !mode.archived ? `Dossier: ${activeDossier.name}` : ''}</Text>
        {!mode.bookmarked && !mode.logical && isAdmin && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="outline" leftSection={<Icon icon="exclamation" />}>
                Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Icon icon="plus" />} disabled={mode.archived || (invoices?.content.length ?? 0) > 0} onClick={newInvoice}>
                New (ctrl+k)
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="sync" />} disabled={mode.archived} onClick={() => refetch()}>
                Reload
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="envelope" />} disabled={mode.archived} onClick={openTemplates}>
                Templates
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {invoices && (
        <>
          <Table.ScrollContainer minWidth={600}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>N°</Table.Th>
                  <Table.Th visibleFrom="md">
                    <SortHeader label="Created" property="dateCreation" sort={sort} onSort={toggleSort} />
                  </Table.Th>
                  <Table.Th>
                    <SortHeader label="Client" property="billTo.clientName" sort={sort} onSort={toggleSort} />
                  </Table.Th>
                  <Table.Th>
                    <SortHeader label="Date" property="dateOfInvoice" sort={sort} onSort={toggleSort} />
                  </Table.Th>
                  <Table.Th visibleFrom="md">Due Date</Table.Th>
                  <Table.Th visibleFrom="md">SubTotal</Table.Th>
                  <Table.Th visibleFrom="md">Taxes</Table.Th>
                  <Table.Th visibleFrom="md">Total</Table.Th>
                  <Table.Th visibleFrom="md">Peppol Status</Table.Th>
                  <Table.Th w={50}>Action</Table.Th>
                  {isAdmin && <Table.Th w={50} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody className={demoMode ? 'blur' : undefined}>
                {!invoices.content.length && (
                  <Table.Tr>
                    <Table.Td colSpan={11}>No Content</Table.Td>
                  </Table.Tr>
                )}
                {invoices.content.map((invoice) => (
                  <Table.Tr key={invoice.id} className="clickable" bg={invoice.creditNote ? 'yellow.0' : undefined} onClick={() => open(invoice)}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{invoice.newInvoiceNumber || invoice.invoiceNumber}</Text>
                        <ThumbnailPreview thumbnailId={thumbnailOf(invoice)} />
                        <ImportedInfo imported={invoice.imported} date={invoice.importedDate} />
                      </Group>
                    </Table.Td>
                    <Table.Td visibleFrom="md">{fmtDate(invoice.dateCreation)}</Table.Td>
                    <Table.Td>{invoice.billTo?.clientName}</Table.Td>
                    <Table.Td>{fmtDate(invoice.dateOfInvoice)}</Table.Td>
                    <Table.Td visibleFrom="md" c="artcoded">
                      {fmtDate(invoice.dueDate)}
                    </Table.Td>
                    <Table.Td visibleFrom="md">{fmtCurrency(invoice.subTotal)}</Table.Td>
                    <Table.Td visibleFrom="md">{fmtCurrency(invoice.taxes)}</Table.Td>
                    <Table.Td visibleFrom="md" c="red">
                      {fmtCurrency(invoice.total)}
                    </Table.Td>
                    <Table.Td visibleFrom="md">{invoice.peppolStatus}</Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="default" aria-label="invoice actions">
                            <Icon icon="ellipsis-v" />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<Icon icon="download" />} disabled={!invoice.invoiceUploadId} onClick={() => filesApi.download(invoice.invoiceUploadId!)}>
                            Download
                          </Menu.Item>
                          {isAdmin && (
                            <Menu.Item leftSection={<Icon icon="clock" />} disabled={!invoice.timesheetId} onClick={() => navigate(`/timesheets/timesheet/${invoice.timesheetId}`)}>
                              Timesheet
                            </Menu.Item>
                          )}
                          {isAdmin && (
                            <Menu.Item
                              leftSection={<Icon icon="mail-bulk" />}
                              disabled={!invoice.invoiceUploadId}
                              onClick={() =>
                                withUpload(invoice.invoiceUploadId, (u) =>
                                  openMailForm({
                                    attachments: [u],
                                    context: invoiceMailContext(invoice),
                                    defaultSubject: `Invoice ${invoice.newInvoiceNumber || invoice.invoiceNumber}`,
                                    to: [invoice.billTo?.emailAddress],
                                  }),
                                )
                              }
                            >
                              Send
                            </Menu.Item>
                          )}
                          {isAdmin && invoice.peppolStatus && (
                            <Menu.Item leftSection={<Icon icon="file-invoice" />} disabled={invoice.peppolStatus !== 'NOT_SENT'} onClick={() => sendToPeppol(invoice)}>
                              Send Peppol
                            </Menu.Item>
                          )}
                          <Menu.Item leftSection={<Icon icon="eye" />} onClick={() => open(invoice)}>
                            Open
                          </Menu.Item>
                          {isAdmin && activeDossier && !invoice.archived && !invoice.logicalDelete && (
                            <Menu.Item leftSection={<Icon icon="cog" />} onClick={() => process(invoice)}>
                              Process
                            </Menu.Item>
                          )}
                          {isAdmin && (
                            <Menu.Item leftSection={<Icon icon="plus" />} onClick={async () => open(await invoicesApi.fromTemplate(invoice.id!))}>
                              From Template
                            </Menu.Item>
                          )}
                          {isAdmin && !invoice.archived && invoices.content.length === 1 && (
                            <Menu.Item leftSection={<Icon icon="trash" />} color="red" onClick={() => remove(invoice)}>
                              Delete
                            </Menu.Item>
                          )}
                          {isAdmin && invoice.logicalDelete && (
                            <Menu.Item leftSection={<Icon icon="trash-restore" />} onClick={() => restore(invoice)}>
                              Restore
                            </Menu.Item>
                          )}
                          <Menu.Item leftSection={<Icon icon="file-pdf" />} disabled={!invoice.invoiceUploadId} onClick={() => withUpload(invoice.invoiceUploadId, openFileViewer)}>
                            View as PDF
                          </Menu.Item>
                          <Menu.Item leftSection={<Icon icon="file-code" />} disabled={!invoice.invoiceUBLId} onClick={() => withUpload(invoice.invoiceUBLId, openFileViewer)}>
                            Peppol XML
                          </Menu.Item>
                          {canMakeCreditNote(invoice) && (
                            <Menu.Item
                              leftSection={<Icon icon="cog" />}
                              onClick={async () => {
                                await invoicesApi.makeCreditNote(invoice.id!);
                                toast.success('Credit note created. Will be generated soon');
                              }}
                            >
                              Make credit note
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td>
                        <BookmarkButton bookmarked={invoice.bookmarked} onToggle={() => toggleBookmark(invoice)} />
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {invoices.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={invoices.page.totalPages} />
            </Group>
          )}
        </>
      )}
    </>
  );
}

export function InvoicePage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const tab = name ?? (isAdmin ? 'bookmarked' : 'processed');

  useEffect(() => {
    document.title = 'Invoices';
  }, []);

  const tabs: { value: string; label: ReactNode; mode: Mode; admin?: boolean }[] = [
    { value: 'bookmarked', label: <Group gap={4}><Icon icon="star" color="orange" />Bookmarks</Group>, mode: { bookmarked: true } },
    { value: 'unprocessed', label: 'Unprocessed', mode: { archived: false } },
    { value: 'processed', label: 'Processed', mode: { archived: true } },
    { value: 'deleted-logically', label: 'Deleted', mode: { logical: true }, admin: true },
  ];

  return (
    <>
      <PageTitle title="Invoices" />
      <Tabs value={tab} onChange={(v) => v && navigate(`/invoice/${v}`)} keepMounted={false}>
        <Tabs.List>
          {tabs
            .filter((t) => !t.admin || isAdmin)
            .map((t) => (
              <Tabs.Tab key={t.value} value={t.value}>
                {t.label}
              </Tabs.Tab>
            ))}
        </Tabs.List>
        {tabs.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} pt="sm">
            <FullscreenSection>
              <InvoiceTable mode={t.mode} />
            </FullscreenSection>
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
