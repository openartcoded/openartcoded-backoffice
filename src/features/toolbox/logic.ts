import { dayjs } from '@/lib/format';

export type DurationUnit = 'days' | 'months' | 'years';
export const DURATION_UNITS: DurationUnit[] = ['days', 'months', 'years'];

/** number of week days between two dates (both included). Same day -> 0 (holidays are not taken into account) */
export function businessDays(start: string | Date, end: string | Date): number {
  let d1 = dayjs(start).startOf('day');
  let d2 = dayjs(end).startOf('day');
  if (d1.isSame(d2, 'day')) return 0;
  if (d2.isBefore(d1)) [d1, d2] = [d2, d1];
  let count = 0;
  for (let d = d1; !d.isAfter(d2, 'day'); d = d.add(1, 'day')) {
    const day = d.day();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/** duration between two dates in the given unit (fractional) */
export function durationBetween(start: string | Date, end: string | Date, unit: DurationUnit): number {
  return dayjs(end).diff(dayjs(start), unit, true);
}

/** how many days/months/years since a past date, or before a future date */
export function howMany(date: string | Date, unit: DurationUnit, before: boolean, now: Date = new Date()): number {
  return before ? durationBetween(now, date, unit) : durationBetween(date, now, unit);
}

/** utf-8 safe base64 */
export function utf8ToB64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function b64ToUtf8(value: string): string {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const PASSWORD_CHARSETS = {
  alphaNum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  simple: '!@#$€%^&*()-_',
  complex: '=+[]{}|;,.<>?$^',
  accented: 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝÿýÑñÇç',
  emoji:
    '😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁😀😃😄😁😆😅😂🤣🥲😊😇🙂🙃😉😌🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐽🐸🐵🐔🐧🐦🐤🐣🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦗🦂🐢🐍🦎🐙🦑🦐🦞🐠🐟🐡🐬🐳🐋🦈',
};

export interface PasswordOptions {
  length: number;
  simpleSpecial: boolean;
  complexSpecial: boolean;
  accented: boolean;
  emoji: boolean;
}

/** random password using crypto.getRandomValues. At least one special character when special characters are enabled */
export function generatePassword(opts: PasswordOptions, random: (n: number) => Uint32Array = randomValues): string {
  const length = Math.max(4, Math.min(64, opts.length || 16));
  let charset = Array.from(PASSWORD_CHARSETS.alphaNum);
  let specials: string[] = [];
  if (opts.simpleSpecial) specials = specials.concat(Array.from(PASSWORD_CHARSETS.simple));
  if (opts.complexSpecial) specials = specials.concat(Array.from(PASSWORD_CHARSETS.complex));
  charset = charset.concat(specials);
  if (opts.accented) charset = charset.concat(Array.from(PASSWORD_CHARSETS.accented));
  if (opts.emoji) charset = charset.concat(Array.from(PASSWORD_CHARSETS.emoji));

  const values = random(length + 2);
  const password = Array.from({ length }, (_, i) => charset[values[i] % charset.length]);
  if (specials.length && !password.some((c) => specials.includes(c))) {
    password[values[length] % length] = specials[values[length + 1] % specials.length];
  }
  return password.join('');
}

function randomValues(n: number): Uint32Array {
  const values = new Uint32Array(n);
  crypto.getRandomValues(values);
  return values;
}

export const DEFAULT_JSON = `{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95 }
  }
}`;

export const DEFAULT_XML = `<store>
  <book><category>reference</category><author>Nigel Rees</author><title>Sayings of the Century</title><price>8.95</price></book>
  <book><category>fiction</category><author>Evelyn Waugh</author><title>Sword of Honour</title><price>12.99</price></book>
  <book><category>fiction</category><author>Herman Melville</author><title>Moby Dick</title><isbn>0-553-21311-3</isbn><price>8.99</price></book>
  <book><category>fiction</category><author>J. R. R. Tolkien</author><title>The Lord of the Rings</title><isbn>0-395-19395-8</isbn><price>22.99</price></book>
  <bicycle><color>red</color><price>19.95</price></bicycle>
</store>`;
