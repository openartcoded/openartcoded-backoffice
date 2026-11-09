import { Avatar, Menu, Text, UnstyledButton } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { openSmsForm } from '@/components/forms';
import { getConfig } from '@/config';
import { logout } from '@/auth/keycloak';
import { useIsAdmin, useMe } from '@/auth/session';
import { openSettings } from './settings';

const initials = (name?: string) =>
  (name ?? '?')
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export function UserMenu() {
  const isAdmin = useIsAdmin();
  const { data: user } = useMe();
  const frontOfficeUrl = getConfig().FRONTEND_URL;

  return (
    <Menu position="bottom-end" shadow="md" width={220}>
      <Menu.Target>
        <UnstyledButton aria-label="user menu">
          <Avatar size={32} radius="xl" color="artcoded">
            {initials(user?.username)}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500} c="var(--mantine-color-text)" truncate>
            {user?.username}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {user?.email}
          </Text>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item leftSection={<Icon icon="user" />} onClick={() => openSettings('personal-info')}>
          Personal info
        </Menu.Item>
        <Menu.Item leftSection={<Icon icon="cog" />} onClick={() => openSettings(isAdmin ? 'menu' : 'personal-info')}>
          Settings
        </Menu.Item>
        {isAdmin && (
          <Menu.Item leftSection={<Icon icon="phone" />} onClick={openSmsForm}>
            Send SMS
          </Menu.Item>
        )}
        {frontOfficeUrl && (
          <Menu.Item leftSection={<Icon icon="book-open" />} component="a" href={frontOfficeUrl} target="_blank">
            Website
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item leftSection={<Icon icon="sign-out-alt" />} onClick={logout}>
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
