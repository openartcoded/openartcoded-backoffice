import { dayjs, TZ } from '@/lib/format';
import type { BillableClient, ClientRate, DateLike, PeriodType, Timesheet, TimesheetPeriod } from '@/types';

export const PERIOD_TAGS: { label: string; periodType: PeriodType; color: string }[] = [
  { label: 'working day', periodType: 'WORKING_DAY', color: 'green' },
  { label: 'weekend', periodType: 'WEEKEND', color: 'yellow' },
  { label: 'sick day', periodType: 'SICKNESS', color: 'red' },
  { label: 'public holidays', periodType: 'PUBLIC_HOLIDAYS', color: 'cyan' },
  { label: 'authorized holidays', periodType: 'AUTHORIZED_HOLIDAYS', color: 'artcoded' },
];

export const tagColor = (pt?: PeriodType) => PERIOD_TAGS.find((t) => t.periodType === pt)?.color ?? 'gray';

const pad = (n: number) => String(n).padStart(2, '0');
export const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** morning start: 08:00 when the max hours per day is >= 8, 09:00 otherwise */
const morningStart = (maxHoursPerDay?: number) => ((maxHoursPerDay ?? 0) >= 8 ? 8 * 60 : 9 * 60);
const LUNCH = 12 * 60;
const AFTERNOON = 13 * 60;

export interface PeriodTimes {
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
}

/** default working day (auto button) */
export function autoTimes(maxHoursPerDay?: number): PeriodTimes {
  return {
    morningStartTime: minutesToTime(morningStart(maxHoursPerDay)),
    morningEndTime: '12:00',
    afternoonStartTime: '13:00',
    afternoonEndTime: '17:00',
  };
}

/** "6.4" or "6,4" -> 384 minutes. null when empty, not a number, <= 0 or not fitting in the day (afternoon after 23:59) */
export function hoursToMinutes(value: unknown, maxHoursPerDay?: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const hours = Number(String(value).replace(',', '.'));
  if (isNaN(hours) || hours <= 0) return null;
  const minutes = Math.round(hours * 60);
  const maxMinutes = LUNCH - morningStart(maxHoursPerDay) + (23 * 60 + 59 - AFTERNOON);
  return minutes > 0 && minutes <= maxMinutes ? minutes : null;
}

/**
 * Fills the morning / afternoon times so the row matches the number of hours typed (e.g. 6.4 -> 6h24).
 * Same start and lunch break as the auto button. When it fits in the morning, the afternoon is empty (13:00-13:00).
 */
export function timesFromHours(value: unknown, maxHoursPerDay?: number): PeriodTimes | null {
  const minutes = hoursToMinutes(value, maxHoursPerDay);
  if (minutes === null) return null;
  const start = morningStart(maxHoursPerDay);
  const morning = Math.min(minutes, LUNCH - start);
  return {
    morningStartTime: minutesToTime(start),
    morningEndTime: minutesToTime(start + morning),
    afternoonStartTime: minutesToTime(AFTERNOON),
    afternoonEndTime: minutesToTime(AFTERNOON + minutes - morning),
  };
}

/** time of a period (backend date) for a time input */
export function toTime(value?: DateLike | null): string {
  return value ? dayjs(value).tz(TZ).format('HH:mm') : '';
}

/** combines the date of the period with a HH:mm time (Brussels) */
export function withTime(date: DateLike | undefined, time: string): Date | null {
  if (!date || !time) return null;
  return dayjs.tz(`${dayjs(date).format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', TZ).toDate();
}

export function rateLabel(r: ClientRate, index: number): string {
  const label = r.label ? `${r.label} - ` : '';
  return `${label}${r.rate}€/${(r.rateType ?? '').toLowerCase()}${index === 0 ? ' (default)' : ''}`;
}

/** rates of a client. A client not migrated yet (only the legacy rate/rateType) is exposed as a single default rate */
export function clientRates(client?: BillableClient): ClientRate[] {
  if (client?.rates?.length) return client.rates;
  if (client?.rate) {
    return [{ id: 'default', rate: client.rate, rateType: client.rateType ?? 'DAYS' }];
  }
  return [];
}

/** the rate chosen for a row, a row without rate (or with a removed one) uses the default (first) rate */
export function selectedRateId(rates: ClientRate[], period: TimesheetPeriod): string | undefined {
  return (rates.find((r) => r.id === period.rateId) ?? rates[0])?.id;
}

export function durationColor(period: TimesheetPeriod, min?: number, max?: number): string {
  if (period.periodType !== 'WORKING_DAY') return 'dark';
  const hours = (period.duration ?? 0) / 60;
  if (max !== undefined && hours > max) return 'red';
  if (min !== undefined && hours < min) return 'orange';
  return 'green';
}

export function isToday(period: TimesheetPeriod): boolean {
  return period.periodType === 'WORKING_DAY' && dayjs(period.date).isSame(dayjs(), 'day');
}

export interface YearStats {
  sumWorkingDays: number;
  avgWorkingDays: number;
  sumWorkingHours: string;
  avgWorkingHours: string;
}

export function yearStats(timesheets: Timesheet[]): YearStats | null {
  if (!timesheets.length) return null;
  const days = timesheets.reduce((s, t) => s + (t.numberOfWorkingDays ?? 0), 0);
  const minutes = timesheets.reduce((s, t) => s + (t.numberOfMinutesWorked ?? 0), 0);
  return {
    sumWorkingDays: days,
    avgWorkingDays: Math.round(days / timesheets.length),
    sumWorkingHours: minutesToTime(minutes),
    avgWorkingHours: minutesToTime(Math.round(minutes / timesheets.length)),
  };
}

export const shortDay = (day?: string) => (day ?? '').substring(0, 3);
