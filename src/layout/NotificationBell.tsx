import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionIcon, Group, Indicator, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { useNotifications } from '@/hooks/notifications';
import { notificationRoute } from '@/lib/notificationBus';
import { fmtDate } from '@/lib/format';
import type { ArtcodedNotification } from '@/types';

export function NotificationBell() {
  const { notifications, unseenCount, toggleSeen, markAllSeen } = useNotifications();
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();

  const open = (n: ArtcodedNotification) => {
    setOpened(false);
    toggleSeen(n, true);
    const route = notificationRoute(n.type);
    if (route) navigate(route);
  };

  return (
    <Popover opened={opened} onChange={setOpened} width={340} position="bottom-end" shadow="md">
      <Popover.Target>
        <Indicator label={unseenCount} size={16} color="red" disabled={unseenCount === 0} offset={4}>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setOpened((o) => !o)} aria-label="notifications">
            <Icon icon="bell" />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="sm" py={6} className="border-bottom">
          <Text fw={700}>Notifications</Text>
          <ActionIcon variant="subtle" color="dark" onClick={markAllSeen} aria-label="mark all as seen">
            <Icon icon="eye" />
          </ActionIcon>
        </Group>
        {!notifications.length ? (
          <Text p="sm">No Notification</Text>
        ) : (
          <ScrollArea.Autosize mah={400}>
            <Stack gap={0}>
              {notifications.map((n) => (
                <Group
                  key={n.id}
                  justify="space-between"
                  wrap="nowrap"
                  px="sm"
                  py={6}
                  bg={n.seen ? undefined : 'blue.0'}
                  className="border-bottom"
                >
                  <UnstyledButton onClick={() => open(n)} style={{ minWidth: 0 }}>
                    <Text size="xs" c="dimmed" fw={700}>
                      {fmtDate(n.receivedDate, 'DD/MM/YYYY @ HH:mm')}
                    </Text>
                    <Text size="sm" className="text-break">
                      {n.title}
                    </Text>
                  </UnstyledButton>
                  <ActionIcon
                    variant="subtle"
                    color={n.seen ? 'gray' : 'blue'}
                    onClick={() => toggleSeen(n)}
                    aria-label="toggle seen"
                  >
                    <Icon icon="eye" />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
