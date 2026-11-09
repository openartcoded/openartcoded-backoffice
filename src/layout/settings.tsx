import { useState } from 'react';
import { Tabs, Text } from '@mantine/core';
import { openModal } from '@/components/modal';
import { useIsAdmin } from '@/auth/session';
import { PersonalInfoForm } from './PersonalInfoForm';
import { SettingsPanel } from './SettingsPanel';
import { CacheForm } from './CacheForm';

export type SettingsTab = 'personal-info' | 'menu' | 'cache';

function Settings({ initialTab }: { initialTab: SettingsTab }) {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<string | null>(initialTab);
  return (
    <Tabs value={tab} onChange={setTab} keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="personal-info">Personal info</Tabs.Tab>
        {isAdmin && <Tabs.Tab value="menu">Menu</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="cache">Cache</Tabs.Tab>}
      </Tabs.List>
      <Tabs.Panel value="personal-info">
        <PersonalInfoForm />
      </Tabs.Panel>
      {isAdmin && (
        <Tabs.Panel value="menu">
          <SettingsPanel />
        </Tabs.Panel>
      )}
      {isAdmin && (
        <Tabs.Panel value="cache">
          <Text size="sm" c="dimmed" mb="md">
            Clears a server side cache, e.g. after editing data directly in the database.
          </Text>
          <CacheForm />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}

/** personal info, menu and cache, opened from the user menu (or ctrl+k) */
export function openSettings(tab: SettingsTab = 'personal-info') {
  // fade only: a transform on the modal would offset the dragged rows of the menu editor (position: fixed)
  openModal({
    title: 'Settings',
    size: 'xl',
    closeOnClickOutside: false,
    transition: 'fade',
    render: () => <Settings initialTab={tab} />,
  });
}
