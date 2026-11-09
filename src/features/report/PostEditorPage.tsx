import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, FileInput, Group, Image, Loader, Select, SimpleGrid, Stack, Tabs, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AuthImage, PageTitle } from '@/components/common';
import { FilePicker } from '@/components/files';
import { MarkdownEditor } from '@/components/markdown';
import { reportApi } from '@/api/misc';
import { useMe } from '@/auth/session';
import { fromInput, titleCase, toInputDateTime } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { Post, PostStatus, Priority } from '@/types';
import { ChannelPanel, PostAttachments, ScrumBoard, useChannel } from './components';
import { dueDateStatus, priorityOptions, statusOptions, unreadMessages } from './logic';
import { postUrl } from './ReportsPage';

interface EditorState {
  title: string;
  author: string;
  tags: string[];
  dueDate: string;
  priority: Priority | null;
  status: PostStatus | null;
  description: string;
  content: string;
}

const toState = (p: Post): EditorState => ({
  title: p.title ?? '',
  author: p.author ?? '',
  tags: p.tags ?? [],
  dueDate: toInputDateTime(p.dueDate),
  priority: p.priority ?? null,
  status: p.status ?? null,
  description: p.description ?? '',
  content: p.content ?? '',
});

const isValid = (s: EditorState) => !!(s.title.trim() && s.author.trim() && s.description.trim() && s.content.trim());

/** loads the post (or creates a new one) then renders the editor */
export function PostEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (id) {
        const p = await reportApi.getPost(id);
        if (!cancelled) setPost(p);
      } else {
        const p = await reportApi.newPost();
        if (!cancelled) navigate(postUrl(p, true), { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (!post) return <Loader />;
  return <PostEditor key={post.id} initial={post} />;
}

function PostEditor({ initial }: { initial: Post }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: me } = useMe();
  const [post, setPost] = useState(initial);
  const [state, setState] = useState(() => toState(initial));
  const [cover, setCover] = useState<File>();
  const [coverPreview, setCoverPreview] = useState<string>();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const lastSaved = useRef(JSON.stringify(toState(initial)));
  const latest = useRef({ state, cover });

  const { data: channel } = useChannel(initial.id, me?.email);

  useEffect(() => {
    latest.current = { state, cover };
  }, [state, cover]);

  useEffect(() => {
    document.title = post.title;
  }, [post.title]);

  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const save = useCallback(async () => {
    const { state: s, cover: c } = latest.current;
    if (!isValid(s)) return;
    const json = JSON.stringify(s);
    if (json === lastSaved.current && !c) return;
    const fd = new FormData();
    fd.append('id', initial.id!);
    const due = fromInput(s.dueDate);
    if (due) fd.append('dueDate', due.toUTCString());
    fd.append('content', s.content);
    fd.append('author', s.author);
    fd.append('tags', s.tags.join(','));
    fd.append('status', s.status ?? '');
    fd.append('priority', s.priority ?? '');
    fd.append('title', s.title);
    if (c) fd.append('cover', c);
    fd.append('description', s.description);
    const saved = await reportApi.save(fd);
    lastSaved.current = json;
    setCover(undefined);
    setPost(saved);
    client.invalidateQueries({ queryKey: ['posts'] });
    toast.success('Report saved');
  }, [initial.id, client]);

  // autosave every minute
  useEffect(() => {
    const timer = setInterval(save, 60_000);
    return () => clearInterval(timer);
  }, [save]);

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((s) => ({ ...s, [key]: value }));

  const updateAttachments = (p: Post) => setPost((current) => ({ ...current, attachmentIds: p.attachmentIds, processedAttachmentIds: p.processedAttachmentIds }));

  const upload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      updateAttachments(await reportApi.addAttachment(post.id!, files));
      toast.success('Attachments uploaded');
    } catch {
      toast.error('Failed to upload attachments. Try with less');
    } finally {
      setFiles([]);
      setUploading(false);
    }
  };

  const unread = unreadMessages(channel?.messages, me?.email);

  return (
    <>
      <PageTitle title={titleCase(post.title)} />
      <Group justify="space-between" mb="sm">
        <Button variant="outline" leftSection={<Icon icon="arrow-left" />} onClick={() => navigate('/report')}>
          Back
        </Button>
        <Button leftSection={<Icon icon="save" />} onClick={save} disabled={!isValid(state)}>
          Save
        </Button>
      </Group>
      <Tabs defaultValue="metadata" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="editor">Editor</Tabs.Tab>
          <Tabs.Tab value="attachments">Attachments</Tabs.Tab>
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
          <Tabs.Tab value="channel" rightSection={<Badge size="xs" color={unread ? 'red' : 'gray'}>{unread}</Badge>}>
            Channel
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="metadata" pt="sm">
          <Stack gap="sm">
            <Text size="sm">{dueDateStatus(state.status ?? undefined, state.dueDate)}</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label="Title" value={state.title} onChange={(e) => set('title', e.currentTarget.value)} error={!state.title.trim() && 'required'} />
              <TextInput label="Author" value={state.author} onChange={(e) => set('author', e.currentTarget.value)} error={!state.author.trim() && 'required'} />
              <TagsInput label="Tags" splitChars={[',']} value={state.tags} onChange={(v) => set('tags', v)} />
              <TextInput type="datetime-local" label="Due Date" value={state.dueDate} onChange={(e) => set('dueDate', e.currentTarget.value)} />
              <Select label="Priority" data={priorityOptions} value={state.priority} onChange={(v) => set('priority', v as Priority | null)} />
              <Select label="Status" data={statusOptions} value={state.status} onChange={(v) => set('status', v as PostStatus | null)} />
            </SimpleGrid>
            <Textarea label="Description" minRows={8} autosize value={state.description} onChange={(e) => set('description', e.currentTarget.value)} />
            <Text size="sm" fw={500}>
              Cover image
            </Text>
            <Group align="center">
              {coverPreview ? (
                <Image src={coverPreview} w={100} h={100} fit="cover" alt="cover" />
              ) : post.coverId ? (
                <AuthImage id={post.coverId} width={100} alt="cover" />
              ) : (
                <Image src="/assets/img/no-cover.png" w={100} h={100} alt="no cover" />
              )}
              <FilePicker onFiles={(f) => setCover(f[0])} accept={['image/*']} label="Drop a cover image" />
            </Group>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="editor" pt="sm">
          <MarkdownEditor value={state.content} onChange={(v) => set('content', v)} />
        </Tabs.Panel>
        <Tabs.Panel value="attachments" pt="sm">
          <Stack>
            <Group align="flex-end">
              <FileInput style={{ flex: 1 }} label="New attachment" multiple value={files} onChange={setFiles} />
              <Button variant="outline" color="green" onClick={upload} disabled={!files.length || uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </Group>
            <PostAttachments
              post={post}
              onToggleProcessed={async (a) => {
                const wasProcessed = post.processedAttachmentIds?.includes(a.id);
                try {
                  updateAttachments(await reportApi.toggleProcessAttachment(post.id!, a.id));
                  toast.success(wasProcessed ? 'Attachment unprocessed' : 'Attachment processed');
                } catch {
                  toast.error('Failed to toggle attachment state');
                }
              }}
              onDelete={async (a) => {
                updateAttachments(await reportApi.removeAttachment(post.id!, a.id));
                toast.success('Attachment removed');
              }}
            />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="tasks" pt="sm">
          <ScrumBoard post={post} />
        </Tabs.Panel>
        <Tabs.Panel value="channel" pt="sm">
          {me && <ChannelPanel post={post} user={me} />}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
