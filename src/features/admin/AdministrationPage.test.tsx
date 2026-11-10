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

// the panels are tested on their own, here we only check the tabs / routing
vi.mock('@/features/home/widgets', () => ({
  TodoList: () => <div>todo-panel</div>,
  NextTasks: () => <div>next-tasks-panel</div>,
  PostitBoard: () => <div>postits-panel</div>,
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
    vi.mocked(infoApi.health).mockResolvedValue({ components: { mongo: { status: 'UP' } } } as never);
  });

  it('shows every tab to an admin and opens the first one by default', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration');
    expect(await screen.findByText('todo-panel')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['To do', 'Next tasks', 'Post-its', 'Toolbox', 'Console', 'System', 'Logs']);
  });

  it('opens the tab from the url', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/logs');
    expect(await screen.findByText('logs-panel: some log line')).toBeInTheDocument();
  });

  it('navigates between tabs', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/todo');
    await userEvent.click(await screen.findByRole('tab', { name: 'Console' }));
    expect(await screen.findByText('console-panel')).toBeInTheDocument();
  });

  it('shows the system info', async () => {
    session.authorities = ['ADMIN'];
    renderAt('/administration/system');
    expect(await screen.findByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('scripts-panel')).toBeInTheDocument();
  });

  it('only shows the toolbox to an accountant', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderAt('/administration');
    expect(await screen.findByText('toolbox-panel')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Toolbox']);
  });

  it('redirects an accountant away from an admin only tab', async () => {
    session.authorities = ['REGULATOR_OR_ACCOUNTANT'];
    renderAt('/administration/logs');
    expect(await screen.findByText('toolbox-panel')).toBeInTheDocument();
    expect(screen.queryByText(/logs-panel/)).not.toBeInTheDocument();
  });
});
