import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ActionIcon,
  Button,
  ColorSwatch,
  Group,
  Loader,
  Menu,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { EmptyRow, PageHeader, StatusBadge } from '@/components/ui';
import { downloadUpload, openFileViewer } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { timesheetApi } from '@/api/misc';
import { clientsApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useDemoMode } from '@/auth/session';
import { useNotificationListener } from '@/hooks/notifications';
import { RegisteredEvent } from '@/lib/notificationBus';
import { fmtCurrency, fmtDate, titleCase } from '@/lib/format';
import { confirm, toast } from '@/lib/ui';
import { openInvoiceById } from '@/features/invoice/InvoiceDetail';
import type { BillableClient, PeriodType, TimesheetPeriod, TimesheetSettingsForm } from '@/types';
import {
  clientRates,
  durationColor,
  isToday,
  PERIOD_TAGS,
  rateLabel,
  selectedRateId,
  shortDay,
  tagColor,
} from './logic';
import { PeriodForm, PeriodQuickActions } from './PeriodForm';

function SettingsForm({
  settings,
  clients,
  onSubmit,
}: {
  settings: TimesheetSettingsForm;
  clients: BillableClient[];
  onSubmit: (s: TimesheetSettingsForm) => void;
}) {
  const form = useForm({
    initialValues: {
      minHoursPerDay: settings.minHoursPerDay ?? 0,
      maxHoursPerDay: settings.maxHoursPerDay ?? 8,
      clientId: settings.clientId ?? null,
    },
    validate: {
      minHoursPerDay: (v) => (v === null || v === undefined || Number(v) < 0 ? 'Min 0' : null),
      maxHoursPerDay: (v) => (!v || Number(v) < 0.5 ? 'Min 0.5' : null),
      clientId: (v) => (v ? null : 'Required'),
    },
  });
  return (
    <form
      onSubmit={form.onSubmit((v) => onSubmit({ ...v, clientId: v.clientId ?? '', timesheetId: settings.timesheetId }))}
    >
      <Stack gap="sm">
        <NumberInput label="Min Hours Per Day" data-autofocus {...form.getInputProps('minHoursPerDay')} />
        <NumberInput label="Max Hours Per Day" {...form.getInputProps('maxHoursPerDay')} />
        <Select
          label="Client"
          placeholder="--Select--"
          data={clients.map((c) => ({ value: c.id ?? '', label: c.name ?? '' }))}
          {...form.getInputProps('clientId')}
        />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function TimesheetDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const demoMode = useDemoMode();
  const [filter, setFilter] = useState<PeriodType | null>('WORKING_DAY');
  const [savingRate, setSavingRate] = useState(false);
  const { data: timesheet, refetch } = useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => timesheetApi.findById(id),
  });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.findAll });
  const billable = !!timesheet?.clientId && !timesheet.student;
  const { data: total, refetch: refetchTotal } = useQuery({
    queryKey: ['timesheet-total', id],
    queryFn: () => timesheetApi.estimateTotal(id),
    enabled: billable,
  });

  const reload = () => {
    refetch();
    if (billable) refetchTotal();
  };
  useNotificationListener([RegisteredEvent.REOPENED_TIMESHEET, RegisteredEvent.CLOSED_TIMESHEET], reload);

  if (!timesheet) return <Loader />;

  const settings = timesheet.settings ?? {};
  const rates = clientRates(clients.find((c) => c.id === timesheet.clientId));
  const rateLocked = savingRate || !!timesheet.invoiceId;
  const periods = (timesheet.periods ?? []).filter((p) => !filter || p.periodType === filter);
  const ctx = {
    timesheetId: timesheet.id ?? id,
    closed: timesheet.closed,
    student: timesheet.student,
    settings,
    rates,
  };

  const openPeriod = (period: TimesheetPeriod) =>
    openModal({
      title: `${fmtDate(period.date)} - ${shortDay(period.dayOfWeek)}`,
      size: 'lg',
      closeOnClickOutside: false,
      onClose: reload,
      render: () => <PeriodForm period={period} ctx={ctx} onSaved={reload} />,
    });

  const changeRate = async (period: TimesheetPeriod, rateId: string | null) => {
    if (!rateId || rateLocked || !period.id || rateId === selectedRateId(rates, period)) return;
    setSavingRate(true);
    try {
      await timesheetApi.updatePeriodRate(ctx.timesheetId, period.id, rateId);
      reload();
    } catch {
      toast.error('Could not update the rate');
      reload();
    } finally {
      setSavingRate(false);
    }
  };

  const openSettings = async () => {
    const ongoing = await clientsApi.findByContractStatus('ONGOING');
    openModal({
      title: 'Timesheet Settings',
      render: (close) => (
        <SettingsForm
          clients={ongoing}
          settings={{
            timesheetId: ctx.timesheetId,
            clientId: timesheet.clientId ?? '',
            maxHoursPerDay: settings.maxHoursPerDay,
            minHoursPerDay: settings.minHoursPerDay,
          }}
          onSubmit={async (s) => {
            close();
            await timesheetApi.updateSettings(s);
            toast.success('Settings updated');
            reload();
          }}
        />
      ),
    });
  };

  const withUpload = async (fn: (upload: Awaited<ReturnType<typeof filesApi.findById>>) => void) => {
    if (!timesheet.uploadId) return;
    fn(await filesApi.findById(timesheet.uploadId));
  };

  const send = () =>
    withUpload((upload) => {
      const period = `${timesheet.month}/${timesheet.year}`;
      openMailForm({
        attachments: [upload],
        context: { Client: timesheet.clientName, Period: period },
        defaultSubject: `Timesheet ${period}`,
        to: clients.filter((c) => c.id === timesheet.clientId).map((c) => c.emailAddress),
      });
    });

  const remove = async () => {
    if (await confirm('Delete this timesheet?')) {
      await timesheetApi.delete(ctx.timesheetId);
      client.invalidateQueries({ queryKey: ['timesheets'] });
      navigate('/timesheets');
    }
  };

  const title = `Timesheet ${shortDay(timesheet.monthEnum)}/${timesheet.year}${timesheet.clientName ? ` (${timesheet.clientName})` : ''}`;

  return (
    <>
      <PageHeader
        title={title}
        documentTitle="Timesheet"
        back={{ to: '/timesheets', label: 'Timesheets' }}
        description={
          <>
            {timesheet.numberOfWorkingDays} working days · {timesheet.numberOfHoursWorked}h
            {billable && total !== undefined && rates.length > 0 && <> · {fmtCurrency(total)} to invoice</>}
          </>
        }
        actions={
          <>
            <StatusBadge
              value={timesheet.closed ? 'CLOSED' : 'OPEN'}
              label={timesheet.closed ? 'Released' : 'Open'}
              color={timesheet.closed ? 'green' : 'blue'}
            />
            {!timesheet.closed ? (
              <Button
                leftSection={<Icon icon="door-closed" />}
                onClick={async () => {
                  if (!(await confirm('Release the timesheet? Its PDF will be generated.', { danger: false }))) return;
                  toast.success('Timesheet will be generated');
                  await timesheetApi.close(ctx.timesheetId);
                }}
              >
                Release
              </Button>
            ) : timesheet.invoiceId ? (
              <Button
                leftSection={<Icon icon="file-invoice-dollar" />}
                onClick={() => openInvoiceById(timesheet.invoiceId!)}
              >
                Open invoice
              </Button>
            ) : (
              <Button
                leftSection={<Icon icon="file-invoice-dollar" />}
                disabled={!timesheet.clientId || timesheet.student}
                onClick={async () => {
                  toast.success('Invoice will be generated');
                  await timesheetApi.generateInvoice(ctx.timesheetId);
                  reload();
                }}
              >
                Generate invoice
              </Button>
            )}
            <Menu position="bottom-end" shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label="more actions">
                  <Icon icon="ellipsis-v" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Icon icon="file-pdf" />}
                  disabled={!timesheet.closed}
                  onClick={() => withUpload((u) => openFileViewer(u))}
                >
                  View PDF
                </Menu.Item>
                <Menu.Item
                  leftSection={<Icon icon="download" />}
                  disabled={!timesheet.closed}
                  onClick={() => timesheet.uploadId && downloadUpload(timesheet.uploadId)}
                >
                  Download
                </Menu.Item>
                <Menu.Item leftSection={<Icon icon="envelope" />} disabled={!timesheet.closed} onClick={send}>
                  Send by email
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<Icon icon="cog" />} onClick={openSettings}>
                  Settings
                </Menu.Item>
                <Menu.Item
                  leftSection={<Icon icon="book-open" />}
                  disabled={!timesheet.closed}
                  onClick={async () => {
                    toast.success('Timesheet will be reopened');
                    await timesheetApi.reopen(ctx.timesheetId);
                  }}
                >
                  Reopen
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<Icon icon="trash" />} color="red" disabled={timesheet.closed} onClick={remove}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />
      <Stack gap="sm" className={`fill-column${demoMode ? ' blur' : ''}`}>
        <ScrollArea type="auto" offsetScrollbars style={{ flexShrink: 0 }}>
          <SegmentedControl
            value={filter ?? 'ALL'}
            onChange={(v) => setFilter(v === 'ALL' ? null : (v as PeriodType))}
            data={[
              ...PERIOD_TAGS.map((t) => ({
                value: t.periodType,
                label: (
                  <Group gap={6} wrap="nowrap">
                    <ColorSwatch color={`var(--mantine-color-${t.color}-6)`} size={8} withShadow={false} />
                    {titleCase(t.label)}
                  </Group>
                ),
              })),
              { value: 'ALL', label: 'All days' },
            ]}
          />
        </ScrollArea>
        <div className="scroll-body">
          <Table stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Day</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th visibleFrom="md">Morning Start</Table.Th>
                <Table.Th visibleFrom="md">Morning End</Table.Th>
                <Table.Th visibleFrom="md">Afternoon Start</Table.Th>
                <Table.Th visibleFrom="md">Afternoon End</Table.Th>
                <Table.Th>Duration</Table.Th>
                {rates.length > 1 && <Table.Th>Rate</Table.Th>}
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!periods.length && <EmptyRow colSpan={9} icon="calendar" title="No day of this type" />}
              {periods.map((p) => (
                <Table.Tr
                  key={p.id ?? String(p.date)}
                  className="clickable"
                  bg={isToday(p) ? 'artcoded.0' : p.periodType !== 'WORKING_DAY' ? 'gray.0' : undefined}
                  onClick={() => openPeriod(p)}
                >
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Icon icon="circle" color={`var(--mantine-color-${tagColor(p.periodType)}-6)`} />
                      {shortDay(p.dayOfWeek)}
                    </Group>
                  </Table.Td>
                  <Table.Td>{fmtDate(p.date)}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(p.morningStartTime, 'HH:mm')}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(p.morningEndTime, 'HH:mm')}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(p.afternoonStartTime, 'HH:mm')}</Table.Td>
                  <Table.Td visibleFrom="md">{fmtDate(p.afternoonEndTime, 'HH:mm')}</Table.Td>
                  {(p.duration ?? 0) >= 0 ? (
                    <Table.Td c={durationColor(p, settings.minHoursPerDay, settings.maxHoursPerDay)} fw={600}>
                      {p.durationInHours}h
                    </Table.Td>
                  ) : (
                    <Table.Td>
                      <StatusBadge value="FAILURE" label="Invalid times" />
                    </Table.Td>
                  )}
                  {rates.length > 1 && (
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      {p.periodType === 'WORKING_DAY' && (
                        <Select
                          size="xs"
                          data={rates.map((r, i) => ({ value: r.id ?? '', label: rateLabel(r, i) }))}
                          value={selectedRateId(rates, p) ?? null}
                          disabled={rateLocked}
                          title={timesheet.invoiceId ? 'An invoice was generated, the rate cannot be changed' : ''}
                          onChange={(v) => changeRate(p, v)}
                          allowDeselect={false}
                        />
                      )}
                    </Table.Td>
                  )}
                  <Table.Td>
                    <PeriodQuickActions period={p} ctx={ctx} onSaved={reload} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>
    </>
  );
}
