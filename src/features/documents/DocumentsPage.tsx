import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, FileInput, Group, Pagination, Popover, Stack, Table, Tabs, TagsInput, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, ThumbnailPreview, useUploads } from '@/components/common';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { canPreview, downloadUpload, openFileViewer } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { documentsApi, dossiersApi, pdfApi } from '@/api/billing';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { bytesToHuman, dayjs, fmtDate, trim } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { AdministrativeDocument, AdministrativeDocumentSearchCriteria } from '@/types';
import { openDocumentEditor } from './DocumentEditor';

const PAGE_SIZE = 10;
const emptySearch = { title: '', description: '', tags: [] as string[], dateAfter: '', dateBefore: '' };

function SearchForm({ onSearch }: { onSearch: (v: typeof emptySearch) => void }) {
  const form = useForm({ initialValues: emptySearch });
  const extra = [form.values.description, form.values.tags.length].filter(Boolean).length;
  return (
    <form onSubmit={form.onSubmit(onSearch)}>
      <Group gap="xs" mb="md" wrap="wrap">
        <TextInput w={240} placeholder="Title" aria-label="Title" leftSection={<Icon icon="search" />} {...form.getInputProps('title')} />
        <TextInput w={150} type="date" aria-label="From" {...form.getInputProps('dateAfter')} />
        <TextInput w={150} type="date" aria-label="To" {...form.getInputProps('dateBefore')} />
        <Popover position="bottom-start" shadow="md" width={300}>
          <Popover.Target>
            <Button variant="default" rightSection={extra ? <Badge size="xs" circle>{extra}</Badge> : undefined}>
              More filters
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <TextInput label="Description contains" {...form.getInputProps('description')} />
              <TagsInput label="Tags" splitChars={[',']} {...form.getInputProps('tags')} />
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Button type="submit" variant="light">
          Search
        </Button>
        {form.isDirty() && (
          <Button
            variant="subtle"
            color="gray"
            onClick={() => {
              form.reset();
              onSearch(emptySearch);
            }}
          >
            Reset
          </Button>
        )}
      </Group>
    </form>
  );
}

function SplitPdf() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Splits a PDF into one file per page.
      </Text>
      <FileInput value={file} onChange={setFile} accept=".pdf" placeholder="Select a PDF" />
      <Button leftSection={<Icon icon="arrows-split-up-and-left" />} disabled={!file} onClick={() => file && pdfApi.split(file)}>
        Split
      </Button>
    </Stack>
  );
}

export function DocumentTable({ bookmarked }: { bookmarked: boolean }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<AdministrativeDocumentSearchCriteria>({ bookmarked });
  const [page, setPage] = useState(1);
  const { data: docs, refetch } = useQuery({
    queryKey: ['documents', criteria, page],
    queryFn: () => documentsApi.search(criteria, page - 1, PAGE_SIZE),
  });
  const { data: activeDossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const { data: attachments = [] } = useUploads(docs?.content.map((d) => d.attachmentId).filter((id): id is string => !!id));
  const attachmentOf = (d: AdministrativeDocument) => attachments.find((a) => a.id === d.attachmentId);

  useNotificationListener([RegisteredEvent.ADMINISTRATIVE_DOCUMENT_ADDED, RegisteredEvent.ADMINISTRATIVE_DOCUMENT_DELETED], () => refetch());

  const edit = (doc: AdministrativeDocument = { title: '' }) =>
    openDocumentEditor(doc, {
      onSubmit: async (form) => {
        await documentsApi.save(form);
        toast.success('document will be uploaded');
      },
    });

  const openRow = (doc: AdministrativeDocument) => {
    const attachment = attachmentOf(doc);
    if (attachment && canPreview(attachment)) openFileViewer(attachment, { blur: demoMode });
    else edit(doc);
  };

  const remove = async (doc: AdministrativeDocument) => {
    if (await confirm(`Delete the document ${doc.title ?? ''}?`)) {
      await documentsApi.delete(doc.id!);
      refetch();
    }
  };

  const addToDossier = async (doc: AdministrativeDocument) => {
    if (await confirm(`Add this document to the dossier ${activeDossier?.name ?? ''}?`, { danger: false })) {
      await dossiersApi.addDocument(doc.id!);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['active-dossier'] });
    }
  };

  const toggleBookmark = async (doc: AdministrativeDocument) => {
    await documentsApi.toggleBookmarked(doc.id!);
    toast.success(doc.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refetch();
  };

  return (
    <div className="fill-column">
      <SearchForm
        onSearch={(v) => {
          setPage(1);
          setCriteria({
            bookmarked,
            title: v.title.trim() || null,
            description: v.description.trim() || null,
            tags: v.tags.length ? v.tags : null,
            dateBefore: v.dateBefore ? dayjs(v.dateBefore).hour(23).minute(59).toDate() : null,
            dateAfter: v.dateAfter ? dayjs(v.dateAfter).hour(1).minute(0).toDate() : null,
          });
        }}
      />
      {docs && (
        <>
          <div className="scroll-body">
            <Table.ScrollContainer minWidth={560}>
            <Table className="clickable-rows">
              <Table.Thead>
                <Table.Tr>
                  {isAdmin && <Table.Th w={40} />}
                  <Table.Th>Title</Table.Th>
                  <Table.Th visibleFrom="md">Created</Table.Th>
                  <Table.Th visibleFrom="md" ta="right">
                    Size
                  </Table.Th>
                  <Table.Th w={110} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody className={demoMode ? 'blur' : undefined}>
                {!docs.content.length && <EmptyRow colSpan={5} icon="file-lines" title="No documents" description="Contracts, certificates, statements... anything administrative." />}
                {docs.content.map((doc) => {
                  const attachment = attachmentOf(doc);
                  return (
                    <Table.Tr key={doc.id} onClick={() => openRow(doc)}>
                      {isAdmin && (
                        <Table.Td>
                          <BookmarkButton bookmarked={doc.bookmarked} onToggle={() => toggleBookmark(doc)} />
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <ThumbnailPreview thumbnailId={attachment?.thumbnailId}>
                            <Text size="sm" fw={500}>
                              {trim(doc.title, 50)}
                            </Text>
                          </ThumbnailPreview>
                          {doc.locked && <StatusBadge value="LOCKED" label="In a dossier" color="gray" />}
                          {doc.tags?.map((t) => (
                            <Badge key={t} size="sm" variant="default" radius="sm" tt="none" fw={400}>
                              {t}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td visibleFrom="md">{fmtDate(doc.dateCreation)}</Table.Td>
                      <Table.Td visibleFrom="md" ta="right" c="dimmed">
                        {bytesToHuman(attachment?.size)}
                      </Table.Td>
                      <Table.Td>
                        <RowActions
                          inline={[
                            { label: 'Open', icon: 'eye', hidden: !attachment || !canPreview(attachment), onClick: () => attachment && openFileViewer(attachment, { blur: demoMode }) },
                            { label: 'Download', icon: 'download', hidden: !attachment, onClick: () => attachment && downloadUpload(attachment.id, attachment.originalFilename) },
                          ]}
                          groups={
                            isAdmin
                              ? [
                                  [
                                    { label: 'Edit', icon: 'edit', onClick: () => edit(doc) },
                                    { label: 'Send by email', icon: 'envelope', hidden: !attachment, onClick: () => attachment && openMailForm({ attachments: [attachment] }) },
                                    { label: 'Add to dossier', icon: 'folder-open', hidden: !activeDossier || !!doc.locked, onClick: () => addToDossier(doc) },
                                  ],
                                  [{ label: 'Delete', icon: 'trash', color: 'red', disabled: doc.locked, onClick: () => remove(doc) }],
                                ]
                              : []
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          </div>
          {docs.page.totalPages > 1 && (
            <Group justify="flex-end" mt="sm">
              <Pagination value={page} onChange={setPage} total={docs.page.totalPages} />
            </Group>
          )}
        </>
      )}
    </div>
  );
}

export function DocumentsPage() {
  const { name = 'home' } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const edit = () =>
    openDocumentEditor(
      { title: '' },
      {
        onSubmit: async (form) => {
          await documentsApi.save(form);
          toast.success('Document will be uploaded');
        },
      },
    );
  useHotkeys(isAdmin ? [['alt+n', edit]] : []);

  return (
    <>
      <PageHeader
        title="Documents"
        documentTitle="Administrative documents"
        description="Administrative documents, searchable and attachable to a dossier."
        actions={
          isAdmin && (
            <>
              <Button variant="default" leftSection={<Icon icon="arrows-split-up-and-left" />} onClick={() => openModal({ title: 'Split a PDF', size: 'sm', render: () => <SplitPdf /> })}>
                Split PDF
              </Button>
              <Tooltip label="Alt+N">
                <Button leftSection={<Icon icon="plus" />} onClick={edit}>
                  New document
                </Button>
              </Tooltip>
            </>
          )
        }
      />
      <Tabs className="page-tabs" value={name} onChange={(v) => v && navigate(`/documents/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="home">All</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" />}>
            Bookmarked
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home">
          <DocumentTable bookmarked={false} />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <DocumentTable bookmarked />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
