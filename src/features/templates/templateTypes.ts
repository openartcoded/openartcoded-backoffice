import type { TemplateType, TemplateVersion } from '@/types';

/** display order */
export const TEMPLATE_TYPES: TemplateType[] = [
  'INVOICE',
  'CV',
  'TIMESHEET',
  'PEPPOL_INVOICE',
  'PEPPOL_CREDIT_NOTE',
  'EMAIL',
  'ACTION',
  'SMS',
  'CALENDAR',
  'DOSSIER_REPORT',
  'BUSINESS_PLAN',
];

export const TEMPLATE_TYPE_DISPLAY: Record<TemplateType, { label: string; description: string }> = {
  INVOICE: { label: 'Invoice', description: 'pdf of an invoice' },
  CV: { label: 'CV', description: 'pdf of the curriculum' },
  TIMESHEET: { label: 'Timesheet', description: 'pdf of a closed timesheet' },
  PEPPOL_INVOICE: { label: 'Peppol invoice', description: 'xml (UBL) of an invoice sent to Peppol' },
  PEPPOL_CREDIT_NOTE: { label: 'Peppol credit note', description: 'xml (UBL) of a credit note sent to Peppol' },
  EMAIL: { label: 'Email', description: 'html around every email sent (subject, htmlBody)' },
  ACTION: { label: 'Action report', description: 'email reporting the result of an action (actionResult)' },
  SMS: { label: 'SMS', description: 'sms reporting the result of an action (actionResult, actionKey)' },
  CALENDAR: { label: 'Calendar invite', description: '.ics attached to a reminder' },
  DOSSIER_REPORT: {
    label: 'Dossier report',
    description: 'monthly pdf report of a dossier, compared with the previous years (report)',
  },
  BUSINESS_PLAN: {
    label: 'Business plan',
    description: 'pdf business plan / plan financier for the banks, in EN, FR or NL (plan)',
  },
};

export const typeLabel = (type?: TemplateType | null) => (type ? TEMPLATE_TYPE_DISPLAY[type].label : '');

export const VERSION_DISPLAY: Record<TemplateVersion, { label: string; color: string }> = {
  V1: { label: 'v1 · FreeMarker', color: 'gray' },
  V2: { label: 'v2 · Jinja', color: 'blue' },
};
