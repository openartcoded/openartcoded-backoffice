import { useState, type ReactNode } from 'react';
import { BarChart, CompositeChart, DonutChart, LineChart } from '@mantine/charts';
import {
  Center,
  ColorSwatch,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { dossiersApi, feesApi } from '@/api/billing';
import { timesheetApi } from '@/api/misc';
import { fmtCurrency, fmtNumber } from '@/lib/format';
import { cumulativeHours, hoursPerClient, hoursPerYear } from './hours';
import { dossierChartData, feeChartData, perWorkedDay, type InvoiceStats } from './summary';

/** all the charts have the same height, so switching view doesn't move the page */
export const CHART_HEIGHT = 300;

/** axis ticks: 12.345 € -> 12k €, the tooltips keep the full amount */
const compactNumber = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const compactCurrency = (v: number) => `${compactNumber.format(v)} €`;

/** same axes / legend / grid for every chart */
const common = {
  h: CHART_HEIGHT,
  withLegend: true,
  legendProps: { verticalAlign: 'top' as const, height: 36 },
  gridAxis: 'y' as const,
  tickLine: 'none' as const,
  xAxisProps: { interval: 'preserveStartEnd' as const, minTickGap: 12, tickMargin: 8 },
};

const CLIENT_COLORS = [
  'artcoded.7',
  'teal.6',
  'orange.6',
  'grape.6',
  'cyan.6',
  'red.6',
  'lime.6',
  'indigo.6',
  'pink.6',
  'yellow.6',
];

function ChartLoader() {
  return (
    <Center h={CHART_HEIGHT}>
      <Loader size="sm" />
    </Center>
  );
}

/** a chart and its caption (the dashboard panel gives the frame) */
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

/** earnings (line, right axis) and working days (bars) per invoiced period */
export function InvoicesPerMonthChart({ stats }: { stats: InvoiceStats }) {
  return (
    <ChartCard title="Earnings / Working days">
      <CompositeChart
        {...common}
        data={stats.perPeriod}
        dataKey="period"
        withRightYAxis
        yAxisProps={{ width: 48, allowDecimals: false }}
        rightYAxisProps={{ width: 64, tickFormatter: compactCurrency }}
        series={[
          { name: 'workingDays', label: 'Working days', color: 'gray.4', type: 'bar' },
          { name: 'earnings', label: 'Earnings', color: 'artcoded.7', type: 'line', yAxisId: 'right' },
        ]}
        curveType="monotone"
        valueFormatter={(v) => fmtNumber(v)}
      />
    </ChartCard>
  );
}

export function InvoicesPerClientChart({ stats }: { stats: InvoiceStats }) {
  const data = stats.perClient.map((c, i) => ({
    name: c.client,
    value: c.total,
    color: CLIENT_COLORS[i % CLIENT_COLORS.length],
  }));
  return (
    <ChartCard title="Invoice / Client">
      <SimpleGrid cols={{ base: 1, sm: 2 }} h={{ sm: CHART_HEIGHT }} spacing="xl" style={{ alignItems: 'center' }}>
        <Center>
          <DonutChart
            data={data}
            size={260}
            thickness={36}
            withTooltip
            tooltipDataSource="segment"
            valueFormatter={fmtCurrency}
          />
        </Center>
        <ScrollArea.Autosize mah={CHART_HEIGHT}>
          <Stack gap={6}>
            {[...data]
              .sort((a, b) => b.value - a.value)
              .map((d) => (
                <Group key={d.name} justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ColorSwatch
                      color={`var(--mantine-color-${d.color.replace('.', '-')})`}
                      size={10}
                      radius={2}
                      withShadow={false}
                    />
                    <Text size="sm" truncate>
                      {d.name}
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtCurrency(d.value)}
                  </Text>
                </Group>
              ))}
          </Stack>
        </ScrollArea.Autosize>
      </SimpleGrid>
    </ChartCard>
  );
}

export function DossierSummaryChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['dossier-summaries'],
    queryFn: () => dossiersApi.allSummaries(true),
  });
  if (isLoading) return <ChartLoader />;
  return (
    <ChartCard title="Earnings / Expenses">
      <BarChart
        {...common}
        yAxisProps={{ width: 64, tickFormatter: compactCurrency }}
        data={dossierChartData(data ?? [])}
        dataKey="name"
        valueFormatter={fmtCurrency}
        series={[
          { name: 'earnings', label: 'Earnings', color: 'artcoded.7' },
          { name: 'expenses', label: 'Expenses', color: 'orange.6' },
        ]}
      />
    </ChartCard>
  );
}

export function FeeSummaryChart() {
  const { data, isLoading } = useQuery({ queryKey: ['fee-summaries'], queryFn: feesApi.summaries });
  if (isLoading) return <ChartLoader />;
  return (
    <ChartCard title="Expenses">
      <BarChart
        {...common}
        yAxisProps={{ width: 64, tickFormatter: compactCurrency }}
        data={feeChartData(data ?? [])}
        dataKey="tag"
        valueFormatter={fmtCurrency}
        series={[
          { name: 'totalHVAT', label: 'Total HVAT', color: 'artcoded.7' },
          { name: 'vat', label: 'VAT', color: 'red.5' },
        ]}
      />
    </ChartCard>
  );
}

type HoursView = 'year' | 'progress' | 'clients';

/** hours worked from the timesheets: per year and client, cumulated month by month, per client */
export function TimesheetHoursChart({ now = new Date() }: { now?: Date }) {
  const [view, setView] = useState<HoursView>('year');
  const [client, setClient] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['timesheet-stats'], queryFn: timesheetApi.stats });
  if (isLoading) return <ChartLoader />;
  if (!data?.rows.length) {
    return (
      <Center h={CHART_HEIGHT}>
        <Text size="sm" c="dimmed">
          No timesheet yet.
        </Text>
      </Center>
    );
  }
  const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;
  const fmtHours = (v: number) => `${fmtNumber(v)} h`;
  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <SegmentedControl
          size="xs"
          value={view}
          onChange={(v) => setView(v as HoursView)}
          data={[
            { value: 'year', label: 'Per year' },
            { value: 'progress', label: 'Progress' },
            { value: 'clients', label: 'Per client' },
          ]}
        />
        {view === 'progress' && (
          <Select
            size="xs"
            w={200}
            placeholder="All clients"
            aria-label="client"
            data={data.clients}
            value={client}
            onChange={setClient}
            clearable
            searchable
          />
        )}
      </Group>
      {view === 'year' &&
        (() => {
          const { data: rows, series } = hoursPerYear(data);
          return (
            <BarChart
              {...common}
              data={rows}
              dataKey="year"
              type="stacked"
              yAxisProps={{ width: 56, tickFormatter: (v: number) => compactNumber.format(v) }}
              valueFormatter={fmtHours}
              series={series.map((name, i) => ({
                name,
                color: name === 'Other' ? 'gray.4' : CLIENT_COLORS[i % CLIENT_COLORS.length],
              }))}
            />
          );
        })()}
      {view === 'progress' &&
        (() => {
          const { data: rows, series } = cumulativeHours(data, client, now);
          const current = String(now.getFullYear());
          return (
            <LineChart
              {...common}
              data={rows}
              dataKey="month"
              connectNulls={false}
              withDots={false}
              yAxisProps={{ width: 56, tickFormatter: (v: number) => compactNumber.format(v) }}
              valueFormatter={fmtHours}
              series={series.map((name, i) => ({
                name,
                color: name === current ? 'artcoded.7' : CLIENT_COLORS[(series.length - i) % CLIENT_COLORS.length],
                strokeDasharray: name === current ? undefined : '4 3',
              }))}
            />
          );
        })()}
      {view === 'clients' &&
        (() => {
          const { rows, total } = hoursPerClient(data, now);
          const years = [...data.years].reverse();
          const progress = (p?: number) =>
            p === undefined ? (
              '—'
            ) : (
              <Text span size="sm" c={p >= 0 ? 'teal.7' : 'red.7'} style={num}>
                {p >= 0 ? '+' : ''}
                {Math.round(p * 100)}%
              </Text>
            );
          return (
            <ScrollArea h={CHART_HEIGHT} type="auto">
              <Table stickyHeader verticalSpacing={6} highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Client</Table.Th>
                    {years.map((y) => (
                      <Table.Th key={y} ta="right">
                        {y}
                      </Table.Th>
                    ))}
                    <Table.Th ta="right">
                      <Tooltip label="This year so far vs the same months last year" withArrow>
                        <span>Progress</span>
                      </Tooltip>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...rows, total].map((r) => (
                    <Table.Tr key={r.client} style={r === total ? { fontWeight: 600 } : undefined}>
                      <Table.Td>
                        <Text size="sm" truncate maw={180} fw={r === total ? 600 : undefined}>
                          {r.client}
                        </Text>
                      </Table.Td>
                      {years.map((y) => (
                        <Table.Td key={y} ta="right" style={num}>
                          {r.perYear[y] ? fmtNumber(r.perYear[y]) : '—'}
                        </Table.Td>
                      ))}
                      <Table.Td ta="right">{progress(r.progress)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          );
        })()}
    </Stack>
  );
}

/**
 * revenue and days worked per year, most recent first, with the average daily rate and a bar to compare the years.
 * The current year is the one still running ("so far").
 */
export function YearlyStats({
  stats,
  workedDays,
  now = new Date(),
}: {
  stats?: InvoiceStats;
  /** per year, the calendar days worked from the timesheets (absent: the column is not shown) */
  workedDays?: Record<number, number>;
  now?: Date;
}) {
  const header = (
    <Group justify="space-between" px="md" py="sm" className="border-bottom" gap="xs">
      <Text fw={600} size="sm">
        Per year
      </Text>
      {stats && stats.totalInvoices > 0 && (
        <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          All time: {fmtCurrency(stats.totalExclVat)} · {fmtNumber(stats.totalAmountOfWork)} days
        </Text>
      )}
    </Group>
  );
  if (!stats) {
    return (
      <Paper withBorder h="100%">
        {header}
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      </Paper>
    );
  }
  const years = Object.keys(stats.perYear)
    .map(Number)
    .sort((a, b) => b - a);
  const max = Math.max(1, ...years.map((y) => stats.perYear[y].totalExclVat));
  const current = now.getFullYear();
  const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

  return (
    <Paper withBorder h="100%">
      {header}
      {!years.length ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No invoices yet.
        </Text>
      ) : (
        <Table withTableBorder={false} highlightOnHover={false} verticalSpacing={8} horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Year</Table.Th>
              <Table.Th ta="right">Revenue (excl. VAT)</Table.Th>
              <Table.Th visibleFrom="sm" w="30%" />
              <Table.Th ta="right">Days</Table.Th>
              <Table.Th ta="right" visibleFrom="xs">
                Per day
              </Table.Th>
              {workedDays && (
                <Table.Th ta="right">
                  <Tooltip
                    label="Revenue of the year / calendar days worked (timesheets): a day counts once, however many hours are invoiced that day. Only the years with a timesheet every month, and the current one"
                    multiline
                    w={280}
                    withArrow
                  >
                    <span>Relative</span>
                  </Tooltip>
                </Table.Th>
              )}
              <Table.Th ta="right" visibleFrom="sm">
                Invoices
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {years.map((y) => {
              const row = stats.perYear[y];
              const isCurrent = y === current;
              return (
                <Table.Tr key={y} style={isCurrent ? { fontWeight: 600 } : undefined}>
                  <Table.Td style={num}>
                    {y}
                    {isCurrent && (
                      <Text span size="xs" c="dimmed" fw={400}>
                        {' '}
                        so far
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right" style={num}>
                    {fmtCurrency(row.totalExclVat)}
                  </Table.Td>
                  <Table.Td visibleFrom="sm">
                    <Progress
                      value={(row.totalExclVat / max) * 100}
                      size="sm"
                      color={isCurrent ? 'artcoded.7' : 'artcoded.3'}
                      aria-label={`revenue ${y}`}
                    />
                  </Table.Td>
                  <Table.Td ta="right" style={num}>
                    {fmtNumber(row.totalAmountOfWork)}
                  </Table.Td>
                  <Table.Td ta="right" style={num} visibleFrom="xs">
                    {row.totalAmountOfWork ? fmtCurrency(row.totalExclVat / row.totalAmountOfWork) : '—'}
                  </Table.Td>
                  {workedDays && (
                    <Table.Td
                      ta="right"
                      style={num}
                      title={workedDays[y] ? `${workedDays[y]} days worked` : 'not a timesheet every month'}
                    >
                      {perWorkedDay(row, workedDays[y]) !== undefined
                        ? fmtCurrency(perWorkedDay(row, workedDays[y]))
                        : '—'}
                    </Table.Td>
                  )}
                  <Table.Td ta="right" style={num} visibleFrom="sm">
                    {row.numberOfInvoices}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
