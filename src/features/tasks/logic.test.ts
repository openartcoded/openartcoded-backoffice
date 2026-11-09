import { describe, expect, it } from 'vitest';
import type { ReminderTask } from '@/types';
import { cloneTask, filterTasks, nextDates, quickDate } from './logic';

const task = (t: Partial<ReminderTask>): ReminderTask => ({ title: 't', description: 'd', disabled: false, ...t });

describe('quick dates', () => {
  // wednesday 4 november 2026, 15:30
  const now = new Date(2026, 10, 4, 15, 30);

  it('adds relative durations', () => {
    expect(quickDate('1hour', now).getHours()).toBe(16);
    expect(quickDate('1min', now).getMinutes()).toBe(31);
    expect(quickDate('now', now).getTime()).toBe(now.getTime());
  });

  it('sets the next morning at 2am', () => {
    const d = quickDate('nextMorning', now);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([5, 2, 0]);
  });

  it('finds the next friday and sunday', () => {
    expect(quickDate('nextFriday', now).getDate()).toBe(6);
    expect(quickDate('nextSunday', now).getDate()).toBe(8);
    // on a friday, next friday is a week later
    expect(quickDate('nextFriday', new Date(2026, 10, 6, 10)).getDate()).toBe(13);
  });
});

describe('task filtering', () => {
  const tasks = [
    task({ id: '1', title: 'Pay taxes', nextDate: '2026-11-04T10:00:00' }),
    task({ id: '2', title: 'Backup', actionKey: 'BACKUP', nextDate: '2026-11-04T18:00:00' }),
    task({ id: '3', title: 'Disabled', disabled: true, nextDate: '2026-11-05T10:00:00' }),
    task({ id: '4', title: 'Call bank', description: 'about the loan', nextDate: '2026-11-06T10:00:00' }),
  ];
  const base = { showActions: true, hideDisabled: true, date: null, search: '' };

  it('lists the distinct days of the next executions', () => {
    expect(nextDates(tasks).map((d) => d.getDate())).toEqual([4, 5, 6]);
  });

  it('hides the disabled tasks and the actions', () => {
    expect(filterTasks(tasks, base).map((t) => t.id)).toEqual(['1', '2', '4']);
    expect(filterTasks(tasks, { ...base, showActions: false }).map((t) => t.id)).toEqual(['1', '4']);
    expect(filterTasks(tasks, { ...base, hideDisabled: false })).toHaveLength(4);
  });

  it('filters on the selected day', () => {
    expect(filterTasks(tasks, { ...base, date: new Date(2026, 10, 4) }).map((t) => t.id)).toEqual(['1', '2']);
  });

  it('searches title / description, ignoring the other filters', () => {
    expect(filterTasks(tasks, { ...base, search: 'LOAN' }).map((t) => t.id)).toEqual(['4']);
    expect(filterTasks(tasks, { ...base, search: 'disabled' }).map((t) => t.id)).toEqual(['3']);
  });

  it('clones a task without its identity', () => {
    const clone = cloneTask(task({ id: '9', nextDate: 'x', lastExecutionDate: 'y', dateCreation: 'z', title: 'keep' }));
    expect(clone).toMatchObject({ id: undefined, nextDate: undefined, lastExecutionDate: undefined, dateCreation: undefined, title: 'keep' });
  });

  it('enables the clone and clears a specific date already passed', () => {
    const now = new Date(2026, 10, 9, 12);
    const executed = task({ id: '1', disabled: true, specificDate: new Date(2026, 10, 1), calendarDate: new Date(2026, 10, 1) });
    expect(cloneTask(executed, now)).toMatchObject({ disabled: false, specificDate: null, calendarDate: null });
    const future = new Date(2026, 11, 1);
    expect(cloneTask(task({ disabled: true, specificDate: future }), now)).toMatchObject({ disabled: false, specificDate: future });
  });
});
