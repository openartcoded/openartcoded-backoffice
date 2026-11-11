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
  ScrollArea,
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
import { StatusBadge } from '@/components/ui';
import { hasOpenModal } from '@/components/modal';
import { postItApi, scriptApi, settingsApi, tasksApi, todoApi } from '@/api/misc';
import { usePersonalInfo } from '@/auth/session';
import { menuPath } from '@/layout/menu';
import { fmtDate, trim } from '@/lib/format';
import { toast } from '@/lib/ui';
import { openTaskForm } from '@/features/tasks/TaskForm';
import type { PostIt, ReminderTask, Todo } from '@/types';

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

/** the notes panel: same height as the chart next to it, only the list scrolls */
export const NOTES_LIST_MAX_HEIGHT = 250;

const noteDate = (p: PostIt) => p.updatedDate ?? p.creationDate;
const byMostRecent = (a: PostIt, b: PostIt) =>
  new Date(noteDate(b) ?? 0).getTime() - new Date(noteDate(a) ?? 0).getTime();

/** a note: edited in place, saved when leaving the field, delete on hover */
function NoteCard({
  note,
  onSave,
  onDelete,
}: {
  note: PostIt;
  onSave: (note: PostIt, value: string) => void;
  onDelete: (note: PostIt) => void;
}) {
  const [value, setValue] = useState(note.note);
  return (
    <div className="note-card">
      <Textarea
        variant="unstyled"
        autosize
        minRows={1}
        size="sm"
        aria-label="note"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={() => onSave(note, value)}
      />
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed">
          {fmtDate(noteDate(note), 'DD/MM/YY HH:mm')}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          className="note-delete"
          onClick={() => onDelete(note)}
          aria-label="delete postit"
        >
          <Icon icon="trash" />
        </ActionIcon>
      </Group>
    </div>
  );
}

/** quick notes (post-its): add on top (ctrl+enter), most recent first */
export function NotesPanel() {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: ['post-its'], queryFn: postItApi.findAll });
  const [draft, setDraft] = useState('');
  const notes = [...(data ?? [])].sort(byMostRecent);

  const setNotes = (updater: (list: PostIt[]) => PostIt[]) =>
    client.setQueryData<PostIt[]>(['post-its'], (list) => updater(list ?? []));

  const add = async () => {
    const note = draft.trim();
    if (!note) return;
    const saved = await postItApi.save({ note });
    setNotes((list) => [{ ...saved, note: saved.note ?? note }, ...list]);
    setDraft('');
    toast.success('note added');
  };

  const save = async (p: PostIt, value: string) => {
    // nothing changed, or emptied by mistake: keep the note as it is (delete is explicit)
    if (!value.trim() || value === p.note) return;
    const saved = await postItApi.save({ id: p.id, note: value });
    setNotes((list) => list.map((n) => (n.id === p.id ? { ...n, ...saved, note: value } : n)));
  };

  const remove = async (p: PostIt) => {
    if (!p.id) return;
    await postItApi.delete(p.id);
    setNotes((list) => list.filter((n) => n.id !== p.id));
    toast.success('note deleted');
  };

  return (
    <Paper withBorder h="100%">
      <Group justify="space-between" px="md" py="sm" className="border-bottom" gap="xs">
        <Group gap="xs">
          <Text fw={600} size="sm">
            Notes
          </Text>
          {!!notes.length && (
            <Badge size="sm" variant="light" color="gray">
              {notes.length}
            </Badge>
          )}
        </Group>
      </Group>
      <Stack gap="sm" p="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Textarea
            placeholder="New note..."
            aria-label="new note"
            autosize
            minRows={2}
            maxRows={6}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                add();
              }
            }}
          />
          <Group justify="space-between" mt={6}>
            <Text size="xs" c="dimmed">
              <Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd>
            </Text>
            <Button type="submit" size="compact-xs" variant="light" disabled={!draft.trim()} aria-label="save postit">
              Add
            </Button>
          </Group>
        </form>
        {data && !notes.length && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No notes yet.
          </Text>
        )}
        {!!notes.length && (
          <ScrollArea.Autosize mah={NOTES_LIST_MAX_HEIGHT} type="auto" offsetScrollbars>
            <Stack gap="xs">
              {notes.map((n) => (
                <NoteCard key={n.id} note={n} onSave={save} onDelete={remove} />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Paper>
  );
}

export function LoadedScripts() {
  const { data: scripts } = useQuery({ queryKey: ['scripts'], queryFn: scriptApi.loaded });
  if (!scripts) return null;
  if (!scripts.length) return <Text c="dimmed">No content</Text>;
  return (
    <Stack gap={0}>
      {scripts.map((s) => (
        <Group key={s.id} justify="space-between" py={6} className="border-bottom" wrap="nowrap" gap="sm">
          <div style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" fw={700}>
              {s.name}
            </Text>
            <Text size="sm" className="text-break">
              {s.description}
            </Text>
          </div>
          <div style={{ flexShrink: 0 }}>
            <StatusBadge value={s.enabled ? 'SUCCESS' : 'FAILURE'} label={s.enabled ? 'Enabled' : 'Disabled'} />
          </div>
        </Group>
      ))}
    </Stack>
  );
}
