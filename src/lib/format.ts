import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { DateLike } from '@/types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TZ = 'Europe/Brussels';

export { dayjs };

/** formats a date for display, e.g. fmtDate(d) -> 25/12/2026, fmtDate(d, 'DD/MM/YYYY HH:mm') */
export function fmtDate(value: DateLike | null | undefined, format = 'DD/MM/YYYY'): string {
  if (value === null || value === undefined || value === '') return '';
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : '';
}

export const fmtDateTime = (value: DateLike | null | undefined) => fmtDate(value, 'DD/MM/YYYY HH:mm');

/** value for <input type="date"> */
export function toInputDate(value: DateLike | null | undefined): string {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
}

/** value for <input type="datetime-local">, in the Brussels timezone */
export function toInputDateTime(value: DateLike | null | undefined): string {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.tz(TZ).format('YYYY-MM-DDTHH:mm') : '';
}

/** parses the value of a date / datetime-local input. Empty -> null */
export function fromInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const numberFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  return currencyFormatter.format(value);
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  return numberFormatter.format(value);
}

export function bytesToHuman(value: number | null | undefined, si = false, dp = 1): string {
  if (value === null || value === undefined) return '';
  const thresh = si ? 1000 : 1024;
  if (Math.abs(value) < thresh) return `${value} B`;
  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;
  let v = value;
  do {
    v /= thresh;
    ++u;
  } while (Math.round(Math.abs(v) * r) / r >= thresh && u < units.length - 1);
  return `${v.toFixed(dp)} ${units[u]}`;
}

export function trim(value: string | null | undefined, length: number, withDots = true): string {
  if (!value) return '';
  const sub = value.substring(0, length);
  return sub.length !== value.length && withDots ? `${sub}...` : sub;
}

export function slugify(input: string | null | undefined): string {
  return (input ?? '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function titleCase(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
