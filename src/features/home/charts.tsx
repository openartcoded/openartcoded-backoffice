import { useState, type ReactNode } from 'react';
import { BarChart, CompositeChart, DonutChart } from '@mantine/charts';
import { Center, ColorSwatch, Group, Loader, Paper, ScrollArea, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { dossiersApi, feesApi } from '@/api/billing';
import { fmtCurrency, fmtNumber } from '@/lib/format';
import { defaultYear, dossierChartData, feeChartData, type InvoiceStats } from './summary';

/** all the charts have the same height, so switching view doesn't move the page */
export const CHART_HEIGHT = 340;

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

const CLIENT_COLORS = ['artcoded.7', 'teal.6', 'orange.6', 'grape.6', 'cyan.6', 'red.6', 'lime.6', 'indigo.6', 'pink.6', 'yellow.6'];

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
  const data = stats.perClient.map((c, i) => ({ name: c.client, value: c.total, color: CLIENT_COLORS[i % CLIENT_COLORS.length] }));
  return (
    <ChartCard title="Invoice / Client">
      <SimpleGrid cols={{ base: 1, sm: 2 }} h={{ sm: CHART_HEIGHT }} spacing="xl" style={{ alignItems: 'center' }}>
        <Center>
          <DonutChart data={data} size={260} thickness={36} withTooltip tooltipDataSource="segment" valueFormatter={fmtCurrency} />
        </Center>
        <ScrollArea.Autosize mah={CHART_HEIGHT}>
          <Stack gap={6}>
            {[...data]
              .sort((a, b) => b.value - a.value)
              .map((d) => (
                <Group key={d.name} justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ColorSwatch color={`var(--mantine-color-${d.color.replace('.', '-')})`} size={10} radius={2} withShadow={false} />
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
  const { data, isLoading } = useQuery({ queryKey: ['dossier-summaries'], queryFn: () => dossiersApi.allSummaries(true) });
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

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <Group justify="space-between" py={6} className="border-bottom">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Group>
  );
}

export function InvoiceStatsPanel({ stats }: { stats: InvoiceStats }) {
  const years = Object.keys(stats.perYear).map(Number).sort();
  const [year, setYear] = useState<number>(() => defaultYear(stats.perYear));
  const selected = stats.perYear[year];
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Paper withBorder p="md">
        <Select
          mb="sm"
          label="Year"
          data={years.map(String)}
          value={String(year)}
          onChange={(v) => v && setYear(Number(v))}
          allowDeselect={false}
        />
        <StatRow label="Number of Invoices" value={selected?.numberOfInvoices ?? 0} />
        <StatRow label="Total worked (days)" value={fmtNumber(selected?.totalAmountOfWork ?? 0)} />
        <StatRow label="Total excl. VAT" value={fmtCurrency(selected?.totalExclVat ?? 0)} />
      </Paper>
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">
          All time
        </Text>
        <StatRow label="Number of Invoices" value={stats.totalInvoices} />
        <StatRow label="Total worked" value={`${fmtNumber(stats.totalAmountOfWork)} days`} />
        <StatRow label="Total excl. VAT" value={fmtCurrency(stats.totalExclVat)} />
      </Paper>
    </SimpleGrid>
  );
}
