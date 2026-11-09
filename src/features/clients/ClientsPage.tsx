import { useEffect } from 'react';
import { ActionIcon, Button, Group, Menu, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { ImportedInfo, PageTitle } from '@/components/common';
import { openModal } from '@/components/modal';
import { clientsApi } from '@/api/billing';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { confirm, toast } from '@/lib/ui';
import type { BillableClient, ContractStatus } from '@/types';
import { ClientDetail } from './ClientForm';

export const CONTRACT_STATUS_DISPLAY: Record<ContractStatus, { label: string; color: string }> = {
  DONE: { label: 'Ended', color: 'red' },
  ONGOING: { label: 'In Progress', color: 'green' },
  NOT_STARTED_YET: { label: 'Not started', color: 'artcoded' },
};

const newClient = (): BillableClient => ({
  defaultWorkingDays: [],
  address: '',
  city: '',
  contractStatus: 'NOT_STARTED_YET',
  documentIds: [],
  emailAddress: '',
  endDate: null,
  startDate: new Date(),
  name: '',
  rateType: 'DAYS',
});

export function ClientsPage() {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const queryClient = useQueryClient();
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.findAll });
  const reload = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  useEffect(() => {
    document.title = 'Clients';
  }, []);

  useNotificationListener([RegisteredEvent.BILLABLE_CLIENT_ERROR], () => reload());

  const open = (client: BillableClient = newClient()) =>
    openModal({
      title: `${client.student ? 'Student' : 'Client'} ${client.name ?? ''}`,
      size: 'xl',
      closeOnClickOutside: false,
      render: (close) => (
        <ClientDetail
          client={client}
          isAdmin={isAdmin}
          blur={demoMode}
          onSave={async (c) => {
            close();
            await clientsApi.save(c);
            toast.success('Client updated');
            reload();
          }}
        />
      ),
    });

  const remove = async (client: BillableClient) => {
    if (!isAdmin || !client.id) return;
    if (await confirm('Are you sure you want to delete this client?')) {
      await clientsApi.delete(client.id);
      toast.success('Client deleted');
      reload();
    }
  };

  return (
    <>
      <PageTitle title="Clients">
        {isAdmin && (
          <Button variant="outline" leftSection={<Icon icon="plus" />} onClick={() => open()}>
            Add
          </Button>
        )}
      </PageTitle>
      {clients && (
        <Table className={demoMode ? 'blur' : undefined}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th visibleFrom="md">Email</Table.Th>
              <Table.Th visibleFrom="md">VAT N°</Table.Th>
              <Table.Th>Status</Table.Th>
              {isAdmin && <Table.Th w={60}>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {!clients.length && (
              <Table.Tr>
                <Table.Td colSpan={5}>No content</Table.Td>
              </Table.Tr>
            )}
            {clients.map((c) => {
              const status = c.contractStatus ? CONTRACT_STATUS_DISPLAY[c.contractStatus] : undefined;
              return (
                <Table.Tr key={c.id} className="clickable" onClick={() => open(c)}>
                  <Table.Td>
                    <Group justify="space-between" wrap="nowrap">
                      <Text className="text-break">{c.name}</Text>
                      <ImportedInfo imported={c.imported} date={c.importedDate} />
                    </Group>
                  </Table.Td>
                  <Table.Td visibleFrom="md" className="text-break">
                    {c.emailAddress}
                  </Table.Td>
                  <Table.Td visibleFrom="md">{c.vatNumber}</Table.Td>
                  <Table.Td c={status?.color}>{status?.label ?? c.contractStatus}</Table.Td>
                  {isAdmin && (
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="default" aria-label="actions">
                            <Icon icon="ellipsis-v" />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<Icon icon="edit" />} onClick={() => open(c)}>
                            Edit
                          </Menu.Item>
                          <Menu.Item leftSection={<Icon icon="trash" />} color="red" onClick={() => remove(c)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
