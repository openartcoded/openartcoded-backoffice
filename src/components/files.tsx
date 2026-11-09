import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Alert, Box, Button, Group, Image, Loader, Menu, Stack, Text } from '@mantine/core';
import { Dropzone, type DropzoneProps } from '@mantine/dropzone';
import { Icon } from './Icon';
import { CopyButton, fileLabel } from './common';
import { openModal } from './modal';
import { filesApi, isImage, isPdf, isXml } from '@/api/files';
import { pdfApi } from '@/api/billing';
import { useIsAdmin } from '@/auth/session';
import { errorMessage } from '@/api/http';
import { toast } from '@/lib/ui';
import { Markdown } from './markdown';
import type { FileUpload } from '@/types';

const PdfDocument = lazy(() => import('./PdfDocument'));

/** downloads an upload, errors are shown as a toast */
export async function downloadUpload(id: string, filename?: string) {
  try {
    await filesApi.download(id, filename);
  } catch (e) {
    toast.error(`Download failed: ${errorMessage(e)}`);
  }
}

type Content = { blob?: Blob; url?: string; xml?: string };

/** fetches the content of an upload, typed with the content type of the upload */
function useUploadContent(file: FileUpload, version: number) {
  const [content, setContent] = useState<Content>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setContent(undefined);
    setError(undefined);
    (async () => {
      if (isXml(file.contentType)) return { xml: await filesApi.text(file.id) };
      const blob = await filesApi.blob(file.id, file.contentType);
      url = URL.createObjectURL(blob);
      return { blob, url };
    })()
      .then((c) => !cancelled && setContent(c))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, file.contentType, version]);
  return { content, error };
}

/** preview of a pdf, image or xml upload */
export function FileViewer({
  file,
  showRotate = true,
  blur,
}: {
  file: FileUpload;
  showRotate?: boolean;
  blur?: boolean;
}) {
  const isAdmin = useIsAdmin();
  const [version, setVersion] = useState(0);
  const { content, error } = useUploadContent(file, version);

  const rotate = async (deg: number) => {
    try {
      await pdfApi.rotate(file.id, deg);
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Box className={blur ? 'blur' : undefined}>
      <Group justify="flex-end" gap={4} mb="xs">
        {isAdmin && showRotate && isPdf(file.contentType) && (
          <>
            <ActionIcon variant="subtle" color="dark" onClick={() => rotate(-90)} aria-label="rotate left">
              <Icon icon="arrow-rotate-backward" />
            </ActionIcon>
            <ActionIcon variant="subtle" color="dark" onClick={() => rotate(90)} aria-label="rotate right">
              <Icon icon="arrow-rotate-forward" />
            </ActionIcon>
          </>
        )}
        {content?.url && (
          <ActionIcon
            variant="subtle"
            color="dark"
            component="a"
            href={content.url}
            target="_blank"
            rel="noreferrer"
            aria-label="open in a new tab"
          >
            <Icon icon="external-link-alt" />
          </ActionIcon>
        )}
        <ActionIcon
          variant="subtle"
          color="dark"
          onClick={() => downloadUpload(file.id, file.originalFilename)}
          aria-label="download"
        >
          <Icon icon="download" />
        </ActionIcon>
      </Group>
      {error ? (
        <Alert color="red" title="Could not load the file">
          {error}
        </Alert>
      ) : !content ? (
        <Loader />
      ) : content.xml !== undefined ? (
        <Stack gap="xs">
          <CopyButton text={content.xml} fullWidth />
          <Markdown source={'```xml\n' + content.xml + '\n```'} />
        </Stack>
      ) : isImage(file.contentType) ? (
        <Image src={content.url} alt={fileLabel(file)} w="100%" />
      ) : isPdf(file.contentType) && content.blob ? (
        <Suspense fallback={<Loader />}>
          <PdfDocument file={content.blob} />
        </Suspense>
      ) : null}
    </Box>
  );
}

export function canPreview(file?: FileUpload) {
  return !!file && (isPdf(file.contentType) || isImage(file.contentType) || isXml(file.contentType));
}

export function openFileViewer(file: FileUpload, opts: { title?: string; blur?: boolean; showRotate?: boolean } = {}) {
  openModal({
    title: opts.title ?? fileLabel(file),
    size: 'xl',
    render: () => <FileViewer file={file} blur={opts.blur} showRotate={opts.showRotate} />,
  });
}

/** standard actions of an attachment row: open (pdf/xml/image) and download */
export function FileActions({ file, onRemove, extra }: { file: FileUpload; onRemove?: () => void; extra?: ReactNode }) {
  return (
    <Group gap={4} wrap="nowrap">
      {canPreview(file) && (
        <ActionIcon variant="subtle" color="gray" onClick={() => openFileViewer(file)} aria-label="open">
          <Icon icon={isPdf(file.contentType) ? 'file-pdf' : isXml(file.contentType) ? 'file-code' : 'file-image'} />
        </ActionIcon>
      )}
      {extra}
      {onRemove && (
        <ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="remove">
          <Icon icon="times" />
        </ActionIcon>
      )}
    </Group>
  );
}

/** list of attachments with download link + preview */
export function AttachmentList({
  files,
  onRemove,
  canRemove,
  badge,
}: {
  files: FileUpload[];
  onRemove?: (f: FileUpload) => void;
  canRemove?: (f: FileUpload) => boolean;
  badge?: (f: FileUpload) => ReactNode;
}) {
  if (!files.length) {
    return (
      <Text c="dimmed" p="sm" bg="gray.0">
        No Content.
      </Text>
    );
  }
  return (
    <Stack gap={0} className="bordered-list">
      {files.map((f) => (
        <Group key={f.id} justify="space-between" wrap="nowrap" px="sm" py={6}>
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => downloadUpload(f.id, f.originalFilename)}
              className="text-break"
            >
              {fileLabel(f)}
            </Button>
            {badge?.(f)}
          </Group>
          <FileActions file={f} onRemove={onRemove && (canRemove?.(f) ?? true) ? () => onRemove(f) : undefined} />
        </Group>
      ))}
    </Stack>
  );
}

/** drop zone + click to select. Shows the selected file names. */
export function FilePicker({
  onFiles,
  multiple = false,
  accept,
  disabled,
  label = 'Drop files here or click to select',
  files,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: DropzoneProps['accept'];
  disabled?: boolean;
  label?: string;
  files?: File[];
}) {
  return (
    <Box>
      <Dropzone onDrop={onFiles} multiple={multiple} accept={accept} disabled={disabled} p="sm">
        <Group justify="center" gap="xs" mih={48} style={{ pointerEvents: 'none' }}>
          <Icon icon="upload" />
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        </Group>
      </Dropzone>
      {!!files?.length && (
        <Text size="sm" mt={4}>
          {files.map((f) => f.name).join(', ')}
        </Text>
      )}
    </Box>
  );
}

/** menu entries shared by the tables listing uploads */
export function FileMenuItems({ file }: { file: FileUpload }) {
  return (
    <>
      <Menu.Item leftSection={<Icon icon="download" />} onClick={() => downloadUpload(file.id, file.originalFilename)}>
        Download
      </Menu.Item>
      {canPreview(file) && (
        <Menu.Item
          leftSection={
            <Icon icon={isPdf(file.contentType) ? 'file-pdf' : isXml(file.contentType) ? 'file-code' : 'file-image'} />
          }
          onClick={() => openFileViewer(file)}
        >
          Open
        </Menu.Item>
      )}
    </>
  );
}
