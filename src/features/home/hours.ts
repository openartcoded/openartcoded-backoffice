import type { TimesheetStats } from '@/types';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const OTHER_CLIENTS = 'Other';

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** hours per year, the most worked clients apart (most worked first), the rest in "Other" */
export function hoursPerYear(stats: TimesheetStats, topClients = 5) {
  const top = stats.clients.slice(0, topClients);
  const series = stats.clients.length > topClients ? [...top, OTHER_CLIENTS] : top;
  const data = stats.years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) };
    for (const s of series) row[s] = 0;
    for (const r of stats.rows.filter((r) => r.year === year)) {
      const key = top.includes(r.client) ? r.client : OTHER_CLIENTS;
      row[key] = (row[key] as number) + r.minutes;
    }
    for (const s of series) row[s] = hours(row[s] as number);
    return row;
  });
  return { data, series };
}

/**
 * cumulated hours month by month, one serie per year (of one client, or every client).
 * The current year stops at the current month.
 */
export function cumulativeHours(stats: TimesheetStats, client: string | null, now = new Date()) {
  const series = stats.years.map(String);
  const totals = new Map<string, number>();
  const data = MONTHS.map((label, i) => {
    const month = i + 1;
    const row: Record<string, number | string | null> = { month: label };
    for (const year of stats.years) {
      const key = String(year);
      const minutes = stats.rows
        .filter((r) => r.year === year && r.month === month && (!client || r.client === client))
        .reduce((a, r) => a + r.minutes, 0);
      totals.set(key, (totals.get(key) ?? 0) + minutes);
      const future = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
      row[key] = future ? null : hours(totals.get(key)!);
    }
    return row;
  });
  return { data, series };
}

export interface ClientHoursRow {
  client: string;
  /** hours per year */
  perYear: Record<number, number>;
  /** this year so far compared with the same months of the previous year (ratio - 1), undefined when not comparable */
  progress?: number;
}

/** hours per client and year, most worked first, with the progress of the current year */
export function hoursPerClient(stats: TimesheetStats, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const sum = (filter: (r: TimesheetStats['rows'][number]) => boolean) =>
    stats.rows.filter(filter).reduce((a, r) => a + r.minutes, 0);
  const row = (client: string | null): ClientHoursRow => {
    const ofClient = (r: TimesheetStats['rows'][number]) => !client || r.client === client;
    const perYear: Record<number, number> = {};
    for (const year of stats.years) perYear[year] = hours(sum((r) => ofClient(r) && r.year === year));
    const current = sum((r) => ofClient(r) && r.year === currentYear && r.month <= currentMonth);
    const previous = sum((r) => ofClient(r) && r.year === currentYear - 1 && r.month <= currentMonth);
    return {
      client: client ?? 'Total',
      perYear,
      progress: previous > 0 && stats.years.includes(currentYear) ? current / previous - 1 : undefined,
    };
  };
  return { rows: stats.clients.map(row), total: row(null) };
}
