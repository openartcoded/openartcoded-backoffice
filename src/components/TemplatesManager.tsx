import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActionIcon, Button, Group, Stack, Tabs, Text, TextInput, Tooltip } from '@mantine/core';
import { Icon } from './Icon';
import { FilePicker } from './files';
import { NoContent } from './common';
import { filesApi } from '@/api/files';
import { confirm, toast } from '@/lib/ui';
import type { FreemarkerTemplate } from '@/types';

/** freemarker templates (invoice & cv): list, download, delete, add and optionally set as default */
export function TemplatesManager({
  queryKey,
  load,
  add,
  remove: removeTemplate,
  defaultTemplateId: initialDefault,
  setDefault,
}: {
  queryKey: string;
  load: () => Promise<FreemarkerTemplate[]>;
  add: (fd: FormData) => Promise<unknown>;
  remove: (t: FreemarkerTemplate) => Promise<unknown>;
  defaultTemplateId?: string;
  setDefault?: (t: FreemarkerTemplate) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File>();
  const [defaultTemplateId, setDefaultTemplateId] = useState(initialDefault);
  const { data: templates = [], refetch } = useQuery({ queryKey: ['templates', queryKey], queryFn: load });

  const onSetDefault = setDefault
    ? async (t: FreemarkerTemplate) => {
        await setDefault(t);
        setDefaultTemplateId(t.id);
        toast.success('template set as default');
      }
    : undefined;

  const remove = async (t: FreemarkerTemplate) => {
    if (t.id === defaultTemplateId) {
      toast.error('you cannot delete the current default template!');
      return;
    }
    if (await confirm('Are you sure you want to delete this template?')) {
      await removeTemplate(t);
      toast.success('template deleted');
      refetch();
    }
  };

  const submit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('template', file);
    fd.append('name', name);
    await add(fd);
    toast.success('template saved');
    setName('');
    setFile(undefined);
    refetch();
  };

  return (
    <Tabs defaultValue="current">
      <Tabs.List>
        <Tabs.Tab value="current">Current Templates</Tabs.Tab>
        <Tabs.Tab value="new">New Template</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="current" pt="sm">
        {!templates.length && <NoContent />}
        <Stack gap={0} className="bordered-list">
          {templates.map((t) => (
            <Group key={t.id} justify="space-between" px="sm" py={6}>
              <Text>{t.name}</Text>
              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  aria-label="download"
                  onClick={() => t.templateUploadId && filesApi.download(t.templateUploadId)}
                >
                  <Icon icon="download" />
                </ActionIcon>
                {onSetDefault && (
                  <Tooltip label="Set as default">
                    <ActionIcon
                      variant="subtle"
                      color="green"
                      disabled={t.id === defaultTemplateId}
                      onClick={() => onSetDefault(t)}
                      aria-label="set as default"
                    >
                      <Icon icon={t.id === defaultTemplateId ? 'check' : 'rocket'} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  disabled={!!defaultTemplateId && t.id === defaultTemplateId}
                  onClick={() => remove(t)}
                  aria-label="delete"
                >
                  <Icon icon="times" />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="new" pt="sm">
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Template name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <FilePicker
            onFiles={(f) => setFile(f[0])}
            accept={{ 'text/plain': ['.ftl'] }}
            files={file ? [file] : []}
            label="Drop a .ftl template"
          />
          <Group justify="flex-end">
            <Button onClick={submit} disabled={!name.trim() || !file}>
              Submit
            </Button>
          </Group>
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
