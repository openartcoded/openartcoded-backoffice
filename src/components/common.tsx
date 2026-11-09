import { useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Box, Button, Divider, Group, Loader, Text, Title, Tooltip, type ButtonProps } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { filesApi } from '@/api/files';
import { copyToClipboard } from '@/lib/ui';
import { fmtDateTime } from '@/lib/format';
import type { DateLike, FileUpload } from '@/types';

export function PageTitle({ title, order = 2, children }: { title: string; order?: 2 | 3 | 4; children?: ReactNode }) {
  return (
    <Box mb="md" pt="xs">
      <Group justify="space-between" align="center">
        <Title order={order} c="dimmed" tt="uppercase" fw={600}>
          {title}
        </Title>
        {children}
      </Group>
      <Divider mt={4} size="sm" />
    </Box>
  );
}

export function CopyButton({
  text,
  label = 'Copy',
  successMessage = 'Copied',
  ...props
}: { text?: string | null; label?: ReactNode; successMessage?: string } & ButtonProps) {
  return (
    <Button
      variant="default"
      size="xs"
      disabled={!text?.length}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(text, successMessage);
      }}
      {...props}
    >
      {label}
    </Button>
  );
}

export function ImportedInfo({ imported, date }: { imported?: boolean; date?: DateLike }) {
  if (!imported) return null;
  return (
    <Tooltip label={`Imported on ${fmtDateTime(date)}`} events={{ hover: true, focus: true, touch: true }}>
      <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => e.stopPropagation()} aria-label="imported">
        <Icon icon="info-circle" />
      </ActionIcon>
    </Tooltip>
  );
}

export function BookmarkButton({ bookmarked, onToggle }: { bookmarked?: boolean; onToggle: () => void }) {
  return (
    <ActionIcon
      variant="subtle"
      color={bookmarked ? 'yellow' : 'gray'}
      aria-label={bookmarked ? 'remove bookmark' : 'bookmark'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Icon icon="star" />
    </ActionIcon>
  );
}

/** blurs its content when the demo mode is enabled */
export function Blur({ active, children }: { active?: boolean; children: ReactNode }) {
  return <div className={active ? 'blur' : undefined}>{children}</div>;
}

/** loads an authenticated image (upload id) */
export function AuthImage({ id, alt = '', width, className }: { id?: string; alt?: string; width?: number | string; className?: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!id) return;
    let url: string | undefined;
    let cancelled = false;
    filesApi
      .objectUrl(id)
      .then((u) => {
        url = u;
        if (!cancelled) setSrc(u);
      })
      .catch(() => setSrc(undefined));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!id) return null;
  if (!src) return <Loader size="sm" />;
  return <img src={src} alt={alt} width={width} className={className} style={{ maxWidth: '100%' }} />;
}

/** small info icon showing the thumbnail of an upload on hover */
export function ThumbnailPreview({ thumbnailId }: { thumbnailId?: string }) {
  return (
    <Tooltip
      disabled={!thumbnailId}
      label={<AuthImage id={thumbnailId} width={300} />}
      color="white"
      withArrow
      events={{ hover: true, focus: false, touch: true }}
    >
      <ActionIcon variant="subtle" color="gray" size="sm" disabled={!thumbnailId} onClick={(e) => e.stopPropagation()}>
        <Icon icon="info-circle" />
      </ActionIcon>
    </Tooltip>
  );
}

/** fetches the uploads of the given ids (with their thumbnail id) */
export function useUploads(ids: string[] | undefined) {
  const key = (ids ?? []).join(',');
  return useQuery({
    queryKey: ['uploads', key],
    queryFn: () => filesApi.findByIds(ids ?? [], false),
    enabled: !!ids,
  });
}

/** wraps a section that can be expanded to the whole screen (esc to exit) */
export function FullscreenSection({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
  useHotkeys([['Escape', () => setFullscreen(false)]]);
  return (
    <Box className={fullscreen ? 'fullscreen' : undefined} p={fullscreen ? 'md' : 0}>
      <Group justify="flex-end" mb={4}>
        <ActionIcon variant="subtle" color="dark" onClick={() => setFullscreen((f) => !f)} aria-label="fullscreen">
          <Icon icon="expand-arrows-alt" />
        </ActionIcon>
      </Group>
      {children}
    </Box>
  );
}

export function NoContent({ children = 'No content.' }: { children?: ReactNode }) {
  return (
    <Text c="dimmed" p="sm" bg="gray.0">
      {children}
    </Text>
  );
}

export function fileLabel(f?: FileUpload) {
  return f?.originalFilename ?? f?.name ?? f?.id ?? '';
}
