import { useNavigate } from 'react-router';
import { ActionIcon, Alert, Button, Group, Loader, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ImportedInfo } from '@/components/common';
import { downloadUpload, FilePicker, FileViewer } from '@/components/files';
import { FormSection, humanize, Stat, StatusBadge, StickyFooter } from '@/components/ui';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { openDrawer } from '@/components/drawer';
import { clientsApi, invoicesApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { fmtCurrency, fmtDate, fromInput, toInputDate } from '@/lib/format';
import { RATE_TYPES, type BillableClient, type FreemarkerTemplate, type Invoice } from '@/types';
import {
  applyRate,
  canMakeCreditNote,
  clientRates,
  fillFromClient,
  fromRowForm,
  initialRows,
  invoiceMailContext,
  invoiceTitle,
  matchRate,
  nextRow,
  rateOptionLabel,
} from './logic';

export interface InvoiceFormResult {
  invoice: Invoice;
  manualUploadFile?: File;
}

interface Props {
  invoice: Invoice;
  clients: BillableClient[];
  templates: FreemarkerTemplate[];
  onSave?: (result: InvoiceFormResult) => void;
}

const RATE_TYPE_OPTIONS = RATE_TYPES.map((t) => ({ value: t, label: t === 'DAYS' ? 'Days' : 'Hours' }));

export function PeppolValidation({ valid, results }: { valid: boolean; results: string }) {
  return <Alert color={valid ? 'green' : 'red'}>{valid ? 'Valid' : <span className="pre-wrap">{results}</span>}</Alert>;
}

export function InvoiceDetail({ invoice, clients, templates, onSave }: Props) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const navigate = useNavigate();
  const readOnly = !isAdmin || !!invoice.locked;
  const savedClient = clients.find((c) => c.name === invoice.billTo?.clientName);
  const [rates, setRates] = useState(() => clientRates(savedClient));
  const [file, setFile] = useState<File>();
  const [validating, setValidating] = useState(false);
  const [view, setView] = useState('details');
  const { data: pdf } = useQuery({
    queryKey: ['upload', invoice.invoiceUploadId],
    queryFn: () => filesApi.findById(invoice.invoiceUploadId!),
    enabled: !!invoice.invoiceUploadId,
  });
  const { data: ubl } = useQuery({
    queryKey: ['upload', invoice.invoiceUBLId],
    queryFn: () => filesApi.findById(invoice.invoiceUBLId!),
    enabled: !!invoice.invoiceUBLId,
  });

  const form = useForm({
    initialValues: {
      dateOfInvoice: toInputDate(invoice.dateOfInvoice ?? new Date()),
      taxRate: invoice.taxRate ?? ('' as number | string),
      freemarkerTemplateId: templates.some((t) => t.id === invoice.freemarkerTemplateId) ? (invoice.freemarkerTemplateId ?? null) : null,
      specialNote: invoice.specialNote ?? '',
      uploadedManually: !!invoice.uploadedManually,
      skipPeppol: !!invoice.skipPeppol,
      selectedClient: savedClient?.id ?? null,
      billToClientName: invoice.billTo?.clientName ?? '',
      billToVatNumber: invoice.billTo?.vatNumber ?? '',
      billToAddress: invoice.billTo?.address ?? '',
      billToCity: invoice.billTo?.city ?? '',
      billToEmailAddress: invoice.billTo?.emailAddress ?? '',
      maxDaysToPay: invoice.maxDaysToPay ?? ('' as number | string),
      rows: initialRows(invoice, clientRates(savedClient)),
    },
    validate: {
      dateOfInvoice: (v) => (v ? null : 'required'),
      taxRate: (v) => (String(v) === '' ? 'required' : null),
      freemarkerTemplateId: (v) => (v ? null : 'required'),
      billToClientName: (v) => (v ? null : 'required'),
      billToVatNumber: (v) => (v ? null : 'required'),
      billToAddress: (v) => (v ? null : 'required'),
      billToCity: (v) => (v ? null : 'required'),
      billToEmailAddress: (v) => (v ? null : 'required'),
      maxDaysToPay: (v) => (String(v) !== '' && Number(v) < 1 ? 'min 1' : null),
      rows: {
        projectName: (v) => (v ? null : 'required'),
        nature: (v) => (v ? null : 'required'),
        period: (v) => (v ? null : 'required'),
        rate: (v) => (String(v) === '' ? 'required' : null),
        amount: (v) => (String(v) === '' || Number(v) < 1 ? 'min 1' : null),
      },
    },
  });
  const v = form.values;
  const label = invoice.creditNote ? 'Credit Note' : 'Invoice';
  const invalid = Object.keys(form.errors);

  const selectClient = (id: string | null) => {
    form.setFieldValue('selectedClient', id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const newRates = clientRates(client);
    setRates(newRates);
    form.setValues(fillFromClient(v, client, newRates));
  };

  const setRow = (i: number, patch: Partial<(typeof v.rows)[number]>) => {
    const row = { ...v.rows[i], ...patch };
    // typing a rate by hand selects the matching client rate, or "custom"
    if ('rate' in patch || 'rateType' in patch) row.rateId = matchRate(rates, row)?.id ?? null;
    form.setFieldValue(`rows.${i}`, row);
  };

  const selectRowRate = (i: number, id: string | null) => {
    const rate = rates.find((r) => r.id === id);
    if (rate) form.setFieldValue(`rows.${i}`, applyRate(v.rows[i], rate));
    else form.setFieldValue(`rows.${i}.rateId`, null);
  };

  const submit = form.onSubmit((values) => {
    if (!isAdmin) return;
    onSave?.({
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        id: invoice.id,
        freemarkerTemplateId: values.freemarkerTemplateId,
        specialNote: values.specialNote,
        maxDaysToPay: values.maxDaysToPay === '' ? undefined : Number(values.maxDaysToPay),
        dateOfInvoice: fromInput(values.dateOfInvoice) ?? undefined,
        taxRate: Number(values.taxRate),
        uploadedManually: values.uploadedManually,
        skipPeppol: values.skipPeppol,
        billTo: {
          vatNumber: values.billToVatNumber,
          clientName: values.billToClientName,
          city: values.billToCity,
          address: values.billToAddress,
          emailAddress: values.billToEmailAddress,
        },
        invoiceTable: values.rows.map(fromRowForm),
      },
      manualUploadFile: file,
    });
  });

  const validatePeppol = async () => {
    if (!invoice.id) return;
    setValidating(true);
    try {
      const res = await invoicesApi.validatePeppol(invoice.id);
      openModal({ title: 'Peppol Validation Result', render: () => <PeppolValidation {...res} /> });
    } finally {
      setValidating(false);
    }
  };

  const sendMail = () =>
    pdf &&
    openMailForm({
      attachments: [pdf],
      context: invoiceMailContext(invoice),
      defaultSubject: `Invoice ${invoice.newInvoiceNumber || invoice.invoiceNumber}`,
      to: [invoice.billTo?.emailAddress],
    });

  const editable = isAdmin && !!onSave && !invoice.locked && !invoice.archived;
  const views = [
    { value: 'details', label: 'Details' },
    ...(pdf ? [{ value: 'pdf', label: 'PDF' }] : []),
    ...(ubl ? [{ value: 'xml', label: 'Peppol XML' }] : []),
  ];

  return (
    <form onSubmit={submit} className={demoMode ? 'blur' : undefined}>
      <Group justify="space-between" mb="md" gap="xs">
        <Group gap={6}>
          {invoice.creditNote && <StatusBadge value="CREDIT_NOTE" label="Credit note" color="orange" />}
          {invoice.locked && <StatusBadge value="LOCKED" label="Locked" color="gray" />}
          {invoice.archived && <StatusBadge value="PROCESSED" label="Processed" color="green" />}
          {invoice.logicalDelete && <StatusBadge value="DELETED" label="Deleted" color="red" />}
          {invoice.peppolStatus && invoice.peppolStatus !== 'OLD' && <StatusBadge value={invoice.peppolStatus} label={`Peppol: ${humanize(invoice.peppolStatus)}`} />}
        </Group>
        {views.length > 1 && <SegmentedControl size="xs" data={views} value={view} onChange={setView} />}
      </Group>

      {view === 'pdf' && pdf && <FileViewer file={pdf} showRotate={false} />}
      {view === 'xml' && ubl && <FileViewer file={ubl} />}

      <Stack gap="xl" display={view === 'details' ? undefined : 'none'}>
        {!!invoice.total && (
          <Paper withBorder p="md" bg="gray.0">
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Stat label="Subtotal" value={fmtCurrency(invoice.subTotal)} />
              <Stat label={`VAT ${invoice.taxRate ?? ''}%`} value={fmtCurrency(invoice.taxes)} />
              <Stat label="Total" value={fmtCurrency(invoice.total)} strong />
              <Stat label="Due date" value={fmtDate(invoice.dueDate)} />
            </SimpleGrid>
          </Paper>
        )}

        <FormSection title="Details">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label={`${label} number`} value={invoice.newInvoiceNumber ?? ''} readOnly variant="filled" />
            <TextInput label="Reference" value={invoice.invoiceNumber ?? ''} readOnly variant="filled" />
            {invoice.creditNoteInvoiceReference && <TextInput label="Credited invoice" value={invoice.creditNoteInvoiceReference} readOnly variant="filled" />}
            {invoice.structuredReference && <TextInput label="Bank reference" value={invoice.structuredReference} readOnly variant="filled" />}
            <TextInput type="date" label="Date" disabled={readOnly} {...form.getInputProps('dateOfInvoice')} />
            <NumberInput label="VAT rate" suffix="%" disabled={readOnly} {...form.getInputProps('taxRate')} />
            {!!templates.length && (
              <Select
                label="Template"
                placeholder="Select a template"
                data={templates.map((t) => ({ value: t.id ?? '', label: t.name ?? '' }))}
                disabled={readOnly}
                {...form.getInputProps('freemarkerTemplateId')}
              />
            )}
          </SimpleGrid>
          <Textarea label="Note" placeholder="Printed on the invoice" autosize minRows={2} disabled={readOnly} {...form.getInputProps('specialNote')} />
          <Group gap="lg">
            <Switch label="Upload the PDF manually" disabled={readOnly} {...form.getInputProps('uploadedManually', { type: 'checkbox' })} />
            <Switch label="Don't send to Peppol" disabled={readOnly} {...form.getInputProps('skipPeppol', { type: 'checkbox' })} />
          </Group>
          {v.uploadedManually && !invoice.locked && !invoice.logicalDelete && (
            <FilePicker onFiles={(f) => isAdmin && setFile(f[0])} accept={['application/pdf']} files={file ? [file] : []} label="Drop the invoice PDF here" />
          )}
        </FormSection>

        <FormSection title="Bill to">
          {!invoice.locked && !readOnly && (
            <Select
              label="Fill from a client"
              placeholder="Select a client"
              data={clients.map((c) => ({ value: c.id ?? '', label: c.name ?? '' }))}
              value={v.selectedClient}
              onChange={selectClient}
              clearable
              searchable
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Name" disabled={readOnly} {...form.getInputProps('billToClientName')} />
            <TextInput label="VAT number" disabled={readOnly} {...form.getInputProps('billToVatNumber')} />
            <TextInput label="Address" disabled={readOnly} {...form.getInputProps('billToAddress')} />
            <TextInput label="City" disabled={readOnly} {...form.getInputProps('billToCity')} />
            <TextInput label="Email" disabled={readOnly} {...form.getInputProps('billToEmailAddress')} />
            <NumberInput label="Days to pay" disabled={!!invoice.locked} {...form.getInputProps('maxDaysToPay')} />
          </SimpleGrid>
        </FormSection>

        <FormSection
          title="Lines"
          actions={
            !readOnly && (
              <Button size="xs" variant="default" leftSection={<Icon icon="plus" />} onClick={() => form.insertListItem('rows', nextRow(v.rows))}>
                Add line
              </Button>
            )
          }
        >
          {v.rows.map((row, i) => (
            <Paper key={i} withBorder p="sm">
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Line {i + 1}
                </Text>
                {!readOnly && v.rows.length > 1 && (
                  <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem('rows', i)} aria-label="remove line">
                    <Icon icon="trash" />
                  </ActionIcon>
                )}
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <TextInput label="Project" disabled={readOnly} {...form.getInputProps(`rows.${i}.projectName`)} />
                <TextInput label="Nature" disabled={readOnly} {...form.getInputProps(`rows.${i}.nature`)} />
                <TextInput type="month" label="Period" disabled={readOnly} {...form.getInputProps(`rows.${i}.period`)} />
                {!!rates.length ? (
                  <Select
                    label="Client rate"
                    data={[{ value: '', label: 'Custom' }, ...rates.map((r, k) => ({ value: r.id ?? '', label: rateOptionLabel(r, k) }))]}
                    value={row.rateId ?? ''}
                    onChange={(id) => selectRowRate(i, id || null)}
                    disabled={readOnly}
                    allowDeselect={false}
                  />
                ) : (
                  <div />
                )}
                <NumberInput label="Quantity" disabled={readOnly} {...form.getInputProps(`rows.${i}.amount`)} />
                <Select label="Unit" data={RATE_TYPE_OPTIONS} allowDeselect={false} disabled={readOnly} {...form.getInputProps(`rows.${i}.amountType`)} />
                <NumberInput
                  label="Rate"
                  decimalScale={2}
                  suffix=" €"
                  disabled={readOnly}
                  value={row.rate}
                  error={form.errors[`rows.${i}.rate`]}
                  onChange={(rate) => setRow(i, { rate })}
                />
                <Select
                  label="Per"
                  data={RATE_TYPE_OPTIONS}
                  allowDeselect={false}
                  disabled={readOnly}
                  value={row.rateType}
                  onChange={(rateType) => rateType && setRow(i, { rateType: rateType as typeof row.rateType })}
                />
              </SimpleGrid>
            </Paper>
          ))}
        </FormSection>

        {!!invalid.length && (
          <Alert color="yellow" title="Some fields need your attention">
            {invalid.map((k) => k.replace(/^rows\.(\d+)\./, (_, n) => `line ${Number(n) + 1} `)).join(', ')}
          </Alert>
        )}
      </Stack>

      <StickyFooter>
        <Group gap="xs">
          <Button variant="default" leftSection={<Icon icon="download" />} disabled={!invoice.invoiceUploadId} onClick={() => invoice.invoiceUploadId && downloadUpload(invoice.invoiceUploadId)}>
            Download
          </Button>
          {isAdmin && (
            <Button variant="default" leftSection={<Icon icon="envelope" />} disabled={!pdf} onClick={sendMail}>
              Send
            </Button>
          )}
          {isAdmin && invoice.timesheetId && (
            <Button variant="default" leftSection={<Icon icon="clock" />} onClick={() => navigate(`/timesheets/timesheet/${invoice.timesheetId}`)}>
              Timesheet
            </Button>
          )}
          {invoice.peppolStatus && invoice.peppolStatus !== 'OLD' && (
            <Button variant="default" leftSection={<Icon icon="check" />} onClick={validatePeppol} loading={validating}>
              Validate Peppol
            </Button>
          )}
        </Group>
        {editable && (
          <Button type="submit" disabled={!form.isValid()}>
            Save
          </Button>
        )}
      </StickyFooter>
    </form>
  );
}

export function InvoiceTitle({ invoice }: { invoice: Invoice }) {
  return (
    <Group gap={4}>
      {invoiceTitle(invoice)}
      <ImportedInfo imported={invoice.imported} date={invoice.importedDate} />
    </Group>
  );
}

function InvoiceDetailLoader({ invoice, onSave, ongoingOnly }: { invoice: Invoice; onSave?: Props['onSave']; ongoingOnly?: boolean }) {
  const { data: clients } = useQuery({
    queryKey: ['clients', ongoingOnly ? 'ongoing' : 'all'],
    queryFn: () => (ongoingOnly ? clientsApi.findByContractStatus('ONGOING') : clientsApi.findAll()),
  });
  const { data: templates } = useQuery({ queryKey: ['invoice-templates'], queryFn: invoicesApi.listTemplates, enabled: !!onSave });
  if (!clients || (onSave && !templates)) return <Loader />;
  return (
    <InvoiceDetail
      invoice={invoice}
      clients={ongoingOnly ? clients.filter((c) => !c.student) : clients}
      templates={templates ?? []}
      onSave={onSave}
    />
  );
}

/** opens the invoice. Without onSave, the invoice is displayed read only (no template selection) */
export function openInvoiceDetail(invoice: Invoice, onSave?: (result: InvoiceFormResult) => void) {
  openDrawer({
    title: <InvoiceTitle invoice={invoice} />,
    size: 1000,
    closeOnClickOutside: false,
    render: (close) => (
      <InvoiceDetailLoader
        invoice={invoice}
        ongoingOnly={!!onSave}
        onSave={
          onSave &&
          ((r) => {
            close();
            onSave(r);
          })
        }
      />
    ),
  });
}

export async function openInvoiceById(id: string) {
  openInvoiceDetail(await invoicesApi.findById(id));
}

export { canMakeCreditNote };
