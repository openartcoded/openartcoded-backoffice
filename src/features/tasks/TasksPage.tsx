import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, Button, Group, Select, Switch, Table, Tabs, Text, TextInput, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { tasksApi } from '@/api/misc';
import { useDemoMode } from '@/auth/session';
import { useNotificationListener, useNotifications } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ReminderTask } from '@/types';
import { filterTasks, nextDates } from './logic';
import { openTaskForm } from './TaskForm';
import { ActionResultsTab } from './ActionResultsTab';
import { NotificationsTab } from './NotificationsTab';

function TaskSchedule({ onResults }: { onResults: (actionKey: string) => void }) {
  const client = useQueryClient();
  const demoMode = useDemoMode();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: tasksApi.findAll });
  const [showActions, setShowActions] = useState(true);
  const [hideDisabled, setHideDisabled] = useState(true);
  const [search, setSearch] = useState('');
  const dates = useMemo(() => nextDates(tasks), [tasks]);
  const [date, setDate] = useState<Date | null | undefined>(undefined);

  // by default, the first day with tasks is selected
  const selectedDate = date === undefined ? (dates[0] ?? null) : date;
  const filtered = filterTasks(tasks, { showActions, hideDisabled, date: selectedDate, search });

  const reload = () => client.invalidateQueries({ queryKey: ['tasks'] });
  const open = (task?: ReminderTask) => openTaskForm(task, reload, demoMode);

  useNotificationListener([RegisteredEvent.REMINDER_TASK_ADD_OR_UPDATE, RegisteredEvent.REMINDER_TASK_DELETE], reload);

  const dayOptions = [
    ...dates.map((d) => ({ value: String(d.getTime()), label: fmtDate(d) })),
    { value: 'ALL', label: 'All days' },
  ];

  return (
    <div className="fill-column">
      <Group gap="sm" mb="md" align="center">
        <TextInput w={260} placeholder="Search" leftSection={<Icon icon="search" />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <Select
          w={180}
          aria-label="Day"
          data={dayOptions}
          value={selectedDate ? String(selectedDate.getTime()) : 'ALL'}
          onChange={(v) => setDate(!v || v === 'ALL' ? null : new Date(Number(v)))}
          allowDeselect={false}
          disabled={!!search.trim()}
        />
        <Switch label="Show actions" checked={showActions} onChange={(e) => setShowActions(e.currentTarget.checked)} />
        <Switch label="Hide disabled" checked={hideDisabled} onChange={(e) => setHideDisabled(e.currentTarget.checked)} />
        <Text size="sm" c="dimmed" ml="auto">
          {filtered.length} task(s)
        </Text>
      </Group>
      <div className="scroll-body">
        <Table.ScrollContainer minWidth={600}>
        <Table className={`clickable-rows ${demoMode ? 'blur' : ''}`}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Next run</Table.Th>
              <Table.Th visibleFrom="md">Last run</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {!filtered.length && <EmptyRow colSpan={5} icon="tasks" title="No task" description={search ? 'No task matches your search.' : 'Nothing planned for this day.'} />}
            {filtered.map((t) => (
              <Table.Tr key={t.id} onClick={() => open(t)}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {t.customActionName || t.title}
                  </Text>
                  {t.actionKey && (
                    <Text size="xs" c="dimmed">
                      Action {t.actionKey}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{fmtDateTime(t.nextDate)}</Table.Td>
                <Table.Td visibleFrom="md">{fmtDateTime(t.lastExecutionDate)}</Table.Td>
                <Table.Td>
                  <StatusBadge value={t.disabled ? 'DISABLED' : 'ENABLED'} label={t.disabled ? 'Disabled' : 'Enabled'} color={t.disabled ? 'gray' : 'green'} />
                </Table.Td>
                <Table.Td>
                  <RowActions
                    inline={[
                      {
                        label: 'Results',
                        icon: 'list',
                        hidden: !t.actionKey,
                        onClick: () => onResults(t.actionKey!),
                      },
                    ]}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      </div>
    </div>
  );
}

type TasksTab = 'schedule' | 'results' | 'notifications';

/** tasks, the results persisted by their actions and the notifications (tab in the url: ?tab=results&action=KEY) */
export function TasksPage() {
  const client = useQueryClient();
  const demoMode = useDemoMode();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TasksTab | null) ?? 'schedule';
  const { unseenCount } = useNotifications();
  const newTask = () => openTaskForm(undefined, () => client.invalidateQueries({ queryKey: ['tasks'] }), demoMode);
  useHotkeys([['alt+n', newTask]]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Reminders and scheduled actions, their results and the notifications."
        actions={
          <Tooltip label="Alt+N">
            <Button leftSection={<Icon icon="plus" />} onClick={newTask}>
              New task
            </Button>
          </Tooltip>
        }
      />
      <Tabs className="page-tabs" value={tab} onChange={(v) => v && setParams(v === 'schedule' ? {} : { tab: v })} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="schedule">Schedule</Tabs.Tab>
          <Tabs.Tab value="results">Action results</Tabs.Tab>
          <Tabs.Tab
            value="notifications"
            rightSection={
              !!unseenCount && (
                <Badge size="xs" color="red" circle>
                  {unseenCount}
                </Badge>
              )
            }
          >
            Notifications
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="schedule">
          <TaskSchedule onResults={(action) => setParams({ tab: 'results', action })} />
        </Tabs.Panel>
        <Tabs.Panel value="results">
          <ActionResultsTab actionKey={params.get('action')} onActionChange={(action) => setParams(action ? { tab: 'results', action } : { tab: 'results' })} />
        </Tabs.Panel>
        <Tabs.Panel value="notifications">
          <NotificationsTab />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
