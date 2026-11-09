import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Group, SegmentedControl, Select, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { EmptyRow, RowActions } from '@/components/ui';
import { useNotifications } from '@/hooks/notifications';
import { notificationRoute } from '@/lib/notificationBus';
import { fmtDateTime } from '@/lib/format';
import { relativeTime } from '@/features/report/logic';
import { filterNotifications, notificationTypes, typeLabel, type SeenFilter } from './history';

/** the latest 100 notifications of the backend (live, same source as the bell) */
export function NotificationsTab() {
  const navigate = useNavigate();
  const { notifications, unseenCount, toggleSeen, markAllSeen } = useNotifications();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [seen, setSeen] = useState<SeenFilter>('all');
  const types = useMemo(() => notificationTypes(notifications), [notifications]);
  const filtered = filterNotifications(notifications, { search, type, seen });

  return (
    <div className="fill-column">
      <Group gap="sm" mb="md">
        <TextInput
          w={260}
          placeholder="Search"
          aria-label="Search"
          leftSection={<Icon icon="search" />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          w={220}
          placeholder="All types"
          aria-label="Type"
          data={types.map((t) => ({ value: t, label: typeLabel(t) }))}
          value={type}
          onChange={setType}
          clearable
          searchable
        />
        <SegmentedControl
          value={seen}
          onChange={(v) => setSeen(v as SeenFilter)}
          data={[
            { value: 'all', label: 'All' },
            { value: 'unseen', label: `Unseen (${unseenCount})` },
            { value: 'seen', label: 'Seen' },
          ]}
        />
        <Button
          variant="default"
          ml="auto"
          leftSection={<Icon icon="check" />}
          disabled={!unseenCount}
          onClick={markAllSeen}
        >
          Mark all as seen
        </Button>
      </Group>
      <div className="scroll-body">
        <Table.ScrollContainer minWidth={600}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={24} />
                <Table.Th>Notification</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Received</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!filtered.length && <EmptyRow colSpan={5} icon="bell" title="No notification" />}
              {filtered.map((n) => {
                const route = notificationRoute(n.type);
                return (
                  <Table.Tr key={n.id}>
                    <Table.Td>{!n.seen && <span className="unseen-dot" aria-label="unseen" />}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={n.seen ? 400 : 600}>
                        {n.title}
                      </Text>
                      {n.correlationId && (
                        <Text size="xs" c="dimmed" ff="monospace">
                          {n.correlationId}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {typeLabel(n.type)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={fmtDateTime(n.receivedDate)}>
                        <Text size="sm">{relativeTime(n.receivedDate)}</Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        inline={[
                          {
                            label: n.seen ? 'Mark as unseen' : 'Mark as seen',
                            icon: n.seen ? 'eye-slash' : 'eye',
                            onClick: () => toggleSeen(n),
                          },
                          {
                            label: 'Open',
                            icon: 'arrow-right',
                            hidden: !route,
                            onClick: () => {
                              if (!n.seen) toggleSeen(n, true);
                              navigate(route!);
                            },
                          },
                        ]}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>
      <Text size="xs" c="dimmed" mt="sm">
        The backend keeps the latest 100 notifications.
      </Text>
    </div>
  );
}
