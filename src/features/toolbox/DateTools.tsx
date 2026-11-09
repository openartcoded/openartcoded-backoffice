import { useState } from 'react';
import { Alert, Button, Group, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { dayjs, fmtDate, toInputDate } from '@/lib/format';
import { businessDays, DURATION_UNITS, durationBetween, howMany, type DurationUnit } from './logic';

function Result({ value, label }: { value: number | null; label: string }) {
  if (value === null || !label) return null;
  return (
    <Group gap="sm" align="baseline" mt="md">
      <Text c="red" fz={48} fw={300}>
        {Math.floor(value).toLocaleString('de-DE')}
      </Text>
      <Text fz={28} fw={300}>
        {label}
      </Text>
    </Group>
  );
}

const unitOptions = DURATION_UNITS.map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }));

export function BusinessDays() {
  const today = toInputDate(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [result, setResult] = useState<number | null>(null);
  const invalid = !start || !end || dayjs(end).isBefore(dayjs(start));
  return (
    <Stack gap="sm">
      <Alert color="yellow" icon={<Icon icon="exclamation-triangle" />}>
        This tool doesn't take holidays into consideration
      </Alert>
      <TextInput type="date" label="Start" value={start} onChange={(e) => setStart(e.currentTarget.value)} />
      <TextInput
        type="date"
        label="End"
        value={end}
        onChange={(e) => setEnd(e.currentTarget.value)}
        error={invalid && end ? 'End must be after start' : null}
      />
      <Group justify="flex-end">
        <Button disabled={invalid} onClick={() => setResult(businessDays(start, end))}>
          Submit
        </Button>
      </Group>
      {!!result && <Result value={result} label="business days" />}
    </Stack>
  );
}

export function DateBetween() {
  const today = toInputDate(new Date());
  const [unit, setUnit] = useState<DurationUnit>('days');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [result, setResult] = useState<{ value: number; label: string } | null>(null);
  const invalid = !start || !end || dayjs(end).isBefore(dayjs(start));
  const submit = () =>
    setResult({
      value: durationBetween(start, end, unit),
      label: `${unit} between ${fmtDate(start)} and ${fmtDate(end)}`,
    });
  return (
    <Stack gap="sm">
      <Select
        label="Type"
        data={unitOptions}
        value={unit}
        onChange={(v) => v && setUnit(v as DurationUnit)}
        allowDeselect={false}
      />
      <TextInput type="date" label="Start" value={start} onChange={(e) => setStart(e.currentTarget.value)} />
      <TextInput type="date" label="End" value={end} onChange={(e) => setEnd(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button disabled={invalid} onClick={submit}>
          Submit
        </Button>
      </Group>
      {result && !!result.value && <Result value={result.value} label={result.label} />}
    </Stack>
  );
}

export function HowMany({ before = false }: { before?: boolean }) {
  const [unit, setUnit] = useState<DurationUnit>('days');
  const [date, setDate] = useState(toInputDate(new Date()));
  const [result, setResult] = useState<{ value: number; label: string } | null>(null);
  const now = dayjs();
  const invalid = !date || (before ? dayjs(date).isBefore(now, 'day') : dayjs(date).isAfter(now, 'day'));
  const submit = () =>
    setResult({ value: howMany(date, unit, before), label: `${unit} ${before ? 'before' : 'since'} ${fmtDate(date)}` });
  return (
    <Stack gap="sm">
      <Select
        label="Type"
        data={unitOptions}
        value={unit}
        onChange={(v) => v && setUnit(v as DurationUnit)}
        allowDeselect={false}
      />
      <TextInput
        type="date"
        label="Date"
        value={date}
        onChange={(e) => setDate(e.currentTarget.value)}
        error={invalid && date ? (before ? 'Date must be in the future' : 'Date must be in the past') : null}
      />
      <Group justify="flex-end">
        <Button disabled={invalid} onClick={submit}>
          Submit
        </Button>
      </Group>
      {result && !!result.value && <Result value={result.value} label={result.label} />}
    </Stack>
  );
}

export function DateTools() {
  return (
    <Tabs defaultValue="business-days" variant="outline">
      <Tabs.List justify="center">
        <Tabs.Tab value="business-days">Business</Tabs.Tab>
        <Tabs.Tab value="how-many-since">Since</Tabs.Tab>
        <Tabs.Tab value="how-many-before">Before</Tabs.Tab>
        <Tabs.Tab value="date-between">Between</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="business-days" p="md">
        <BusinessDays />
      </Tabs.Panel>
      <Tabs.Panel value="how-many-since" p="md">
        <HowMany />
      </Tabs.Panel>
      <Tabs.Panel value="how-many-before" p="md">
        <HowMany before />
      </Tabs.Panel>
      <Tabs.Panel value="date-between" p="md">
        <DateBetween />
      </Tabs.Panel>
    </Tabs>
  );
}
