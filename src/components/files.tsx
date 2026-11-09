import { useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Box, Button, Code, Group, Image, Loader, Menu, ScrollArea, Stack, Text } from '@mantine/core';
import { Dropzone, type DropzoneProps } from '@mantine/dropzone';
import { Icon } from './Icon';
import { CopyButton, fileLabel } from './common';
import { openModal } from './modal';
import { filesApi, isImage, isPdf, isXml } from '@/api/files';
import { pdfApi } from '@/api/billing';
import { useIsAdmin } from '@/auth/session';
import type { FileUpload } from '@/types';

/** preview of a pdf, image or xml upload */
export function FileViewer({ file, showRotate = true, blur }: { file: FileUpload; showRotate?: boolean; blur?: boolean }) {
  const isAdmin = useIsAdmin();
  const [src, setSrc] = useState<string>();
  const [xml, setXml] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    if (isXml(file.contentType)) {
      filesApi.text(file.id).then((t) => !cancelled && setXml(t));
    } else {
      filesApi.objectUrl(file.id).then((u) => {
        url = u;
        if (!cancelled) setSrc(u);
      });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, file.contentType, version]);

  const rotate = async (deg: number) => {
    await pdfApi.rotate(file.id, deg);
    setVersion((v) => v + 1);
  };

  return (
    <Box className={blur ? 'blur' : undefined}>
      {isAdmin && showRotate && isPdf(file.contentType) && (
        <Group justify="flex-end" mb="xs">
          <ActionIcon variant="subtle" color="dark" onClick={() => rotate(-90)} aria-label="rotate left">
            <Icon icon="arrow-rotate-backward" />
          </ActionIcon>
          <ActionIcon variant="subtle" color="dark" onClick={() => rotate(90)} aria-label="rotate right">
            <Icon icon="arrow-rotate-forward" />
          </ActionIcon>
        </Group>
      )}
      {isXml(file.contentType) ? (
        xml === undefined ? (
          <Loader />
        ) : (
          <Stack gap="xs">
            <CopyButton text={xml} fullWidth />
            <ScrollArea h="75vh">
              <Code block>{xml}</Code>
            </ScrollArea>
          </Stack>
        )
      ) : !src ? (
        <Loader />
      ) : isImage(file.contentType) ? (
        <Image src={src} alt={fileLabel(file)} w="100%" />
      ) : (
        <iframe title={fileLabel(file)} src={src} style={{ width: '100%', height: '80vh', border: 0 }} />
      )}
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
            <Button variant="subtle" size="compact-sm" onClick={() => filesApi.download(f.id)} className="text-break">
              {fileLabel(f)}
            </Button>
            {badge?.(f)}
          </Group>
          <FileActions
            file={f}
            onRemove={onRemove && (canRemove?.(f) ?? true) ? () => onRemove(f) : undefined}
          />
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
      <Menu.Item leftSection={<Icon icon="download" />} onClick={() => filesApi.download(file.id)}>
        Download
      </Menu.Item>
      {canPreview(file) && (
        <Menu.Item
          leftSection={<Icon icon={isPdf(file.contentType) ? 'file-pdf' : isXml(file.contentType) ? 'file-code' : 'file-image'} />}
          onClick={() => openFileViewer(file)}
        >
          Open
        </Menu.Item>
      )}
    </>
  );
}
