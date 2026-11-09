import { useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Button, Loader, Text, Tooltip, type ButtonProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { filesApi } from '@/api/files';
import { copyToClipboard } from '@/lib/ui';
import { fmtDateTime } from '@/lib/format';
import type { DateLike, FileUpload } from '@/types';

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
export function AuthImage({
  id,
  alt = '',
  width,
  className,
}: {
  id?: string;
  alt?: string;
  width?: number | string;
  className?: string;
}) {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!id) return;
    let url: string | undefined;
    let cancelled = false;
    setSrc(undefined);
    setFailed(false);
    filesApi
      .objectUrl(id)
      .then((u) => {
        url = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setSrc(u);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!id) return null;
  if (failed) {
    return (
      <Text size="xs" c="dimmed">
        Image unavailable
      </Text>
    );
  }
  if (!src) return <Loader size="sm" />;
  return <img src={src} alt={alt} width={width} className={className} style={{ maxWidth: '100%' }} />;
}

/** shows the thumbnail of an upload when hovering the children (or a small icon when there are no children) */
export function ThumbnailPreview({ thumbnailId, children }: { thumbnailId?: string; children?: ReactNode }) {
  return (
    <Tooltip
      disabled={!thumbnailId}
      label={<AuthImage id={thumbnailId} width={280} />}
      color="white"
      withArrow
      openDelay={200}
      styles={{
        tooltip: {
          boxShadow: 'var(--mantine-shadow-md)',
          border: '1px solid var(--mantine-color-default-border)',
          padding: 4,
        },
      }}
      events={{ hover: true, focus: false, touch: true }}
    >
      {children ? (
        <span>{children}</span>
      ) : (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          disabled={!thumbnailId}
          onClick={(e) => e.stopPropagation()}
          aria-label="preview"
        >
          <Icon icon="eye" />
        </ActionIcon>
      )}
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
