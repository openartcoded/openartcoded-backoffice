import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Grid, Group, Loader, Paper, ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { infoApi } from '@/api/misc';
import { useIsAdmin } from '@/auth/session';
import { Markdown } from '@/components/markdown';
import { PageHeader, Panel, StatusBadge } from '@/components/ui';
import { bytesToHuman, fmtDateTime } from '@/lib/format';
import { ToolboxPanel } from '@/features/toolbox/ToolboxPanel';
import { LogsPanel, ScriptConsole } from '@/features/home/console';
import { LoadedScripts, NextTasks, PostitBoard, TodoList } from '@/features/home/widgets';

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

/** what's new, backend version / health and the loaded scripts */
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
    .map((k) => ({
      key: k,
      label: k === 'jms' ? 'Artemis' : k[0].toUpperCase() + k.slice(1),
      status: components?.[k]?.status,
    }))
    .filter((s) => s.status);

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Panel title="What's new">
          <ScrollArea.Autosize mah={420}>
            {news ? <Markdown source={news} /> : <Loader size="sm" />}
          </ScrollArea.Autosize>
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
                <Row
                  key={s.key}
                  label={s.label}
                  value={<StatusBadge value={s.status === 'UP' ? 'SUCCESS' : 'FAILURE'} label={s.status} />}
                />
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

function Logs() {
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: infoApi.logs });
  return logs !== undefined ? <LogsPanel logs={logs} /> : <Loader />;
}

type AdminTab = { value: string; label: string; adminOnly: boolean; render: () => ReactNode };

export const ADMIN_TABS: AdminTab[] = [
  { value: 'todo', label: 'To do', adminOnly: true, render: () => <TodoList /> },
  { value: 'next-tasks', label: 'Next tasks', adminOnly: true, render: () => <NextTasks /> },
  { value: 'post-its', label: 'Post-its', adminOnly: true, render: () => <PostitBoard /> },
  { value: 'toolbox', label: 'Toolbox', adminOnly: false, render: () => <ToolboxPanel /> },
  { value: 'console', label: 'Console', adminOnly: true, render: () => <ScriptConsole /> },
  { value: 'system', label: 'System', adminOnly: true, render: () => <SystemPanel /> },
  { value: 'logs', label: 'Logs', adminOnly: true, render: () => <Logs /> },
];

/** everything that is not the dashboard: to do, post-its, toolbox, script console, system info, logs */
export function AdministrationPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { name } = useParams();
  const tabs = ADMIN_TABS.filter((t) => isAdmin || !t.adminOnly);
  const current = tabs.find((t) => t.value === name);

  if (!current) return <Navigate to={`/administration/${tabs[0].value}`} replace />;

  return (
    <div className="admin-page">
      <PageHeader title="Administration" mb={0} />
      <Paper withBorder p="md" className="admin-panel">
        <Tabs
          value={current.value}
          onChange={(v) => v && navigate(`/administration/${v}`)}
          keepMounted={false}
          className="home-tabs"
          h="100%"
        >
          <Tabs.List mb="md">
            {tabs.map((t) => (
              <Tabs.Tab key={t.value} value={t.value}>
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {tabs.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              {t.render()}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Paper>
    </div>
  );
}
