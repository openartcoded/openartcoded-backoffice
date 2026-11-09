import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ActionIcon, Badge, Button, Card, Group, Kbd, Paper, ScrollArea, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { hasOpenModal } from '@/components/modal';
import { postItApi, scriptApi, settingsApi, tasksApi, todoApi } from '@/api/misc';
import { dossiersApi, feesApi, invoicesApi } from '@/api/billing';
import { usePersonalInfo } from '@/auth/session';
import { menuPath } from '@/layout/menu';
import { fmtDate, trim } from '@/lib/format';
import { toast } from '@/lib/ui';
import { openTaskForm } from '@/features/tasks/TaskForm';
import { openFeeDetail } from '@/features/fee/FeeDetail';
import { openInvoiceDetail } from '@/features/invoice/InvoiceDetail';
import type { PostIt, ReminderTask, Todo } from '@/types';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4}>
      {children}
    </Text>
  );
}

/** company card (logo + contact) that can be downloaded as a png */
export function CompanyStamp() {
  const { data: info } = usePersonalInfo();
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  if (!info) return null;

  const downloadImage = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: null });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'company_stamp.png';
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Stack gap="xs" mb="sm">
      <Card withBorder shadow="sm" p="xs" ref={ref}>
        <AuthImage id={info.logoUploadId} alt="logo" />
        <Stack gap={2} mt="xs" fz="xs" fw={700}>
          <Group gap={6} wrap="nowrap">
            <Icon icon="vcard" />
            <span>
              {info.organizationName} ({info.vatNumber})
            </span>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Icon icon="phone" />
            <span>{info.organizationPhoneNumber}</span>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Icon icon="mail-bulk" />
            <span className="text-break">{info.organizationEmailAddress}</span>
          </Group>
        </Stack>
      </Card>
      <Button variant="outline" size="xs" onClick={downloadImage} loading={downloading} fullWidth>
        Download
      </Button>
    </Stack>
  );
}

export function ActiveDossierLink() {
  const navigate = useNavigate();
  const { data: dossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  if (!dossier) return null;
  return (
    <div>
      <SectionLabel>Active Dossier</SectionLabel>
      <Button variant="default" c="red" fullWidth leftSection={<Icon icon="folder" />} onClick={() => navigate('/dossier')}>
        {dossier.name}
      </Button>
    </div>
  );
}

/** the latest unprocessed expense and invoice */
export function PendingItems() {
  const { data: fees } = useQuery({
    queryKey: ['home-unpaid-fees'],
    queryFn: () => feesApi.search({ archived: false, bookmarked: false }, 0, 1),
  });
  const { data: invoices } = useQuery({
    queryKey: ['home-open-invoices'],
    queryFn: () =>
      invoicesApi.search({ archived: false, logical: false, page: 0, size: 1, sort: { property: 'dateOfInvoice', direction: 'DESC' } }),
  });
  return (
    <Stack gap="sm">
      <div>
        <SectionLabel>Unpaid expenses</SectionLabel>
        {fees?.content.map((f) => (
          <Button key={f.id} variant="default" size="xs" fullWidth mb={4} onClick={() => openFeeDetail(f)}>
            {trim(f.subject, 20)}
          </Button>
        ))}
        {fees && !fees.content.length && <Text c="dimmed" size="sm">No content</Text>}
      </div>
      <div>
        <SectionLabel>Open invoices</SectionLabel>
        {invoices?.content.map((i) => (
          <Button key={i.id} variant="default" size="xs" fullWidth mb={4} onClick={() => openInvoiceDetail(i)}>
            {trim(i.id, 20)}
          </Button>
        ))}
        {invoices && !invoices.content.length && <Text c="dimmed" size="sm">No content</Text>}
      </div>
    </Stack>
  );
}

/** top 3 menu links, reachable with ctrl+1..3 */
export function MostClickedMenu() {
  const navigate = useNavigate();
  const { data: links = [] } = useQuery({ queryKey: ['menu-top3'], queryFn: settingsApi.top3 });
  useHotkeys(
    [1, 2, 3, 4, 5].map((n) => [
      `ctrl+${n}`,
      () => {
        const link = links[n - 1];
        if (link && !hasOpenModal()) navigate(menuPath(link));
      },
    ]),
  );
  if (!links.length) return null;
  return (
    <div>
      <SectionLabel>Most Clicked</SectionLabel>
      <Stack gap={4}>
        {links.map((l, i) => (
          <Button
            key={l.id ?? l.title}
            variant="default"
            size="xs"
            justify="space-between"
            leftSection={<Icon icon={l.icon} />}
            rightSection={<Kbd size="xs">ctrl+{i + 1}</Kbd>}
            onClick={() => navigate(menuPath(l))}
          >
            {l.title}
          </Button>
        ))}
      </Stack>
    </div>
  );
}

export function taskName(task: ReminderTask) {
  return trim(task.customActionName || task.title, 15);
}

export function NextTasks() {
  const client = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['next-tasks'], queryFn: tasksApi.nextTen });
  const open = (task?: ReminderTask) =>
    openTaskForm(task, () => client.invalidateQueries({ queryKey: ['next-tasks'] }));
  return (
    <div>
      <SectionLabel>Next Tasks</SectionLabel>
      <ScrollArea h="26vh">
        <Stack gap={4}>
          <Button variant="outline" color="yellow" c="dark" leftSection={<Icon icon="plus" />} onClick={() => open()}>
            New Task
          </Button>
          {tasks.map((t, i) => (
            <Button
              key={t.id}
              variant={i < 3 ? 'light' : 'default'}
              color={i < 3 ? 'yellow' : 'gray'}
              c="dark"
              h="auto"
              py={4}
              onClick={() => open(t)}
            >
              <Stack gap={0} align="center">
                <Text size="xs">{fmtDate(t.nextDate, 'DD/MM @ HH:mm')}</Text>
                <Text size="xs" fw={700}>
                  {taskName(t)}
                </Text>
              </Stack>
            </Button>
          ))}
        </Stack>
      </ScrollArea>
    </div>
  );
}

export function TodoList() {
  const client = useQueryClient();
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => (await todoApi.findAll()).sort((a, b) => Number(a.done) - Number(b.done)),
  });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  useHotkeys([['ctrl+k', () => setAdding((a) => !a)]]);

  const setTodos = (updater: (list: Todo[]) => Todo[]) =>
    client.setQueryData<Todo[]>(['todos'], (list) => updater(list ?? []));

  const save = async () => {
    if (title.trim().length < 2) return;
    const saved = await todoApi.save({ title: title.trim(), done: false });
    setTodos((list) => [saved, ...list]);
    setAdding(false);
    setTitle('');
    toast.success('todo saved');
  };

  const toggle = async (todo: Todo) => {
    const updated = { ...todo, done: !todo.done };
    await todoApi.save(updated);
    setTodos((list) => list.map((t) => (t.id === todo.id ? updated : t)));
  };

  const remove = async (todo: Todo) => {
    if (!todo.id) return;
    await todoApi.delete(todo.id);
    setTodos((list) => list.filter((t) => t.id !== todo.id));
    toast.success('todo deleted');
  };

  if (!todos) return null;
  return (
    <Paper withBorder>
      <Group justify="space-between" p="xs" bg="gray.0">
        <Text fw={600} c="dimmed">
          Todo List (ctrl+k)
        </Text>
        <ActionIcon variant="default" onClick={() => setAdding((a) => !a)} aria-label="add todo">
          <Icon icon={adding ? 'times' : 'plus'} />
        </ActionIcon>
      </Group>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Group p="xs" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              placeholder="New todo..."
              data-autofocus
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <ActionIcon type="submit" variant="subtle" disabled={title.trim().length < 2} aria-label="save todo">
              <Icon icon="save" />
            </ActionIcon>
          </Group>
        </form>
      )}
      <ScrollArea h="80vh">
        {!todos.length && (
          <Text c="dimmed" ta="center" p="sm">
            Nothing to do.
          </Text>
        )}
        {todos.map((todo) => (
          <Group key={todo.id} justify="space-between" wrap="nowrap" px="sm" py={6} className="border-bottom" opacity={todo.done ? 0.5 : 1}>
            <Text fw={700} td={todo.done ? 'line-through' : undefined} style={{ flex: 1 }}>
              {todo.title}
            </Text>
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" color={todo.done ? 'green' : 'gray'} onClick={() => toggle(todo)} aria-label="toggle done">
                <Icon icon={todo.done ? 'check' : 'times'} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="gray" onClick={() => remove(todo)} aria-label="delete todo">
                <Icon icon="trash" />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </ScrollArea>
    </Paper>
  );
}

interface PostItRow {
  key: string;
  id?: string;
  note: string;
  updatedOn?: string | number | Date;
}

const toRow = (p?: PostIt): PostItRow => ({
  key: p?.id ?? Math.random().toString(36).slice(2),
  id: p?.id,
  note: p?.note ?? '',
  updatedOn: p?.updatedDate ?? p?.creationDate,
});

/** horizontal board of post-its, there is always an empty one to add a new note */
export function PostitBoard() {
  const { data } = useQuery({ queryKey: ['post-its'], queryFn: postItApi.findAll });
  if (!data) return null;
  return <PostitBoardContent initial={data} />;
}

function PostitBoardContent({ initial }: { initial: PostIt[] }) {
  const [rows, setRows] = useState<PostItRow[]>(() => [...initial.map(toRow), toRow()]);

  const update = (key: string, patch: Partial<PostItRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async (row: PostItRow, index: number) => {
    if (!row.note.trim()) return;
    const saved = await postItApi.save({ id: row.id, note: row.note });
    update(row.key, { id: saved.id, updatedOn: saved.updatedDate ?? saved.creationDate });
    if (index === rows.length - 1) setRows((list) => [...list, toRow()]);
    toast.success('postit saved or updated');
  };

  const remove = async (row: PostItRow) => {
    if (!row.id) return;
    await postItApi.delete(row.id);
    setRows((list) => list.filter((r) => r.key !== row.key));
    toast.success('postit removed');
  };

  return (
    <ScrollArea type="auto">
      <Group wrap="nowrap" align="stretch" p={4}>
        {rows.map((row, i) => (
          <Paper key={row.key} withBorder shadow="xs" p="xs" className="postit">
            <Textarea
              variant="unstyled"
              placeholder="New postIt..."
              autosize
              minRows={4}
              value={row.note}
              onChange={(e) => update(row.key, { note: e.currentTarget.value })}
            />
            <Group justify={row.updatedOn ? 'space-between' : 'flex-end'}>
              {row.updatedOn && (
                <Text size="xs" c="dimmed">
                  {fmtDate(row.updatedOn, 'DD/MM/YY HH:mm')}
                </Text>
              )}
              <Group gap={2}>
                <ActionIcon variant="subtle" color="gray" onClick={() => save(row, i)} aria-label="save postit">
                  <Icon icon="save" />
                </ActionIcon>
                {row.id && (
                  <ActionIcon variant="subtle" color="red" onClick={() => remove(row)} aria-label="delete postit">
                    <Icon icon="trash" />
                  </ActionIcon>
                )}
              </Group>
            </Group>
          </Paper>
        ))}
      </Group>
    </ScrollArea>
  );
}

export function LoadedScripts() {
  const { data: scripts } = useQuery({ queryKey: ['scripts'], queryFn: scriptApi.loaded });
  if (!scripts) return null;
  if (!scripts.length) return <Text c="dimmed">No content</Text>;
  return (
    <Stack gap={0}>
      {scripts.map((s) => (
        <Group key={s.id} justify="space-between" py={4} className="border-bottom" wrap="nowrap">
          <div>
            <Text size="xs" c="dimmed" fw={700}>
              {s.name}
            </Text>
            <Text size="sm" className="text-break">
              {s.description}
            </Text>
          </div>
          <Badge color={s.enabled ? 'artcoded' : 'red'} circle size="xs">
            {' '}
          </Badge>
        </Group>
      ))}
    </Stack>
  );
}
