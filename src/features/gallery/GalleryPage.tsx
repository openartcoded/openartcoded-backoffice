import { useEffect, useState } from 'react';
import { ActionIcon, Button, Card, Paper, Checkbox, Group, Image, Pagination, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { EmptyState, PageHeader } from '@/components/ui';
import { FilePicker } from '@/components/files';
import { openDrawer } from '@/components/drawer';
import { memzApi } from '@/api/misc';
import { filesApi } from '@/api/files';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fromInput, titleCase, toInputDateTime } from '@/lib/format';
import { confirm } from '@/lib/ui';
import type { Memz } from '@/types';

const PAGE_SIZE = 12;

function MemzImage({ memz }: { memz: Memz }) {
  if (!memz.imageUploadId) return null;
  // visible images are public, the others need the token
  return memz.visible ? (
    <Image src={filesApi.publicUrl(memz.imageUploadId)} alt={memz.title} fit="contain" h={300} />
  ) : (
    <AuthImage id={memz.imageUploadId} alt={memz.title} />
  );
}

export function MemzEditor({ memz, onSaved }: { memz: Memz; onSaved: () => void }) {
  const [title, setTitle] = useState(memz.title ?? '');
  const [description, setDescription] = useState(memz.description ?? '');
  const [visible, setVisible] = useState(!!memz.visible);
  const [dateOfVisibility, setDateOfVisibility] = useState(toInputDateTime(memz.dateOfVisibility ?? new Date()));
  const [image, setImage] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const submit = async () => {
    setLoading(true);
    const fd = new FormData();
    if (memz.id) fd.append('id', memz.id);
    fd.append('visible', String(visible));
    fd.append('title', title);
    const date = fromInput(dateOfVisibility);
    if (date) fd.append('dateOfVisibility', date.toUTCString());
    if (image) fd.append('imageUpload', image);
    fd.append('description', description);
    try {
      await memzApi.save(fd);
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="sm">
      <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      <Textarea label="Description" autosize value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      <Text size="sm" fw={500}>
        Image
      </Text>
      {preview ? <Image src={preview} alt="preview" w={100} h={100} fit="cover" /> : memz.id && <MemzImage memz={memz} />}
      <FilePicker onFiles={(f) => setImage(f[0])} accept={['image/*']} label="Drop an image" />
      {!visible && <TextInput type="datetime-local" label="Date to set visible" value={dateOfVisibility} onChange={(e) => setDateOfVisibility(e.currentTarget.value)} />}
      <Checkbox label="Visible" checked={visible} onChange={(e) => setVisible(e.currentTarget.checked)} />
      <Group justify="flex-end">
        <Button onClick={submit} loading={loading} disabled={!title.trim() || !dateOfVisibility}>
          Submit
        </Button>
      </Group>
    </Stack>
  );
}

export function GalleryPage() {
  const [page, setPage] = useState(1);
  const { data, refetch } = useQuery({ queryKey: ['memz', page], queryFn: () => memzApi.adminFindAll(page - 1, PAGE_SIZE) });

  useEffect(() => {
    document.title = 'Gallery';
  }, []);

  useNotificationListener([RegisteredEvent.MEMZ_SET_VISIBLE, RegisteredEvent.MEMZ_ADDED, RegisteredEvent.MEMZ_DELETED], () => refetch());

  const edit = (memz: Memz = { title: '', description: '', visible: false }) =>
    openDrawer({
      title: memz.title ? `${titleCase(memz.title)} (${memz.viewsCount ?? 0} views)` : 'New',
      size: 'xl',
      render: (close) => <MemzEditor memz={memz} onSaved={close} />,
    });

  const remove = async (memz: Memz) => {
    if (await confirm('Are you sure you want to delete this picture?')) await memzApi.delete(memz.id!);
  };

  return (
    <>
      <PageHeader
        title="Gallery"
        documentTitle="Memz"
        actions={
          <Button leftSection={<Icon icon="plus" />} onClick={() => edit()}>
            Add image
          </Button>
        }
      />
      {!data?.content.length ? (
        <Paper withBorder>
          <EmptyState icon="images" title="No image" />
        </Paper>
      ) : (
        <div>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {data.content.map((m) => (
              <Card key={m.id} withBorder shadow="sm">
                <Card.Section>
                  <MemzImage memz={m} />
                </Card.Section>
                <Group justify="space-between" mt="sm" wrap="nowrap">
                  <Text fw={700}>{m.title}</Text>
                  <Group gap={0}>
                    <ActionIcon variant="subtle" onClick={() => edit(m)} aria-label="edit">
                      <Icon icon="edit" />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => remove(m)} aria-label="delete">
                      <Icon icon="trash" />
                    </ActionIcon>
                  </Group>
                </Group>
                {m.description && m.description !== 'null' && (
                  <Text size="sm" c="dimmed">
                    {m.description}
                  </Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
          {data.page.totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination value={page} onChange={setPage} total={data.page.totalPages} />
            </Group>
          )}
        </div>
      )}
    </>
  );
}
