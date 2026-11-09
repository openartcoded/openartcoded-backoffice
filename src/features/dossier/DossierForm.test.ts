import { describe, expect, it } from 'vitest';
import type { Fee, Invoice } from '@/types';
import { computeTotals, filterExpenses } from './DossierForm';

const fees = [
  { id: '1', subject: 'Laptop', tag: 'HARDWARE', vat: 210, priceHVAT: 1000 },
  { id: '2', subject: 'Internet', tag: 'INTERNET', vat: 10.5, priceHVAT: 50 },
] as Fee[];

describe('dossier', () => {
  it('computes the totals of expenses and invoices', () => {
    const invoices = [{ taxes: 105, subTotal: 500 }, { taxes: 21, subTotal: 100 }] as Invoice[];
    expect(computeTotals(fees, invoices)).toEqual({ feeTotalVat: 220.5, feeTotalExclVat: 1050, vatTotal: 126, invoiceTotalExclVat: 600 });
    expect(computeTotals([], [])).toEqual({ feeTotalVat: 0, feeTotalExclVat: 0, vatTotal: 0, invoiceTotalExclVat: 0 });
  });

  it('filters the expenses by subject or tag after 3 characters', () => {
    expect(filterExpenses(fees, 'la')).toHaveLength(2);
    expect(filterExpenses(fees, 'lap').map((f) => f.id)).toEqual(['1']);
    expect(filterExpenses(fees, 'internet').map((f) => f.id)).toEqual(['2']);
  });
});
