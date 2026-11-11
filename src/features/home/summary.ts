import type { BackendInvoiceSummary, DossierSummary, FeeSummary } from '@/types';

export interface YearSummary {
  totalAmountOfWork: number;
  totalExclVat: number;
  numberOfInvoices: number;
}

/**
 * revenue per calendar day worked (from the timesheets): a day counts once, however many hours are invoiced that day.
 * undefined when the days worked are not known.
 */
export function perWorkedDay(year: YearSummary, workedDays?: number): number | undefined {
  return workedDays && workedDays > 0 ? year.totalExclVat / workedDays : undefined;
}

export interface InvoiceStats {
  /** earnings / working days per period (MM/yyyy), ordered by date */
  perPeriod: { period: string; earnings: number; workingDays: number }[];
  perClient: { client: string; total: number }[];
  perYear: Record<number, YearSummary>;
  totalInvoices: number;
  totalAmountOfWork: number;
  totalExclVat: number;
}

/** amount of work in days (hours are converted with the hours per day of the invoice) */
export function amountInDays(invoice: BackendInvoiceSummary): number {
  if (!invoice?.amount) return 0;
  if (invoice.amountType === 'HOURS') {
    return invoice.hoursPerDay ? invoice.amount / invoice.hoursPerDay : 0;
  }
  return invoice.amount;
}

export function computeInvoiceStats(invoices: BackendInvoiceSummary[]): InvoiceStats {
  const ordered = [...invoices].sort(
    (a, b) => new Date(a.dateOfInvoice ?? 0).getTime() - new Date(b.dateOfInvoice ?? 0).getTime(),
  );

  const perPeriodMap = new Map<string, { period: string; earnings: number; workingDays: number }>();
  const perClientMap = new Map<string, number>();
  const perYear: Record<number, YearSummary> = {};

  for (const invoice of ordered) {
    const period = invoice.period ?? '';
    const days = amountInDays(invoice);
    const subTotal = invoice.subTotal ?? 0;

    const p = perPeriodMap.get(period) ?? { period, earnings: 0, workingDays: 0 };
    p.earnings += subTotal;
    p.workingDays += days;
    perPeriodMap.set(period, p);

    const client = invoice.client ?? 'N/A';
    perClientMap.set(client, (perClientMap.get(client) ?? 0) + subTotal);

    const year = new Date(invoice.dateOfInvoice ?? 0).getFullYear();
    const y = perYear[year] ?? { totalAmountOfWork: 0, totalExclVat: 0, numberOfInvoices: 0 };
    perYear[year] = {
      totalAmountOfWork: y.totalAmountOfWork + days,
      totalExclVat: y.totalExclVat + subTotal,
      numberOfInvoices: y.numberOfInvoices + 1,
    };
  }

  return {
    perPeriod: [...perPeriodMap.values()],
    perClient: [...perClientMap.entries()].map(([client, total]) => ({ client, total })),
    perYear,
    totalInvoices: ordered.length,
    totalAmountOfWork: ordered.map(amountInDays).reduce((a, b) => a + b, 0),
    totalExclVat: ordered.map((i) => i.subTotal ?? 0).reduce((a, b) => a + b, 0),
  };
}

/** the year to show by default: the current one if it has invoices, otherwise the previous one */
export function defaultYear(perYear: Record<number, YearSummary>, now = new Date()): number {
  const current = now.getFullYear();
  return perYear[current] ? current : current - 1;
}

export function feeChartData(summaries: FeeSummary[]) {
  return summaries
    .filter((s) => s.tag?.toLowerCase() !== 'other' && s.totalHVAT !== 0)
    .sort((a, b) => (b.totalHVAT ?? 0) - (a.totalHVAT ?? 0))
    .map((s) => ({ tag: s.tag ?? '', totalHVAT: s.totalHVAT ?? 0, vat: s.totalVAT ?? 0 }));
}

export function dossierChartData(summaries: DossierSummary[]) {
  return [...summaries]
    .sort((a, b) => new Date(a.closedDate).getTime() - new Date(b.closedDate).getTime())
    .map((s) => ({ name: s.name ?? '', earnings: s.totalEarnings ?? 0, expenses: s.totalExpenses ?? 0 }));
}
