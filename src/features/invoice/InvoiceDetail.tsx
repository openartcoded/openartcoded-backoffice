import { useNavigate } from 'react-router';
import { Alert, Button, Checkbox, Group, Loader, Menu, NumberInput, Paper, Select, SimpleGrid, Stack, Tabs, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ImportedInfo } from '@/components/common';
import { FilePicker, FileViewer, openFileViewer } from '@/components/files';
import { openMailForm } from '@/components/forms';
import { openModal } from '@/components/modal';
import { clientsApi, invoicesApi } from '@/api/billing';
import { filesApi } from '@/api/files';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { fmtCurrency, fromInput, toInputDate } from '@/lib/format';
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

  return (
    <form onSubmit={submit} className={demoMode ? 'blur' : undefined}>
      <Tabs defaultValue="info" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="info">{label} Info</Tabs.Tab>
          <Tabs.Tab value="billTo">Bill To</Tabs.Tab>
          <Tabs.Tab value="table">Invoice Table</Tabs.Tab>
          {ubl && <Tabs.Tab value="xml">Peppol XML</Tabs.Tab>}
          {pdf && <Tabs.Tab value="pdf">PDF</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="info" pt="sm">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label={`${label} number`} value={invoice.newInvoiceNumber ?? ''} disabled />
              <TextInput label={`${label} reference`} value={invoice.invoiceNumber ?? ''} disabled />
              {invoice.creditNoteInvoiceReference && <TextInput label="Invoice reference" value={invoice.creditNoteInvoiceReference} disabled />}
              <TextInput type="date" label={`Date of ${label}`} disabled={readOnly} {...form.getInputProps('dateOfInvoice')} />
              <NumberInput label="Tax Rate %" disabled={readOnly} {...form.getInputProps('taxRate')} />
              {!!invoice.subTotal && <TextInput label="Subtotal" value={fmtCurrency(invoice.subTotal)} disabled />}
              {!!invoice.taxes && <TextInput label="VAT" value={fmtCurrency(invoice.taxes)} disabled c="red" />}
              {!!invoice.total && <TextInput label="Total" value={fmtCurrency(invoice.total)} disabled c="green" />}
              {invoice.structuredReference && <TextInput label="Bank Reference" value={invoice.structuredReference} disabled />}
              {!!templates.length && (
                <Select
                  label="Template"
                  placeholder="Please select"
                  data={templates.map((t) => ({ value: t.id ?? '', label: t.name ?? '' }))}
                  disabled={readOnly}
                  {...form.getInputProps('freemarkerTemplateId')}
                />
              )}
            </SimpleGrid>
            <Textarea label="Special note" placeholder="Put a note here" autosize disabled={readOnly} {...form.getInputProps('specialNote')} />
            {invoice.peppolStatus && invoice.peppolStatus !== 'OLD' && (
              <Group align="flex-end">
                <TextInput style={{ flex: 1 }} label="Peppol Status" value={invoice.peppolStatus} disabled />
                <Button variant="outline" onClick={validatePeppol} loading={validating}>
                  Validate
                </Button>
              </Group>
            )}
            <Group>
              <Checkbox label="Manual upload" disabled={readOnly} {...form.getInputProps('uploadedManually', { type: 'checkbox' })} />
              <Checkbox label="Skip Peppol" disabled={readOnly} {...form.getInputProps('skipPeppol', { type: 'checkbox' })} />
              <Checkbox label="Locked" checked={!!invoice.locked} disabled readOnly />
              <Checkbox label="Logical delete" checked={!!invoice.logicalDelete} disabled readOnly />
            </Group>
            {v.uploadedManually && !invoice.locked && !invoice.logicalDelete && (
              <FilePicker onFiles={(f) => isAdmin && setFile(f[0])} accept={['application/pdf']} files={file ? [file] : []} label="Drop invoice here" />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="billTo" pt="sm">
          <Stack gap="sm">
            {!invoice.locked && (
              <Select
                label="Saved Clients"
                placeholder="--Select--"
                data={clients.map((c) => ({ value: c.id ?? '', label: c.name ?? '' }))}
                value={v.selectedClient}
                onChange={selectClient}
                disabled={readOnly}
                clearable
              />
            )}
            <TextInput label="Client Name" disabled={readOnly} {...form.getInputProps('billToClientName')} />
            <TextInput label="VatNumber" disabled={readOnly} {...form.getInputProps('billToVatNumber')} />
            <TextInput label="Address" disabled={readOnly} {...form.getInputProps('billToAddress')} />
            <TextInput label="City" disabled={readOnly} {...form.getInputProps('billToCity')} />
            <TextInput label="Email" disabled={readOnly} {...form.getInputProps('billToEmailAddress')} />
            <NumberInput label="Max Days to pay" disabled={!!invoice.locked} {...form.getInputProps('maxDaysToPay')} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="table" pt="sm">
          <Stack gap="sm">
            {v.rows.map((row, i) => (
              <Paper key={i} bg="gray.0" p="sm">
                {!readOnly && v.rows.length > 1 && (
                  <Group justify="flex-end">
                    <Button size="xs" variant="outline" color="red" leftSection={<Icon icon="trash" />} onClick={() => form.removeListItem('rows', i)}>
                      Remove
                    </Button>
                  </Group>
                )}
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <TextInput label="Project Name" disabled={readOnly} {...form.getInputProps(`rows.${i}.projectName`)} />
                  <TextInput label="Nature" disabled={readOnly} {...form.getInputProps(`rows.${i}.nature`)} />
                  <TextInput type="month" label="Period" disabled={readOnly} {...form.getInputProps(`rows.${i}.period`)} />
                  <NumberInput label="Amount" disabled={readOnly} {...form.getInputProps(`rows.${i}.amount`)} />
                  <Select label="Amount Type" data={RATE_TYPES} allowDeselect={false} disabled={readOnly} {...form.getInputProps(`rows.${i}.amountType`)} />
                  {!!rates.length && (
                    <Select
                      label="Client rate"
                      data={[{ value: '', label: 'Custom' }, ...rates.map((r, k) => ({ value: r.id ?? '', label: rateOptionLabel(r, k) }))]}
                      value={row.rateId ?? ''}
                      onChange={(id) => selectRowRate(i, id || null)}
                      disabled={readOnly}
                      allowDeselect={false}
                    />
                  )}
                  <NumberInput
                    label="Rate"
                    decimalScale={2}
                    disabled={readOnly}
                    value={row.rate}
                    error={form.errors[`rows.${i}.rate`]}
                    onChange={(rate) => setRow(i, { rate })}
                  />
                  <Select
                    label="Rate Type"
                    data={RATE_TYPES}
                    allowDeselect={false}
                    disabled={readOnly}
                    value={row.rateType}
                    onChange={(rateType) => rateType && setRow(i, { rateType: rateType as typeof row.rateType })}
                  />
                </SimpleGrid>
              </Paper>
            ))}
            {!readOnly && (
              <Group>
                <Button size="xs" variant="outline" leftSection={<Icon icon="plus" />} onClick={() => form.insertListItem('rows', nextRow(v.rows))}>
                  Add row
                </Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
        {ubl && (
          <Tabs.Panel value="xml" pt="sm">
            <FileViewer file={ubl} />
          </Tabs.Panel>
        )}
        {pdf && (
          <Tabs.Panel value="pdf" pt="sm">
            <FileViewer file={pdf} showRotate={false} />
          </Tabs.Panel>
        )}
      </Tabs>

      {!!invalid.length && (
        <Alert color="yellow" mt="sm">
          Invalid field: {JSON.stringify(invalid)}
        </Alert>
      )}
      <Group justify="flex-end" mt="md">
        <Menu position="top-end">
          <Menu.Target>
            <Button variant="outline" disabled={!invoice.invoiceUploadId}>
              Action
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon icon="download" />} onClick={() => invoice.invoiceUploadId && filesApi.download(invoice.invoiceUploadId)}>
              Download
            </Menu.Item>
            {isAdmin && (
              <Menu.Item leftSection={<Icon icon="clock" />} disabled={!invoice.timesheetId} onClick={() => navigate(`/timesheets/timesheet/${invoice.timesheetId}`)}>
                Timesheet
              </Menu.Item>
            )}
            {isAdmin && (
              <Menu.Item leftSection={<Icon icon="mail-bulk" />} onClick={sendMail}>
                Send
              </Menu.Item>
            )}
            <Menu.Item leftSection={<Icon icon="file-pdf" />} onClick={() => pdf && openFileViewer(pdf)}>
              View as PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {isAdmin && onSave && (
          <Button type="submit" disabled={!form.isValid() || !!invoice.locked || !!invoice.archived}>
            Submit
          </Button>
        )}
      </Group>
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
  openModal({
    title: <InvoiceTitle invoice={invoice} />,
    size: 'xl',
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
