import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Alert, Anchor, Button, Collapse, Grid, Group, Loader, Menu, Pagination, Paper, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Icon } from '@/components/Icon';
import { BookmarkButton, CopyButton, FullscreenSection, PageTitle, ThumbnailPreview } from '@/components/common';
import { FileMenuItems } from '@/components/files';
import { filesApi } from '@/api/files';
import { fileSearchApi } from '@/api/misc';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { bytesToHuman, dayjs, fmtDateTime, trim } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { FileUploadSearchCriteria } from '@/types';
import { searchErrorMessage, skippedFiles, snippet, SNIPPET_LENGTH, toDisplayHit, uploadIdFromFileName, type DisplayHit } from './fileSearch';

const PAGE_SIZE = 10;
const emptySearch = { id: '', correlationId: '', originalFilename: '', dateAfter: '', dateBefore: '', publicResource: null as string | null };

function SearchForm({ isAdmin, onSearch }: { isAdmin: boolean; onSearch: (v: typeof emptySearch) => void }) {
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
            <TextInput label="Id" {...form.getInputProps('id')} />
            {isAdmin && <TextInput label="Correlation Id" {...form.getInputProps('correlationId')} />}
            <TextInput label="FileName" {...form.getInputProps('originalFilename')} />
            <TextInput type="date" label="From" {...form.getInputProps('dateAfter')} />
            <TextInput type="date" label="To" {...form.getInputProps('dateBefore')} />
            <Select
              label="Public"
              placeholder="Select option..."
              data={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
              clearable
              {...form.getInputProps('publicResource')}
            />
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

export function UploadTable({ bookmarked }: { bookmarked: boolean }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const [criteria, setCriteria] = useState<FileUploadSearchCriteria>({ bookmarked });
  const [page, setPage] = useState(1);
  const { data: uploads, refetch } = useQuery({ queryKey: ['uploads-search', criteria, page], queryFn: () => filesApi.search(criteria, page - 1, PAGE_SIZE) });
  const { data: links = {} } = useQuery({ queryKey: ['correlation-links'], queryFn: filesApi.correlationLinks });

  const toggleBookmark = async (id: string) => {
    await filesApi.toggleBookmarked(id);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  return (
    <>
      {uploads && isAdmin && (
        <Text fw={700} ta="right" mb="sm">
          Total: {uploads.page.totalElements}
        </Text>
      )}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <SearchForm
            isAdmin={isAdmin}
            onSearch={(v) => {
              setPage(1);
              setCriteria({
                bookmarked,
                id: v.id.trim() || null,
                correlationId: v.correlationId.trim() || null,
                originalFilename: v.originalFilename || null,
                publicResource: v.publicResource === null ? null : v.publicResource === 'true',
                dateBefore: v.dateBefore ? dayjs(v.dateBefore).hour(23).minute(59).toDate() : null,
                dateAfter: v.dateAfter ? dayjs(v.dateAfter).hour(1).minute(0).toDate() : null,
              });
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          {uploads && (
            <>
              <Table.ScrollContainer minWidth={600}>
                <Table className={demoMode ? 'blur' : undefined}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Creation Date</Table.Th>
                      <Table.Th>Filename</Table.Th>
                      {isAdmin && <Table.Th>Correlation</Table.Th>}
                      <Table.Th>Public</Table.Th>
                      <Table.Th>Size</Table.Th>
                      {isAdmin && <Table.Th w={90}>Actions</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {!uploads.content.length && (
                      <Table.Tr>
                        <Table.Td colSpan={6}>No content</Table.Td>
                      </Table.Tr>
                    )}
                    {uploads.content.map((u) => (
                      <Table.Tr key={u.id}>
                        <Table.Td>{fmtDateTime(u.creationDate)}</Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm" className="text-break">
                              {trim(u.originalFilename, 40)}
                            </Text>
                            <ThumbnailPreview thumbnailId={u.thumbnailId} />
                          </Group>
                        </Table.Td>
                        {isAdmin && (
                          <Table.Td>
                            <CopyButton
                              variant="subtle"
                              text={u.correlationId}
                              label={(u.correlationId && links[u.correlationId]) || 'N/A'}
                              successMessage="Correlation Id copied"
                            />
                          </Table.Td>
                        )}
                        <Table.Td>{u.publicResource ? 'Yes' : 'No'}</Table.Td>
                        <Table.Td>{bytesToHuman(u.size)}</Table.Td>
                        {isAdmin && (
                          <Table.Td>
                            <Group gap={0} wrap="nowrap">
                              <BookmarkButton bookmarked={u.bookmarked} onToggle={() => toggleBookmark(u.id)} />
                              <Menu position="bottom-end">
                                <Menu.Target>
                                  <ActionIcon variant="default" aria-label="upload actions">
                                    <Icon icon="ellipsis-v" />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <FileMenuItems file={u} />
                                  <Menu.Item leftSection={<Icon icon="trash" />} disabled>
                                    Delete (disabled)
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {uploads.page.totalPages > 1 && (
                <Group justify="flex-end" mt="sm">
                  <Pagination value={page} onChange={setPage} total={uploads.page.totalPages} />
                </Group>
              )}
            </>
          )}
        </Grid.Col>
      </Grid>
    </>
  );
}

const FUZZY_PAGE_SIZE = 2;

export function FuzzySearch() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(0);
  const [showSkipped, setShowSkipped] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const stats = useQuery({ queryKey: ['file-search-stats'], queryFn: fileSearchApi.stats });
  const search = useQuery({
    queryKey: ['file-search', submitted, page],
    enabled: !!submitted,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<DisplayHit[]> => {
      const results = await fileSearchApi.search(submitted, page, FUZZY_PAGE_SIZE);
      if (!Array.isArray(results)) throw new Error('Unexpected response from file-search.');
      return Promise.all(
        results.map(toDisplayHit).map(async (hit) => {
          const id = uploadIdFromFileName(hit.fileName);
          if (!id) return hit;
          try {
            const upload = await filesApi.findById(id);
            return upload?.id === id ? { ...hit, upload } : hit;
          } catch {
            return hit;
          }
        }),
      );
    },
  });
  const hits = search.data ?? [];
  const error = search.error
    ? searchErrorMessage(axios.isAxiosError(search.error) ? search.error.response?.status : undefined, search.error.message)
    : '';
  const skipped = skippedFiles(stats.data);

  return (
    <Stack>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setExpanded({});
          setSubmitted(query.trim());
        }}
      >
        <Group wrap="nowrap">
          <TextInput style={{ flex: 1 }} type="search" maxLength={4096} placeholder="e.g. invioce" autoComplete="off" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Button type="submit" disabled={search.isFetching || !query.trim()}>
            Search
          </Button>
        </Group>
      </form>
      <Paper withBorder p="sm">
        {stats.isError && <Text c="red">Unable to load ingestion statistics.</Text>}
        {stats.isLoading && <Text c="dimmed">Loading indexing statistics…</Text>}
        {stats.data && (
          <>
            <SimpleGrid cols={4}>
              {(['discovered', 'indexed', 'skipped', 'pending'] as const).map((k) => (
                <Stack key={k} gap={0} align="center">
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {k}
                  </Text>
                  <Text fw={700}>{stats.data[k]}</Text>
                </Stack>
              ))}
            </SimpleGrid>
            {stats.data.skipped > 0 && (
              <Button variant="subtle" size="xs" mt="xs" onClick={() => setShowSkipped((s) => !s)} aria-expanded={showSkipped}>
                {showSkipped ? 'Hide skipped files' : `Show skipped files (${stats.data.skipped})`}
              </Button>
            )}
            {showSkipped &&
              skipped.map((f) => (
                <Group key={f.name} justify="space-between">
                  <Text size="sm">{f.name}</Text>
                  <Text size="xs" c="dimmed">
                    {f.reason}
                  </Text>
                </Group>
              ))}
          </>
        )}
      </Paper>
      {error && <Alert color="red">{error}</Alert>}
      {search.isFetching && <Loader size="sm" />}
      {!!submitted && search.isSuccess && !hits.length && <Text c="dimmed">No matches found.</Text>}
      {hits.map((hit, i) => (
        <Paper key={`${hit.fileName}|${hit.sheet}|${hit.position}|${i}`} withBorder p="sm">
          <Text fw={700}>
            {hit.upload ? (
              <Anchor onClick={() => filesApi.download(hit.upload!.id)}>{hit.upload.originalFilename || hit.fileName}</Anchor>
            ) : (
              hit.fileName
            )}
          </Text>
          <Text size="xs" c="dimmed">
            {[hit.sheet, hit.position, hit.upload ? 'Click title to download' : 'Download unavailable'].filter(Boolean).join(' · ')}
          </Text>
          <Text size="sm" mt={4} className="pre-wrap">
            {snippet(hit.content, !!expanded[i]) || 'No preview available'}
          </Text>
          {hit.content.length > SNIPPET_LENGTH && (
            <Button variant="subtle" size="compact-xs" onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))} aria-expanded={!!expanded[i]}>
              {expanded[i] ? 'Read less' : 'Read more'}
            </Button>
          )}
          {hit.context && (
            <Text size="xs" c="dimmed" mt={4}>
              {hit.context}
            </Text>
          )}
        </Paper>
      ))}
      {!!submitted && !error && (page > 0 || hits.length === FUZZY_PAGE_SIZE) && (
        <Group justify="space-between">
          <Button variant="default" disabled={page === 0 || search.isFetching} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="default" disabled={hits.length < FUZZY_PAGE_SIZE || search.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </Group>
      )}
    </Stack>
  );
}

export function UploadsPage() {
  const { name = 'home' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Uploads';
  }, []);
  return (
    <>
      <PageTitle title="Uploads" />
      <Tabs value={name} onChange={(v) => v && navigate(`/file-upload/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="home">Search</Tabs.Tab>
          <Tabs.Tab value="fuzzy-search">Fuzzy search</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" color="orange" />}>
            Bookmarks
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home" pt="sm">
          <FullscreenSection>
            <UploadTable bookmarked={false} />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="fuzzy-search" pt="sm">
          <FuzzySearch />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks" pt="sm">
          <FullscreenSection>
            <UploadTable bookmarked />
          </FullscreenSection>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
