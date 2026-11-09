import { useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  Popover,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { Icon } from '@/components/Icon';
import { settingsApi } from '@/api/misc';
import { saveBlob } from '@/api/http';
import { confirm, toast } from '@/lib/ui';
import { ROLE_ADMIN, type MenuLink } from '@/types';
import { MENU_KEY, useInvalidateMenu, useMenuLinks } from './useMenuLinks';
import { menuPath } from './menu';

const iconName = (icon: MenuLink['icon']) => (Array.isArray(icon) ? icon[1] : icon);

/** rename a link and change its icon (font awesome name, previewed while typing) */
function EditLink({ link, onSave }: { link: MenuLink; onSave: (l: MenuLink) => void }) {
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [icon, setIcon] = useState(iconName(link.icon));
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" shadow="md" width={260} trapFocus>
      <Popover.Target>
        <ActionIcon variant="subtle" color="gray" onClick={() => setOpened((o) => !o)} aria-label="edit">
          <Icon icon="pen" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <TextInput
            label="Icon"
            description="Font Awesome name, e.g. folder-open"
            leftSection={<Icon icon={icon || 'question'} />}
            value={icon}
            onChange={(e) => setIcon(e.currentTarget.value.trim())}
          />
          <Group justify="flex-end">
            <Button
              size="xs"
              disabled={!title.trim() || !icon}
              onClick={() => {
                setOpened(false);
                onSave({ ...link, title: title.trim(), icon: ['fas', icon] });
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** moves a link and renumbers the menu: the new list and the links whose order changed (to save) */
export function reorderLinks(links: MenuLink[], from: number, to: number): { list: MenuLink[]; changed: MenuLink[] } {
  const moved = [...links];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  const list = moved.map((l, i) => ({ ...l, order: i }));
  return { list, changed: list.filter((_, i) => moved[i].order !== i) };
}

/**
 * navigation menu: drag a row (or use the arrows) to reorder, switch to show/hide, rename, change the icon.
 * Import / export the whole menu as json.
 */
export function SettingsPanel() {
  const { all: links } = useMenuLinks();
  const invalidate = useInvalidateMenu();
  const client = useQueryClient();

  const save = async (...updated: MenuLink[]) => {
    await Promise.all(updated.map((l) => settingsApi.save(l)));
    invalidate();
  };

  /** the new order is shown right away (no jump back while saving) */
  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return;
    const { list, changed } = reorderLinks(links, source.index, destination.index);
    client.setQueryData(MENU_KEY, list);
    save(...changed);
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    const json = JSON.parse(await file.text()) as MenuLink[];
    await settingsApi.importAll(json);
    toast.success('Menu imported');
    invalidate();
  };

  const exportLinks = () =>
    saveBlob(new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' }), `menu${Date.now()}.json`);

  const remove = async (link: MenuLink) => {
    if (!link.id || !(await confirm(`Remove ${link.title} from the menu?`))) return;
    await settingsApi.delete(link.id);
    invalidate();
  };

  const renderRow = (link: MenuLink, draggable: DraggableProvided, snapshot: DraggableStateSnapshot) => (
    <Paper
      ref={draggable.innerRef}
      {...draggable.draggableProps}
      {...draggable.dragHandleProps}
      withBorder
      px="sm"
      py={6}
      mb={4}
      shadow={snapshot.isDragging ? 'md' : undefined}
      opacity={link.show || snapshot.isDragging ? 1 : 0.6}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Icon icon="grip-vertical" color="var(--mantine-color-gray-5)" />
          <Icon icon={link.icon} />
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} truncate>
              {link.title}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {menuPath(link)}
            </Text>
          </div>
          {link.roles?.length === 1 && link.roles[0] === ROLE_ADMIN && (
            <Badge size="xs" variant="default" tt="none" fw={400}>
              Admin only
            </Badge>
          )}
        </Group>
        <Group gap={4} wrap="nowrap">
          {!!link.numberOfTimesClicked && (
            <Tooltip label="Number of clicks">
              <Text size="xs" c="dimmed" mr="xs">
                {link.numberOfTimesClicked}
              </Text>
            </Tooltip>
          )}
          <Switch
            size="xs"
            checked={!!link.show}
            onChange={() => save({ ...link, show: !link.show })}
            aria-label="toggle visibility"
            mr="xs"
          />
          <EditLink link={link} onSave={(l) => save(l)} />
          <ActionIcon variant="subtle" color="gray" onClick={() => remove(link)} aria-label="delete">
            <Icon icon="trash" />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Drag the rows to reorder the menu. Hidden links stay reachable with Ctrl+K.
        </Text>
        <Group gap="xs">
          <FileButton onChange={importFile} accept="application/json">
            {(props) => (
              <Button {...props} size="xs" variant="default" leftSection={<Icon icon="upload" />}>
                Import
              </Button>
            )}
          </FileButton>
          <Button size="xs" variant="default" leftSection={<Icon icon="download" />} onClick={exportLinks}>
            Export
          </Button>
        </Group>
      </Group>
      <DragDropContext onDragEnd={onDragEnd}>
        {/* the dragged row is rendered in document.body: inside the modal it would be offset by the modal positioning */}
        <Droppable
          droppableId="menu-links"
          renderClone={(draggable, snapshot, rubric) => renderRow(links[rubric.source.index], draggable, snapshot)}
        >
          {(droppable) => (
            <div ref={droppable.innerRef} {...droppable.droppableProps}>
              {links.map((link, index) => (
                <Draggable key={link.id ?? link.title} draggableId={link.id ?? link.title} index={index}>
                  {(draggable, snapshot) => renderRow(link, draggable, snapshot)}
                </Draggable>
              ))}
              {droppable.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Stack>
  );
}
