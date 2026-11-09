import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Button, FileInput, Group, Menu, Pagination, Stack, Table, Tabs } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, FullscreenSection, ImportedInfo, PageTitle } from '@/components/common';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { dossiersApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { errorMessage } from '@/api/http';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { fmtCurrency, fmtDateTime } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Dossier, SortCriteria } from '@/types';
import { DossierForm } from './DossierForm';

const PAGE_SIZE = 10;
const SORT: SortCriteria = { property: 'updatedDate', direction: 'DESC' };

function ImportForm({ onImport }: { onImport: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack>
      <Button variant="outline" onClick={() => dossiersApi.importExample()}>
        Download example
      </Button>
      <FileInput value={file} onChange={setFile} accept=".zip" placeholder="Select a zip" />
      <Button leftSection={<Icon icon="plus" />} disabled={!file} onClick={() => file && onImport(file)}>
        Import
      </Button>
    </Stack>
  );
}

/** keeps the dossier returned by the backend after each change and re-renders the form with it */
function DossierEditor({ initial, recallForModification, onChanged }: { initial: Dossier; recallForModification: boolean; onChanged: () => void }) {
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
          else if (d.id && recallForModification) refresh(await dossiersApi.recallForModification(d), 'Dossier updated');
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

export function DossierTable({ closed, bookmarked }: { closed?: boolean; bookmarked?: boolean }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: dossiers, refetch } = useQuery({
    queryKey: ['dossiers', { closed, bookmarked }, page],
    queryFn: () => (bookmarked ? dossiersApi.bookmarked(page - 1, PAGE_SIZE, SORT) : dossiersApi.findAllPaged(!!closed, page - 1, PAGE_SIZE, SORT)),
  });
  const content = dossiers?.content ?? [];
  const active = !closed && !bookmarked ? content[0] : undefined;
  const reload = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['active-dossier'] });
  };

  const open = (dossier: Dossier = { name: null, advancePayments: [] }, recallForModification = false) =>
    openModal({
      title: `Dossier <${dossier.name || 'New Dossier'}>`,
      size: 'xl',
      closeOnClickOutside: false,
      render: () => <DossierEditor initial={dossier} recallForModification={recallForModification} onChanged={reload} />,
    });

  const fromPrevious = async () => {
    if (!isAdmin || content.length > 0) return;
    open(await dossiersApi.fromPrevious());
  };
  useHotkeys(!closed && !bookmarked ? [['ctrl+k', fromPrevious]] : []);

  const closeActive = async () => {
    if (!(await confirm('Are you sure you want to close the dossier?'))) return;
    toast.success('Dossier closed. Generating ZIP');
    const d = await dossiersApi.closeActiveDossier();
    if (d.dossierUploadId) await filesApi.download(d.dossierUploadId);
    reload();
  };

  const importDossier = () =>
    openModal({
      title: 'Import Dossier',
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

  const sendMail = async (d: Dossier) => {
    if (!d.dossierUploadId) return;
    openMailForm({ attachments: [await filesApi.findById(d.dossierUploadId)], context: { Name: d.name } });
  };

  const modify = async (d: Dossier) => {
    if (await confirm('Are you sure you want to modify the dossier?', { danger: false })) open(d, true);
  };

  const toggleBookmark = async (d: Dossier) => {
    await dossiersApi.toggleBookmarked(d.id!);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  return (
    <>
      {!closed && !bookmarked && isAdmin && (
        <Group justify="flex-end" mb="sm">
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="outline" leftSection={<Icon icon="exclamation" />}>
                Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Icon icon="plus" />} disabled={content.length > 0} onClick={() => open()}>
                New
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="plus" />} disabled={content.length > 0} onClick={fromPrevious}>
                From Previous (ctrl+k)
              </Menu.Item>
              <Menu.Item
                leftSection={<Icon icon="times" />}
                disabled={!active || !!active.feeIds?.length || !!active.invoiceIds?.length}
                onClick={async () => {
                  await dossiersApi.deleteActiveDossier();
                  reload();
                }}
              >
                Delete
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="check" />} disabled={!active || (!active.feeIds?.length && !active.invoiceIds?.length)} onClick={closeActive}>
                Close
              </Menu.Item>
              <Menu.Item leftSection={<Icon icon="upload" />} onClick={importDossier}>
                Import
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      )}
      {dossiers && (
        <>
          <Table.ScrollContainer minWidth={600}>
            <Table className={demoMode ? 'blur' : undefined}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Date updated</Table.Th>
                  <Table.Th visibleFrom="md">Nb. Expenses</Table.Th>
                  <Table.Th visibleFrom="md">Nb. Invoices</Table.Th>
                  <Table.Th visibleFrom="md">Description</Table.Th>
                  <Table.Th>{closed ? 'Tva Due' : 'Tva Delta'}</Table.Th>
                  {isAdmin && <Table.Th w={50} />}
                  {closed && <Table.Th w={50}>Action</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {!content.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>No entries</Table.Td>
                  </Table.Tr>
                )}
                {content.map((d) => (
                  <Table.Tr key={d.id} className="clickable" onClick={() => open(d)}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {d.name}
                        <ImportedInfo imported={d.imported} date={d.importedDate} />
                      </Group>
                    </Table.Td>
                    <Table.Td>{fmtDateTime(d.updatedDate)}</Table.Td>
                    <Table.Td visibleFrom="md">{d.feeIds?.length}</Table.Td>
                    <Table.Td visibleFrom="md">{d.invoiceIds?.length}</Table.Td>
                    <Table.Td visibleFrom="md">{d.description}</Table.Td>
                    <Table.Td c={closed ? undefined : (d.tvaToBePaid ?? 0) > 0 ? 'red' : 'green'}>
                      {fmtCurrency(closed ? (d.tvaDue ?? 0) : d.tvaToBePaid)}
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td>
                        <BookmarkButton bookmarked={d.bookmarked} onToggle={() => toggleBookmark(d)} />
                      </Table.Td>
                    )}
                    {closed && (
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="default" aria-label="dossier actions">
                              <Icon icon="ellipsis-v" />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<Icon icon="download" />} onClick={() => d.dossierUploadId && filesApi.download(d.dossierUploadId)}>
                              Download
                            </Menu.Item>
                            {isAdmin && (
                              <Menu.Item leftSection={<Icon icon="mail-bulk" />} onClick={() => sendMail(d)}>
                                Send
                              </Menu.Item>
                            )}
                            {isAdmin && (
                              <Menu.Item leftSection={<Icon icon="edit" />} onClick={() => modify(d)}>
                                Edit
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {dossiers.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={dossiers.page.totalPages} />
            </Group>
          )}
        </>
      )}
    </>
  );
}

export function DossierPage() {
  const { name = 'open' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Dossiers';
  }, []);
  return (
    <>
      <PageTitle title="Dossier" />
      <Tabs value={name} onChange={(v) => v && navigate(`/dossier/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="open">Open</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" color="orange" />}>
            Bookmarks
          </Tabs.Tab>
          <Tabs.Tab value="closed">Closed</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="open" pt="sm">
          <FullscreenSection>
            <DossierTable closed={false} />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks" pt="sm">
          <FullscreenSection>
            <DossierTable bookmarked />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="closed" pt="sm">
          <FullscreenSection>
            <DossierTable closed />
          </FullscreenSection>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
