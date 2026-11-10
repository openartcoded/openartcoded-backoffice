import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Chip,
  Collapse,
  Group,
  Loader,
  Mark,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Icon } from '@/components/Icon';
import { canPreview, downloadUpload, openFileViewer } from '@/components/files';
import { fileSearchApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { bytesToHuman } from '@/lib/format';
import type { FileSearchField, FileSearchKind, FileSearchMode, FileSearchV2Hit, FileUpload } from '@/types';
import {
  canSearch,
  emptySearchForm,
  FIELDS,
  hitLocation,
  hitTitle,
  KINDS,
  kindIcon,
  kindLabel,
  MODES,
  searchErrorMessage,
  skippedFiles,
  snippet,
  snippetParts,
  SNIPPET_LENGTH,
  toSearchParams,
  type SearchFormValues,
} from './fileSearch';

function Snippet({ html }: { html: string }) {
  const parts = snippetParts(html);
  if (!parts.length) return <Text c="dimmed">No preview available</Text>;
  return (
    <Text size="sm" className="pre-wrap">
      {parts.map((p, i) => (p.highlighted ? <Mark key={i}>{p.text}</Mark> : <span key={i}>{p.text}</span>))}
    </Text>
  );
}

function Hit({ hit, groupedByFile }: { hit: FileSearchV2Hit; groupedByFile: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const upload = hit.upload;
  // the viewer opens the upload: an extracted file is inside the archive, only downloadable with it
  const viewable: FileUpload | null =
    upload && !hit.extracted
      ? {
          id: upload.id,
          contentType: upload.contentType ?? undefined,
          originalFilename: upload.originalFilename ?? undefined,
        }
      : null;
  const location = hitLocation(hit);
  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Icon icon={kindIcon(hit.kind)} />
            <Text fw={700} truncate="end">
              {hitTitle(hit)}
            </Text>
          </Group>
          <Group gap={6}>
            <Badge size="xs" variant="light">
              {kindLabel(hit.kind)}
            </Badge>
            {location && (
              <Badge size="xs" variant="outline" color="gray">
                {location}
              </Badge>
            )}
            {groupedByFile && hit.matches > 1 && (
              <Badge size="xs" variant="light" color="teal">
                {hit.matches} matches in this file
              </Badge>
            )}
            {hit.modifiedAt && (
              <Text size="xs" c="dimmed">
                modified {hit.modifiedAt}
              </Text>
            )}
            {upload?.correlationLabel && (
              <Text size="xs" c="dimmed">
                · {upload.correlationLabel}
              </Text>
            )}
            {upload?.size ? (
              <Text size="xs" c="dimmed">
                · {bytesToHuman(upload.size)}
              </Text>
            ) : null}
          </Group>
        </Stack>
        <Group gap={4} wrap="nowrap">
          {viewable && canPreview(viewable) && (
            <Tooltip label="Open">
              <ActionIcon variant="subtle" aria-label="open" onClick={() => openFileViewer(viewable)}>
                <Icon icon="eye" />
              </ActionIcon>
            </Tooltip>
          )}
          {upload ? (
            <Tooltip label={hit.extracted ? 'Download the archive' : 'Download'}>
              <ActionIcon
                variant="subtle"
                aria-label="download"
                onClick={() => downloadUpload(upload.id, upload.originalFilename ?? undefined)}
              >
                <Icon icon="download" />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Not an upload of the backoffice">
              <Icon icon="circle-question" />
            </Tooltip>
          )}
        </Group>
      </Group>
      {!!hit.context.length && (
        <Text size="xs" c="dimmed" mt={4}>
          Columns: {hit.context.join(', ')}
        </Text>
      )}
      <div style={{ marginTop: 6 }}>
        <Snippet html={hit.snippetHtml} />
      </div>
      {hit.content.length > SNIPPET_LENGTH && (
        <>
          <Collapse in={expanded}>
            <Paper bg="var(--mantine-color-default-hover)" p="xs" mt="xs">
              <Text size="sm" className="pre-wrap">
                {snippet(hit.content, true)}
              </Text>
            </Paper>
          </Collapse>
          <Button
            variant="subtle"
            size="compact-xs"
            mt={4}
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide the full text' : 'Show the full text'}
          </Button>
        </>
      )}
    </Paper>
  );
}

/** search in the content of the uploads (file-search service), with modes and filters */
export function FileContentSearch() {
  const [form, setForm] = useState<SearchFormValues>(emptySearchForm);
  const [submitted, setSubmitted] = useState<SearchFormValues | null>(null);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const set = <K extends keyof SearchFormValues>(key: K, value: SearchFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const stats = useQuery({ queryKey: ['file-search-stats'], queryFn: fileSearchApi.stats });
  const params = submitted ? toSearchParams(submitted, page) : null;
  const search = useQuery({
    queryKey: ['file-search', params],
    enabled: !!params,
    placeholderData: (prev) => prev,
    retry: false,
    queryFn: () => fileSearchApi.search(params!),
  });
  const result = search.data;
  const error = search.error
    ? searchErrorMessage(
        axios.isAxiosError(search.error) ? search.error.response?.status : undefined,
        errorMessage(search.error),
      )
    : '';
  const skipped = skippedFiles(stats.data);
  const filterCount =
    form.kinds.length +
    (form.fields.length ? 1 : 0) +
    (form.extensions.trim() ? 1 : 0) +
    (form.modifiedFrom ? 1 : 0) +
    (form.modifiedTo ? 1 : 0) +
    (form.groupByFile ? 0 : 1);
  const submit = (values: SearchFormValues) => {
    if (!canSearch(values)) return;
    setPage(0);
    setSubmitted(values);
  };
  const mode = MODES.find((m) => m.value === form.mode);

  return (
    <Stack>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(form);
        }}
      >
        <Stack gap="xs">
          <Group wrap="nowrap" align="flex-end">
            <TextInput
              style={{ flex: 1 }}
              type="search"
              maxLength={4096}
              leftSection={<Icon icon="search" />}
              placeholder='e.g. facture octobre, "frais de port", -brouillon'
              autoComplete="off"
              value={form.q}
              onChange={(e) => set('q', e.currentTarget.value)}
            />
            <Select
              w={190}
              aria-label="Match"
              data={MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={form.mode}
              onChange={(v) => v && set('mode', v as FileSearchMode)}
              allowDeselect={false}
            />
            <Button type="submit" disabled={search.isFetching || !canSearch(form)}>
              Search
            </Button>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {mode?.description}. Accents and case don&apos;t matter.
              {form.mode === 'smart' && ' "quoted words" in this order, -word excluded.'}
            </Text>
            <Button
              variant="subtle"
              size="compact-xs"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
            >
              {showFilters ? 'Hide filters' : `Filters${filterCount ? ` (${filterCount})` : ''}`}
            </Button>
          </Group>
          <Chip.Group multiple value={form.kinds} onChange={(v) => set('kinds', v as FileSearchKind[])}>
            <Group gap={6}>
              {KINDS.map((k) => (
                <Chip key={k.value} value={k.value} size="xs" variant="light">
                  {k.label}
                  {stats.data?.kinds?.[k.value] !== undefined ? ` (${stats.data.kinds[k.value]})` : ''}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Collapse in={showFilters}>
            <Paper withBorder p="sm">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                <MultiSelect
                  label="Search in"
                  placeholder="Everything"
                  data={FIELDS}
                  value={form.fields}
                  onChange={(v) => set('fields', v as FileSearchField[])}
                  clearable
                />
                <TextInput
                  label="Extensions"
                  placeholder="e.g. pdf, xlsx"
                  value={form.extensions}
                  onChange={(e) => set('extensions', e.currentTarget.value)}
                />
                <Select
                  label="Typos allowed"
                  description={form.mode === 'smart' || form.mode === 'fuzzy' ? undefined : 'smart and typos modes'}
                  disabled={form.mode !== 'smart' && form.mode !== 'fuzzy'}
                  data={[
                    { value: '', label: 'Automatic (by word length)' },
                    { value: '0', label: 'None' },
                    { value: '1', label: '1 letter' },
                    { value: '2', label: '2 letters' },
                  ]}
                  value={form.fuzziness}
                  onChange={(v) => set('fuzziness', v ?? '')}
                  allowDeselect={false}
                />
                <TextInput
                  type="date"
                  label="Modified from"
                  value={form.modifiedFrom}
                  max={form.modifiedTo || undefined}
                  onChange={(e) => set('modifiedFrom', e.currentTarget.value)}
                />
                <TextInput
                  type="date"
                  label="Modified to"
                  value={form.modifiedTo}
                  min={form.modifiedFrom || undefined}
                  onChange={(e) => set('modifiedTo', e.currentTarget.value)}
                />
                <Select
                  label="Results per page"
                  data={['10', '20', '50', '100']}
                  value={String(form.perPage)}
                  onChange={(v) => v && set('perPage', Number(v))}
                  allowDeselect={false}
                />
              </SimpleGrid>
              <Group justify="space-between" mt="sm">
                <Switch
                  label="One result per file (off: every matching row of a sheet, every matching page part)"
                  checked={form.groupByFile}
                  onChange={(e) => set('groupByFile', e.currentTarget.checked)}
                />
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setForm((f) => ({ ...emptySearchForm, q: f.q, mode: f.mode }))}
                >
                  Clear filters
                </Button>
              </Group>
            </Paper>
          </Collapse>
        </Stack>
      </form>

      <Paper withBorder p="sm">
        {stats.isError && <Text c="red">Unable to load ingestion statistics.</Text>}
        {stats.isLoading && <Text c="dimmed">Loading indexing statistics…</Text>}
        {stats.data && (
          <>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              {(['indexed', 'pending', 'skipped', 'duplicate'] as const).map((k) => (
                <Stack key={k} gap={0} align="center">
                  <Text size="xs" c="dimmed" tt="capitalize">
                    {k}
                  </Text>
                  <Text fw={700}>{stats.data[k] ?? 0}</Text>
                </Stack>
              ))}
            </SimpleGrid>
            {stats.data.skipped > 0 && (
              <Button
                variant="subtle"
                size="xs"
                mt="xs"
                onClick={() => setShowSkipped((s) => !s)}
                aria-expanded={showSkipped}
              >
                {showSkipped ? 'Hide skipped files' : `Show skipped files (${stats.data.skipped})`}
              </Button>
            )}
            {showSkipped &&
              skipped.map((f) => (
                <Group key={f.name} justify="space-between" wrap="nowrap">
                  <Text size="sm" truncate="end">
                    {f.name}
                  </Text>
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
      {submitted && result && !error && (
        <Text size="sm" c="dimmed">
          {result.totalMatches} match{result.totalMatches === 1 ? '' : 'es'}
          {submitted.groupByFile ? ', best match of each file' : ''} · page {result.page + 1} · {result.tookMs} ms
        </Text>
      )}
      {submitted && search.isSuccess && !result?.hits.length && <Text c="dimmed">No matches found.</Text>}
      {result?.hits.map((hit, i) => (
        <Hit
          key={`${hit.originFileName}|${hit.fileName}|${hit.positions.join(',')}|${page}|${i}`}
          hit={hit}
          groupedByFile={!!submitted?.groupByFile}
        />
      ))}
      {submitted && !error && result && (page > 0 || result.hasMore) && (
        <Group justify="space-between">
          <Button variant="default" disabled={page === 0 || search.isFetching} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="default"
            disabled={!result.hasMore || search.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Group>
      )}
    </Stack>
  );
}
