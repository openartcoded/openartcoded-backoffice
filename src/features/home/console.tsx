import { useEffect, useState } from 'react';
import { ActionIcon, Button, Code, Grid, Group, Paper, ScrollArea, Select, Stack, Table, Text, Textarea } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { CopyButton } from '@/components/common';
import { Markdown } from '@/components/markdown';
import { openModal } from '@/components/modal';
import { scriptApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { copyToClipboard } from '@/lib/ui';
import type { UserScript } from '@/types';

const STORAGE_KEY = 'script';
const PLACEHOLDER = `let dossiers = dossierService.findAll(true)
let ids = []
for(const dossier of dossiers) {
  ids.push(dossier.getId())
}
JSON.stringify(ids)`;

function readDraft(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(value: string) {
  try {
    if (value.trim()) localStorage.setItem(STORAGE_KEY, value.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage not available, the draft is simply not kept
  }
}

export function GraalJsHelp() {
  const open = async () => {
    let content: string;
    try {
      const res = await fetch('/assets/graaljs-help.md');
      content = await res.text();
    } catch {
      content = '# Error\n\nFailed to load help content.';
    }
    openModal({ title: 'GraalJS Scripting Quick Reference', fullScreen: true, render: () => <Markdown source={content} /> });
  };
  return (
    <ActionIcon variant="subtle" color="dark" onClick={open} aria-label="GraalJS Quick Help">
      <Icon icon="circle-question" />
    </ActionIcon>
  );
}

/** graaljs console: run scripts on the backend, save them, browse the bindings */
export function ScriptConsole() {
  const client = useQueryClient();
  const { data: bindings = {} } = useQuery({ queryKey: ['script-bindings'], queryFn: scriptApi.bindings });
  const { data: userScripts = [] } = useQuery({ queryKey: ['user-scripts'], queryFn: scriptApi.userScripts });
  const [script, setScript] = useState(readDraft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [out, setOut] = useState('');
  const [error, setError] = useState(false);

  // the draft is kept in the local storage (5 seconds after the last change)
  useEffect(() => {
    const timer = setTimeout(() => writeDraft(script), 5000);
    return () => clearTimeout(timer);
  }, [script]);

  const run = async () => {
    setError(false);
    if (!script.trim()) {
      setOut('script is empty');
      setError(true);
      return;
    }
    try {
      setOut(await scriptApi.run(script));
    } catch (e) {
      setOut(errorMessage(e));
      setError(true);
    }
  };

  const save = async () => {
    const saved = await scriptApi.saveUserScript({ id: selectedId ?? undefined, content: script });
    client.setQueryData<UserScript[]>(['user-scripts'], (list = []) =>
      list.some((s) => s.id === saved.id) ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved],
    );
    setSelectedId(saved.id ?? null);
  };

  const remove = async () => {
    if (!selectedId) return;
    await scriptApi.deleteUserScript(selectedId);
    client.setQueryData<UserScript[]>(['user-scripts'], (list = []) => list.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    const s = userScripts.find((x) => x.id === id);
    if (s) setScript(s.content);
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, lg: 9 }}>
        <Group gap="xs" mb="xs" wrap="nowrap">
          <GraalJsHelp />
          <Select
            style={{ flex: 1 }}
            size="xs"
            placeholder="--- Select Script ---"
            data={userScripts.map((s) => ({ value: s.id ?? '', label: `Script ${s.id}` }))}
            value={selectedId}
            onChange={select}
            disabled={!userScripts.length}
            clearable
          />
          <Button size="xs" variant="outline" color="green" disabled={!script.trim()} onClick={save}>
            Save
          </Button>
          <Button size="xs" variant="outline" color="red" disabled={!selectedId} onClick={remove}>
            Delete
          </Button>
        </Group>
        <Paper withBorder>
          <Textarea
            variant="unstyled"
            px="sm"
            autoFocus
            minRows={15}
            maxRows={15}
            autosize
            ff="monospace"
            placeholder={PLACEHOLDER}
            value={script}
            onChange={(e) => setScript(e.currentTarget.value)}
          />
          <Group justify="space-between" p="xs" bg="gray.0">
            <Group gap="xs">
              <Button size="xs" onClick={run}>
                Run
              </Button>
              <CopyButton text={script} label="Copy script" />
            </Group>
            <Group gap="xs">
              <CopyButton text={out} label="Copy out" />
              <Button
                size="xs"
                variant="outline"
                color="cyan"
                onClick={() => {
                  setOut('');
                  setError(false);
                }}
              >
                Clear
              </Button>
            </Group>
          </Group>
          <Text px="sm" py={4} c="dimmed" fw={600} bg="gray.0">
            Output
          </Text>
          <ScrollArea h="34vh">
            <Code block c={error ? 'red' : undefined} className="pre-wrap">
              {out || 'no output.'}
            </Code>
          </ScrollArea>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 3 }}>
        <Paper withBorder>
          <Text p="xs" c="dimmed" fw={600}>
            Bindings
          </Text>
          <ScrollArea.Autosize mah={480}>
            <Table>
              <Table.Tbody>
                {Object.keys(bindings).map((b) => (
                  <Table.Tr key={b} className="clickable" onClick={() => copyToClipboard(b, 'copied')}>
                    <Table.Td>
                      <Code>{b}</Code>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!Object.keys(bindings).length && (
                  <Table.Tr>
                    <Table.Td c="dimmed">No bindings available</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}

export function LogsPanel({ logs }: { logs: string }) {
  return (
    <Stack gap="xs" h="100%">
      <Group justify="flex-end">
        <CopyButton text={logs} />
      </Group>
      <ScrollArea style={{ flex: 1, minHeight: 0 }} viewportRef={(el) => el && el.scrollTo({ top: el.scrollHeight })}>
        <Code block className="pre-wrap">
          {logs}
        </Code>
      </ScrollArea>
    </Stack>
  );
}
