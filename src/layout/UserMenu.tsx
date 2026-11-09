import { ActionIcon, Menu } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { openSmsForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { getConfig } from '@/config';
import { logout } from '@/auth/keycloak';
import { useIsAdmin } from '@/auth/session';
import { PersonalInfoForm } from './PersonalInfoForm';

export function UserMenu() {
  const isAdmin = useIsAdmin();
  const frontOfficeUrl = getConfig().FRONTEND_URL;

  return (
    <Menu position="bottom-end" shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon variant="transparent" c="white" aria-label="user menu">
          <Icon icon="user" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<Icon icon="edit" />}
          onClick={() =>
            openModal({
              title: 'Personal Info',
              size: 'xl',
              closeOnClickOutside: false,
              render: () => <PersonalInfoForm />,
            })
          }
        >
          Personal Info
        </Menu.Item>
        {isAdmin && (
          <Menu.Item leftSection={<Icon icon="phone" />} onClick={openSmsForm}>
            Send sms
          </Menu.Item>
        )}
        {frontOfficeUrl && (
          <Menu.Item leftSection={<Icon icon="book-open" />} component="a" href={frontOfficeUrl} target="_blank">
            Homepage
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
