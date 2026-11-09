import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AttachmentList } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { clientsApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fromInput, toInputDate } from '@/lib/format';
import { toast } from '@/lib/ui';
import { countryCodeValidator, required } from '@/lib/validators';
import {
  CONTRACT_STATUSES,
  RATE_TYPES,
  WORKING_DAYS,
  type BillableClient,
  type ClientRate,
  type RateType,
} from '@/types';

/** rates of the client. Clients not migrated yet only have the legacy rate/rateType, it becomes the first (default) rate */
export function initialRates(client: BillableClient): ClientRate[] {
  if (client.rates?.length) return client.rates;
  return [{ rate: client.rate, rateType: client.rateType ?? 'DAYS' }];
}

/** moves the rate at index to the first position (= default rate) */
export function makeDefault<T>(list: T[], index: number): T[] {
  if (index <= 0 || index >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  return [item, ...copy];
}

interface Props {
  client: BillableClient;
  isAdmin: boolean;
  onSave: (client: BillableClient) => void;
}

export function ClientDetailsForm({ client, isAdmin, onSave }: Props) {
  const form = useForm({
    initialValues: {
      name: client.name ?? '',
      emailAddress: client.emailAddress ?? '',
      phoneNumber: client.phoneNumber ?? '',
      vatNumber: client.vatNumber ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      countryCode: client.countryCode ?? '',
      maxDaysToPay: client.maxDaysToPay ?? 30,
      projectName: client.projectName ?? '',
      nature: client.nature ?? '',
      taxRate: client.taxRate ?? 21,
      rates: initialRates(client).map((r) => ({
        id: r.id ?? '',
        label: r.label ?? '',
        rate: r.rate ?? '',
        rateType: r.rateType ?? 'DAYS',
      })),
      startDate: toInputDate(client.startDate ?? new Date()),
      endDate: toInputDate(client.endDate),
      contractStatus: client.contractStatus ?? null,
      defaultWorkingDays: client.defaultWorkingDays ?? [],
      student: !!client.student,
    },
    validate: {
      name: required(),
      vatNumber: required(),
      address: required(),
      city: required(),
      countryCode: countryCodeValidator,
      projectName: required(),
      nature: required(),
      startDate: required(),
      contractStatus: required(),
      defaultWorkingDays: (v) => (v.length ? null : 'Required'),
      maxDaysToPay: (v) => (String(v) === '' || Number(v) < 0 ? 'Min 0' : null),
      taxRate: (v) => (String(v) === '' || Number(v) < 0 ? 'Min 0' : null),
      rates: {
        label: (v) => ((v ?? '').length > 100 ? 'Max 100 characters' : null),
        rate: (v) => (String(v ?? '') === '' || Number(v) < 0 ? 'Required' : null),
        rateType: required(),
      },
    },
  });
  const disabled = !isAdmin;
  const rates = form.values.rates;

  const submit = form.onSubmit((v) => {
    const savedRates: ClientRate[] = v.rates.map((r) => ({
      id: r.id || undefined,
      label: r.label.trim() || undefined,
      rate: Number(r.rate),
      rateType: r.rateType as RateType,
    }));
    onSave({
      ...client,
      name: v.name,
      emailAddress: v.emailAddress,
      phoneNumber: v.phoneNumber,
      vatNumber: v.vatNumber,
      address: v.address,
      city: v.city,
      countryCode: v.countryCode,
      maxDaysToPay: Number(v.maxDaysToPay),
      projectName: v.projectName,
      nature: v.nature,
      taxRate: Number(v.taxRate),
      rates: savedRates,
      // legacy fields mirror the default (first) rate
      rate: savedRates[0]?.rate,
      rateType: savedRates[0]?.rateType,
      startDate: fromInput(v.startDate),
      endDate: fromInput(v.endDate),
      contractStatus: v.contractStatus ?? undefined,
      defaultWorkingDays: v.defaultWorkingDays,
      student: v.student,
    });
  });

  const text = (key: string, label: string, placeholder?: string) => (
    <TextInput label={label} placeholder={placeholder} disabled={disabled} {...form.getInputProps(key)} />
  );

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {text('name', 'Client Name')}
          {text('emailAddress', 'Email')}
          {text('phoneNumber', 'Phone')}
          {text('vatNumber', 'Vat Number')}
          {text('address', 'Address')}
          {text('city', 'City')}
          {text('countryCode', 'Country code', 'e.g BE')}
          <NumberInput label="Max Days to pay" disabled={disabled} {...form.getInputProps('maxDaysToPay')} />
          {text('projectName', 'Project Name')}
          {text('nature', 'Nature')}
          <NumberInput label="Taxes%" disabled={disabled} {...form.getInputProps('taxRate')} />
        </SimpleGrid>

        <Text size="sm" fw={500}>
          Rates
        </Text>
        {rates.map((_, i) => (
          <Paper key={i} bg="gray.0" p="xs">
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <Text fw={700}>Rate {i + 1}</Text>
                {i === 0 && <Badge color="gray">default</Badge>}
              </Group>
              {isAdmin && (
                <Group gap="xs">
                  {i > 0 && (
                    <Button
                      size="xs"
                      variant="outline"
                      color="gray"
                      onClick={() => form.setFieldValue('rates', makeDefault(rates, i))}
                    >
                      Make default
                    </Button>
                  )}
                  {rates.length > 1 && (
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      leftSection={<Icon icon="trash" />}
                      onClick={() => form.removeListItem('rates', i)}
                    >
                      Remove
                    </Button>
                  )}
                </Group>
              )}
            </Group>
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                placeholder="Label (added to the invoice description)"
                disabled={disabled}
                {...form.getInputProps(`rates.${i}.label`)}
              />
              <NumberInput
                placeholder="Rate"
                decimalScale={2}
                disabled={disabled}
                {...form.getInputProps(`rates.${i}.rate`)}
              />
              <Select
                data={RATE_TYPES}
                disabled={disabled}
                allowDeselect={false}
                {...form.getInputProps(`rates.${i}.rateType`)}
              />
            </SimpleGrid>
          </Paper>
        ))}
        {isAdmin && (
          <Group>
            <Button
              size="xs"
              variant="outline"
              leftSection={<Icon icon="plus" />}
              onClick={() =>
                // a new rate has no id yet (given by the backend), the rate type of the previous one is kept
                form.insertListItem('rates', {
                  id: '',
                  label: '',
                  rate: '',
                  rateType: rates[rates.length - 1]?.rateType ?? 'DAYS',
                })
              }
            >
              Add rate
            </Button>
          </Group>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput type="date" label="Start Date" disabled={disabled} {...form.getInputProps('startDate')} />
          <TextInput type="date" label="End Date" disabled={disabled} {...form.getInputProps('endDate')} />
          <Select
            label="Status"
            placeholder="Select option..."
            data={CONTRACT_STATUSES}
            disabled={disabled}
            {...form.getInputProps('contractStatus')}
          />
          <MultiSelect
            label="Working days"
            data={WORKING_DAYS.map((d) => ({ value: d, label: d.toLowerCase() }))}
            disabled={disabled}
            {...form.getInputProps('defaultWorkingDays')}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Switch label="Student" disabled={disabled} {...form.getInputProps('student', { type: 'checkbox' })} />
        </Group>
        {isAdmin && (
          <Group justify="flex-end">
            <Button type="submit" disabled={!form.isValid()}>
              Submit
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}

export function ClientDocuments({
  client,
  isAdmin,
  blur,
}: {
  client: BillableClient;
  isAdmin: boolean;
  blur?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const { data: documents = [], refetch } = useQuery({
    queryKey: ['client-documents', client.id],
    queryFn: async () =>
      (await filesApi.findByCorrelationId(client.id!)).sort(
        (a, b) => new Date(b.creationDate ?? 0).getTime() - new Date(a.creationDate ?? 0).getTime(),
      ),
    enabled: !!client.id,
  });
  // documents are added / removed asynchronously by the backend
  useNotificationListener(
    [RegisteredEvent.BILLABLE_CLIENT_UPLOAD_ADDED, RegisteredEvent.BILLABLE_CLIENT_UPLOAD_DELETED],
    () => refetch(),
  );
  const upload = async () => {
    if (!file || !client.id) return;
    await clientsApi.upload(client.id, file);
    toast.success('Will add a new document to the client in a bit');
    setFile(null);
  };

  return (
    <Stack gap="sm" className={blur ? 'blur' : undefined}>
      {isAdmin && client.id && (
        <Group align="flex-end">
          <FileInput style={{ flex: 1 }} placeholder="Select a document" value={file} onChange={setFile} />
          <Button leftSection={<Icon icon="plus" />} onClick={upload} disabled={!file}>
            Upload
          </Button>
        </Group>
      )}
      <AttachmentList
        files={documents}
        onRemove={
          isAdmin
            ? async (f) => {
                await clientsApi.deleteUpload(client.id!, f.id);
                toast.success('Will delete the document in a bit');
              }
            : undefined
        }
        badge={(f) =>
          isAdmin && (
            <ActionIcon
              variant="subtle"
              aria-label="send by mail"
              onClick={() =>
                openMailForm({
                  attachments: [f],
                  context: { Client: client.name, Project: client.projectName },
                  to: [client.emailAddress],
                })
              }
            >
              <Icon icon="mail-bulk" />
            </ActionIcon>
          )
        }
      />
    </Stack>
  );
}

export function ClientDetail({ client, isAdmin, blur, onSave }: Props & { blur?: boolean }) {
  return (
    <Tabs defaultValue="details">
      <Tabs.List>
        <Tabs.Tab value="details">Details</Tabs.Tab>
        <Tabs.Tab value="documents" disabled={!client.id}>
          Documents
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="details" pt="sm" className={blur ? 'blur' : undefined}>
        <ClientDetailsForm client={client} isAdmin={isAdmin} onSave={onSave} />
      </Tabs.Panel>
      <Tabs.Panel value="documents" pt="sm">
        <ClientDocuments client={client} isAdmin={isAdmin} blur={blur} />
      </Tabs.Panel>
    </Tabs>
  );
}
