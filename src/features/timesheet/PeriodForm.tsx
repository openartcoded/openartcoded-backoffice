import { useState, type FormEvent } from 'react';
import { ActionIcon, Button, Group, Select, Stack, TextInput, Textarea, Tooltip } from '@mantine/core';
import { Icon } from '@/components/Icon';
import { timesheetApi } from '@/api/misc';
import { dayjs, TZ } from '@/lib/format';
import { PERIOD_TYPES, type ClientRate, type PeriodType, type TimesheetPeriod, type TimesheetSettings } from '@/types';
import { autoTimes, hoursToMinutes, rateLabel, timesFromHours, toTime, withTime, type PeriodTimes } from './logic';

interface Ctx {
  timesheetId: string;
  closed?: boolean;
  student?: boolean;
  settings?: TimesheetSettings;
  rates?: ClientRate[];
}

/** saves the period with the given times / type */
async function savePeriod(timesheetId: string, period: TimesheetPeriod, times: PeriodTimes, extra: Partial<TimesheetPeriod> = {}) {
  return timesheetApi.savePeriod(timesheetId, {
    ...period,
    ...extra,
    morningStartTime: withTime(period.date, times.morningStartTime),
    morningEndTime: withTime(period.date, times.morningEndTime),
    afternoonStartTime: withTime(period.date, times.afternoonStartTime),
    afternoonEndTime: withTime(period.date, times.afternoonEndTime),
  });
}

/** quick buttons of a row: fill as a working day / set as holiday */
export function PeriodQuickActions({ period, ctx, onSaved }: { period: TimesheetPeriod; ctx: Ctx; onSaved: () => void }) {
  const auto = autoTimes(ctx.settings?.maxHoursPerDay);
  return (
    <Group gap={0} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
      {!ctx.closed && !ctx.student && (
        <Tooltip label="Auto fill">
          <ActionIcon
            variant="subtle"
            aria-label="auto fill"
            onClick={async () => {
              await savePeriod(ctx.timesheetId, period, auto);
              onSaved();
            }}
          >
            <Icon icon="user-clock" />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label="Holiday">
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label="set holiday"
          disabled={ctx.closed}
          onClick={async () => {
            await savePeriod(ctx.timesheetId, period, auto, { periodType: 'AUTHORIZED_HOLIDAYS' });
            onSaved();
          }}
        >
          <Icon icon="window-close" />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

export function PeriodForm({ period: initial, ctx, onSaved }: { period: TimesheetPeriod; ctx: Ctx; onSaved: (p: TimesheetPeriod) => void }) {
  const rates = ctx.rates ?? [];
  const [period, setPeriod] = useState(initial);
  const [times, setTimes] = useState<PeriodTimes>({
    morningStartTime: toTime(initial.morningStartTime),
    morningEndTime: toTime(initial.morningEndTime),
    afternoonStartTime: toTime(initial.afternoonStartTime),
    afternoonEndTime: toTime(initial.afternoonEndTime),
  });
  const [periodType, setPeriodType] = useState<PeriodType>(initial.periodType ?? 'WORKING_DAY');
  const [projectName, setProjectName] = useState(initial.projectName ?? '');
  const [shortDescription, setShortDescription] = useState(initial.shortDescription ?? '');
  const [rateId, setRateId] = useState<string | null>(
    initial.rateId && rates.some((r) => r.id === initial.rateId) ? initial.rateId : (rates[0]?.id ?? initial.rateId ?? null),
  );
  const [hours, setHours] = useState('');

  const closed = !!ctx.closed;
  const maxHours = ctx.settings?.maxHoursPerDay;
  const setTime = (key: keyof PeriodTimes, value: string) => setTimes((t) => ({ ...t, [key]: value }));
  const auto = () => setTimes(autoTimes(maxHours));
  const fill = () => {
    const t = timesFromHours(hours, maxHours);
    if (t) setTimes(t);
  };

  const changeType = (value: string | null) => {
    if (!value) return;
    setPeriodType(value as PeriodType);
    if (value !== 'WORKING_DAY') auto();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const saved = await savePeriod(ctx.timesheetId, period, times, {
      periodType,
      projectName,
      shortDescription,
      // the rate can only be chosen when the client has several rates
      rateId: rates.length > 1 ? (rateId ?? undefined) : initial.rateId,
    });
    setPeriod(saved);
    setTimes({
      morningStartTime: toTime(saved.morningStartTime),
      morningEndTime: toTime(saved.morningEndTime),
      afternoonStartTime: toTime(saved.afternoonStartTime),
      afternoonEndTime: toTime(saved.afternoonEndTime),
    });
    onSaved(saved);
  };

  const timeField = (key: keyof PeriodTimes, label: string, enabled: boolean) => (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <TextInput
        style={{ flex: 1 }}
        type="time"
        label={label}
        value={times[key]}
        disabled={closed || !enabled}
        onChange={(e) => setTime(key, e.currentTarget.value)}
      />
      <ActionIcon
        size="lg"
        aria-label={`${label} now`}
        disabled={closed || !enabled}
        onClick={() => setTime(key, dayjs().tz(TZ).format('HH:mm'))}
      >
        <Icon icon="user-clock" />
      </ActionIcon>
    </Group>
  );

  const requiredOk = !!times.morningStartTime && !!periodType;

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Group justify="flex-end" gap="xs">
          <TextInput
            placeholder="Hours (e.g 6.4)"
            title="Number of hours worked, fills the times below"
            inputMode="decimal"
            value={hours}
            disabled={closed || ctx.student}
            onChange={(e) => setHours(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fill();
              }
            }}
            w={160}
          />
          <Button leftSection={<Icon icon="user-clock" />} onClick={fill} disabled={closed || ctx.student || hoursToMinutes(hours, maxHours) === null}>
            Fill
          </Button>
          <Button leftSection={<Icon icon="user-clock" />} onClick={auto} disabled={closed || ctx.student}>
            Auto
          </Button>
        </Group>
        {timeField('morningStartTime', 'Morning Start', true)}
        {timeField('morningEndTime', 'Morning End', !!times.morningStartTime)}
        {timeField('afternoonStartTime', 'Afternoon Start', !!times.morningEndTime)}
        {timeField('afternoonEndTime', 'Afternoon End', !!times.afternoonStartTime)}
        <Select label="Type" data={PERIOD_TYPES} value={periodType} onChange={changeType} disabled={closed} allowDeselect={false} />
        {rates.length > 1 && (
          <Select
            label="Rate"
            data={rates.map((r, i) => ({ value: r.id ?? '', label: rateLabel(r, i) }))}
            value={rateId}
            onChange={setRateId}
            disabled={closed}
            allowDeselect={false}
          />
        )}
        <TextInput label="Project Name" value={projectName} disabled={closed} onChange={(e) => setProjectName(e.currentTarget.value)} />
        <Textarea
          label="Short description"
          autosize
          value={shortDescription}
          disabled={closed}
          onChange={(e) => setShortDescription(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" disabled={closed || !requiredOk}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
