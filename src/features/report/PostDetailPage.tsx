import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Box, Button, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { EmptyState, humanize, PageHeader, StatusBadge } from '@/components/ui';
import { reportApi } from '@/api/misc';
import { useMe } from '@/auth/session';
import { fmtDateTime, titleCase } from '@/lib/format';
import { ChannelPanel, PostAttachments, ScrumBoard, useChannel } from './components';
import { unreadMessages } from './logic';
import { postUrl } from './ReportsPage';

export function PostDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: post } = useQuery({ queryKey: ['post', id], queryFn: () => reportApi.getPost(id) });
  const { data: channel } = useChannel(post?.id, me?.email);

  useEffect(() => {
    if (!post) return;
    document.title = post.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', post.description ?? '');
  }, [post]);

  if (!post) return <Loader />;
  const unread = unreadMessages(channel?.messages, me?.email);

  return (
    <>
      <PageHeader
        title={titleCase(post.title)}
        documentTitle={post.title}
        back={{ to: '/report', label: 'Reports' }}
        description={
          <Group gap={6} component="span">
            <StatusBadge value={post.status} />
            <StatusBadge value={post.priority} label={`${humanize(post.priority)} priority`} />
            {post.tags?.map((t) => (
              <Badge key={t} size="sm" variant="default" radius="sm" tt="none" fw={400}>
                #{t}
              </Badge>
            ))}
            <Text span size="xs" c="dimmed">
              Updated {fmtDateTime(post.updatedDate)}
            </Text>
          </Group>
        }
        actions={
          <>
            <Button variant="default" leftSection={<Icon icon="file-pdf" />} onClick={() => reportApi.generatePdf(post.id!)}>
              PDF
            </Button>
            <Button leftSection={<Icon icon="edit" />} onClick={() => navigate(postUrl(post, true))}>
              Edit
            </Button>
          </>
        }
      />
      <Tabs className="page-tabs" defaultValue="overview" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="tasks">Board</Tabs.Tab>
          {me && (
            <Tabs.Tab
              value="channel"
              rightSection={
                !!unread && (
                  <Badge size="xs" color="red" circle>
                    {unread}
                  </Badge>
                )
              }
            >
              Discussion
            </Tabs.Tab>
          )}
          {!!post.attachmentIds?.length && <Tabs.Tab value="attachments">Attachments ({post.attachmentIds.length})</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Stack gap="lg" maw={960}>
            {post.coverId && (
              <Box className="post-cover">
                <AuthImage id={post.coverId} alt="Cover image" />
              </Box>
            )}
            {post.description && (
              <Text c="dimmed" fs="italic">
                {post.description}
              </Text>
            )}
            {post.content?.length ? <Markdown source={post.content} /> : <EmptyState icon="file-lines" title="No content yet" />}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="attachments">
          <PostAttachments post={post} />
        </Tabs.Panel>
        <Tabs.Panel value="channel">{me && <ChannelPanel post={post} user={me} />}</Tabs.Panel>
        <Tabs.Panel value="tasks">
          <ScrumBoard post={post} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
