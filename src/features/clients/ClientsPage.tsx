import { Button, Group, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { ImportedInfo } from '@/components/common';
import { EmptyRow, PageHeader, RowActions, StatusBadge } from '@/components/ui';
import { openDrawer } from '@/components/drawer';
import { clientsApi } from '@/api/billing';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { confirm, toast } from '@/lib/ui';
import type { BillableClient, ContractStatus } from '@/types';
import { ClientDetail } from './ClientForm';

export const CONTRACT_STATUS_DISPLAY: Record<ContractStatus, { label: string; color: string }> = {
  DONE: { label: 'Ended', color: 'gray' },
  ONGOING: { label: 'Ongoing', color: 'green' },
  NOT_STARTED_YET: { label: 'Not started', color: 'blue' },
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

  useNotificationListener([RegisteredEvent.BILLABLE_CLIENT_ERROR], () => reload());

  const open = (client: BillableClient = newClient()) =>
    openDrawer({
      title: client.id ? client.name : 'New client',
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
    if (await confirm(`Delete the client ${client.name ?? ''}?`)) {
      await clientsApi.delete(client.id);
      toast.success('Client deleted');
      reload();
    }
  };

  return (
    <>
      <PageHeader
        title="Clients"
        description="Billable clients, their rates and contract documents."
        actions={
          isAdmin && (
            <Button leftSection={<Icon icon="plus" />} onClick={() => open()}>
              New client
            </Button>
          )
        }
      />
      {clients && (
        <Table.ScrollContainer minWidth={560}>
          <Table className={`clickable-rows ${demoMode ? 'blur' : ''}`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th visibleFrom="md">Email</Table.Th>
                <Table.Th visibleFrom="md">VAT number</Table.Th>
                <Table.Th>Contract</Table.Th>
                {isAdmin && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!clients.length && <EmptyRow colSpan={5} icon="user" title="No client" description="Add a client to generate its timesheets and invoices." />}
              {clients.map((c) => {
                const status = c.contractStatus ? CONTRACT_STATUS_DISPLAY[c.contractStatus] : undefined;
                return (
                  <Table.Tr key={c.id} onClick={() => open(c)}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {c.name}
                        </Text>
                        {c.student && <StatusBadge value="STUDENT" label="Student" color="grape" />}
                        <ImportedInfo imported={c.imported} date={c.importedDate} />
                      </Group>
                    </Table.Td>
                    <Table.Td visibleFrom="md" c="dimmed">
                      {c.emailAddress}
                    </Table.Td>
                    <Table.Td visibleFrom="md">{c.vatNumber}</Table.Td>
                    <Table.Td>
                      <StatusBadge value={c.contractStatus} label={status?.label} color={status?.color} />
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td>
                        <RowActions groups={[[{ label: 'Edit', icon: 'edit', onClick: () => open(c) }], [{ label: 'Delete', icon: 'trash', color: 'red', onClick: () => remove(c) }]]} />
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
