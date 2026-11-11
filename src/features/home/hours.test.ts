import { describe, expect, it } from 'vitest';
import type { TimesheetStats } from '@/types';
import { cumulativeHours, hoursPerClient, hoursPerYear, OTHER_CLIENTS } from './hours';

const h = (hours: number) => hours * 60;

const stats: TimesheetStats = {
  years: [2025, 2026],
  workedDays: { 2025: 30, 2026: 33 },
  clients: ['Y', 'X', 'Z'],
  rows: [
    { year: 2025, month: 1, client: 'Y', minutes: h(100), days: 12 },
    { year: 2025, month: 2, client: 'Y', minutes: h(120), days: 15 },
    { year: 2025, month: 2, client: 'X', minutes: h(10), days: 2 },
    { year: 2025, month: 7, client: 'Z', minutes: h(4), days: 1 },
    { year: 2026, month: 1, client: 'Y', minutes: h(130), days: 16 },
    { year: 2026, month: 2, client: 'Y', minutes: h(140), days: 17 },
    { year: 2026, month: 2, client: 'X', minutes: h(5.5), days: 1 },
  ],
};
const now = new Date(2026, 1, 20); // 20 february 2026

describe('timesheet hours', () => {
  it('per year, the most worked clients apart and the rest in "Other"', () => {
    const { data, series } = hoursPerYear(stats, 2);
    expect(series).toEqual(['Y', 'X', OTHER_CLIENTS]);
    expect(data).toEqual([
      { year: '2025', Y: 220, X: 10, [OTHER_CLIENTS]: 4 },
      { year: '2026', Y: 270, X: 5.5, [OTHER_CLIENTS]: 0 },
    ]);
    // no "Other" when every client fits
    expect(hoursPerYear(stats).series).toEqual(['Y', 'X', 'Z']);
  });

  it('cumulated month by month, the current year stops at the current month', () => {
    const { data, series } = cumulativeHours(stats, null, now);
    expect(series).toEqual(['2025', '2026']);
    expect(data[0]).toEqual({ month: 'Jan', 2025: 100, 2026: 130 });
    expect(data[1]).toEqual({ month: 'Feb', 2025: 230, 2026: 275.5 });
    expect(data[6]).toEqual({ month: 'Jul', 2025: 234, 2026: null });
    expect(data[11]).toEqual({ month: 'Dec', 2025: 234, 2026: null });
  });

  it('cumulated for one client', () => {
    const { data } = cumulativeHours(stats, 'X', now);
    expect(data[1]).toEqual({ month: 'Feb', 2025: 10, 2026: 5.5 });
  });

  it('per client, with the progress against the same months of last year', () => {
    const { rows, total } = hoursPerClient(stats, now);
    expect(rows.map((r) => r.client)).toEqual(['Y', 'X', 'Z']);
    expect(rows[0].perYear).toEqual({ 2025: 220, 2026: 270 });
    // 270 vs 220 (january + february)
    expect(rows[0].progress).toBeCloseTo(270 / 220 - 1);
    expect(rows[1].progress).toBeCloseTo(5.5 / 10 - 1);
    // Z: nothing in the first months of 2025
    expect(rows[2].progress).toBeUndefined();
    expect(total.client).toBe('Total');
    expect(total.perYear).toEqual({ 2025: 234, 2026: 275.5 });
    expect(total.progress).toBeCloseTo(275.5 / 230 - 1);
  });
});
