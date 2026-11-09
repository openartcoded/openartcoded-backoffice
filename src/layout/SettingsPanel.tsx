import { useState } from 'react';
import { ActionIcon, Button, FileInput, Group, Stack, Text } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { settingsApi } from '@/api/misc';
import { saveBlob } from '@/api/http';
import { useInvalidateMenu, useMenuLinks } from './useMenuLinks';
import type { MenuLink } from '@/types';

/** menu settings: order, visibility, delete, import / export */
export function SettingsPanel() {
  const { all: links } = useMenuLinks();
  const invalidate = useInvalidateMenu();
  const [file, setFile] = useState<File | null>(null);

  const save = async (...updated: MenuLink[]) => {
    await Promise.all(updated.map((l) => settingsApi.save(l)));
    invalidate();
  };

  /** swaps the order of two consecutive links */
  const move = (index: number, delta: -1 | 1) => {
    const a = links[index];
    const b = links[index + delta];
    if (!a || !b) return;
    save({ ...a, order: (a.order ?? 0) + delta }, { ...b, order: (b.order ?? 0) - delta });
  };

  const importFile = async () => {
    if (!file) return;
    const json = JSON.parse(await file.text()) as MenuLink[];
    await settingsApi.importAll(json);
    setFile(null);
    invalidate();
  };

  const exportLinks = () =>
    saveBlob(new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' }), `menu${Date.now()}.json`);

  const remove = async (link: MenuLink) => {
    if (!link.id) return;
    await settingsApi.delete(link.id);
    invalidate();
  };

  return (
    <Stack gap="sm">
      <Group align="flex-end">
        <FileInput style={{ flex: 1 }} label="Import menu" value={file} onChange={setFile} accept="application/json" />
        <Button onClick={importFile} disabled={!file}>
          Import
        </Button>
        <Button variant="default" leftSection={<Icon icon="download" />} onClick={exportLinks}>
          Export
        </Button>
      </Group>
      <Stack gap={0} className="bordered-list">
        {links.map((link, index) => (
          <Group key={link.id ?? link.title} justify="space-between" px="sm" py={4}>
            <Group gap="xs">
              <Icon icon={link.icon} />
              <Text>{link.title}</Text>
            </Group>
            <Group gap={2}>
              <ActionIcon variant="subtle" color="gray" disabled={index === 0} onClick={() => move(index, -1)} aria-label="up">
                <Icon icon="arrow-up" />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={index === links.length - 1}
                onClick={() => move(index, 1)}
                aria-label="down"
              >
                <Icon icon="arrow-down" />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color={link.show ? 'green' : 'gray'}
                onClick={() => save({ ...link, show: !link.show })}
                aria-label="toggle visibility"
              >
                <Icon icon={link.show ? 'eye' : 'eye-slash'} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" onClick={() => remove(link)} aria-label="delete">
                <Icon icon="trash" />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
