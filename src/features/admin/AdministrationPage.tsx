import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Badge, Group, Loader, Paper, Progress, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { infoApi } from '@/api/misc';
import { useIsAdmin } from '@/auth/session';
import { Markdown } from '@/components/markdown';
import { PageHeader, Panel } from '@/components/ui';
import { bytesToHuman, fmtDateTime } from '@/lib/format';
import { ToolboxPanel } from '@/features/toolbox/ToolboxPanel';
import { LogsPanel, ScriptConsole } from '@/features/home/console';
import { LoadedScripts, NextTasks, TodoList } from '@/features/home/widgets';

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" truncate>
        {value || '—'}
      </Text>
    </Group>
  );
}

/** backend version, uptime, disk and services at a glance */
function SystemStatus() {
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
  const disk = components?.diskSpace?.details;
  const usedPercent = disk?.total ? ((disk.total - disk.free) / disk.total) * 100 : undefined;

  return (
    <Panel
      title="System"
      actions={
        health?.status && (
          <Badge size="sm" variant="light" color={health.status === 'UP' ? 'green' : 'red'}>
            {health.status}
          </Badge>
        )
      }
    >
      <Stack gap={6}>
        <Row label="Version" value={buildInfo?.build?.version} />
        <Row label="Build" value={fmtDateTime(buildInfo?.build?.time)} />
        <Row label="Uptime" value={String(buildInfo?.['camel.uptime'] ?? '')} />
        {disk && usedPercent !== undefined && (
          <Stack gap={4}>
            <Row label="Disk" value={`${bytesToHuman(disk.free, true)} free of ${bytesToHuman(disk.total, true)}`} />
            <Progress
              value={usedPercent}
              size="sm"
              color={usedPercent > 90 ? 'red' : usedPercent > 75 ? 'orange' : 'artcoded.7'}
              aria-label="disk used"
            />
          </Stack>
        )}
        {!!services.length && (
          <Group gap={6} mt={4}>
            {services.map((s) => (
              <Tooltip key={s.key} label={s.status} withArrow>
                <Badge variant="dot" color={s.status === 'UP' ? 'green' : 'red'} size="sm">
                  {s.label}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        )}
      </Stack>
    </Panel>
  );
}

function News() {
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
  return news ? <Markdown source={news} /> : <Loader size="sm" />;
}

function Logs() {
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: infoApi.logs });
  return logs !== undefined ? <LogsPanel logs={logs} /> : <Loader />;
}

type WorkbenchTab = { value: string; label: string; adminOnly: boolean; render: () => ReactNode };

/** the tools that need room: one url per tab (/administration/logs...) */
export const WORKBENCH_TABS: WorkbenchTab[] = [
  { value: 'console', label: 'Console', adminOnly: true, render: () => <ScriptConsole /> },
  { value: 'logs', label: 'Logs', adminOnly: true, render: () => <Logs /> },
  { value: 'scripts', label: 'Scripts', adminOnly: true, render: () => <LoadedScripts /> },
  { value: 'toolbox', label: 'Toolbox', adminOnly: false, render: () => <ToolboxPanel /> },
  { value: 'news', label: "What's new", adminOnly: true, render: () => <News /> },
];

/**
 * Desktop: a side column always visible (system, to do, next tasks) and the workbench filling the rest of the screen,
 * only their content scrolls. Smaller screens: one column, the page scrolls.
 */
export function AdministrationPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { name } = useParams();
  const tabs = WORKBENCH_TABS.filter((t) => isAdmin || !t.adminOnly);
  const current = tabs.find((t) => t.value === name);

  // unknown tab, or one of the old ones (todo, next-tasks...) now always visible on the side
  if (!current) return <Navigate to={`/administration/${tabs[0].value}`} replace />;

  return (
    <div className="admin-page">
      <PageHeader title="Administration" mb={0} />
      <div className={isAdmin ? 'admin-layout' : 'admin-layout admin-layout-single'}>
        {isAdmin && (
          <div className="admin-side">
            <SystemStatus />
            <Panel title="To do">
              <TodoList />
            </Panel>
            <Panel title="Next tasks">
              <NextTasks />
            </Panel>
          </div>
        )}
        <Paper withBorder p="md" className="admin-workbench">
          <Tabs
            value={current.value}
            onChange={(v) => v && navigate(`/administration/${v}`)}
            keepMounted={false}
            className="home-tabs"
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
    </div>
  );
}
