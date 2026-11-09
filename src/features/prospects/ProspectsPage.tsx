import { Fragment, useEffect } from 'react';
import { ActionIcon, Table, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/common';
import { contactApi } from '@/api/misc';
import { fmtDateTime } from '@/lib/format';

export function ProspectsPage() {
  const { data: contacts, refetch } = useQuery({ queryKey: ['prospects'], queryFn: contactApi.findAll });

  useEffect(() => {
    document.title = 'Prospects';
  }, []);

  return (
    <>
      <PageTitle title="Prospects" />
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Full name</Table.Th>
            <Table.Th>Subject</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th visibleFrom="md">Phone number</Table.Th>
            <Table.Th visibleFrom="md">Date received</Table.Th>
            <Table.Th w={60}>Action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {contacts && !contacts.length && (
            <Table.Tr>
              <Table.Td colSpan={6}>No content</Table.Td>
            </Table.Tr>
          )}
          {contacts?.map((fc) => (
            <Fragment key={fc.id}>
              <Table.Tr>
                <Table.Td>{fc.fullName}</Table.Td>
                <Table.Td>{fc.subject}</Table.Td>
                <Table.Td>{fc.email}</Table.Td>
                <Table.Td visibleFrom="md">{fc.phoneNumber}</Table.Td>
                <Table.Td visibleFrom="md">{fmtDateTime(fc.creationDate)}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="delete"
                    onClick={async () => {
                      await contactApi.delete(fc.id!);
                      refetch();
                    }}
                  >
                    <Icon icon="trash" />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
              {!!fc.body?.length && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Textarea value={fc.body} readOnly autosize variant="filled" />
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
