import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, Group, Pagination, Paper, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { BookmarkButton } from '@/components/common';
import { EmptyState, humanize, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { reportApi } from '@/api/misc';
import { useMe } from '@/auth/session';
import { fmtDate, slugify, titleCase } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import type { Post, PostSearchCriteria, PostStatus, Priority } from '@/types';
import { dueDateStatus, priorityOptions, statusOptions, unreadForStatus } from './logic';

const PAGE_SIZE = 5;

export const postUrl = (p: Post, edit = false) =>
  `/report/post/${slugify(p.title) || 'post'}/${p.id}${edit ? '/edit' : ''}`;

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
    if (await confirm(`Delete the report ${post.title ?? ''}?`)) {
      await reportApi.delete(post.id!);
      refetch();
    }
  };

  const toggleBookmark = async (post: Post) => {
    await reportApi.toggleBookmarked(post.id!);
    toast.success(post.bookmarked ? 'Bookmark removed' : 'Bookmarked');
    refetch();
  };

  return (
    <div className="fill-column">
      <Group gap="xs" mb="md" wrap="wrap">
        <TextInput
          w={240}
          type="search"
          placeholder="Search"
          aria-label="Search"
          leftSection={<Icon icon="search" />}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <Select
          w={160}
          placeholder="Any priority"
          aria-label="Priority"
          data={priorityOptions}
          value={priority}
          onChange={(v) => setPriority(v as Priority | null)}
          clearable
        />
        {!fixedStatus && (
          <Select
            w={160}
            placeholder="Any status"
            aria-label="Status"
            data={statusOptions}
            value={status}
            onChange={(v) => setStatus(v as PostStatus | null)}
            clearable
          />
        )}
        <Select
          w={180}
          placeholder="Any tag"
          aria-label="Tag"
          data={tags.map((t) => ({ value: t, label: `#${t}` }))}
          value={tag}
          onChange={setTag}
          clearable
          searchable
        />
      </Group>
      <Stack gap="sm" className="scroll-body">
        {posts && !posts.content.length && (
          <Paper withBorder>
            <EmptyState
              icon="blog"
              title="No report"
              description="Reports track a subject over time: notes, attachments, a scrum board and a discussion."
            />
          </Paper>
        )}
        {posts?.content.map((p) => (
          <Paper key={p.id} withBorder p="md" className="clickable" onClick={() => navigate(postUrl(p))}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600}>{titleCase(p.title)}</Text>
                  {!!p.unreadCount && (
                    <Badge color="red" size="sm" circle>
                      {p.unreadCount}
                    </Badge>
                  )}
                </Group>
                <Group gap={6}>
                  <StatusBadge value={p.status} />
                  <StatusBadge value={p.priority} label={`${humanize(p.priority)} priority`} />
                  {p.tags?.map((t) => (
                    <Badge key={t} size="sm" variant="default" radius="sm" tt="none" fw={400}>
                      #{t}
                    </Badge>
                  ))}
                </Group>
                {p.description && (
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {p.description}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  Updated {fmtDate(p.updatedDate)}
                  {p.dueDate && p.status !== 'DONE' && p.status !== 'CANCELLED'
                    ? ` · ${dueDateStatus(p.status, p.dueDate)}`
                    : ''}
                </Text>
              </Stack>
              <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                <BookmarkButton bookmarked={p.bookmarked} onToggle={() => toggleBookmark(p)} />
                <RowActions
                  inline={[{ label: 'Edit', icon: 'edit', onClick: () => navigate(postUrl(p, true)) }]}
                  groups={[[{ label: 'Delete', icon: 'trash', color: 'red', onClick: () => remove(p) }]]}
                />
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
    </div>
  );
}

const STATUS_TABS: { value: string; status: PostStatus; label: string }[] = [
  { value: 'drafts', status: 'DRAFT', label: 'Draft' },
  { value: 'in-progress', status: 'IN_PROGRESS', label: 'In progress' },
  { value: 'pending', status: 'PENDING', label: 'Pending' },
  { value: 'done', status: 'DONE', label: 'Done' },
];

export function ReportsPage() {
  const { name = 'home' } = useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: counters } = useQuery({ queryKey: ['unread-counters'], queryFn: reportApi.unreadCount });

  return (
    <>
      <PageHeader
        title="Reports"
        documentTitle="Activity report"
        actions={
          <Button leftSection={<Icon icon="plus" />} onClick={() => navigate('/report/post/new')}>
            New report
          </Button>
        }
      />
      <Tabs className="page-tabs" value={name} onChange={(v) => v && navigate(`/report/${v}`)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="home">All</Tabs.Tab>
          {STATUS_TABS.map((t) => {
            const unread = unreadForStatus(counters, t.status, me?.email);
            return (
              <Tabs.Tab
                key={t.value}
                value={t.value}
                rightSection={
                  !!unread && (
                    <Badge size="xs" color="red" circle>
                      {unread}
                    </Badge>
                  )
                }
              >
                {t.label}
              </Tabs.Tab>
            );
          })}
          <Tabs.Tab value="bookmarks" leftSection={<Icon icon="star" />}>
            Bookmarked
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="home">
          <PostList />
        </Tabs.Panel>
        <Tabs.Panel value="bookmarks">
          <PostList bookmarked />
        </Tabs.Panel>
        {STATUS_TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            <PostList status={t.status} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
