import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/theme';
import type { Page, User } from '@/types';

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

export function Providers({ children, route = '/', path }: { children: ReactNode; route?: string; path?: string }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MantineProvider theme={theme}>
        <Notifications />
        <MemoryRouter initialEntries={[route]}>
          <ModalsProvider>
            {path ? (
              <Routes>
                <Route path={path} element={children} />
              </Routes>
            ) : (
              children
            )}
          </ModalsProvider>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

/** renders a component with mantine, react-query, router and modals */
export function renderWithProviders(ui: ReactElement, opts: { route?: string; path?: string } = {}) {
  return render(ui, { wrapper: ({ children }) => <Providers {...opts}>{children}</Providers> });
}

export const adminUser: User = { username: 'admin', email: 'admin@artcoded.tech', authorities: ['ADMIN'] };
export const accountantUser: User = {
  username: 'accountant',
  email: 'acc@artcoded.tech',
  authorities: ['REGULATOR_OR_ACCOUNTANT'],
};

export function page<T>(content: T[], number = 0, size = 10): Page<T> {
  return {
    content,
    page: { number, size, totalElements: content.length, totalPages: Math.max(1, Math.ceil(content.length / size)) },
  };
}
