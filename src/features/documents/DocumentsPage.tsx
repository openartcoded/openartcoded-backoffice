import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Badge, Button, Collapse, FileInput, Grid, Group, Menu, Pagination, Paper, Stack, Table, Tabs, TagsInput, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, FullscreenSection, PageTitle, ThumbnailPreview, useUploads } from '@/components/common';
import { canPreview, FileMenuItems, openFileViewer } from '@/components/files';
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
  const [opened, setOpened] = useState(true);
  const form = useForm({ initialValues: emptySearch });
  return (
    <Paper withBorder>
      <UnstyledButton w="100%" p="sm" onClick={() => setOpened((o) => !o)}>
        <Group justify="space-between">
          <Text fw={700}>Search Form</Text>
          <Icon icon={opened ? 'ellipsis-h' : 'eye'} />
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <form onSubmit={form.onSubmit(onSearch)}>
          <Stack gap="xs" p="sm" pt={0}>
            <TextInput label="Title" {...form.getInputProps('title')} />
            <TextInput label="Description" {...form.getInputProps('description')} />
            <TagsInput label="Tags" splitChars={[',']} {...form.getInputProps('tags')} />
            <TextInput type="date" label="From" {...form.getInputProps('dateAfter')} />
            <TextInput type="date" label="To" {...form.getInputProps('dateBefore')} />
            <Group justify="flex-end">
              <Button type="submit">Submit</Button>
              <Button
                variant="outline"
                color="red"
                onClick={() => {
                  form.reset();
                  onSearch(emptySearch);
                }}
              >
                Reset
              </Button>
            </Group>
          </Stack>
        </form>
      </Collapse>
    </Paper>
  );
}

function SplitPdf() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Stack>
      <FileInput value={file} onChange={setFile} accept=".pdf" placeholder="Select a pdf" />
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
  useHotkeys(isAdmin ? [['ctrl+k', () => edit()]] : []);

  const openRow = (doc: AdministrativeDocument) => {
    const attachment = attachmentOf(doc);
    if (attachment && canPreview(attachment)) openFileViewer(attachment, { blur: demoMode });
    else edit(doc);
  };

  const remove = async (doc: AdministrativeDocument) => {
    if (await confirm('Are you sure you want to delete this document?')) {
      await documentsApi.delete(doc.id!);
      refetch();
    }
  };

  const addToDossier = async (doc: AdministrativeDocument) => {
    if (await confirm('Add document to dossier?', { danger: false })) {
      await dossiersApi.addDocument(doc.id!);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['active-dossier'] });
    }
  };

  const toggleBookmark = async (doc: AdministrativeDocument) => {
    await documentsApi.toggleBookmarked(doc.id!);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  return (
    <>
      {isAdmin && (
        <Group justify="flex-end" mb="sm">
          <Button variant="outline" leftSection={<Icon icon="plus" />} onClick={() => edit()}>
            Add (ctrl+k)
          </Button>
          <Button
            variant="outline"
            leftSection={<Icon icon="arrows-split-up-and-left" />}
            onClick={() => openModal({ title: 'Split PDF', size: 'sm', render: () => <SplitPdf /> })}
          >
            Split
          </Button>
        </Group>
      )}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
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
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          {docs && (
            <>
              <Table className={demoMode ? 'blur' : undefined}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th visibleFrom="md">Creation Date</Table.Th>
                    <Table.Th visibleFrom="md">Size</Table.Th>
                    {isAdmin && <Table.Th w={90}>Actions</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {!docs.content.length && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>No content</Table.Td>
                    </Table.Tr>
                  )}
                  {docs.content.map((doc) => {
                    const attachment = attachmentOf(doc);
                    return (
                      <Table.Tr key={doc.id} className="clickable" onClick={() => openRow(doc)}>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm">{trim(doc.title, 40)}</Text>
                            {doc.tags?.map((t) => (
                              <Badge key={t} size="xs" variant="light">
                                {t}
                              </Badge>
                            ))}
                            <ThumbnailPreview thumbnailId={attachment?.thumbnailId} />
                          </Group>
                        </Table.Td>
                        <Table.Td visibleFrom="md">{fmtDate(doc.dateCreation)}</Table.Td>
                        <Table.Td visibleFrom="md">{bytesToHuman(attachment?.size)}</Table.Td>
                        {isAdmin && (
                          <Table.Td onClick={(e) => e.stopPropagation()}>
                            <Group gap={0} wrap="nowrap">
                              <BookmarkButton bookmarked={doc.bookmarked} onToggle={() => toggleBookmark(doc)} />
                              <Menu position="bottom-end">
                                <Menu.Target>
                                  <ActionIcon variant="default" aria-label="document actions">
                                    <Icon icon="ellipsis-v" />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item leftSection={<Icon icon="edit" />} onClick={() => edit(doc)}>
                                    Edit
                                  </Menu.Item>
                                  <Menu.Item leftSection={<Icon icon="trash" />} color="red" disabled={doc.locked} onClick={() => remove(doc)}>
                                    Delete
                                  </Menu.Item>
                                  {attachment && <FileMenuItems file={attachment} />}
                                  {attachment && (
                                    <Menu.Item leftSection={<Icon icon="mail-bulk" />} onClick={() => openMailForm({ attachments: [attachment] })}>
                                      Send
                                    </Menu.Item>
                                  )}
                                  {activeDossier && !doc.locked && (
                                    <Menu.Item leftSection={<Icon icon="cog" />} onClick={() => addToDossier(doc)}>
                                      Add to dossier
                                    </Menu.Item>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              {docs.page.totalPages > 1 && (
                <Group justify="flex-end" mt="sm">
                  <Pagination value={page} onChange={setPage} total={docs.page.totalPages} />
                </Group>
              )}
            </>
          )}
        </Grid.Col>
      </Grid>
    </>
  );
}

export function DocumentsPage() {
  const { name = 'home' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Administrative Documents';
  }, []);
  return (
    <>
      <PageTitle title="Documents" />
      <Tabs value={name} onChange={(v) => v && navigate(`/documents/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="home">Search</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" color="orange" />}>
            Bookmarks
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home" pt="sm">
          <FullscreenSection>
            <DocumentTable bookmarked={false} />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks" pt="sm">
          <FullscreenSection>
            <DocumentTable bookmarked />
          </FullscreenSection>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
