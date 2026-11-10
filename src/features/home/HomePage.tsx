import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Center, Grid, Loader, Paper, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { timesheetApi } from '@/api/misc';
import { dossiersApi, feesApi, invoicesApi } from '@/api/billing';
import { useIsAdmin, useMe, usePersonalInfo } from '@/auth/session';
import { KpiCard, PageHeader } from '@/components/ui';
import { dayjs, fmtCurrency, trim } from '@/lib/format';
import {
  CHART_HEIGHT,
  DossierSummaryChart,
  FeeSummaryChart,
  InvoiceStatsPanel,
  InvoicesPerClientChart,
  InvoicesPerMonthChart,
} from './charts';
import { computeInvoiceStats } from './summary';
import { CompanyStamp, MostClickedMenu } from './widgets';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** key figures: to invoice, revenue of the year, unprocessed expenses, active dossier */
function Kpis({ isAdmin, revenue, invoices }: { isAdmin: boolean; revenue?: number; invoices?: number }) {
  const navigate = useNavigate();
  const { data: estimate } = useQuery({
    queryKey: ['timesheet-estimate'],
    queryFn: timesheetApi.estimateThisMonth,
    enabled: isAdmin,
  });
  const { data: fees } = useQuery({
    queryKey: ['home-unpaid-fees'],
    queryFn: () => feesApi.search({ archived: false, bookmarked: false }, 0, 1),
  });
  const { data: dossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const latestFee = fees?.content[0];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
      {isAdmin && (
        <KpiCard
          label="To invoice this month"
          icon="clock"
          value={fmtCurrency(estimate ?? 0)}
          hint="Based on the open timesheets"
          onClick={() => navigate('/timesheets')}
        />
      )}
      <KpiCard
        label={`Revenue ${new Date().getFullYear()} (excl. VAT)`}
        icon="file-invoice-dollar"
        value={revenue === undefined ? undefined : fmtCurrency(revenue)}
        hint={invoices === undefined ? undefined : `${invoices} invoice(s)`}
        onClick={() => navigate('/invoice')}
      />
      <KpiCard
        label="Unprocessed expenses"
        icon="money-bill-wave"
        value={fees?.page.totalElements}
        hint={latestFee ? `Latest: ${trim(latestFee.subject, 30)}` : 'All processed'}
        onClick={() => navigate('/fee/unprocessed')}
      />
      <KpiCard
        label="Active dossier"
        icon="folder-open"
        value={dossier?.name ?? 'None'}
        hint={dossier ? `VAT estimate ${fmtCurrency(dossier.tvaToBePaid)}` : 'Open one to process expenses'}
        onClick={() => navigate('/dossier')}
      />
    </SimpleGrid>
  );
}

type ChartView = 'month' | 'client' | 'dossiers' | 'expenses' | 'stats';

function Charts({ stats }: { stats?: ReturnType<typeof computeInvoiceStats> }) {
  const [view, setView] = useState<ChartView>('month');
  const loading = (
    <Center h={CHART_HEIGHT}>
      <Loader size="sm" />
    </Center>
  );
  return (
    <Stack gap="md">
      <SegmentedControl
        size="xs"
        w="fit-content"
        value={view}
        onChange={(v) => setView(v as ChartView)}
        data={[
          { value: 'month', label: 'Per month' },
          { value: 'client', label: 'Per client' },
          { value: 'dossiers', label: 'Dossiers' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'stats', label: 'Totals' },
        ]}
      />
      {view === 'month' && (stats ? <InvoicesPerMonthChart stats={stats} /> : loading)}
      {view === 'client' && (stats ? <InvoicesPerClientChart stats={stats} /> : loading)}
      {view === 'dossiers' && <DossierSummaryChart />}
      {view === 'expenses' && <FeeSummaryChart />}
      {view === 'stats' && (stats ? <InvoiceStatsPanel stats={stats} /> : loading)}
    </Stack>
  );
}

export function HomePage() {
  const { data: user } = useMe();
  const { data: personalInfo } = usePersonalInfo();
  const isAdmin = useIsAdmin();
  const { data: invoiceSummaries } = useQuery({
    queryKey: ['invoice-summaries'],
    queryFn: invoicesApi.findAllSummaries,
  });
  const stats = invoiceSummaries ? computeInvoiceStats(invoiceSummaries) : undefined;
  const thisYear = stats?.perYear[new Date().getFullYear()];

  if (!user || !personalInfo) return <Loader />;

  return (
    <div className={`home-page${personalInfo.demoMode ? ' blur' : ''}`}>
      <PageHeader
        title={`${greeting()}${user.username ? `, ${user.username}` : ''}`}
        documentTitle="Artcoded BackOffice"
        description={dayjs().format('dddd D MMMM YYYY')}
        actions={isAdmin && <MostClickedMenu />}
        mb={0}
      />
      <Kpis
        isAdmin={isAdmin}
        revenue={stats ? (thisYear?.totalExclVat ?? 0) : undefined}
        invoices={stats ? (thisYear?.numberOfInvoices ?? 0) : undefined}
      />
      <Grid>
        <Grid.Col span={{ base: 12, lg: isAdmin ? 8 : 12 }}>
          <Paper withBorder p="md" h="100%">
            <Charts stats={stats} />
          </Paper>
        </Grid.Col>
        {isAdmin && (
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder p="md" h="100%">
              <Text fw={600} mb="xs">
                Company card
              </Text>
              <CompanyStamp />
            </Paper>
          </Grid.Col>
        )}
      </Grid>
    </div>
  );
}
