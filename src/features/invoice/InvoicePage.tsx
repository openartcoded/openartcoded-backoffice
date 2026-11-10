import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Button, Group, Loader, Pagination, Table, Tabs, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, ImportedInfo, ThumbnailPreview, useUploads } from '@/components/common';
import { EmptyRow, MoneyCell, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { downloadUpload, openFileViewer } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { dossiersApi, invoicesApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { errorMessage } from '@/api/http';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fmtDate } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Invoice, SortCriteria } from '@/types';
import { canMakeCreditNote, invoiceMailContext } from './logic';
import { openInvoiceDetail, type InvoiceFormResult } from './InvoiceDetail';

const PAGE_SIZE = 10;
const DEFAULT_SORT: SortCriteria = { property: 'dateCreation', direction: 'DESC' };

type Mode = { bookmarked?: boolean; archived?: boolean; logical?: boolean };

function SortHeader({
  label,
  property,
  sort,
  onSort,
}: {
  label: string;
  property: string;
  sort: SortCriteria;
  onSort: (p: string) => void;
}) {
  const active = sort.property === property;
  return (
    <UnstyledButton onClick={() => onSort(property)} fw={700} fz="sm">
      <Group gap={4} wrap="nowrap">
        {label}
        <Icon
          icon={!active ? 'arrows-up-down' : sort.direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
          color={active ? undefined : 'gray'}
        />
      </Group>
    </UnstyledButton>
  );
}

export function InvoiceTable({ mode, onSave }: { mode: Mode; onSave: (r: InvoiceFormResult) => void }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortCriteria>(DEFAULT_SORT);
  const key = ['invoices', mode, page, sort];
  const { data: invoices, refetch } = useQuery({
    queryKey: key,
    queryFn: () => invoicesApi.search({ ...mode, page: page - 1, size: PAGE_SIZE, sort }),
  });
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const { data: uploads = [] } = useUploads(
    invoices?.content.map((i) => i.invoiceUploadId).filter((id): id is string => !!id),
  );
  const thumbnailOf = (i: Invoice) => uploads.find((u) => u.id === i.invoiceUploadId)?.thumbnailId;

  useNotificationListener([RegisteredEvent.NEW_INVOICE], () => refetch());

  const open = (invoice: Invoice) => openInvoiceDetail(invoice, isAdmin ? onSave : undefined);

  const withUpload = async (id: string | undefined, fn: (u: Awaited<ReturnType<typeof filesApi.findById>>) => void) => {
    if (id) fn(await filesApi.findById(id));
  };

  const toggleBookmark = async (invoice: Invoice) => {
    await invoicesApi.toggleBookmarked(invoice.id!);
    toast.success(invoice.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refetch();
  };

  const remove = async (invoice: Invoice) => {
    if (
      await confirm(
        mode.logical
          ? 'Delete this invoice permanently? This cannot be undone.'
          : 'Move this invoice to the deleted invoices?',
      )
    ) {
      await invoicesApi.delete(invoice.id!, !mode.logical);
      refetch();
    }
  };

  const restore = async (invoice: Invoice) => {
    if (await confirm('Restore this invoice?', { danger: false })) {
      await invoicesApi.restore(invoice.id!);
      refetch();
    }
  };

  const sendToPeppol = async (invoice: Invoice) => {
    if (invoice.peppolStatus !== 'NOT_SENT') return;
    if (await confirm('Send this invoice to Peppol?', { danger: false })) {
      await invoicesApi.sendToPeppol(invoice.id!);
      toast.success('Sent to Peppol');
      refetch();
    }
  };

  const process = async (invoice: Invoice) => {
    if (!(await confirm('Process this invoice?', { danger: false }))) return;
    if (
      invoice.peppolStatus === 'NOT_SENT' &&
      !(await confirm("This invoice wasn't sent to Peppol. Process it anyway?"))
    )
      return;
    await dossiersApi.processInvoice(invoice.id!);
    refetch();
    client.invalidateQueries({ queryKey: ['active-dossier'] });
  };

  const toggleSort = (property: string) =>
    setSort((s) => ({ property, direction: s.direction === 'ASC' ? 'DESC' : 'ASC' }));
  const number = (i: Invoice) => i.newInvoiceNumber || i.invoiceNumber;

  const sendMail = (invoice: Invoice) =>
    withUpload(invoice.invoiceUploadId, (u) =>
      openMailForm({
        attachments: [u],
        context: invoiceMailContext(invoice),
        defaultSubject: `Invoice ${number(invoice)}`,
        to: [invoice.billTo?.emailAddress],
      }),
    );

  const actions = (invoice: Invoice) => (
    <RowActions
      inline={[
        {
          label: 'View PDF',
          icon: 'file-pdf',
          disabled: !invoice.invoiceUploadId,
          onClick: () => withUpload(invoice.invoiceUploadId, openFileViewer),
        },
        {
          label: 'Download',
          icon: 'download',
          disabled: !invoice.invoiceUploadId,
          onClick: () => downloadUpload(invoice.invoiceUploadId!),
        },
      ]}
      groups={[
        [
          {
            label: 'Send by email',
            icon: 'envelope',
            hidden: !isAdmin,
            disabled: !invoice.invoiceUploadId,
            onClick: () => sendMail(invoice),
          },
          {
            label: 'Send to Peppol',
            icon: 'paper-plane',
            hidden: !isAdmin || !invoice.peppolStatus,
            disabled: invoice.peppolStatus !== 'NOT_SENT',
            onClick: () => sendToPeppol(invoice),
          },
          {
            label: 'View Peppol XML',
            icon: 'file-code',
            disabled: !invoice.invoiceUBLId,
            onClick: () => withUpload(invoice.invoiceUBLId, openFileViewer),
          },
        ],
        [
          {
            label: 'Process',
            icon: 'check',
            hidden: !isAdmin || !activeDossier || !!invoice.archived || !!invoice.logicalDelete,
            onClick: () => process(invoice),
          },
          {
            label: 'Open timesheet',
            icon: 'clock',
            hidden: !isAdmin,
            disabled: !invoice.timesheetId,
            onClick: () => navigate(`/timesheets/timesheet/${invoice.timesheetId}`),
          },
          {
            label: 'New from this invoice',
            icon: 'copy',
            hidden: !isAdmin,
            onClick: async () => open(await invoicesApi.fromTemplate(invoice.id!)),
          },
          {
            label: 'Make credit note',
            icon: 'receipt',
            hidden: !canMakeCreditNote(invoice),
            onClick: async () => {
              await invoicesApi.makeCreditNote(invoice.id!);
              toast.success('Credit note created. Will be generated soon');
            },
          },
        ],
        [
          {
            label: 'Restore',
            icon: 'trash-restore',
            hidden: !isAdmin || !invoice.logicalDelete,
            onClick: () => restore(invoice),
          },
          {
            label: mode.logical ? 'Delete permanently' : 'Delete',
            icon: 'trash',
            color: 'red',
            hidden: !isAdmin || !!invoice.archived || invoices?.content.length !== 1,
            onClick: () => remove(invoice),
          },
        ],
      ]}
    />
  );

  if (!invoices) return <Loader />;

  return (
    <div className="fill-column">
      <div className="scroll-body">
        <Table.ScrollContainer minWidth={760}>
          <Table className="clickable-rows">
            <Table.Thead>
              <Table.Tr>
                {isAdmin && <Table.Th w={40} />}
                <Table.Th>Number</Table.Th>
                <Table.Th>
                  <SortHeader label="Client" property="billTo.clientName" sort={sort} onSort={toggleSort} />
                </Table.Th>
                <Table.Th>
                  <SortHeader label="Date" property="dateOfInvoice" sort={sort} onSort={toggleSort} />
                </Table.Th>
                <Table.Th visibleFrom="md">Due</Table.Th>
                <Table.Th visibleFrom="md" ta="right">
                  Subtotal
                </Table.Th>
                <Table.Th visibleFrom="md" ta="right">
                  VAT
                </Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th visibleFrom="md">Peppol</Table.Th>
                <Table.Th w={110} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody className={demoMode ? 'blur' : undefined}>
              {!invoices.content.length && (
                <EmptyRow
                  colSpan={10}
                  icon="file-invoice-dollar"
                  title="No invoices"
                  description={emptyDescription(mode)}
                />
              )}
              {invoices.content.map((invoice) => (
                <Table.Tr key={invoice.id} onClick={() => open(invoice)}>
                  {isAdmin && (
                    <Table.Td>
                      <BookmarkButton bookmarked={invoice.bookmarked} onToggle={() => toggleBookmark(invoice)} />
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <ThumbnailPreview thumbnailId={thumbnailOf(invoice)}>
                        <Text size="sm" fw={500}>
                          {number(invoice)}
                        </Text>
                      </ThumbnailPreview>
                      {invoice.creditNote && <StatusBadge value="CREDIT_NOTE" label="Credit note" color="orange" />}
                      <ImportedInfo imported={invoice.imported} date={invoice.importedDate} />
                    </Group>
                  </Table.Td>
                  <Table.Td>{invoice.billTo?.clientName}</Table.Td>
                  <Table.Td>{fmtDate(invoice.dateOfInvoice)}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(invoice.dueDate)}</Table.Td>
                  <MoneyCell value={invoice.subTotal} visibleFrom="md" />
                  <MoneyCell value={invoice.taxes} visibleFrom="md" />
                  <MoneyCell value={invoice.total} strong />
                  <Table.Td visibleFrom="md">
                    <StatusBadge value={invoice.peppolStatus} />
                  </Table.Td>
                  <Table.Td>{actions(invoice)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>
      {invoices.page.totalPages > 1 && (
        <Group justify="flex-end" mt="sm">
          <Pagination value={page} onChange={setPage} total={invoices.page.totalPages} />
        </Group>
      )}
    </div>
  );
}

const emptyDescription = (mode: Mode) =>
  mode.bookmarked
    ? 'Star an invoice to find it here.'
    : mode.logical
      ? 'Deleted invoices can be restored from here.'
      : mode.archived
        ? 'Invoices are moved here once processed in a dossier.'
        : 'New invoices are generated from a timesheet or created with "New invoice".';

const TABS: { value: string; label: string; mode: Mode; admin?: boolean }[] = [
  { value: 'bookmarked', label: 'Bookmarked', mode: { bookmarked: true } },
  { value: 'unprocessed', label: 'Unprocessed', mode: { archived: false } },
  { value: 'processed', label: 'Processed', mode: { archived: true } },
  { value: 'deleted-logically', label: 'Deleted', mode: { logical: true }, admin: true },
];

export function InvoicePage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const isAdmin = useIsAdmin();
  const tab = name ?? (isAdmin ? 'bookmarked' : 'processed');
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  // same query as the unprocessed table (shared cache): a new invoice can only be created when everything is processed
  const { data: unprocessed } = useQuery({
    queryKey: ['invoices', TABS[1].mode, 1, DEFAULT_SORT],
    queryFn: () => invoicesApi.search({ ...TABS[1].mode, page: 0, size: PAGE_SIZE, sort: DEFAULT_SORT }),
    enabled: isAdmin,
  });
  const canCreate = isAdmin && unprocessed?.content.length === 0;

  const save = async ({ invoice, manualUploadFile }: InvoiceFormResult) => {
    try {
      const saved = await invoicesApi.save(invoice);
      if (saved.uploadedManually && manualUploadFile && saved.id)
        await invoicesApi.manualUpload(saved.id, manualUploadFile);
      toast.success('Invoice created. Will be generated soon');
      client.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const newInvoice = async () => {
    if (!canCreate) return;
    openInvoiceDetail(await invoicesApi.newInvoice(), save);
  };
  useHotkeys([['alt+n', newInvoice]]);

  /** the invoice templates are managed with the other templates */
  const openTemplates = () => navigate('/templates?type=INVOICE');

  return (
    <>
      <PageHeader
        title="Invoices"
        description={activeDossier ? `Active dossier: ${activeDossier.name}` : undefined}
        actions={
          isAdmin && (
            <>
              <Button variant="default" leftSection={<Icon icon="envelope" />} onClick={openTemplates}>
                Templates
              </Button>
              <Tooltip label={canCreate ? 'Alt+N' : 'Process the unprocessed invoices first'}>
                <Button leftSection={<Icon icon="plus" />} disabled={!canCreate} onClick={newInvoice}>
                  New invoice
                </Button>
              </Tooltip>
            </>
          )
        }
      />
      {isAdmin && !activeDossier && (
        <Alert color="yellow" icon={<Icon icon="exclamation-triangle" />} mb="md" title="No active dossier">
          Invoices can't be processed until a dossier is opened.
        </Alert>
      )}
      <Tabs className="page-tabs" value={tab} onChange={(v) => v && navigate(`/invoice/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          {TABS.filter((t) => !t.admin || isAdmin).map((t) => (
            <Tabs.Tab
              key={t.value}
              value={t.value}
              leftSection={t.value === 'bookmarked' ? <Icon icon="star" /> : undefined}
            >
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            <InvoiceTable mode={t.mode} onSave={save} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
