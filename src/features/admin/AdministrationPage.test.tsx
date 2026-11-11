import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderWithProviders } from '@/test/utils';

const session = vi.hoisted(() => ({ authorities: ['ADMIN'] as string[] }));

vi.mock('@/auth/session', () => ({
  ME_KEY: ['me'],
  PERSONAL_INFO_KEY: ['personal-info'],
  useIsAdmin: () => session.authorities.includes('ADMIN'),
  useDemoMode: () => false,
}));

// the panels are tested on their own, here we only check the layout / tabs / routing
vi.mock('@/features/home/widgets', () => ({
  TodoList: () => <div>todo-panel</div>,
  NextTasks: () => <div>next-tasks-panel</div>,
  LoadedScripts: () => <div>scripts-panel</div>,
}));
vi.mock('@/features/home/console', () => ({
  ScriptConsole: () => <div>console-panel</div>,
  LogsPanel: ({ logs }: { logs: string }) => <div>logs-panel: {logs}</div>,
}));
vi.mock('@/features/toolbox/ToolboxPanel', () => ({ ToolboxPanel: () => <div>toolbox-panel</div> }));
vi.mock('@/api/misc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/misc')>()),
  infoApi: { logs: vi.fn(), buildInfo: vi.fn(), health: vi.fn() },
}));

import { infoApi } from '@/api/misc';
import { AdministrationPage } from './AdministrationPage';

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/administration/:name?" element={<AdministrationPage />} />
    </Routes>,
    { route },
  );
}

describe('AdministrationPage', () => {
  // restoreMocks is on (vite.config.ts): the mocked values must be set before each test
  beforeEach(() => {
    vi.mocked(infoApi.logs).mockResolvedValue('some log line');
    vi.mocked(infoApi.buildInfo).mockResolvedValue({ build: { version: '1.0.0' } } as never);
    vi.mocked(infoApi.health).mockResolvedValue({
      status: 'UP',
      components: { mongo: { status: 'UP' }, diskSpace: { status: 'UP', details: { total: 100e9, free: 40e9 } } },
    } as never);
  });

  it('always shows the system, the to do and the next tasks to an admin, next to the console', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration');
    expect(await screen.findByText('console-panel')).toBeInTheDocument();
    expect(screen.getByText('todo-panel')).toBeInTheDocument();
    expect(screen.getByText('next-tasks-panel')).toBeInTheDocument();
    expect(await screen.findByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Mongo')).toBeInTheDocument();
    expect(screen.getByLabelText('disk used')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Console', 'Logs', 'Scripts', 'Toolbox', "What's new"]);
  });

  it('opens the tab from the url', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/logs');
    expect(await screen.findByText('logs-panel: some log line')).toBeInTheDocument();
    // the side column stays
    expect(screen.getByText('todo-panel')).toBeInTheDocument();
  });

  it('navigates between tabs', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/logs');
    await userEvent.click(await screen.findByRole('tab', { name: 'Scripts' }));
    expect(await screen.findByText('scripts-panel')).toBeInTheDocument();
  });

  it('redirects the old tabs (to do, next tasks...) to the console', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/todo');
    expect(await screen.findByText('console-panel')).toBeInTheDocument();
  });

  it('only shows the toolbox to an accountant, without the side column', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderAt('/administration');
    expect(await screen.findByText('toolbox-panel')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Toolbox']);
    expect(screen.queryByText('todo-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('redirects an accountant away from an admin only tab', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderAt('/administration/logs');
    expect(await screen.findByText('toolbox-panel')).toBeInTheDocument();
    expect(screen.queryByText(/logs-panel/)).not.toBeInTheDocument();
  });
});
