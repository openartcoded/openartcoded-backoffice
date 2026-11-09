import { useEffect, useState } from 'react';
import { Accordion, Box, Divider, Grid, Group, Loader, Paper, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { infoApi } from '@/api/misc';
import { invoicesApi } from '@/api/billing';
import { useIsAdmin, useMe, usePersonalInfo } from '@/auth/session';
import { Markdown } from '@/components/markdown';
import { bytesToHuman, fmtDateTime } from '@/lib/format';
import { ToolboxPanel } from '@/features/toolbox/ToolboxPanel';
import {
  DossierSummaryChart,
  FeeSummaryChart,
  InvoiceStatsPanel,
  InvoicesPerClientChart,
  InvoicesPerMonthChart,
} from './charts';
import { LogsPanel, ScriptConsole } from './console';
import { computeInvoiceStats } from './summary';
import {
  ActiveDossierLink,
  CompanyStamp,
  LoadedScripts,
  MostClickedMenu,
  NextTasks,
  PendingItems,
  PostitBoard,
  TodoList,
} from './widgets';

function StatusRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <Group justify="space-between">
      <Text fw={700} tt="uppercase" size="sm">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </Group>
  );
}

function AdminHome() {
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
  const statusItems = (['jms', 'mail', 'mongo', 'redis'] as const)
    .map((k) => ({ key: k, label: k === 'jms' ? 'Artemis' : k[0].toUpperCase() + k.slice(1), value: components?.[k] }))
    .filter((i) => i.value);

  return (
    <ScrollArea h="85vh">
      <Accordion multiple defaultValue={['news', 'postits', 'scripts', 'buildInfo', 'diskSpace', ...statusItems.map((s) => s.key)]} variant="contained">
        {news && (
          <Accordion.Item value="news">
            <Accordion.Control>What's new</Accordion.Control>
            <Accordion.Panel>
              <ScrollArea h="40vh">
                <Markdown source={news} />
              </ScrollArea>
            </Accordion.Panel>
          </Accordion.Item>
        )}
        <Accordion.Item value="postits">
          <Accordion.Control>Post it</Accordion.Control>
          <Accordion.Panel>
            <PostitBoard />
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="scripts">
          <Accordion.Control>Scripts</Accordion.Control>
          <Accordion.Panel>
            <LoadedScripts />
          </Accordion.Panel>
        </Accordion.Item>
        {buildInfo && (
          <Accordion.Item value="buildInfo">
            <Accordion.Control>Backend Info</Accordion.Control>
            <Accordion.Panel>
              <StatusRow label="Build Time" value={fmtDateTime(buildInfo.build?.time)} />
              <StatusRow label="Version" value={buildInfo.build?.version} />
              <StatusRow label="Uptime" value={String(buildInfo['camel.uptime'] ?? '')} />
            </Accordion.Panel>
          </Accordion.Item>
        )}
        {components?.diskSpace?.details && (
          <Accordion.Item value="diskSpace">
            <Accordion.Control>Disk Space</Accordion.Control>
            <Accordion.Panel>
              <StatusRow label="Total" value={bytesToHuman(components.diskSpace.details.total, true)} />
              <StatusRow label="Free" value={bytesToHuman(components.diskSpace.details.free, true)} />
            </Accordion.Panel>
          </Accordion.Item>
        )}
        {statusItems.map((s) => (
          <Accordion.Item key={s.key} value={s.key}>
            <Accordion.Control>{s.label}</Accordion.Control>
            <Accordion.Panel>
              <StatusRow label="Status" value={s.value?.status} />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </ScrollArea>
  );
}

export function HomePage() {
  const { data: user } = useMe();
  const { data: personalInfo } = usePersonalInfo();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<string | null>(null);
  const { data: invoiceSummaries } = useQuery({ queryKey: ['invoice-summaries'], queryFn: invoicesApi.findAllSummaries });
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: infoApi.logs, enabled: isAdmin && tab === 'logs' });
  const stats = invoiceSummaries ? computeInvoiceStats(invoiceSummaries) : undefined;

  useEffect(() => {
    document.title = 'Artcoded BackOffice';
  }, []);

  useEffect(() => {
    if (user && tab === null) setTab(isAdmin ? 'home' : 'invoices-month');
  }, [user, isAdmin, tab]);

  if (!user || !personalInfo) return <Loader />;

  const loadingStats = !stats && <Text>loading...</Text>;

  return (
    <Box className={personalInfo.demoMode ? 'blur' : undefined}>
      <Grid gutter="sm">
        {isAdmin && (
          <Grid.Col span={{ base: 12, lg: 2 }}>
            <Paper withBorder p="xs">
              <Stack gap="sm">
                <CompanyStamp />
                <ActiveDossierLink />
                <PendingItems />
                <Divider />
                <MostClickedMenu />
                <Divider />
                <NextTasks />
              </Stack>
            </Paper>
          </Grid.Col>
        )}
        <Grid.Col span={{ base: 12, lg: isAdmin ? 7 : 12 }}>
          <Tabs value={tab} onChange={setTab} keepMounted={false}>
            <Tabs.List grow>
              {isAdmin && <Tabs.Tab value="home">Home</Tabs.Tab>}
              {isAdmin && <Tabs.Tab value="console">Console</Tabs.Tab>}
              <Tabs.Tab value="toolbox">Toolbox</Tabs.Tab>
              <Tabs.Tab value="invoices-month">Invoices/Months</Tabs.Tab>
              <Tabs.Tab value="invoices-client">Invoices/Client</Tabs.Tab>
              <Tabs.Tab value="dossiers">Dossiers</Tabs.Tab>
              <Tabs.Tab value="expenses">Expenses</Tabs.Tab>
              <Tabs.Tab value="stats">Stats</Tabs.Tab>
              {isAdmin && <Tabs.Tab value="logs">Logs</Tabs.Tab>}
            </Tabs.List>
            <Box pt="sm">
              {isAdmin && <Tabs.Panel value="home"><AdminHome /></Tabs.Panel>}
              {isAdmin && <Tabs.Panel value="console"><ScriptConsole /></Tabs.Panel>}
              <Tabs.Panel value="toolbox">
                <ToolboxPanel />
              </Tabs.Panel>
              <Tabs.Panel value="invoices-month">{stats ? <InvoicesPerMonthChart stats={stats} /> : loadingStats}</Tabs.Panel>
              <Tabs.Panel value="invoices-client">{stats ? <InvoicesPerClientChart stats={stats} /> : loadingStats}</Tabs.Panel>
              <Tabs.Panel value="dossiers">
                <DossierSummaryChart />
              </Tabs.Panel>
              <Tabs.Panel value="expenses">
                <FeeSummaryChart />
              </Tabs.Panel>
              <Tabs.Panel value="stats">{stats ? <InvoiceStatsPanel stats={stats} /> : loadingStats}</Tabs.Panel>
              {isAdmin && <Tabs.Panel value="logs">{logs !== undefined ? <LogsPanel logs={logs} /> : <Loader />}</Tabs.Panel>}
            </Box>
          </Tabs>
        </Grid.Col>
        {isAdmin && (
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <TodoList />
          </Grid.Col>
        )}
      </Grid>
    </Box>
  );
}
