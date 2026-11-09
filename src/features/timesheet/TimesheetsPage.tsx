import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Group, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { EmptyRow, EmptyState, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { timesheetApi } from '@/api/misc';
import { useDemoMode } from '@/auth/session';
import { fmtCurrency } from '@/lib/format';
import { yearStats } from './logic';

export function TimesheetsPage() {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const { data: grouped } = useQuery({ queryKey: ['timesheets'], queryFn: timesheetApi.findAllGrouped });
  const { data: estimate } = useQuery({ queryKey: ['timesheet-estimate'], queryFn: timesheetApi.estimateThisMonth });
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [client, setClient] = useState<string>();

  const years = useMemo(() => Object.keys(grouped ?? {}).map(Number).sort((a, b) => a - b), [grouped]);
  const clientNames = useMemo(
    () => [...new Set(Object.values(grouped ?? {}).flatMap((byClient) => Object.keys(byClient)))],
    [grouped],
  );
  const byClient = grouped?.[String(year)] ?? {};
  const selectedClient = client ?? Object.keys(byClient)[0];
  const timesheets = [...(byClient[selectedClient ?? ''] ?? [])].sort((a, b) => (b.month ?? 0) - (a.month ?? 0));
  const stats = yearStats(timesheets);

  const header = (
    <PageHeader
      title="Timesheets"
      description={
        <span className={demoMode ? 'blur' : undefined}>
          Estimate this month: <b>{fmtCurrency(estimate ?? 0)}</b>
        </span>
      }
    />
  );
  if (!grouped) return header;

  return (
    <>
      {header}
      {!years.length ? (
        <Paper withBorder>
          <EmptyState icon="clock" title="No timesheet" description="Timesheets are created automatically each month for the ongoing clients." />
        </Paper>
      ) : (
        <Stack gap="md" className={demoMode ? 'blur' : undefined}>
          <Group justify="space-between" gap="sm">
            {clientNames.length > 1 ? (
              <SegmentedControl value={selectedClient ?? ''} onChange={setClient} data={clientNames} aria-label="client" />
            ) : (
              <Text fw={500}>{selectedClient}</Text>
            )}
            <SegmentedControl value={String(year)} onChange={(y) => setYear(Number(y))} data={years.map(String)} aria-label="year" />
          </Group>
          {stats && (
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Paper withBorder p="sm">
                <Stat label="Working days" value={stats.sumWorkingDays} strong />
              </Paper>
              <Paper withBorder p="sm">
                <Stat label="Average per month" value={stats.avgWorkingDays} />
              </Paper>
              <Paper withBorder p="sm">
                <Stat label="Hours worked" value={stats.sumWorkingHours} strong />
              </Paper>
              <Paper withBorder p="sm">
                <Stat label="Hours per month" value={stats.avgWorkingHours} />
              </Paper>
            </SimpleGrid>
          )}
          <Table className="clickable-rows">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Period</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Working days</Table.Th>
                <Table.Th ta="right" visibleFrom="sm">
                  Hours
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!timesheets.length && <EmptyRow colSpan={4} icon="clock" title="No result for this year." />}
              {timesheets.map((t) => (
                <Table.Tr key={t.id} onClick={() => navigate(`/timesheets/timesheet/${t.id}`)}>
                  <Table.Td fw={500}>{t.name}</Table.Td>
                  <Table.Td>
                    <StatusBadge value={t.closed ? 'CLOSED' : 'OPEN'} label={t.closed ? 'Released' : 'Open'} color={t.closed ? 'green' : 'blue'} />
                  </Table.Td>
                  <Table.Td ta="right">{t.numberOfWorkingDays}</Table.Td>
                  <Table.Td ta="right" visibleFrom="sm">
                    {t.numberOfHoursWorked}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </>
  );
}
