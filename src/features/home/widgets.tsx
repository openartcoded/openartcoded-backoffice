import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Kbd,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { hasOpenModal } from '@/components/modal';
import { postItApi, scriptApi, settingsApi, tasksApi, todoApi } from '@/api/misc';
import { usePersonalInfo } from '@/auth/session';
import { menuPath } from '@/layout/menu';
import { fmtDate, trim } from '@/lib/format';
import { toast } from '@/lib/ui';
import { openTaskForm } from '@/features/tasks/TaskForm';
import type { PostIt, ReminderTask, Todo } from '@/types';

/** company card (logo + contact) that can be downloaded as a png */
/** a business card (85 x 55 mm) with the company info, downloadable as a png (print quality) */
export function CompanyStamp() {
  const { data: info } = usePersonalInfo();
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  if (!info) return null;

  const downloadImage = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      // 340 x 220 css px rendered at 4x: 1360 x 880 px, ~400 dpi at 85 x 55 mm
      const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 4 });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'company_card.png';
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const address = [
    info.organizationAddress,
    [info.organizationPostCode, info.organizationCity].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const line = (icon: string, value?: string) =>
    value && (
      <div className="company-card-line">
        <Icon icon={icon} />
        <span>{value}</span>
      </div>
    );

  return (
    <Stack gap="md" align="center" py="lg">
      <div className="company-card" ref={ref}>
        <div className="company-card-top">
          <div>
            <div className="company-card-name">{info.ceoFullName || info.organizationName}</div>
            {info.ceoFullName && <div className="company-card-org">{info.organizationName}</div>}
          </div>
          {info.logoUploadId && (
            <div className="company-card-logo">
              <AuthImage id={info.logoUploadId} alt="logo" />
            </div>
          )}
        </div>
        <div className="company-card-contact">
          {line(
            'phone',
            [info.organizationPhoneNumber, info.organizationSecondPhoneNumber].filter(Boolean).join(' · ') || undefined,
          )}
          {line('envelope', info.organizationEmailAddress)}
          {line('map-marker-alt', address)}
          {line('vcard', info.vatNumber && `VAT ${info.vatNumber}`)}
        </div>
      </div>
      <Text size="xs" c="dimmed">
        Business card size (85 × 55 mm)
      </Text>
      <Button variant="default" leftSection={<Icon icon="download" />} onClick={downloadImage} loading={downloading}>
        Download as image
      </Button>
    </Stack>
  );
}

/** keys of the number row of an azerty keyboard (1..5 without shift) */
export const QUICK_LINK_KEYS = ['&', 'é', '"', "'", '('];

/** most clicked menu links, reachable with ctrl+& ctrl+é ctrl+" ... */
export function MostClickedMenu() {
  const navigate = useNavigate();
  const { data: links = [] } = useQuery({ queryKey: ['menu-top3'], queryFn: settingsApi.top3 });
  useHotkeys(
    QUICK_LINK_KEYS.map((key, i) => [
      `ctrl+${key}`,
      () => {
        const link = links[i];
        if (link && !hasOpenModal()) navigate(menuPath(link));
      },
    ]),
  );
  if (!links.length) return null;
  return (
    <Group gap="xs">
      {links.map((l, i) => (
        <Tooltip key={l.id ?? l.title} label={`${l.title} · Ctrl+${QUICK_LINK_KEYS[i]}`} withArrow>
          <ActionIcon variant="light" size="xl" radius="md" onClick={() => navigate(menuPath(l))} aria-label={l.title}>
            <Icon icon={l.icon} />
          </ActionIcon>
        </Tooltip>
      ))}
    </Group>
  );
}

export function taskName(task: ReminderTask) {
  return trim(task.customActionName || task.title, 40);
}

/** next ten tasks, content of a home tab */
export function NextTasks() {
  const client = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['next-tasks'], queryFn: tasksApi.nextTen });
  const open = (task?: ReminderTask) =>
    openTaskForm(task, () => client.invalidateQueries({ queryKey: ['next-tasks'] }));
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          The next 10 runs.
        </Text>
        <Button size="xs" variant="default" leftSection={<Icon icon="plus" />} onClick={() => open()}>
          New task
        </Button>
      </Group>
      {!tasks.length && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Nothing planned.
        </Text>
      )}
      <Stack gap={0}>
        {tasks.map((t) => (
          <UnstyledButton key={t.id} className="list-row border-bottom" onClick={() => open(t)}>
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {taskName(t)}
                </Text>
                {t.actionKey && (
                  <Text size="xs" c="dimmed">
                    Action {t.actionKey}
                  </Text>
                )}
              </div>
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDate(t.nextDate, 'ddd DD/MM HH:mm')}
              </Text>
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  );
}

export function TodoList() {
  const client = useQueryClient();
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => (await todoApi.findAll()).sort((a, b) => Number(a.done) - Number(b.done)),
  });
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkeys([['alt+n', () => inputRef.current?.focus()]]);

  const setTodos = (updater: (list: Todo[]) => Todo[]) =>
    client.setQueryData<Todo[]>(['todos'], (list) => updater(list ?? []));

  const save = async () => {
    if (title.trim().length < 2) return;
    const saved = await todoApi.save({ title: title.trim(), done: false });
    setTodos((list) => [saved, ...list]);
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
  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const row = (todo: Todo) => (
    <Group key={todo.id} gap="sm" wrap="nowrap" className="todo-row">
      <Checkbox checked={!!todo.done} onChange={() => toggle(todo)} aria-label="toggle done" radius="xl" />
      <Text
        size="sm"
        style={{ flex: 1 }}
        td={todo.done ? 'line-through' : undefined}
        c={todo.done ? 'dimmed' : undefined}
      >
        {todo.title}
      </Text>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        className="todo-delete"
        onClick={() => remove(todo)}
        aria-label="delete todo"
      >
        <Icon icon="trash" />
      </ActionIcon>
    </Group>
  );

  return (
    <Stack gap="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          ref={inputRef}
          placeholder="New todo..."
          aria-label="new todo"
          leftSection={<Icon icon="plus" />}
          rightSectionWidth={70}
          rightSection={
            title.trim().length >= 2 ? (
              <Button type="submit" size="compact-xs" variant="light" aria-label="save todo">
                Add
              </Button>
            ) : (
              <Kbd size="xs">Alt+N</Kbd>
            )
          }
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </form>
      {!todos.length && (
        <Text c="dimmed" ta="center" py="xl" size="sm">
          Nothing to do.
        </Text>
      )}
      {!!pending.length && <Stack gap={0}>{pending.map(row)}</Stack>}
      {!!done.length && (
        <Stack gap={0}>
          <Text size="xs" c="dimmed" fw={500} mb={4}>
            Completed ({done.length})
          </Text>
          {done.map(row)}
        </Stack>
      )}
    </Stack>
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
    <Stack gap="sm">
      {rows.map((row, i) => (
        <Paper key={row.key} p="sm" className={row.id ? 'postit' : 'postit postit-new'}>
          <Textarea
            variant="unstyled"
            placeholder="New note..."
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
              <ActionIcon
                variant="subtle"
                color="dark"
                size="sm"
                disabled={!row.note.trim()}
                onClick={() => save(row, i)}
                aria-label="save postit"
              >
                <Icon icon="save" />
              </ActionIcon>
              {row.id && (
                <ActionIcon
                  variant="subtle"
                  color="dark"
                  size="sm"
                  onClick={() => remove(row)}
                  aria-label="delete postit"
                >
                  <Icon icon="trash" />
                </ActionIcon>
              )}
            </Group>
          </Group>
        </Paper>
      ))}
    </Stack>
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
