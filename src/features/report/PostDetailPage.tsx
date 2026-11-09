import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionIcon, Badge, Box, Button, Group, Image, Loader, Paper, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { reportApi } from '@/api/misc';
import { useMe } from '@/auth/session';
import { fmtDateTime, titleCase } from '@/lib/format';
import { ChannelPanel, PostAttachments, ScrumBoard, useChannel } from './components';
import { priorityEmoji, statusEmoji, unreadMessages } from './logic';

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
    <Stack>
      <Group>
        <Button variant="outline" leftSection={<Icon icon="arrow-left" />} onClick={() => navigate('/report')}>
          Back
        </Button>
      </Group>
      <Box maw={900}>
        {post.coverId ? <AuthImage id={post.coverId} alt="Cover image" /> : <Image src="/assets/img/no-cover.png" alt="No cover available" h={200} fit="contain" />}
      </Box>
      <Tabs defaultValue="metadata" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          {!!post.content?.length && <Tabs.Tab value="content">Content</Tabs.Tab>}
          {!!post.attachmentIds?.length && <Tabs.Tab value="attachments">Attachments</Tabs.Tab>}
          {me && (
            <Tabs.Tab value="channel" rightSection={<Badge size="xs" color={unread ? 'red' : 'gray'}>{unread}</Badge>}>
              Channel
            </Tabs.Tab>
          )}
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="metadata" pt="sm">
          <Paper withBorder p="md">
            <Group justify="space-between">
              <Title order={4}>
                {priorityEmoji(post.priority)} {statusEmoji(post.status)} {titleCase(post.title)}
              </Title>
              <ActionIcon variant="subtle" color="red" onClick={() => reportApi.generatePdf(post.id!)} aria-label="generate pdf">
                <Icon icon="file-pdf" />
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed">
              Last updated: {fmtDateTime(post.updatedDate)}
            </Text>
            <Text mt="sm">{post.description}</Text>
            <Group gap={4} mt="sm">
              {post.tags?.map((t) => (
                <Badge key={t} variant="light" tt="none">
                  #{t}
                </Badge>
              ))}
            </Group>
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="content" pt="sm">
          <Markdown source={post.content} />
        </Tabs.Panel>
        <Tabs.Panel value="attachments" pt="sm">
          <PostAttachments post={post} />
        </Tabs.Panel>
        <Tabs.Panel value="channel" pt="sm">
          {me && <ChannelPanel post={post} user={me} />}
        </Tabs.Panel>
        <Tabs.Panel value="tasks" pt="sm">
          <ScrumBoard post={post} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
