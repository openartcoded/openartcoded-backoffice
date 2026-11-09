import { useState } from 'react';
import { Accordion, Code, Group, Loader, Pagination, Paper, Select, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, StatusBadge } from '@/components/ui';
import { CopyButton } from '@/components/common';
import { tasksApi } from '@/api/misc';
import { fmtDate } from '@/lib/format';
import type { ActionResult } from '@/types';
import { duration } from './history';

const PAGE_SIZE = 10;

function ResultDetail({ result }: { result: ActionResult }) {
  const output = (result.messages ?? []).join('\n');
  const parameters = (result.parameters ?? []).filter((p) => p.key);
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        id {result.id} · created {fmtDate(result.createdDate, 'DD/MM/YYYY HH:mm:ss')}
      </Text>
      {!!parameters.length && (
        <Table withTableBorder={false} highlightOnHover={false} verticalSpacing={4}>
          <Table.Tbody>
            {parameters.map((p) => (
              <Table.Tr key={p.key}>
                <Table.Td w={200} c="dimmed">
                  {p.key}
                </Table.Td>
                <Table.Td ff="monospace" fz="sm">
                  {p.value ?? '—'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {output ? (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Output
            </Text>
            <CopyButton text={output} variant="subtle" />
          </Group>
          <Code block mah={360} style={{ overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {output}
          </Code>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No output.
        </Text>
      )}
    </Stack>
  );
}

/** results persisted by the actions (when "persist result" is checked on the task), per action */
export function ActionResultsTab({ actionKey, onActionChange }: { actionKey: string | null; onActionChange: (key: string | null) => void }) {
  const [page, setPage] = useState(1);
  const { data: actions = [] } = useQuery({ queryKey: ['allowed-actions'], queryFn: tasksApi.allowedActions });
  const key = actionKey ?? actions[0]?.key ?? null;
  const { data: results, isLoading } = useQuery({
    queryKey: ['action-results', key, page],
    queryFn: () => tasksApi.actionResults(key!, page - 1, PAGE_SIZE),
    enabled: !!key,
  });

  return (
    <div className="fill-column">
      <Group gap="sm" mb="md">
        <Select
          w={360}
          aria-label="Action"
          placeholder="Select an action"
          searchable
          allowDeselect={false}
          data={actions.map((a) => ({ value: a.key ?? '', label: a.title || a.key || '' }))}
          value={key}
          onChange={(v) => {
            setPage(1);
            onActionChange(v);
          }}
        />
        {results && (
          <Text size="sm" c="dimmed">
            {results.page.totalElements} run(s)
          </Text>
        )}
      </Group>
      <div className="scroll-body">
      {isLoading && <Loader size="sm" />}
      {results && !results.content.length && (
        <Paper withBorder>
          <EmptyState icon="list" title="No result" description='Results are kept when "persist result" is checked on the task.' />
        </Paper>
      )}
      {!!results?.content.length && (
        <Accordion variant="separated" chevronPosition="left">
          {results.content.map((r) => (
            <Accordion.Item key={r.id} value={r.id ?? ''}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" pr="sm">
                  <Group gap="sm" wrap="nowrap">
                    <StatusBadge value={r.status ?? 'UNKNOWN'} />
                    <Text size="sm">{fmtDate(r.startedDate ?? r.createdDate, 'ddd DD/MM/YYYY HH:mm:ss')}</Text>
                  </Group>
                  <Group gap="md" wrap="nowrap">
                    {!!r.messages?.length && (
                      <Text size="xs" c="dimmed">
                        {r.messages.length} line(s)
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" w={70} ta="right">
                      {duration(r.startedDate, r.finishedDate)}
                    </Text>
                  </Group>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <ResultDetail result={r} />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      </div>
      {results && results.page.totalPages > 1 && (
        <Group justify="flex-end" mt="sm">
          <Pagination value={page} onChange={setPage} total={results.page.totalPages} />
        </Group>
      )}
    </div>
  );
}
