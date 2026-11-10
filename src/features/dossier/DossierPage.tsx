import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Anchor,
  Button,
  FileInput,
  Group,
  Loader,
  Pagination,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, ImportedInfo } from '@/components/common';
import { downloadUpload } from '@/components/files';
import { EmptyRow, EmptyState, MoneyCell, PageHeader, RowActions, Stat, StatusBadge } from '@/components/ui';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { openDrawer } from '@/components/drawer';
import { dossiersApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { errorMessage } from '@/api/http';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Dossier, SortCriteria } from '@/types';
import { DossierForm } from './DossierForm';

const PAGE_SIZE = 10;
const SORT: SortCriteria = { property: 'updatedDate', direction: 'DESC' };

function ImportForm({ onImport }: { onImport: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Import closed dossiers from a zip.{' '}
        <Anchor size="sm" onClick={() => dossiersApi.importExample()}>
          Download an example
        </Anchor>
      </Text>
      <FileInput value={file} onChange={setFile} accept=".zip" placeholder="Select a zip" />
      <Button leftSection={<Icon icon="plus" />} disabled={!file} onClick={() => file && onImport(file)}>
        Import
      </Button>
    </Stack>
  );
}

/** keeps the dossier returned by the backend after each change and re-renders the form with it */
function DossierEditor({
  initial,
  recallForModification,
  onChanged,
}: {
  initial: Dossier;
  recallForModification: boolean;
  onChanged: () => void;
}) {
  const [dossier, setDossier] = useState(initial);
  const [version, setVersion] = useState(0);
  const refresh = (saved: Dossier, message: string) => {
    toast.success(message);
    onChanged();
    setDossier(saved);
    setVersion((v) => v + 1);
  };
  return (
    <DossierForm
      key={version}
      dossier={dossier}
      recallForModification={recallForModification}
      onSubmit={async (d) => {
        try {
          if (d.id && !d.closed) refresh(await dossiersApi.updateDossier(d), 'Dossier updated');
          else if (d.id && recallForModification)
            refresh(await dossiersApi.recallForModification(d), 'Dossier updated');
          else if (!d.id) refresh(await dossiersApi.newDossier(d), 'Dossier created');
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
      onRemoveFee={async (f) => refresh(await dossiersApi.removeFee(f.id), 'Expense removed')}
      onRemoveInvoice={async (i) => refresh(await dossiersApi.removeInvoice(i.id!), 'Invoice removed')}
      onRemoveDocument={async (doc) => refresh(await dossiersApi.removeDocument(doc.id!), 'Document removed')}
    />
  );
}

/** opening, mailing, reopening and bookmarking a dossier; reload: after a change */
function useDossierActions(reload: () => void) {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const refresh = () => {
    reload();
    queryClient.invalidateQueries({ queryKey: ['active-dossier'] });
    queryClient.invalidateQueries({ queryKey: ['dossiers'] });
  };
  const open = (dossier: Dossier = { name: null, advancePayments: [] }, recallForModification = false) =>
    openDrawer({
      title: dossier.name ? `Dossier ${dossier.name}` : 'New dossier',
      size: 1000,
      closeOnClickOutside: false,
      render: () => (
        <DossierEditor initial={dossier} recallForModification={recallForModification} onChanged={refresh} />
      ),
    });
  const sendMail = async (d: Dossier) => {
    if (!d.dossierUploadId) return;
    openMailForm({ attachments: [await filesApi.findById(d.dossierUploadId)], context: { Name: d.name } });
  };
  const modify = async (d: Dossier) => {
    if (await confirm('Reopen this closed dossier to change it?', { danger: false })) open(d, true);
  };
  const toggleBookmark = async (d: Dossier) => {
    await dossiersApi.toggleBookmarked(d.id!);
    toast.success(d.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refresh();
  };
  return { isAdmin, open, sendMail, modify, toggleBookmark, refresh };
}

/** downloads the annual report of a year; loading: the year being generated */
function useAnnualReport() {
  const [loading, setLoading] = useState<number | null>(null);
  const download = async (year: number) => {
    setLoading(year);
    try {
      await dossiersApi.generateAnnualReport(year);
    } catch (e) {
      toast.error(`Could not generate the annual report: ${errorMessage(e)}`);
    } finally {
      setLoading(null);
    }
  };
  return { loading, download };
}

/** the table of some dossiers (closed or bookmarked) */
function DossierRows({
  dossiers,
  actions,
  emptyTitle,
  emptyDescription,
}: {
  dossiers: Dossier[];
  actions: ReturnType<typeof useDossierActions>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const demoMode = useDemoMode();
  const { isAdmin, open, sendMail, modify, toggleBookmark } = actions;
  return (
    <Table.ScrollContainer minWidth={600}>
      <Table className="clickable-rows">
        <Table.Thead>
          <Table.Tr>
            {isAdmin && <Table.Th w={40} />}
            <Table.Th>Name</Table.Th>
            <Table.Th visibleFrom="md">Description</Table.Th>
            <Table.Th ta="center">Expenses</Table.Th>
            <Table.Th ta="center">Invoices</Table.Th>
            <Table.Th ta="right">VAT due</Table.Th>
            <Table.Th visibleFrom="md">Closed</Table.Th>
            <Table.Th w={110} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody className={demoMode ? 'blur' : undefined}>
          {!dossiers.length && (
            <EmptyRow colSpan={8} icon="folder-open" title={emptyTitle} description={emptyDescription} />
          )}
          {dossiers.map((d) => (
            <Table.Tr key={d.id} onClick={() => open(d)}>
              {isAdmin && (
                <Table.Td>
                  <BookmarkButton bookmarked={d.bookmarked} onToggle={() => toggleBookmark(d)} />
                </Table.Td>
              )}
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={500}>
                    {d.name}
                  </Text>
                  <ImportedInfo imported={d.imported} date={d.importedDate} />
                </Group>
              </Table.Td>
              <Table.Td visibleFrom="md" c="dimmed">
                <Text size="sm" lineClamp={1}>
                  {d.description}
                </Text>
              </Table.Td>
              <Table.Td ta="center">{d.feeIds?.length ?? 0}</Table.Td>
              <Table.Td ta="center">{d.invoiceIds?.length ?? 0}</Table.Td>
              <MoneyCell value={d.closed ? (d.tvaDue ?? 0) : d.tvaToBePaid} />
              <Table.Td visibleFrom="md">{fmtDate(d.closedDate ?? d.updatedDate)}</Table.Td>
              <Table.Td>
                <RowActions
                  inline={[
                    {
                      label: 'Download',
                      icon: 'download',
                      hidden: !d.closed,
                      disabled: !d.dossierUploadId,
                      onClick: () => downloadUpload(d.dossierUploadId!),
                    },
                  ]}
                  groups={[
                    [
                      {
                        label: 'Send by email',
                        icon: 'envelope',
                        hidden: !isAdmin || !d.closed,
                        onClick: () => sendMail(d),
                      },
                      {
                        label: 'Reopen for changes',
                        icon: 'edit',
                        hidden: !isAdmin || !d.closed,
                        onClick: () => modify(d),
                      },
                    ],
                  ]}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** the closed dossiers, one tab per year (the most recent first), each with its annual report */
export function ClosedDossiers() {
  const {
    data: years,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['dossiers', 'closed-by-year'],
    queryFn: dossiersApi.closedByYear,
  });
  const actions = useDossierActions(() => refetch());
  const report = useAnnualReport();
  const [year, setYear] = useState<string | null>(null);

  if (isLoading || !years) return <Loader />;
  if (!years.length) {
    return (
      <Paper withBorder>
        <EmptyState
          icon="folder-open"
          title="No closed dossier"
          description="Closed dossiers and their archives show up here, by year."
        />
      </Paper>
    );
  }
  const selected = year && years.some((y) => String(y.year) === year) ? year : String(years[0].year);
  return (
    <Tabs value={selected} onChange={setYear} variant="pills" keepMounted={false}>
      <Tabs.List mb="sm">
        {years.map((y) => (
          <Tabs.Tab key={y.year} value={String(y.year)}>
            {y.year}{' '}
            <Text span size="xs" c="dimmed">
              ({y.dossiers.length})
            </Text>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {years.map((y) => (
        <Tabs.Panel key={y.year} value={String(y.year)}>
          <Group justify="space-between" mb="sm">
            <Text size="sm" c="dimmed">
              {y.dossiers.length} closed dossier{y.dossiers.length > 1 ? 's' : ''} in {y.year}
            </Text>
            <Tooltip label={`${y.year} compared with the other years, and where the last three years lead`}>
              <Button
                variant="default"
                leftSection={<Icon icon="file-pdf" />}
                loading={report.loading === y.year}
                onClick={() => report.download(y.year)}
              >
                Annual report {y.year}
              </Button>
            </Tooltip>
          </Group>
          <DossierRows
            dossiers={y.dossiers}
            actions={actions}
            emptyTitle="No closed dossier"
            emptyDescription={`No dossier of ${y.year} is closed.`}
          />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

export function DossierTable({ closed, bookmarked }: { closed?: boolean; bookmarked?: boolean }) {
  const demoMode = useDemoMode();
  const [page, setPage] = useState(1);
  const { data: dossiers, refetch } = useQuery({
    queryKey: ['dossiers', { closed, bookmarked }, page],
    queryFn: () =>
      bookmarked
        ? dossiersApi.bookmarked(page - 1, PAGE_SIZE, SORT)
        : dossiersApi.findAllPaged(!!closed, page - 1, PAGE_SIZE, SORT),
  });
  const actions = useDossierActions(() => refetch());
  const { isAdmin, open, refresh } = actions;
  const report = useAnnualReport();
  const content = dossiers?.content ?? [];
  const active = !closed && !bookmarked ? content[0] : undefined;

  const fromPrevious = async () => {
    if (!isAdmin || content.length > 0) return;
    open(await dossiersApi.fromPrevious());
  };
  useHotkeys(!closed && !bookmarked ? [['alt+n', fromPrevious]] : []);

  const closeActive = async () => {
    if (!(await confirm('Close the dossier? Its archive (zip) will be generated and downloaded.', { danger: false })))
      return;
    toast.success('Dossier closed. Generating ZIP');
    const d = await dossiersApi.closeActiveDossier();
    if (d.dossierUploadId) await filesApi.download(d.dossierUploadId);
    refresh();
  };

  const removeActive = async () => {
    if (!(await confirm('Delete the active dossier? It has no expense nor invoice.'))) return;
    await dossiersApi.deleteActiveDossier();
    refresh();
  };

  if (!dossiers) return <Loader />;

  // open tab: the active dossier as a card, or how to start one
  if (!closed && !bookmarked) {
    if (!active) {
      return (
        <Paper withBorder>
          <EmptyState
            icon="folder-open"
            title="No active dossier"
            description="Expenses and invoices are processed into the active dossier. Start one for the current period."
            action={
              isAdmin && (
                <Group gap="xs" mt="xs">
                  <Button variant="default" onClick={() => open()}>
                    Empty dossier
                  </Button>
                  <Tooltip label="Alt+N">
                    <Button leftSection={<Icon icon="plus" />} onClick={fromPrevious}>
                      From the previous dossier
                    </Button>
                  </Tooltip>
                </Group>
              )
            }
          />
        </Paper>
      );
    }
    const empty = !active.feeIds?.length && !active.invoiceIds?.length;
    const currentYear = new Date().getFullYear();
    return (
      <Paper withBorder p="lg" className={demoMode ? 'blur' : undefined}>
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Group gap="xs">
              <Text fw={600} size="lg">
                {active.name}
              </Text>
              <StatusBadge value="ACTIVE" label="Active" color="green" />
              <ImportedInfo imported={active.imported} date={active.importedDate} />
            </Group>
            {active.description && (
              <Text size="sm" c="dimmed" mt={2}>
                {active.description}
              </Text>
            )}
          </div>
          <Group gap="xs">
            {isAdmin && empty && (
              <Button variant="subtle" color="red" onClick={removeActive}>
                Delete
              </Button>
            )}
            <Tooltip label={`${currentYear} so far, compared with the other years, and where it leads`}>
              <Button
                variant="default"
                leftSection={<Icon icon="file-pdf" />}
                loading={report.loading === currentYear}
                onClick={() => report.download(currentYear)}
              >
                Year report
              </Button>
            </Tooltip>
            {isAdmin && (
              <Tooltip label="Add expenses or invoices first" disabled={!empty}>
                <Button variant="default" leftSection={<Icon icon="check" />} disabled={empty} onClick={closeActive}>
                  Close dossier
                </Button>
              </Tooltip>
            )}
            <Button leftSection={<Icon icon="folder-open" />} onClick={() => open(active)}>
              Open
            </Button>
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Expenses" value={active.feeIds?.length ?? 0} />
          <Stat label="Invoices" value={active.invoiceIds?.length ?? 0} />
          <Stat label="VAT to pay (estimate)" value={fmtCurrency(active.tvaToBePaid)} strong />
          <Stat label="Last update" value={fmtDateTime(active.updatedDate)} />
        </SimpleGrid>
      </Paper>
    );
  }

  return (
    <div className="fill-column">
      <div className="scroll-body">
        <DossierRows
          dossiers={content}
          actions={actions}
          emptyTitle={bookmarked ? 'No bookmarked dossier' : 'No closed dossier'}
          emptyDescription={
            bookmarked ? 'Star a dossier to find it here.' : 'Closed dossiers and their archives show up here.'
          }
        />
      </div>
      {dossiers.page.totalPages > 1 && (
        <Group justify="flex-end" mt="sm">
          <Pagination value={page} onChange={setPage} total={dossiers.page.totalPages} />
        </Group>
      )}
    </div>
  );
}

export function DossierPage() {
  const { name = 'open' } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  const importDossier = () =>
    openModal({
      title: 'Import dossiers',
      size: 'sm',
      render: (close) => (
        <ImportForm
          onImport={async (file) => {
            close();
            await dossiersApi.import(file);
            toast.success('Dossier(s) will be imported.');
          }}
        />
      ),
    });

  return (
    <>
      <PageHeader
        title="Dossiers"
        description="A dossier groups the expenses and invoices of a VAT period."
        actions={
          isAdmin && (
            <Button variant="default" leftSection={<Icon icon="upload" />} onClick={importDossier}>
              Import
            </Button>
          )
        }
      />
      <Tabs className="page-tabs" value={name} onChange={(v) => v && navigate(`/dossier/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="open">Active</Tabs.Tab>
          <Tabs.Tab value="closed">Closed</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" />}>
            Bookmarked
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open">
          <DossierTable closed={false} />
        </Tabs.Panel>
        <Tabs.Panel value="closed">
          <ClosedDossiers />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <DossierTable bookmarked />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
