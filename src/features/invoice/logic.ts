import { dayjs } from '@/lib/format';
import type { BillableClient, ClientRate, Invoice, InvoiceRow, RateType } from '@/types';

export { clientRates } from '@/features/timesheet/logic';

/** a row of the invoice table as edited in the form */
export interface RowForm {
  projectName: string;
  nature: string;
  /** YYYY-MM (month input) */
  period: string;
  amount: number | string;
  amountType: RateType;
  rate: number | string;
  rateType: RateType;
  /** client rate applied to the row (form only, not sent) */
  rateId: string | null;
  /** label of the applied rate added to the nature (form only) */
  appliedLabel: string | null;
}

export function rateOptionLabel(r: ClientRate, index: number): string {
  const label = r.label ? `${r.label} - ` : '';
  return `${label}${r.rate}€/${(r.rateType ?? '').toLowerCase()}${index === 0 ? ' (default)' : ''}`;
}

/** the client rate matching a rate + rate type typed by hand */
export function matchRate(
  rates: ClientRate[],
  row: { rate?: number | string; rateType?: string },
): ClientRate | undefined {
  return rates.find((r) => Number(r.rate) === Number(row.rate) && String(r.rateType) === String(row.rateType));
}

/** replaces the label of the previously applied rate by the label of the new rate in the description (nature) */
export function withRateLabel(
  nature: string | undefined,
  previousLabel?: string | null,
  label?: string | null,
): string {
  let base = nature ?? '';
  if (previousLabel) {
    if (base.endsWith(` - ${previousLabel}`)) base = base.slice(0, -(previousLabel.length + 3));
    else if (base === previousLabel) base = '';
  }
  if (!label) return base;
  return base ? `${base} - ${label}` : label;
}

/** applies a client rate to a row: rate, rate type and its label in the description. baseNature replaces the description */
export function applyRate(row: RowForm, rate?: ClientRate, baseNature?: string): RowForm {
  const previousLabel = baseNature !== undefined ? undefined : row.appliedLabel;
  const nature = baseNature !== undefined ? baseNature : row.nature;
  return {
    ...row,
    rate: rate?.rate ?? '',
    rateType: rate?.rateType ?? row.rateType,
    rateId: rate?.id ?? null,
    nature: withRateLabel(nature, previousLabel, rate?.label),
    appliedLabel: rate?.label ?? null,
  };
}

export function toRowForm(
  row: Partial<InvoiceRow> & { rateId?: string | null; appliedLabel?: string | null },
  rates: ClientRate[],
): RowForm {
  const matched = matchRate(rates, row);
  return {
    projectName: row.projectName ?? '',
    nature: row.nature ?? '',
    period: row.period ? dayjs(row.period, 'MM/YYYY').format('YYYY-MM') : dayjs().format('YYYY-MM'),
    amount: row.amount ?? '',
    amountType: row.amountType ?? 'DAYS',
    rate: row.rate ?? '',
    rateType: row.rateType ?? 'HOURS',
    rateId: row.rateId !== undefined ? row.rateId : (matched?.id ?? null),
    appliedLabel:
      row.appliedLabel ?? (matched?.label && row.nature?.endsWith(` - ${matched.label}`) ? matched.label : null),
  };
}

export function fromRowForm(row: RowForm): InvoiceRow {
  return {
    projectName: row.projectName,
    nature: row.nature,
    period: dayjs(row.period, 'YYYY-MM').format('MM/YYYY'),
    amount: Number(row.amount),
    rate: Number(row.rate),
    rateType: row.rateType,
    amountType: row.amountType,
  };
}

/** a new invoice starts with two rows sharing the same template */
export function initialRows(invoice: Invoice, rates: ClientRate[]): RowForm[] {
  const defaultRow: Partial<InvoiceRow> = { rateType: 'HOURS', amountType: 'DAYS' };
  const rows = invoice.invoiceTable?.length ? invoice.invoiceTable : [defaultRow, { ...defaultRow }];
  return rows.map((r) => toRowForm(r, rates));
}

/** a new row using the previous one as template, the amount is left empty */
export function nextRow(rows: RowForm[]): RowForm {
  const last = rows[rows.length - 1];
  if (!last) return toRowForm({ rateType: 'HOURS', amountType: 'DAYS' }, []);
  return { ...last, amount: '' };
}

/** fills the "bill to" + rows from a saved client: first row gets the default rate, second row the second rate... */
export function fillFromClient<T extends { rows: RowForm[] }>(values: T, client: BillableClient, rates: ClientRate[]) {
  return {
    billToVatNumber: client.vatNumber ?? '',
    billToClientName: client.name ?? '',
    billToCity: client.city ?? '',
    billToAddress: client.address ?? '',
    billToEmailAddress: client.emailAddress ?? '',
    maxDaysToPay: client.maxDaysToPay ?? '',
    taxRate: client.taxRate ?? '',
    rows: values.rows.map((row, i) =>
      applyRate({ ...row, projectName: client.projectName ?? '' }, rates[i] ?? rates[0], client.nature ?? ''),
    ),
  };
}

export function invoiceTitle(invoice: Invoice) {
  return `${invoice.creditNote ? 'Credit Note' : 'Invoice'} <${invoice.newInvoiceNumber || invoice.invoiceNumber || 'New'}>`;
}

export function invoiceMailContext(invoice: Invoice) {
  return {
    'Invoice Ref': invoice.invoiceNumber,
    'Invoice N°': invoice.newInvoiceNumber,
    Client: invoice.billTo?.clientName,
    Period: invoice.invoiceTable?.[0]?.period,
  };
}

/** a credit note can be made of a processed invoice that is not already a credit note / manual upload */
export function canMakeCreditNote(i: Invoice) {
  return !!i.archived && !i.logicalDelete && !i.creditNote && !i.uploadedManually && !i.creditNoteId;
}
