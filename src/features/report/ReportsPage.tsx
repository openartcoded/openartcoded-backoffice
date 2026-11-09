import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Badge, Grid, Group, Pagination, Paper, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton, FullscreenSection, PageTitle } from '@/components/common';
import { reportApi } from '@/api/misc';
import { useMe } from '@/auth/session';
import { fmtDate, slugify, titleCase } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Post, PostSearchCriteria, PostStatus, Priority } from '@/types';
import { dueDateStatus, priorityEmoji, priorityOptions, statusEmoji, statusOptions, unreadForStatus } from './logic';

const PAGE_SIZE = 5;

export const postUrl = (p: Post, edit = false) => `/report/post/${slugify(p.title) || 'post'}/${p.id}${edit ? '/edit' : ''}`;

export function PostList({ bookmarked, status: fixedStatus }: { bookmarked?: boolean; status?: PostStatus }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [debouncedText] = useDebouncedValue(text, 300);
  const [tag, setTag] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [status, setStatus] = useState<PostStatus | null>(fixedStatus ?? null);
  const textSearch = debouncedText.length >= 3 ? debouncedText : null;
  const criteria: PostSearchCriteria = {
    bookmarked: bookmarked ?? null,
    priority,
    status,
    tag,
    title: textSearch,
    content: textSearch,
  };
  const { data: tags = [] } = useQuery({ queryKey: ['report-tags'], queryFn: reportApi.tags });
  const { data: posts, refetch } = useQuery({
    queryKey: ['posts', criteria, page],
    queryFn: async () => {
      const result = await reportApi.search(criteria, page - 1, PAGE_SIZE);
      const counts = await Promise.all(result.content.map((p) => reportApi.singleUnreadCount(p.id!)));
      return { ...result, content: result.content.map((p, i) => ({ ...p, unreadCount: counts[i] })) };
    },
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedText, tag, priority, status]);

  const remove = async (post: Post) => {
    if (await confirm('Are you sure you want to delete this post?')) {
      await reportApi.delete(post.id!);
      refetch();
    }
  };

  const toggleBookmark = async (post: Post) => {
    await reportApi.toggleBookmarked(post.id!);
    toast.success('Bookmark toggled. Reload...');
    refetch();
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, lg: 3 }}>
        <Paper withBorder p="sm">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>Filters</Text>
              <ActionIcon variant="filled" onClick={() => navigate('/report/post/new')} aria-label="new report">
                <Icon icon="plus" />
              </ActionIcon>
            </Group>
            <TextInput type="search" placeholder="Search" value={text} onChange={(e) => setText(e.currentTarget.value)} />
            <Text size="sm" fw={500}>
              Filter by tag
            </Text>
            <Group gap={4}>
              {tags.map((t) => (
                <Badge key={t} className="clickable" variant={tag === t ? 'filled' : 'light'} tt="none" onClick={() => setTag((current) => (current === t ? null : t))}>
                  #{t}
                </Badge>
              ))}
            </Group>
            <Select label="Filter by priority" placeholder="--- Select ---" data={priorityOptions} value={priority} onChange={(v) => setPriority(v as Priority | null)} clearable />
            <Select
              label="Filter by status"
              placeholder="--- Select ---"
              data={statusOptions}
              value={status}
              onChange={(v) => setStatus(v as PostStatus | null)}
              disabled={!!fixedStatus}
              clearable
            />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 9 }}>
        {!posts?.content.length && <Text>No content</Text>}
        <Stack gap="sm">
          {posts?.content.map((p) => (
            <Paper key={p.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={700} className="clickable" onClick={() => navigate(postUrl(p))}>
                      {priorityEmoji(p.priority)} {statusEmoji(p.status)} {titleCase(p.title)}
                    </Text>
                    {!!p.unreadCount && (
                      <Badge color="red" circle>
                        {p.unreadCount}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {fmtDate(p.updatedDate)}
                  </Text>
                  <Text size="sm" fs="italic">
                    {p.description || 'N/A'}
                  </Text>
                  <Text size="xs">{dueDateStatus(p.status, p.dueDate)}</Text>
                </Stack>
                <Group gap={0} wrap="nowrap">
                  <BookmarkButton bookmarked={p.bookmarked} onToggle={() => toggleBookmark(p)} />
                  <ActionIcon variant="subtle" onClick={() => navigate(postUrl(p))} aria-label="read">
                    <Icon icon="book-open" />
                  </ActionIcon>
                  <ActionIcon variant="subtle" onClick={() => navigate(postUrl(p, true))} aria-label="edit">
                    <Icon icon="edit" />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => remove(p)} aria-label="delete">
                    <Icon icon="trash" />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
        {posts && posts.page.totalPages > 1 && (
          <Group justify="flex-end" mt="sm">
            <Pagination value={page} onChange={setPage} total={posts.page.totalPages} />
          </Group>
        )}
      </Grid.Col>
    </Grid>
  );
}

const STATUS_TABS: { value: string; status: PostStatus; label: string }[] = [
  { value: 'drafts', status: 'DRAFT', label: '📝 Draft' },
  { value: 'in-progress', status: 'IN_PROGRESS', label: '⏳ In progress' },
  { value: 'pending', status: 'PENDING', label: '🕗 Pending' },
  { value: 'done', status: 'DONE', label: '✅ Done' },
];

export function ReportsPage() {
  const { name = 'home' } = useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: counters } = useQuery({ queryKey: ['unread-counters'], queryFn: reportApi.unreadCount });

  useEffect(() => {
    document.title = 'Activity Report';
  }, []);

  return (
    <>
      <PageTitle title="Reports" />
      <Tabs value={name} onChange={(v) => v && navigate(`/report/${v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="home">🔍 Search</Tabs.Tab>
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" color="orange" />}>
            Bookmarks
          </Tabs.Tab>
          {STATUS_TABS.map((t) => {
            const unread = unreadForStatus(counters, t.status, me?.email);
            return (
              <Tabs.Tab
                key={t.value}
                value={t.value}
                rightSection={counters && <Badge size="xs" color={unread ? 'red' : 'gray'}>{unread}</Badge>}
              >
                {t.label}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
        <Tabs.Panel value="home" pt="sm">
          <FullscreenSection>
            <PostList />
          </FullscreenSection>
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks" pt="sm">
          <FullscreenSection>
            <PostList bookmarked />
          </FullscreenSection>
        </Tabs.Panel>
        {STATUS_TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} pt="sm">
            <FullscreenSection>
              <PostList status={t.status} />
            </FullscreenSection>
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
