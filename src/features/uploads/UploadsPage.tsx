import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Anchor, Badge, Button, Group, Loader, Pagination, Paper, Popover, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Icon } from '@/components/Icon';
import { BookmarkButton, CopyButton, ThumbnailPreview } from '@/components/common';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { canPreview, downloadUpload, openFileViewer } from '@/components/files';
import { filesApi } from '@/api/files';
import { fileSearchApi } from '@/api/misc';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { bytesToHuman, dayjs, fmtDateTime, trim } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { FileUpload, FileUploadSearchCriteria } from '@/types';
import { searchErrorMessage, skippedFiles, snippet, SNIPPET_LENGTH, toDisplayHit, uploadIdFromFileName, type DisplayHit } from './fileSearch';

const PAGE_SIZE = 10;
const emptySearch = { id: '', correlationId: '', originalFilename: '', dateAfter: '', dateBefore: '', publicResource: null as string | null };

function SearchForm({ isAdmin, onSearch }: { isAdmin: boolean; onSearch: (v: typeof emptySearch) => void }) {
  const form = useForm({ initialValues: emptySearch });
  const extra = [form.values.id, form.values.correlationId, form.values.publicResource].filter(Boolean).length;
  return (
    <form onSubmit={form.onSubmit(onSearch)}>
      <Group gap="xs" mb="md" wrap="wrap">
        <TextInput w={240} placeholder="File name" aria-label="File name" leftSection={<Icon icon="search" />} {...form.getInputProps('originalFilename')} />
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
              <TextInput label="Id" {...form.getInputProps('id')} />
              {isAdmin && <TextInput label="Correlation id" {...form.getInputProps('correlationId')} />}
              <Select
                label="Visibility"
                placeholder="Any"
                data={[
                  { value: 'true', label: 'Public' },
                  { value: 'false', label: 'Private' },
                ]}
                clearable
                comboboxProps={{ withinPortal: false }}
                {...form.getInputProps('publicResource')}
              />
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

export function UploadTable({ bookmarked }: { bookmarked: boolean }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const [criteria, setCriteria] = useState<FileUploadSearchCriteria>({ bookmarked });
  const [page, setPage] = useState(1);
  const { data: uploads, refetch } = useQuery({ queryKey: ['uploads-search', criteria, page], queryFn: () => filesApi.search(criteria, page - 1, PAGE_SIZE) });
  const { data: links = {} } = useQuery({ queryKey: ['correlation-links'], queryFn: filesApi.correlationLinks });

  const toggleBookmark = async (u: FileUpload) => {
    await filesApi.toggleBookmarked(u.id);
    toast.success(u.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refetch();
  };

  return (
    <div className="fill-column">
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
      {uploads && (
        <>
          <div className="scroll-body">
            <Table.ScrollContainer minWidth={640}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  {isAdmin && <Table.Th w={40} />}
                  <Table.Th>File</Table.Th>
                  {isAdmin && <Table.Th visibleFrom="md">Linked to</Table.Th>}
                  <Table.Th visibleFrom="sm">Uploaded</Table.Th>
                  <Table.Th visibleFrom="sm" ta="right">
                    Size
                  </Table.Th>
                  <Table.Th w={110} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody className={demoMode ? 'blur' : undefined}>
                {!uploads.content.length && <EmptyRow colSpan={6} icon="upload" title="No files" />}
                {uploads.content.map((u) => (
                  <Table.Tr key={u.id}>
                    {isAdmin && (
                      <Table.Td>
                        <BookmarkButton bookmarked={u.bookmarked} onToggle={() => toggleBookmark(u)} />
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <ThumbnailPreview thumbnailId={u.thumbnailId}>
                          <Text size="sm" fw={500} className="text-break">
                            {trim(u.originalFilename, 50)}
                          </Text>
                        </ThumbnailPreview>
                        {u.publicResource && <StatusBadge value="PUBLIC" label="Public" color="blue" />}
                      </Group>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td visibleFrom="md">
                        {u.correlationId ? (
                          <CopyButton variant="subtle" color="gray" text={u.correlationId} label={links[u.correlationId] || 'Copy id'} successMessage="Correlation id copied" />
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td visibleFrom="sm">{fmtDateTime(u.creationDate)}</Table.Td>
                    <Table.Td visibleFrom="sm" ta="right" c="dimmed">
                      {bytesToHuman(u.size)}
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        inline={[
                          { label: 'Open', icon: 'eye', hidden: !canPreview(u), onClick: () => openFileViewer(u) },
                          { label: 'Download', icon: 'download', onClick: () => downloadUpload(u.id, u.originalFilename) },
                        ]}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          </div>
          <Group justify="space-between" mt="sm">
            <Text size="sm" c="dimmed">
              {uploads.page.totalElements} file(s)
            </Text>
            {uploads.page.totalPages > 1 && <Pagination value={page} onChange={setPage} total={uploads.page.totalPages} />}
          </Group>
        </>
      )}
    </div>
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
  return (
    <>
      <PageHeader title="Uploads" description="Every file stored by the backoffice: attachments, generated PDFs, images..." />
      <Tabs className="page-tabs" value={name} onChange={(v) => v && navigate(`/file-upload/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="home">All files</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" />}>
            Bookmarked
          </Tabs.Tab>
          <Tabs.Tab value="fuzzy-search" leftSection={<Icon icon="search" />}>
            Search in content
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home">
          <UploadTable bookmarked={false} />
        </Tabs.Panel>
        <Tabs.Panel value="fuzzy-search">
          <FuzzySearch />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <UploadTable bookmarked />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
