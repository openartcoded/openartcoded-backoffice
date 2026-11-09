import { describe, expect, it } from 'vitest';
import type { ClientRate } from '@/types';
import {
  applyRate,
  canMakeCreditNote,
  fillFromClient,
  fromRowForm,
  initialRows,
  matchRate,
  nextRow,
  toRowForm,
  withRateLabel,
} from './logic';

const rates: ClientRate[] = [
  { id: 'r1', rate: 600, rateType: 'DAYS' },
  { id: 'r2', label: 'On call', rate: 90, rateType: 'HOURS' },
];

describe('rate label in the nature', () => {
  it('adds, replaces and removes the label', () => {
    expect(withRateLabel('Consulting', undefined, 'On call')).toBe('Consulting - On call');
    expect(withRateLabel('Consulting - On call', 'On call', 'Night')).toBe('Consulting - Night');
    expect(withRateLabel('Consulting - On call', 'On call', undefined)).toBe('Consulting');
    expect(withRateLabel('On call', 'On call', 'Night')).toBe('Night');
    expect(withRateLabel('', undefined, undefined)).toBe('');
  });
});

describe('invoice rows', () => {
  it('converts the period from/to the month input', () => {
    const row = toRowForm(
      {
        period: '03/2026',
        amount: 10,
        rate: 600,
        rateType: 'DAYS',
        amountType: 'DAYS',
        nature: 'Dev',
        projectName: 'P',
      },
      rates,
    );
    expect(row.period).toBe('2026-03');
    expect(row.rateId).toBe('r1');
    expect(fromRowForm(row)).toEqual({
      projectName: 'P',
      nature: 'Dev',
      period: '03/2026',
      amount: 10,
      rate: 600,
      rateType: 'DAYS',
      amountType: 'DAYS',
    });
  });

  it('matches the client rate typed by hand', () => {
    expect(matchRate(rates, { rate: '90', rateType: 'HOURS' })?.id).toBe('r2');
    expect(matchRate(rates, { rate: 91, rateType: 'HOURS' })).toBeUndefined();
  });

  it('detects the applied label of an existing row', () => {
    const row = toRowForm({ nature: 'Dev - On call', rate: 90, rateType: 'HOURS' }, rates);
    expect(row.appliedLabel).toBe('On call');
  });

  it('applies a rate to a row', () => {
    const row = toRowForm({ nature: 'Dev', rate: 600, rateType: 'DAYS' }, rates);
    const applied = applyRate(row, rates[1]);
    expect(applied).toMatchObject({
      rate: 90,
      rateType: 'HOURS',
      rateId: 'r2',
      nature: 'Dev - On call',
      appliedLabel: 'On call',
    });
    expect(applyRate(applied, rates[0])).toMatchObject({ nature: 'Dev', rateId: 'r1', appliedLabel: null });
  });

  it('starts a new invoice with two rows', () => {
    expect(initialRows({}, [])).toHaveLength(2);
    expect(initialRows({ invoiceTable: [{ nature: 'x' }] }, [])).toHaveLength(1);
  });

  it('adds a row from the previous one without the amount', () => {
    const rows = [toRowForm({ nature: 'Dev', amount: 5, rate: 600, rateType: 'DAYS' }, rates)];
    expect(nextRow(rows)).toMatchObject({ nature: 'Dev', amount: '', rate: 600 });
  });

  it('fills the bill to and gives each row its own client rate', () => {
    const client = {
      name: 'ACME',
      vatNumber: 'BE1',
      city: 'Brussels',
      address: 'Street 1',
      emailAddress: 'a@acme.be',
      maxDaysToPay: 30,
      taxRate: 21,
      projectName: 'Proj',
      nature: 'Consulting',
    };
    const values = { rows: initialRows({}, []) };
    const filled = fillFromClient(values, client, rates);
    expect(filled.billToClientName).toBe('ACME');
    expect(filled.rows[0]).toMatchObject({ projectName: 'Proj', rate: 600, rateId: 'r1', nature: 'Consulting' });
    expect(filled.rows[1]).toMatchObject({ rate: 90, rateId: 'r2', nature: 'Consulting - On call' });
  });

  it('allows a credit note only on processed regular invoices', () => {
    expect(canMakeCreditNote({ archived: true })).toBe(true);
    expect(canMakeCreditNote({ archived: true, creditNote: true })).toBe(false);
    expect(canMakeCreditNote({ archived: true, creditNoteId: 'x' })).toBe(false);
    expect(canMakeCreditNote({ archived: false })).toBe(false);
  });
});
