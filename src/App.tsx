import { BrowserRouter } from 'react-router';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { NotificationsProvider } from './hooks/notifications';
import { AppRoutes } from './routes';
import { DrawerHost } from './components/drawer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <BrowserRouter>
          <NotificationsProvider>
            <ModalsProvider>
              <AppRoutes />
              <DrawerHost />
            </ModalsProvider>
          </NotificationsProvider>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}
