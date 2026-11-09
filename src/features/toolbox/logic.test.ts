import { describe, expect, it } from 'vitest';
import { b64ToUtf8, businessDays, durationBetween, generatePassword, howMany, PASSWORD_CHARSETS, utf8ToB64 } from './logic';

describe('business days', () => {
  it('counts week days, both dates included', () => {
    expect(businessDays('2026-11-02', '2026-11-06')).toBe(5); // monday -> friday
    expect(businessDays('2026-11-02', '2026-11-09')).toBe(6); // monday -> next monday
    expect(businessDays('2026-11-06', '2026-11-08')).toBe(1); // friday -> sunday
  });

  it('returns 0 for the same day and accepts reversed dates', () => {
    expect(businessDays('2026-11-02', '2026-11-02')).toBe(0);
    expect(businessDays('2026-11-06', '2026-11-02')).toBe(5);
  });
});

describe('durations', () => {
  it('computes durations between dates', () => {
    expect(durationBetween('2026-01-01', '2026-01-31', 'days')).toBe(30);
    expect(Math.floor(durationBetween('2024-01-01', '2026-06-01', 'years'))).toBe(2);
  });

  it('computes since / before relative to now', () => {
    const now = new Date('2026-01-11T00:00:00');
    expect(Math.floor(howMany('2026-01-01T00:00:00', 'days', false, now))).toBe(10);
    expect(Math.floor(howMany('2026-01-21T00:00:00', 'days', true, now))).toBe(10);
  });
});

describe('base64', () => {
  it('round trips utf-8 text', () => {
    const text = 'héllo wörld 👋';
    expect(b64ToUtf8(utf8ToB64(text))).toBe(text);
    expect(utf8ToB64('hello')).toBe('aGVsbG8=');
  });
});

describe('password generator', () => {
  it('generates a password of the requested length', () => {
    const pwd = generatePassword({ length: 20, simpleSpecial: false, complexSpecial: false, accented: false, emoji: false });
    expect(pwd).toHaveLength(20);
    expect([...pwd].every((c) => PASSWORD_CHARSETS.alphaNum.includes(c))).toBe(true);
  });

  it('contains at least one special character when enabled', () => {
    // deterministic "random" values always picking the first alpha numeric character
    const zeros = (n: number) => new Uint32Array(n);
    const pwd = generatePassword({ length: 8, simpleSpecial: true, complexSpecial: false, accented: false, emoji: false }, zeros);
    expect([...pwd].some((c) => PASSWORD_CHARSETS.simple.includes(c))).toBe(true);
  });

  it('clamps the length between 4 and 64', () => {
    const opts = { simpleSpecial: false, complexSpecial: false, accented: false, emoji: false };
    expect(generatePassword({ ...opts, length: 1 })).toHaveLength(4);
    expect(generatePassword({ ...opts, length: 500 })).toHaveLength(64);
  });
});
