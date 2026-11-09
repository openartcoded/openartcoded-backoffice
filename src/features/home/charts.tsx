import { useState, type ReactNode } from 'react';
import { BarChart, CompositeChart, DonutChart } from '@mantine/charts';
import { Group, Loader, Paper, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { dossiersApi, feesApi } from '@/api/billing';
import { fmtCurrency, fmtNumber } from '@/lib/format';
import { defaultYear, dossierChartData, feeChartData, type InvoiceStats } from './summary';

const CLIENT_COLORS = ['artcoded.7', 'teal.6', 'orange.6', 'grape.6', 'cyan.6', 'red.6', 'lime.6', 'indigo.6', 'pink.6', 'yellow.6'];

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder p="md">
      <Title order={5} mb="sm">
        {title}
      </Title>
      {children}
    </Paper>
  );
}

/** earnings (line, right axis) and working days (bars) per invoiced period */
export function InvoicesPerMonthChart({ stats }: { stats: InvoiceStats }) {
  return (
    <ChartCard title="Earnings / Working days">
      <CompositeChart
        h={420}
        data={stats.perPeriod}
        dataKey="period"
        withLegend
        withRightYAxis
        rightYAxisProps={{ tickFormatter: (v: number) => fmtCurrency(v) }}
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
      <Group justify="center" align="center" gap="xl">
        <DonutChart data={data} size={300} thickness={40} withTooltip tooltipDataSource="segment" valueFormatter={fmtCurrency} />
        <Stack gap={4}>
          {data.map((d) => (
            <Group key={d.name} gap="xs">
              <div style={{ width: 12, height: 12, borderRadius: 2, background: `var(--mantine-color-${d.color.replace('.', '-')})` }} />
              <Text size="sm">
                {d.name}: <b>{fmtCurrency(d.value)}</b>
              </Text>
            </Group>
          ))}
        </Stack>
      </Group>
    </ChartCard>
  );
}

export function DossierSummaryChart() {
  const { data, isLoading } = useQuery({ queryKey: ['dossier-summaries'], queryFn: () => dossiersApi.allSummaries(true) });
  if (isLoading) return <Loader />;
  return (
    <ChartCard title="Earnings / Expenses">
      <BarChart
        h={420}
        data={dossierChartData(data ?? [])}
        dataKey="name"
        withLegend
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
  if (isLoading) return <Loader />;
  return (
    <ChartCard title="Expenses">
      <BarChart
        h={420}
        data={feeChartData(data ?? [])}
        dataKey="tag"
        withLegend
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
      <Text fw={600} tt="uppercase" size="sm">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
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
        <Text fw={700} c="dimmed" tt="uppercase" mb="sm">
          All time
        </Text>
        <StatRow label="Number of Invoices" value={stats.totalInvoices} />
        <StatRow label="Total worked" value={`${fmtNumber(stats.totalAmountOfWork)} days`} />
        <StatRow label="Total excl. VAT" value={fmtCurrency(stats.totalExclVat)} />
      </Paper>
    </SimpleGrid>
  );
}
