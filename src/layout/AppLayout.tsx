import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ActionIcon, AppShell, Burger, Group, NavLink, ScrollArea, Select, Text, Tooltip } from '@mantine/core';
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import { Icon } from '@/components/Icon';
import { hasOpenModal, openModal } from '@/components/modal';
import { APP_VERSION, getConfig } from '@/config';
import { useIsAdmin, useMe } from '@/auth/session';
import { settingsApi } from '@/api/misc';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { SettingsPanel } from './SettingsPanel';
import { CacheForm } from './CacheForm';
import { findActiveLink, menuPath } from './menu';
import { useMenuLinks } from './useMenuLinks';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { visible } = useMenuLinks();
  const { data: user } = useMe();
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const activeLink = findActiveLink(visible, location.pathname);
  const lastClicked = useRef<string | undefined>(undefined);

  // close the mobile menu on navigation, count the clicks of the menu links (most clicked on home page)
  useEffect(() => {
    close();
    const id = activeLink?.id;
    if (id && menuPath(activeLink) !== '/' && lastClicked.current !== location.pathname) {
      lastClicked.current = location.pathname;
      settingsApi.clicked(id).catch(() => undefined);
    }
  }, [location.pathname, activeLink, close]);

  // ctrl+² goes back home
  useHotkeys([['ctrl+²', () => !hasOpenModal() && navigate('/')]]);

  const env = (() => {
    try {
      return getConfig().ENV_TYPE?.toLowerCase();
    } catch {
      return undefined;
    }
  })();

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened, desktop: !opened } }}
      padding="md"
    >
      <AppShell.Header className="app-header">
        <Group h="100%" px="sm" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" color="white" aria-label="toggle menu" />
            <Text
              fw={800}
              c="white"
              visibleFrom="sm"
              className="brand"
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            >
              artcoded
            </Text>
            <Tooltip label={`v${APP_VERSION} (${env ?? 'unknown'})`} events={{ hover: true, focus: true, touch: true }}>
              <ActionIcon variant="transparent" c="white" aria-label="version">
                <Icon icon="info-circle" />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Select
            w={{ base: 160, sm: 280 }}
            searchable
            placeholder="Go to..."
            data={visible.map((l) => ({ value: menuPath(l), label: l.title }))}
            value={activeLink ? menuPath(activeLink) : null}
            onChange={(v) => v && navigate(v)}
            nothingFoundMessage="Nothing found"
            allowDeselect={false}
            aria-label="navigate"
          />
          <Group gap={4} wrap="nowrap">
            {isAdmin && (
              <ActionIcon
                variant="transparent"
                c="white"
                aria-label="clear cache"
                onClick={() => openModal({ title: 'Clear Cache', size: 'sm', render: () => <CacheForm /> })}
              >
                <Icon icon="database" />
              </ActionIcon>
            )}
            <ActionIcon variant="transparent" c="white" aria-label="reload" onClick={() => window.location.reload()}>
              <Icon icon="sync" />
            </ActionIcon>
            {isAdmin && <NotificationBell />}
            {user && <UserMenu />}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="app-navbar">
        <ScrollArea>
          {visible.map((l) => (
            <NavLink
              key={l.id ?? l.title}
              label={l.title}
              leftSection={<Icon icon={l.icon} />}
              active={activeLink === l}
              onClick={() => navigate(menuPath(l))}
              variant="filled"
              className="app-navlink"
            />
          ))}
          {isAdmin && (
            <NavLink
              label="Settings"
              leftSection={<Icon icon="toolbox" />}
              c="yellow"
              className="app-navlink"
              onClick={() => openModal({ title: 'Settings', size: 'xl', render: () => <SettingsPanel /> })}
            />
          )}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
