import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Center, Grid, Group, Loader, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { infoApi, timesheetApi } from '@/api/misc';
import { dossiersApi, feesApi, invoicesApi } from '@/api/billing';
import { useIsAdmin, useMe, usePersonalInfo } from '@/auth/session';
import { Markdown } from '@/components/markdown';
import { KpiCard, PageHeader, Panel, StatusBadge } from '@/components/ui';
import { bytesToHuman, dayjs, fmtCurrency, fmtDateTime, trim } from '@/lib/format';
import { ToolboxPanel } from '@/features/toolbox/ToolboxPanel';
import { CHART_HEIGHT, DossierSummaryChart, FeeSummaryChart, InvoiceStatsPanel, InvoicesPerClientChart, InvoicesPerMonthChart } from './charts';
import { LogsPanel, ScriptConsole } from './console';
import { computeInvoiceStats } from './summary';
import { CompanyStamp, LoadedScripts, MostClickedMenu, NextTasks, PostitBoard, TodoList } from './widgets';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** key figures: to invoice, revenue of the year, unprocessed expenses, active dossier */
function Kpis({ isAdmin, revenue, invoices }: { isAdmin: boolean; revenue?: number; invoices?: number }) {
  const navigate = useNavigate();
  const { data: estimate } = useQuery({ queryKey: ['timesheet-estimate'], queryFn: timesheetApi.estimateThisMonth, enabled: isAdmin });
  const { data: fees } = useQuery({
    queryKey: ['home-unpaid-fees'],
    queryFn: () => feesApi.search({ archived: false, bookmarked: false }, 0, 1),
  });
  const { data: dossier } = useQuery({ queryKey: ['active-dossier'], queryFn: dossiersApi.activeDossier });
  const latestFee = fees?.content[0];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
      {isAdmin && (
        <KpiCard label="To invoice this month" icon="clock" value={fmtCurrency(estimate ?? 0)} hint="Based on the open timesheets" onClick={() => navigate('/timesheets')} />
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

function SystemPanel() {
  const { data: news } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      try {
        return await (await fetch('/assets/news.md')).text();
      } catch {
        return '# Error\n\nFailed to load content.';
      }
    },
  });
  const { data: buildInfo } = useQuery({ queryKey: ['build-info'], queryFn: infoApi.buildInfo });
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: infoApi.health });
  const components = health?.components;
  const services = (['jms', 'mail', 'mongo', 'redis'] as const)
    .map((k) => ({ key: k, label: k === 'jms' ? 'Artemis' : k[0].toUpperCase() + k.slice(1), status: components?.[k]?.status }))
    .filter((s) => s.status);

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Panel title="What's new">
          <ScrollArea.Autosize mah={420}>{news ? <Markdown source={news} /> : <Loader size="sm" />}</ScrollArea.Autosize>
        </Panel>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack>
          <Panel title="Backend">
            <Stack gap={6}>
              <Row label="Version" value={buildInfo?.build?.version} />
              <Row label="Build time" value={fmtDateTime(buildInfo?.build?.time)} />
              <Row label="Uptime" value={String(buildInfo?.['camel.uptime'] ?? '')} />
              {components?.diskSpace?.details && (
                <Row
                  label="Disk space"
                  value={`${bytesToHuman(components.diskSpace.details.free, true)} free of ${bytesToHuman(components.diskSpace.details.total, true)}`}
                />
              )}
              {services.map((s) => (
                <Row key={s.key} label={s.label} value={<StatusBadge value={s.status === 'UP' ? 'SUCCESS' : 'FAILURE'} label={s.status} />} />
              ))}
            </Stack>
          </Panel>
          <Panel title="Scripts">
            <LoadedScripts />
          </Panel>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right">
        {value || '—'}
      </Text>
    </Group>
  );
}

function Workspace({ isAdmin, stats }: { isAdmin: boolean; stats?: ReturnType<typeof computeInvoiceStats> }) {
  const [tab, setTab] = useState<string | null>(isAdmin ? 'todo' : 'activity');
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: infoApi.logs, enabled: isAdmin && tab === 'logs' });
  return (
    <Tabs value={tab} onChange={setTab} keepMounted={false} className="home-tabs" h="100%">
      <Tabs.List mb="md">
        {isAdmin && <Tabs.Tab value="todo">To do</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="next-tasks">Next tasks</Tabs.Tab>}
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
        <Tabs.Tab value="toolbox">Toolbox</Tabs.Tab>
        {isAdmin && <Tabs.Tab value="console">Console</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="company">Company card</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="system">System</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="logs">Logs</Tabs.Tab>}
      </Tabs.List>
      {isAdmin && (
        <Tabs.Panel value="todo">
          <TodoList />
        </Tabs.Panel>
      )}
      {isAdmin && (
        <Tabs.Panel value="next-tasks">
          <NextTasks />
        </Tabs.Panel>
      )}
      <Tabs.Panel value="activity">
        <Charts stats={stats} />
      </Tabs.Panel>
      <Tabs.Panel value="toolbox">
        <ToolboxPanel />
      </Tabs.Panel>
      {isAdmin && (
        <Tabs.Panel value="console">
          <ScriptConsole />
        </Tabs.Panel>
      )}
      {isAdmin && (
        <Tabs.Panel value="company">
          <CompanyStamp />
        </Tabs.Panel>
      )}
      {isAdmin && (
        <Tabs.Panel value="system">
          <SystemPanel />
        </Tabs.Panel>
      )}
      {isAdmin && <Tabs.Panel value="logs">{logs !== undefined ? <LogsPanel logs={logs} /> : <Loader />}</Tabs.Panel>}
    </Tabs>
  );
}

export function HomePage() {
  const { data: user } = useMe();
  const { data: personalInfo } = usePersonalInfo();
  const isAdmin = useIsAdmin();
  const { data: invoiceSummaries } = useQuery({ queryKey: ['invoice-summaries'], queryFn: invoicesApi.findAllSummaries });
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
      <Kpis isAdmin={isAdmin} revenue={stats ? (thisYear?.totalExclVat ?? 0) : undefined} invoices={stats ? (thisYear?.numberOfInvoices ?? 0) : undefined} />
      <div className={isAdmin ? 'home-main' : 'home-main home-main-single'}>
        <Paper withBorder p="md" className="home-panel">
          <Workspace isAdmin={isAdmin} stats={stats} />
        </Paper>
        {isAdmin && (
          <ScrollArea className="home-panel" type="auto" offsetScrollbars>
            <PostitBoard />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
