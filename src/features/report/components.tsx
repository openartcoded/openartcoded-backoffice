import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Group, Menu, Paper, ScrollArea, SimpleGrid, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { ThumbnailPreview, useUploads } from '@/components/common';
import { FileMenuItems } from '@/components/files';
import { reportApi } from '@/api/misc';
import { filesApi, isImage, isPdf } from '@/api/files';
import { fmtDate, trim } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { FileUpload, Post, PostIt, PostItType, User } from '@/types';
import { boardPayload, movePostIt, relativeTime, type Board } from './logic';

const EMOJIS = ['👍', '👏', '😂', '🙂', '🤔', '✅', '❌', '🎉'];
const COLUMNS: { type: PostItType; label: string }[] = [
  { type: 'TODOS', label: 'Todos' },
  { type: 'IN_PROGRESS', label: 'In Progress' },
  { type: 'DONE', label: 'Done' },
];

/** post attachments: preview thumbnail, download, open, optionally processed flag / delete */
export function PostAttachments({
  post,
  onToggleProcessed,
  onDelete,
}: {
  post: Post;
  onToggleProcessed?: (a: FileUpload) => void;
  onDelete?: (a: FileUpload) => void;
}) {
  const { data: attachments = [] } = useUploads(post.attachmentIds ?? []);
  const processed = (a: FileUpload) => !!post.processedAttachmentIds?.includes(a.id);
  if (!attachments.length) return <Text c="dimmed">No attachments.</Text>;
  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <Button variant="outline" size="xs" onClick={() => filesApi.downloadBulk(attachments.map((a) => a.id))}>
          Download all
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
        {attachments.map((a) => (
          <Paper key={a.id} withBorder p="xs">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                <ThumbnailPreview thumbnailId={a.thumbnailId} />
                <Anchor size="sm" title={a.originalFilename} onClick={() => filesApi.download(a.id)} className="text-break">
                  {trim(a.originalFilename, 30)}
                </Anchor>
              </Group>
              <Group gap={4} wrap="nowrap">
                {onToggleProcessed ? (
                  <Tooltip label="Toggle processed state">
                    <ActionIcon variant="subtle" color={processed(a) ? 'green' : 'gray'} onClick={() => onToggleProcessed(a)} aria-label="processed">
                      <Icon icon="check-circle" />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Icon icon="check-circle" color={processed(a) ? 'green' : 'lightgray'} />
                )}
                <Menu position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="attachment actions">
                      <Icon icon="ellipsis-v" />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <FileMenuItems file={a} />
                    {onDelete && (
                      <Menu.Item leftSection={<Icon icon="trash" />} color="red" onClick={() => onDelete(a)}>
                        Delete
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

/** drag & drop board of post-its (todo / in progress / done), saved on change and every minute */
export function ScrumBoard({ post, height = '57vh' }: { post: Post; height?: string }) {
  const toBoard = (p: Post): Board => ({ TODOS: p.todos ?? [], IN_PROGRESS: p.inProgress ?? [], DONE: p.done ?? [] });
  const [board, setBoard] = useState<Board>(() => {
    const b = toBoard(post);
    // post-its without id get one so they can be dragged
    return {
      TODOS: b.TODOS.map((p) => ({ ...p, id: p.id ?? crypto.randomUUID() })),
      IN_PROGRESS: b.IN_PROGRESS.map((p) => ({ ...p, id: p.id ?? crypto.randomUUID() })),
      DONE: b.DONE.map((p) => ({ ...p, id: p.id ?? crypto.randomUUID() })),
    };
  });
  const lastSaved = useRef(JSON.stringify(boardPayload(board)));
  const boardRef = useRef(board);
  const dragged = useRef<string | null>(null);

  const save = async (b: Board = boardRef.current) => {
    const payload = boardPayload(b);
    const json = JSON.stringify(payload);
    if (json === lastSaved.current || !post.id) return;
    await reportApi.updatePostIts(post.id, payload);
    lastSaved.current = json;
    toast.success('board updated');
  };

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const timer = setInterval(() => save(), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (col: PostItType, id: string, note: string) =>
    setBoard((b) => ({ ...b, [col]: b[col].map((p) => (p.id === id ? { ...p, note } : p)) }));

  const add = (col: PostItType) =>
    setBoard((b) => ({ ...b, [col]: [...b[col], { id: crypto.randomUUID(), note: '', creationDate: new Date() } as PostIt] }));

  const remove = (col: PostItType, id: string) => {
    const next = { ...board, [col]: board[col].filter((p) => p.id !== id) };
    setBoard(next);
    save(next);
  };

  const drop = (col: PostItType) => {
    if (!dragged.current) return;
    const next = movePostIt(board, dragged.current, col);
    dragged.current = null;
    if (next !== board) {
      setBoard(next);
      save(next);
    }
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 3 }}>
      {COLUMNS.map((c) => (
        <Paper key={c.type} withBorder bg="gray.0" p="xs" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.type)}>
          <Group justify="space-between" mb="xs">
            <Text fw={700}>{c.label}</Text>
            <ActionIcon variant="subtle" onClick={() => add(c.type)} aria-label={`add to ${c.label}`}>
              <Icon icon="plus" />
            </ActionIcon>
          </Group>
          <ScrollArea h={height}>
            <Stack gap="xs">
              {board[c.type].map((p) => (
                <Paper key={p.id} withBorder p="xs" className="postit" maw="100%" draggable onDragStart={() => (dragged.current = p.id ?? null)}>
                  <Textarea variant="unstyled" placeholder="New postIt..." autosize minRows={4} value={p.note} onChange={(e) => update(c.type, p.id!, e.currentTarget.value)} />
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {fmtDate(p.creationDate, 'DD/MM/YYYY HH:mm:ss')}
                    </Text>
                    <Group gap={0}>
                      <ActionIcon variant="subtle" color="gray" onClick={() => save()} aria-label="save">
                        <Icon icon="save" />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(c.type, p.id!)} aria-label="delete">
                        <Icon icon="trash" />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

const attachmentIcon = (a: FileUpload) => (isImage(a.contentType) ? 'file-image' : isPdf(a.contentType) ? 'file-pdf' : 'file');

function MessageAttachments({ ids }: { ids?: string[] }) {
  const { data: files = [] } = useUploads(ids?.length ? ids : undefined);
  if (!files.length) return null;
  return (
    <Stack gap={2} mt={4}>
      {files.map((f) => (
        <Anchor key={f.id} size="xs" c="dimmed" onClick={() => filesApi.download(f.id)}>
          <Icon icon={attachmentIcon(f)} /> <u>{f.originalFilename}</u>
        </Anchor>
      ))}
    </Stack>
  );
}

/** channel of a post. Opening a post subscribes the user to its channel (as before) */
export function useChannel(postId: string | undefined, email: string | undefined, refetchInterval?: number) {
  return useQuery({
    queryKey: ['channel', postId],
    enabled: !!postId && !!email,
    refetchInterval,
    queryFn: async () => {
      const channel = await reportApi.getChannel(postId!);
      return channel.subscribers?.includes(email!) ? channel : reportApi.subscribe(postId!);
    },
  });
}

/** discussion channel of a post. Auto refresh every 10 seconds, messages set as read after 5 seconds */
export function ChannelPanel({ post, user }: { post: Post; user: User }) {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const { data: channel, refetch } = useChannel(post.id, user.email, 10_000);
  const subscribed = !!channel?.subscribers?.includes(user.email ?? '');

  useEffect(() => {
    if (!subscribed) return;
    const timer = setTimeout(async () => client.setQueryData(['channel', post.id], await reportApi.setChannelToRead(post.id!)), 5000);
    return () => clearTimeout(timer);
  }, [subscribed, post.id, client]);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [channel?.messages?.length]);

  const subscribe = async () => {
    try {
      await reportApi.subscribe(post.id!);
      toast.success('Successfully subscribed to channel');
      refetch();
    } catch {
      toast.error('Failed to subscribe');
    }
  };

  const send = async () => {
    if (!message.trim() && !files.length) return;
    setSending(true);
    try {
      await reportApi.postMessage(post.id!, message, files);
      setMessage('');
      setFiles([]);
      refetch();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id || !(await confirm('Are you sure you want to delete this message?'))) return;
    try {
      await reportApi.deleteMessage(post.id!, id);
      toast.success('Message deleted');
      refetch();
    } catch {
      toast.error('Failed to delete message');
    }
  };

  if (!channel) return null;
  if (!subscribed) {
    return (
      <Stack align="center" p="xl">
        <Icon icon="comment" size="3x" />
        <Title order={5}>Join the Discussion</Title>
        <Text c="dimmed">Subscribe to participate in this channel</Text>
        <Button onClick={subscribe}>Subscribe</Button>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <ScrollArea h="50vh" viewportRef={viewport}>
        {!channel.messages?.length && (
          <Stack align="center" p="xl" c="dimmed">
            <Icon icon="inbox" size="2x" />
            <Text>No messages yet. Start the conversation!</Text>
          </Stack>
        )}
        <Stack gap="xs" p="xs">
          {channel.messages?.map((m) => {
            const own = m.emailFrom === user.email;
            return (
              <Group key={m.id} justify={own ? 'flex-end' : 'flex-start'}>
                <Paper p="xs" maw="75%" bg={own ? 'yellow.0' : 'gray.1'}>
                  {!own && (
                    <Text size="xs" fw={700} c="dimmed">
                      {m.emailFrom}
                    </Text>
                  )}
                  <Text size="sm" className="pre-wrap">
                    {m.content}
                  </Text>
                  <MessageAttachments ids={m.attachmentIds} />
                  <Group gap={4} justify="flex-end">
                    <Text size="xs" c="dimmed">
                      {relativeTime(m.creationDate)}
                    </Text>
                    {own && m.read && <Icon icon="check" size="xs" color="green" />}
                    {own && (
                      <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => remove(m.id)} aria-label="delete message">
                        <Icon icon="trash" size="xs" />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>
      {!!files.length && (
        <Group gap={4}>
          {files.map((f, i) => (
            <Badge
              key={`${f.name}-${i}`}
              variant="light"
              rightSection={
                <ActionIcon size="xs" variant="transparent" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} aria-label="remove file">
                  <Icon icon="times" size="xs" />
                </ActionIcon>
              }
            >
              {f.name}
            </Badge>
          ))}
        </Group>
      )}
      <Group align="flex-end" wrap="nowrap">
        <Dropzone onDrop={(f) => setFiles((list) => [...list, ...f])} p={6} w={42} h={42} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach files">
          <Icon icon="paperclip" />
        </Dropzone>
        <Textarea
          style={{ flex: 1 }}
          placeholder="Type a message..."
          autosize
          minRows={2}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <ActionIcon size="xl" onClick={send} loading={sending} disabled={!message.trim() && !files.length} aria-label="send">
          <Icon icon="paper-plane" />
        </ActionIcon>
      </Group>
      <Group justify="space-between">
        <Group gap={4}>
          {EMOJIS.map((e) => (
            <Button key={e} variant="subtle" size="compact-sm" onClick={() => setMessage((m) => m + e)}>
              {e}
            </Button>
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          Enter to send, Shift+Enter for new line
        </Text>
      </Group>
    </Stack>
  );
}
