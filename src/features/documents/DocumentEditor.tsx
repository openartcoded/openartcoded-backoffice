import { useState } from 'react';
import { Button, Group, Loader, Menu, Stack, TagsInput, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { fileLabel } from '@/components/common';
import { FileMenuItems, FilePicker } from '@/components/files';
import { openDrawer } from '@/components/drawer';
import { filesApi } from '@/api/files';
import { useIsAdmin } from '@/auth/session';
import type { AdministrativeDocument, AdministrativeDocumentForm } from '@/types';

export function DocumentEditor({
  document,
  readOnly = false,
  onSubmit,
}: {
  document: AdministrativeDocument;
  readOnly?: boolean;
  onSubmit?: (form: AdministrativeDocumentForm) => void;
}) {
  const isAdmin = useIsAdmin();
  const disabled = !isAdmin || readOnly;
  const [file, setFile] = useState<File>();
  const { data: attachment, isLoading } = useQuery({
    queryKey: ['upload', document.attachmentId],
    queryFn: () => filesApi.findById(document.attachmentId!),
    enabled: !!document.attachmentId,
  });
  const form = useForm({
    initialValues: { title: document.title ?? '', description: document.description ?? '', tags: document.tags ?? [] },
    validate: {
      title: (v) => (v.trim() ? null : 'required'),
      description: (v) => (v.trim() ? null : 'required'),
    },
  });

  const submit = form.onSubmit((v) => {
    if (isAdmin) onSubmit?.({ id: document.id, ...v, document: file ?? null });
  });

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <TextInput label="Title" disabled={disabled} {...form.getInputProps('title')} />
        <Textarea label="Description" autosize disabled={disabled} {...form.getInputProps('description')} />
        <TagsInput label="Tags" splitChars={[',']} disabled={disabled} {...form.getInputProps('tags')} />
        <FilePicker
          onFiles={(f) => setFile(f[0])}
          disabled={disabled}
          label={file?.name ?? (attachment ? fileLabel(attachment) : 'Drop the document here')}
        />
        {isLoading && <Loader size="sm" />}
        <Group justify="flex-end">
          {attachment && (
            <Menu position="top-end">
              <Menu.Target>
                <Button variant="outline" leftSection={<Icon icon="ellipsis-v" />}>
                  Action
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <FileMenuItems file={attachment} />
              </Menu.Dropdown>
            </Menu>
          )}
          {isAdmin && !readOnly && (
            <Button type="submit" disabled={!form.isValid() || (!file && !document.attachmentId)}>
              Submit
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}

export function openDocumentEditor(
  document: AdministrativeDocument,
  opts: { readOnly?: boolean; onSubmit?: (form: AdministrativeDocumentForm) => void } = {},
) {
  openDrawer({
    title: document.title ? `${opts.readOnly ? '' : 'Edit '}${document.title}` : 'New Document',
    size: 'xl',
    closeOnClickOutside: false,
    render: (close) => (
      <DocumentEditor
        document={document}
        readOnly={opts.readOnly}
        onSubmit={(f) => {
          close();
          opts.onSubmit?.(f);
        }}
      />
    ),
  });
}
