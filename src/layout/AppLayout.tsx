import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  Image,
  Kbd,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useHotkeys, useLocalStorage } from '@mantine/hooks';
import { Spotlight, spotlight, type SpotlightActionData } from '@mantine/spotlight';
import { Icon } from '@/components/Icon';
import { hasOpenModal } from '@/components/modal';
import { closeAllDrawers } from '@/components/drawer';
import { APP_VERSION, getConfig } from '@/config';
import { logout } from '@/auth/keycloak';
import { useIsAdmin, useMe } from '@/auth/session';
import { settingsApi } from '@/api/misc';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { openSettings } from './settings';
import { findActiveLink, menuPath } from './menu';
import { useMenuLinks } from './useMenuLinks';

const NAV_WIDTH = 232;
const NAV_COLLAPSED_WIDTH = 64;

function envType() {
  try {
    return getConfig().ENV_TYPE?.toLowerCase();
  } catch {
    return undefined;
  }
}

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [collapsed, setCollapsed] = useLocalStorage({ key: 'nav-collapsed', defaultValue: false });
  const { visible } = useMenuLinks();
  const { data: user } = useMe();
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const activeLink = findActiveLink(visible, location.pathname);
  const lastClicked = useRef<string | undefined>(undefined);

  // close the mobile menu on navigation, count the clicks of the menu links (most clicked on home page)
  useEffect(() => {
    closeMobile();
    closeAllDrawers();
    const id = activeLink?.id;
    if (id && menuPath(activeLink) !== '/' && lastClicked.current !== location.pathname) {
      lastClicked.current = location.pathname;
      settingsApi.clicked(id).catch(() => undefined);
    }
  }, [location.pathname, activeLink, closeMobile]);

  // ctrl+² goes back home (ctrl+k opens the command palette, see Spotlight)
  useHotkeys([['ctrl+²', () => !hasOpenModal() && navigate('/')]]);

  const actions: SpotlightActionData[] = [
    ...visible.map((l) => ({
      id: menuPath(l),
      label: l.title,
      group: 'Go to',
      leftSection: <Icon icon={l.icon} />,
      onClick: () => navigate(menuPath(l)),
    })),
    {
      id: 'settings',
      label: 'Settings',
      group: 'Account',
      leftSection: <Icon icon="cog" />,
      onClick: () => openSettings(),
    },
    { id: 'logout', label: 'Logout', group: 'Account', leftSection: <Icon icon="sign-out-alt" />, onClick: logout },
  ];

  const navCollapsed = collapsed && !mobileOpened;
  const env = envType();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: { base: NAV_WIDTH, sm: collapsed ? NAV_COLLAPSED_WIDTH : NAV_WIDTH },
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" aria-label="toggle menu" />
            <UnstyledButton onClick={() => navigate('/')} aria-label="home">
              <Group gap={8} wrap="nowrap">
                <Image src="/assets/img/logo.png" alt="" h={26} w="auto" />
                <Text fw={700} visibleFrom="xs">
                  artcoded
                </Text>
              </Group>
            </UnstyledButton>
          </Group>
          <UnstyledButton onClick={spotlight.open} className="search-trigger" aria-label="search">
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <Group gap="xs" wrap="nowrap">
                <Icon icon="search" />
                <Text size="sm" c="dimmed">
                  Search
                </Text>
              </Group>
              <Kbd size="xs" visibleFrom="sm">
                Ctrl + K
              </Kbd>
            </Group>
          </UnstyledButton>
          <Group gap="xs" wrap="nowrap">
            {isAdmin && <NotificationBell />}
            {user && <UserMenu />}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {visible.map((l) => (
              <Tooltip key={l.id ?? l.title} label={l.title} position="right" disabled={!navCollapsed} withArrow>
                <NavLink
                  label={navCollapsed ? undefined : l.title}
                  leftSection={<Icon icon={l.icon} />}
                  active={activeLink === l}
                  onClick={() => navigate(menuPath(l))}
                  variant="light"
                  aria-label={l.title}
                  className="app-navlink"
                />
              </Tooltip>
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section className="app-navbar-footer" pt="xs">
          <Group justify={navCollapsed ? 'center' : 'space-between'} px={navCollapsed ? 0 : 'xs'} pt={4} wrap="nowrap">
            {!navCollapsed && (
              <Text size="xs" c="dimmed">
                v{APP_VERSION}
                {env ? ` · ${env}` : ''}
              </Text>
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              visibleFrom="sm"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'expand menu' : 'collapse menu'}
            >
              <Icon icon={collapsed ? 'angle-double-right' : 'angle-double-left'} />
            </ActionIcon>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </AppShell.Main>

      <Spotlight
        actions={actions}
        shortcut={['mod + K']}
        nothingFound="Nothing found"
        highlightQuery
        searchProps={{ leftSection: <Icon icon="search" />, placeholder: 'Go to...' }}
      />
    </AppShell>
  );
}
