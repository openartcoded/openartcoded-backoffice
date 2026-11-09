import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Checkbox, Grid, Group, NavLink, Paper, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/common';
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

  useEffect(() => {
    document.title = 'Timesheets';
  }, []);

  const years = useMemo(() => Object.keys(grouped ?? {}).map(Number).sort((a, b) => a - b), [grouped]);
  const clientNames = useMemo(
    () => [...new Set(Object.values(grouped ?? {}).flatMap((byClient) => Object.keys(byClient)))],
    [grouped],
  );
  const byClient = grouped?.[String(year)] ?? {};
  const selectedClient = client ?? Object.keys(byClient)[0];
  const timesheets = [...(byClient[selectedClient ?? ''] ?? [])].sort((a, b) => (b.month ?? 0) - (a.month ?? 0));
  const stats = yearStats(timesheets);

  if (!grouped) return <PageTitle title="Timesheets" />;

  return (
    <>
      <PageTitle title="Timesheets" />
      <Group justify="space-between" mb="sm" className={demoMode ? 'blur' : undefined}>
        <Text fw={600}>Estimate this month: {fmtCurrency(estimate ?? 0)}</Text>
        <Group gap="xs">
          {clientNames.map((name) => (
            <Button key={name} variant={name === selectedClient ? 'filled' : 'outline'} color="gray" onClick={() => setClient(name)}>
              {name}
            </Button>
          ))}
        </Group>
      </Group>
      {!years.length && (
        <Alert color="yellow" icon={<Icon icon="info" />}>
          No content.
        </Alert>
      )}
      <Grid className={demoMode ? 'blur' : undefined}>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Paper withBorder>
            {years.map((y) => (
              <NavLink key={y} label={y} active={y === year} onClick={() => setYear(y)} />
            ))}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          {!timesheets.length ? (
            <Text>No result for this year.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Period</Table.Th>
                  <Table.Th ta="center">Closed</Table.Th>
                  <Table.Th ta="center">Working Days</Table.Th>
                  <Table.Th ta="center" visibleFrom="md">
                    Hours Worked
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {timesheets.map((t) => (
                  <Table.Tr key={t.id} className="clickable" onClick={() => navigate(`/timesheets/timesheet/${t.id}`)}>
                    <Table.Td>{t.name}</Table.Td>
                    <Table.Td ta="center">{t.closed ? <Checkbox checked readOnly aria-label="closed" mx="auto" w="fit-content" /> : 'No'}</Table.Td>
                    <Table.Td ta="center">{t.numberOfWorkingDays}</Table.Td>
                    <Table.Td ta="center" visibleFrom="md">
                      {t.numberOfHoursWorked}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              {stats && (
                <Table.Tfoot visibleFrom="md">
                  <Table.Tr bg="gray.1">
                    <Table.Td colSpan={2} ta="right" fw={700}>
                      Total / Avg
                    </Table.Td>
                    <Table.Td ta="center" bg="yellow.1">
                      {stats.sumWorkingDays} / {stats.avgWorkingDays}
                    </Table.Td>
                    <Table.Td ta="center" bg="red.1">
                      {stats.sumWorkingHours} / {stats.avgWorkingHours}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          )}
        </Grid.Col>
      </Grid>
    </>
  );
}
