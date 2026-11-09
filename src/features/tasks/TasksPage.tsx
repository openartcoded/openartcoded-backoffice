import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, Grid, Group, NavLink, Pagination, Paper, ScrollArea, Stack, Table, Text, TextInput } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/common';
import { openModal } from '@/components/modal';
import { tasksApi } from '@/api/misc';
import { useDemoMode } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ReminderTask, StatusType } from '@/types';
import { filterTasks, nextDates } from './logic';
import { openTaskForm } from './TaskForm';

const STATUS_COLOR: Record<StatusType, string> = { SUCCESS: 'green', UNKNOWN: 'gray', FAILURE: 'red' };

export function ActionResults({ actionKey }: { actionKey: string }) {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ['action-results', actionKey, page],
    queryFn: () => tasksApi.actionResults(actionKey, page - 1, 2),
  });
  if (!data) return null;
  if (!data.content.length) return <Text>No data.</Text>;
  return (
    <Stack>
      {data.content.map((r) => (
        <Paper key={r.id} withBorder p="sm">
          <Stack gap={4}>
            <Group justify="space-between">
              <Text>#</Text>
              <Badge color="gray">{r.id}</Badge>
            </Group>
            <Group justify="space-between">
              <Text>Status</Text>
              <Badge color={STATUS_COLOR[r.status ?? 'UNKNOWN']}>{r.status}</Badge>
            </Group>
            <Group justify="space-between">
              <Text>Started at</Text>
              <Badge color="cyan">{fmtDate(r.startedDate, 'DD/MM/YYYY HH:mm:ss')}</Badge>
            </Group>
            <Group justify="space-between">
              <Text>Finished at</Text>
              <Badge>{fmtDate(r.finishedDate, 'DD/MM/YYYY HH:mm:ss')}</Badge>
            </Group>
            {!!r.messages?.length && (
              <>
                <Text>Output</Text>
                <Paper bg="gray.0" p="xs">
                  {r.messages.map((m, i) => (
                    <Text key={i} size="sm" className="pre-wrap">
                      {m}
                    </Text>
                  ))}
                </Paper>
              </>
            )}
          </Stack>
        </Paper>
      ))}
      {data.page.totalPages > 1 && <Pagination value={page} onChange={setPage} total={data.page.totalPages} />}
    </Stack>
  );
}

export function TasksPage() {
  const client = useQueryClient();
  const demoMode = useDemoMode();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: tasksApi.findAll });
  const [showActions, setShowActions] = useState(true);
  const [hideDisabled, setHideDisabled] = useState(true);
  const [search, setSearch] = useState('');
  const dates = useMemo(() => nextDates(tasks), [tasks]);
  const [date, setDate] = useState<Date | null | undefined>(undefined);

  useEffect(() => {
    document.title = 'Tasks';
  }, []);

  // by default, the first day with tasks is selected
  const selectedDate = date === undefined ? (dates[0] ?? null) : date;
  const filtered = filterTasks(tasks, { showActions, hideDisabled, date: selectedDate, search });

  const reload = () => client.invalidateQueries({ queryKey: ['tasks'] });
  const open = (task?: ReminderTask) => openTaskForm(task, reload, demoMode);

  useHotkeys([['ctrl+k', () => open()]]);
  useNotificationListener([RegisteredEvent.REMINDER_TASK_ADD_OR_UPDATE, RegisteredEvent.REMINDER_TASK_DELETE], reload);

  return (
    <>
      <PageTitle title="Tasks" />
      <Group justify="space-between" mb="sm">
        <Group>
          <Checkbox label="Show Actions" checked={showActions} onChange={(e) => setShowActions(e.currentTarget.checked)} />
          <Checkbox label="Hide Disabled" checked={hideDisabled} onChange={(e) => setHideDisabled(e.currentTarget.checked)} />
        </Group>
        <Button variant="outline" leftSection={<Icon icon="plus" />} onClick={() => open()}>
          New Task (ctrl+k)
        </Button>
      </Group>
      <Grid className={demoMode ? 'blur' : undefined}>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Paper withBorder>
            {dates.map((d) => {
              const active = selectedDate?.getTime() === d.getTime();
              return (
                <NavLink
                  key={d.getTime()}
                  label={fmtDate(d)}
                  active={active}
                  onClick={() => setDate(d)}
                  rightSection={active ? <Badge color="yellow">{filtered.length}</Badge> : null}
                />
              );
            })}
            <NavLink
              label="Show all"
              active={!selectedDate}
              onClick={() => setDate(null)}
              rightSection={!selectedDate ? <Badge color="cyan">{filtered.length}</Badge> : null}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <TextInput placeholder="Search" mb="sm" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
          <ScrollArea h="75vh">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th visibleFrom="md">Action Type</Table.Th>
                  <Table.Th visibleFrom="md">Last Date</Table.Th>
                  <Table.Th>Next Date</Table.Th>
                  <Table.Th visibleFrom="md">Disabled</Table.Th>
                  <Table.Th visibleFrom="md">Has Action</Table.Th>
                  <Table.Th>Results</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {!filtered.length && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>No entries</Table.Td>
                  </Table.Tr>
                )}
                {filtered.map((t) => (
                  <Table.Tr key={t.id} className="clickable" onClick={() => open(t)}>
                    <Table.Td>{t.customActionName || t.title}</Table.Td>
                    <Table.Td visibleFrom="md">{t.actionKey || 'N/A'}</Table.Td>
                    <Table.Td visibleFrom="md">{fmtDateTime(t.lastExecutionDate)}</Table.Td>
                    <Table.Td>{fmtDateTime(t.nextDate)}</Table.Td>
                    <Table.Td visibleFrom="md">
                      <Checkbox checked={!!t.disabled} readOnly aria-label="disabled" />
                    </Table.Td>
                    <Table.Td visibleFrom="md">
                      <Checkbox checked={!!t.actionKey} readOnly aria-label="has action" />
                    </Table.Td>
                    <Table.Td>
                      {t.actionKey && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label="results"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal({ title: t.actionKey, size: 'xl', render: () => <ActionResults actionKey={t.actionKey!} /> });
                          }}
                        >
                          <Icon icon="eye" />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Grid.Col>
      </Grid>
    </>
  );
}
