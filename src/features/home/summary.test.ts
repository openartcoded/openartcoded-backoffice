import { describe, expect, it } from 'vitest';
import { amountInDays, computeInvoiceStats, defaultYear, dossierChartData, feeChartData } from './summary';

describe('invoice summary', () => {
  const invoices = [
    {
      period: '02/2026',
      amount: 16,
      hoursPerDay: 8,
      amountType: 'HOURS',
      subTotal: 1000,
      client: 'B',
      dateOfInvoice: '2026-02-28',
    },
    { period: '01/2026', amount: 20, amountType: 'DAYS', subTotal: 10000, client: 'A', dateOfInvoice: '2026-01-31' },
    { period: '01/2026', amount: 2, amountType: 'DAYS', subTotal: 1000, client: 'B', dateOfInvoice: '2026-01-31' },
    { period: '12/2025', amount: 18, amountType: 'DAYS', subTotal: 9000, client: 'A', dateOfInvoice: '2025-12-31' },
  ];

  it('converts hours to days', () => {
    expect(amountInDays(invoices[0])).toBe(2);
    expect(amountInDays(invoices[1])).toBe(20);
    expect(amountInDays({})).toBe(0);
  });

  it('aggregates per period in chronological order', () => {
    const stats = computeInvoiceStats(invoices);
    expect(stats.perPeriod).toEqual([
      { period: '12/2025', earnings: 9000, workingDays: 18 },
      { period: '01/2026', earnings: 11000, workingDays: 22 },
      { period: '02/2026', earnings: 1000, workingDays: 2 },
    ]);
  });

  it('aggregates per client and per year', () => {
    const stats = computeInvoiceStats(invoices);
    expect(stats.perClient).toEqual(
      expect.arrayContaining([
        { client: 'A', total: 19000 },
        { client: 'B', total: 2000 },
      ]),
    );
    expect(stats.perYear[2026]).toEqual({ totalAmountOfWork: 24, totalExclVat: 12000, numberOfInvoices: 3 });
    expect(stats.perYear[2025].numberOfInvoices).toBe(1);
    expect(stats.totalInvoices).toBe(4);
    expect(stats.totalAmountOfWork).toBe(42);
    expect(stats.totalExclVat).toBe(21000);
  });

  it('defaults to the previous year when the current one has no invoice', () => {
    const perYear = { 2025: { totalAmountOfWork: 1, totalExclVat: 1, numberOfInvoices: 1 } };
    expect(defaultYear(perYear, new Date(2026, 0, 2))).toBe(2025);
    expect(defaultYear(perYear, new Date(2025, 5, 2))).toBe(2025);
  });
});

describe('chart data', () => {
  it('ignores "other" and empty tags, sorted by total', () => {
    const data = feeChartData([
      { tag: 'OTHER', totalHVAT: 999, totalVAT: 1 },
      { tag: 'TELECOM', totalHVAT: 50, totalVAT: 10 },
      { tag: 'EMPTY', totalHVAT: 0, totalVAT: 0 },
      { tag: 'RENT', totalHVAT: 500, totalVAT: 0 },
    ]);
    expect(data.map((d) => d.tag)).toEqual(['RENT', 'TELECOM']);
  });

  it('orders the dossiers by closed date', () => {
    const data = dossierChartData([
      { name: 'b', closedDate: '2026-02-01', totalEarnings: 2, totalExpenses: 1 },
      { name: 'a', closedDate: '2025-02-01', totalEarnings: 1, totalExpenses: 1 },
    ]);
    expect(data.map((d) => d.name)).toEqual(['a', 'b']);
  });
});
