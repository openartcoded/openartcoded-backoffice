import { describe, expect, it } from 'vitest';
import { autoTimes, clientRates, durationColor, hoursToMinutes, rateLabel, selectedRateId, timesFromHours, yearStats } from './logic';

describe('period times', () => {
  it('starts at 8 when the max hours per day is >= 8, at 9 otherwise', () => {
    expect(autoTimes(8)).toEqual({ morningStartTime: '08:00', morningEndTime: '12:00', afternoonStartTime: '13:00', afternoonEndTime: '17:00' });
    expect(autoTimes(7).morningStartTime).toBe('09:00');
  });

  it('parses hours with a dot or a comma', () => {
    expect(hoursToMinutes('6.4', 8)).toBe(384);
    expect(hoursToMinutes('6,5', 8)).toBe(390);
    expect(hoursToMinutes('', 8)).toBeNull();
    expect(hoursToMinutes('abc', 8)).toBeNull();
    expect(hoursToMinutes('-1', 8)).toBeNull();
    expect(hoursToMinutes('20', 8)).toBeNull(); // afternoon would end after 23:59
  });

  it('fills the morning first then the afternoon', () => {
    expect(timesFromHours('6.4', 8)).toEqual({
      morningStartTime: '08:00',
      morningEndTime: '12:00',
      afternoonStartTime: '13:00',
      afternoonEndTime: '15:24',
    });
    expect(timesFromHours('3', 7)).toEqual({
      morningStartTime: '09:00',
      morningEndTime: '12:00',
      afternoonStartTime: '13:00',
      afternoonEndTime: '13:00',
    });
    expect(timesFromHours('nope', 8)).toBeNull();
  });
});

describe('rates', () => {
  it('exposes the legacy rate as the default one', () => {
    expect(clientRates({ rate: 500, rateType: 'DAYS' })).toEqual([{ id: 'default', rate: 500, rateType: 'DAYS' }]);
    expect(clientRates({ rates: [{ id: 'a', rate: 60, rateType: 'HOURS' }] })).toHaveLength(1);
    expect(clientRates(undefined)).toEqual([]);
  });

  it('labels the rates', () => {
    expect(rateLabel({ rate: 500, rateType: 'DAYS' }, 0)).toBe('500€/days (default)');
    expect(rateLabel({ label: 'Senior', rate: 70, rateType: 'HOURS' }, 1)).toBe('Senior - 70€/hours');
  });

  it('falls back to the default rate', () => {
    const rates = [{ id: 'a' }, { id: 'b' }];
    expect(selectedRateId(rates, { rateId: 'b' })).toBe('b');
    expect(selectedRateId(rates, { rateId: 'removed' })).toBe('a');
    expect(selectedRateId(rates, {})).toBe('a');
  });
});

describe('timesheet display', () => {
  it('colors the duration of working days', () => {
    expect(durationColor({ periodType: 'WEEKEND', duration: 600 }, 6, 8)).toBe('dark');
    expect(durationColor({ periodType: 'WORKING_DAY', duration: 9 * 60 }, 6, 8)).toBe('red');
    expect(durationColor({ periodType: 'WORKING_DAY', duration: 5 * 60 }, 6, 8)).toBe('orange');
    expect(durationColor({ periodType: 'WORKING_DAY', duration: 7 * 60 }, 6, 8)).toBe('green');
  });

  it('computes the totals and averages of a year', () => {
    expect(
      yearStats([
        { numberOfWorkingDays: 20, numberOfMinutesWorked: 20 * 8 * 60 },
        { numberOfWorkingDays: 18, numberOfMinutesWorked: 18 * 8 * 60 + 30 },
      ]),
    ).toEqual({ sumWorkingDays: 38, avgWorkingDays: 19, sumWorkingHours: '304:30', avgWorkingHours: '152:15' });
    expect(yearStats([])).toBeNull();
  });
});
