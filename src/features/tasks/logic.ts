import { dayjs } from '@/lib/format';
import type { ReminderTask } from '@/types';

export const QUICK_DATES = [
  { value: 'now', label: 'Now' },
  { value: '1min', label: 'In one minute' },
  { value: '1hour', label: 'In one hour' },
  { value: '8hour', label: 'In 8 hours' },
  { value: 'nextMorning', label: 'Next morning' },
  { value: '1day', label: 'In one day' },
  { value: '1week', label: 'In one week' },
  { value: '1month', label: 'In one month' },
  { value: 'nextFriday', label: 'Next Friday' },
  { value: 'nextSunday', label: 'Next Sunday' },
];

/** computes the date of a quick date option, relative to now */
export function quickDate(option: string, now: Date = new Date()): Date {
  const d = new Date(now);
  switch (option) {
    case '1week':
      d.setDate(d.getDate() + 7);
      d.setHours(2, 0, 0, 0);
      break;
    case '1month':
      d.setMonth(d.getMonth() + 1);
      d.setHours(2, 0, 0, 0);
      break;
    case 'nextMorning':
      d.setDate(d.getDate() + 1);
      d.setHours(2, 0, 0, 0);
      break;
    case '1day':
      d.setDate(d.getDate() + 1);
      break;
    case '1hour':
      d.setHours(d.getHours() + 1);
      break;
    case '1min':
      d.setMinutes(d.getMinutes() + 1);
      break;
    case '8hour':
      d.setHours(d.getHours() + 8);
      break;
    case 'nextFriday':
      d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
      d.setHours(2, 0, 0, 0);
      break;
    case 'nextSunday':
      d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
      d.setHours(2, 0, 0, 0);
      break;
    default:
      break;
  }
  return d;
}

/** distinct days (start of day) of the next execution of the tasks, sorted */
export function nextDates(tasks: ReminderTask[]): Date[] {
  const days = tasks
    .filter((t) => t.nextDate)
    .map((t) => dayjs(t.nextDate).startOf('day').valueOf());
  return [...new Set(days)].sort((a, b) => a - b).map((d) => new Date(d));
}

export interface TaskFilter {
  showActions: boolean;
  hideDisabled: boolean;
  date: Date | null;
  search: string;
}

export function filterTasks(tasks: ReminderTask[], f: TaskFilter): ReminderTask[] {
  const search = f.search.trim().toLowerCase();
  if (search) {
    return tasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search) ||
        t.customActionName?.toLowerCase().includes(search),
    );
  }
  return tasks
    .filter((t) => f.showActions || !t.actionKey)
    .filter((t) => !f.hideDisabled || !t.disabled)
    .filter((t) => !f.date || !t.nextDate || dayjs(t.nextDate).isSame(f.date, 'day'));
}

/**
 * a copy of the task ready to be scheduled again, used by "clone":
 * no identity nor execution history, enabled (a one shot task is disabled by the backend once executed),
 * and a specific date already passed is cleared so a new one must be chosen
 */
export function cloneTask(task: ReminderTask, now: Date = new Date()): ReminderTask {
  const pastDate = !!task.specificDate && new Date(task.specificDate).getTime() <= now.getTime();
  return {
    ...task,
    id: undefined,
    lastExecutionDate: undefined,
    nextDate: undefined,
    dateCreation: undefined,
    updatedDate: undefined,
    disabled: false,
    specificDate: pastDate ? null : task.specificDate,
    calendarDate: pastDate ? null : task.calendarDate,
  };
}

export const emptyTask = (): ReminderTask => ({ title: '', description: '', disabled: false });
