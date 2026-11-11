import { useState, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  FileButton,
  Group,
  Loader,
  Modal,
  Pagination,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { fileLabel, ThumbnailPreview } from './common';
import { AttachmentList } from './files';
import { filesApi } from '@/api/files';
import { errorMessage } from '@/api/http';
import { bytesToHuman, fmtDate } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { FileUpload } from '@/types';

/** the types Peppol accepts as attachment (same list as the backend, rule BR-CL-24) */
export const PEPPOL_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
];

/** no accept list: everything is accepted */
export function isAccepted(file: FileUpload, accept?: string[]) {
  return !accept || accept.includes(file.contentType?.toLowerCase() ?? '');
}

const PAGE_SIZE = 8;

function UploadsBrowser({
  accept,
  exclude = [],
  onSelect,
  close,
}: {
  accept?: string[];
  exclude?: string[];
  onSelect: (files: FileUpload[]) => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [bookmarked, setBookmarked] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FileUpload[]>([]);
  const { data, isFetching } = useQuery({
    queryKey: ['uploads-browser', debounced, bookmarked, page],
    queryFn: () => filesApi.search({ originalFilename: debounced || null, bookmarked }, page - 1, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const isSelected = (f: FileUpload) => selected.some((s) => s.id === f.id);
  const toggle = (f: FileUpload) =>
    setSelected((list) => (isSelected(f) ? list.filter((s) => s.id !== f.id) : [...list, f]));
  const reason = (f: FileUpload) =>
    exclude.includes(f.id) ? 'Already attached' : !isAccepted(f, accept) ? 'This type is not accepted here' : undefined;

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Search by file name..."
          aria-label="search uploads"
          leftSection={isFetching ? <Loader size={14} /> : <Icon icon="search" />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          data-autofocus
        />
        <Chip
          checked={bookmarked}
          onChange={(v) => {
            setBookmarked(v);
            setPage(1);
          }}
          size="sm"
        >
          Bookmarked
        </Chip>
      </Group>
      <Stack gap={0} className="bordered-list">
        {data?.content.map((f) => {
          const disabled = reason(f);
          return (
            <Tooltip key={f.id} label={disabled} disabled={!disabled} position="top-start" withArrow>
              <Box component="label" className="upload-row" px="sm" py={8} data-disabled={disabled ? true : undefined}>
                <Group gap="sm" wrap="nowrap">
                  <Checkbox
                    checked={isSelected(f) || exclude.includes(f.id)}
                    disabled={!!disabled}
                    onChange={() => toggle(f)}
                    aria-label={`select ${fileLabel(f)}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ThumbnailPreview thumbnailId={f.thumbnailId}>
                      <Text size="sm" span className="text-break">
                        {fileLabel(f)}
                      </Text>
                    </ThumbnailPreview>
                  </div>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(f.creationDate)}
                    {f.size ? ` · ${bytesToHuman(f.size, true)}` : ''}
                  </Text>
                </Group>
              </Box>
            </Tooltip>
          );
        })}
        {data && !data.content.length && (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            {debounced ? `No upload matching "${debounced}".` : 'No uploads.'}
          </Text>
        )}
        {!data && (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        )}
      </Stack>
      <Group justify="space-between" gap="sm">
        {data && data.page.totalPages > 1 ? (
          <Pagination size="sm" value={page} onChange={setPage} total={data.page.totalPages} />
        ) : (
          <span />
        )}
        <Group gap="xs">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!selected.length}
            onClick={() => {
              onSelect(selected);
              close();
            }}
          >
            {selected.length ? `Add ${selected.length} file${selected.length > 1 ? 's' : ''}` : 'Add'}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

/**
 * The attached files: choose some among the uploads, or upload new ones (they go to the uploads too).
 * accept: the allowed content types (all when absent), the files of another type are flagged.
 */
export function AttachmentsField({
  value,
  onChange,
  accept,
  label = 'Attachments',
  description,
  disabled,
  busy,
}: {
  value: FileUpload[];
  onChange: (files: FileUpload[]) => void;
  accept?: string[];
  label?: string;
  description?: ReactNode;
  disabled?: boolean;
  /** the change is being saved */
  busy?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  const add = (files: FileUpload[]) => {
    const ids = new Set(value.map((f) => f.id));
    onChange([...value, ...files.filter((f) => !ids.has(f.id))]);
  };

  const uploadNew = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => filesApi.upload(f)));
      add(uploaded);
      toast.success(uploaded.length > 1 ? `${uploaded.length} files uploaded` : 'File uploaded');
    } catch (e) {
      toast.error(`Upload failed: ${errorMessage(e)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={500}>
          {label}
          {!!value.length && ` (${value.length})`}
          {busy && <Loader size={12} ml="xs" />}
        </Text>
        {!disabled && (
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<Icon icon="folder-open" />}
              disabled={busy}
              onClick={() => setBrowsing(true)}
            >
              From uploads
            </Button>
            <FileButton onChange={(files) => uploadNew(files)} multiple accept={accept?.join(',')}>
              {(props) => (
                <Button
                  {...props}
                  size="xs"
                  variant="default"
                  leftSection={<Icon icon="upload" />}
                  loading={uploading}
                  disabled={busy}
                >
                  Upload new
                </Button>
              )}
            </FileButton>
          </Group>
        )}
      </Group>
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
      {value.length ? (
        <AttachmentList
          files={value}
          onRemove={disabled || busy ? undefined : (f) => onChange(value.filter((x) => x.id !== f.id))}
          badge={(f) =>
            !isAccepted(f, accept) && (
              <Badge color="red" variant="light" size="xs">
                not accepted
              </Badge>
            )
          }
        />
      ) : (
        <Text size="sm" c="dimmed">
          No attachments.
        </Text>
      )}
      {/* a modal of its own, above the one of the mail form: the modals manager would replace (and reset) it */}
      <Modal opened={browsing} onClose={() => setBrowsing(false)} title="Choose from uploads" size="lg" zIndex={400}>
        {browsing && (
          <UploadsBrowser
            accept={accept}
            exclude={value.map((f) => f.id)}
            onSelect={add}
            close={() => setBrowsing(false)}
          />
        )}
      </Modal>
    </Stack>
  );
}
