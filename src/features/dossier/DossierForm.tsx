import { useState } from 'react';
import { ActionIcon, Anchor, Button, Group, Loader, NumberInput, Paper, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { NoContent } from '@/components/common';
import { documentsApi, dossiersApi, feesApi, invoicesApi, labelsApi } from '@/api/billing';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { bytesToHuman, fmtCurrency, fmtDateTime, fromInput, toInputDate } from '@/lib/format';
import { openFeeDetail, tagColor } from '@/features/fee/FeeDetail';
import { openInvoiceDetail } from '@/features/invoice/InvoiceDetail';
import { openDocumentEditor } from '@/features/documents/DocumentEditor';
import type { AdministrativeDocument, Dossier, Fee, Invoice } from '@/types';

export interface DossierTotals {
  feeTotalVat: number;
  feeTotalExclVat: number;
  vatTotal: number;
  invoiceTotalExclVat: number;
}

export function computeTotals(fees: Fee[], invoices: Invoice[]): DossierTotals {
  return {
    feeTotalVat: fees.reduce((s, f) => s + (f.vat ?? 0), 0),
    feeTotalExclVat: fees.reduce((s, f) => s + (f.priceHVAT ?? 0), 0),
    vatTotal: invoices.reduce((s, i) => s + (i.taxes ?? 0), 0),
    invoiceTotalExclVat: invoices.reduce((s, i) => s + (i.subTotal ?? 0), 0),
  };
}

export function filterExpenses(fees: Fee[], search: string): Fee[] {
  if (search.length <= 2) return fees;
  const s = search.toLowerCase();
  return fees.filter((f) => f.subject?.toLowerCase().includes(s) || f.tag?.toLowerCase().includes(s));
}

interface Props {
  dossier: Dossier;
  recallForModification?: boolean;
  onSubmit: (d: Dossier) => void;
  onRemoveFee: (f: Fee) => void;
  onRemoveInvoice: (i: Invoice) => void;
  onRemoveDocument: (d: AdministrativeDocument) => void;
}

export function DossierForm({ dossier, recallForModification = false, onSubmit, onRemoveFee, onRemoveInvoice, onRemoveDocument }: Props) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const [search, setSearch] = useState('');
  const feeIds = dossier.feeIds ?? [];
  const invoiceIds = dossier.invoiceIds ?? [];
  const documentIds = dossier.documentIds ?? [];
  const { data: labels = [] } = useQuery({ queryKey: ['labels'], queryFn: labelsApi.findAll });
  const { data: size } = useQuery({ queryKey: ['dossier-size', dossier.id], queryFn: () => dossiersApi.size(dossier.id!), enabled: !!dossier.id });
  const fees = useQuery({
    queryKey: ['dossier-fees', feeIds.join()],
    queryFn: async () => (await feesApi.findByIds(feeIds)).sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
  });
  const invoices = useQuery({
    queryKey: ['dossier-invoices', invoiceIds.join()],
    queryFn: async () =>
      (await invoicesApi.findByIds(invoiceIds)).sort((a, b) => new Date(b.dateOfInvoice ?? 0).getTime() - new Date(a.dateOfInvoice ?? 0).getTime()),
  });
  const documents = useQuery({ queryKey: ['dossier-documents', documentIds.join()], queryFn: () => documentsApi.findByIds(documentIds) });

  const editable = !dossier.closed || recallForModification;
  const disabled = !isAdmin || !editable;
  const form = useForm({
    initialValues: {
      name: dossier.name ?? '',
      description: dossier.description ?? '',
      tvaDue: dossier.tvaDue ?? ('' as number | string),
      comment: dossier.comment ?? '',
      advancePayments: (dossier.advancePayments ?? []).map((p) => ({ datePaid: toInputDate(p.datePaid ?? new Date()), advance: p.advance ?? ('' as number | string) })),
    },
    validate: {
      name: (v) => (v.length < 5 || v.length > 20 ? 'between 5 and 20 characters' : null),
      description: (v) => (v.length > 2048 ? 'max 2048 characters' : null),
      comment: (v) => (v.length > 4096 ? 'max 4096 characters' : null),
      advancePayments: {
        datePaid: (v) => (v ? null : 'required'),
        advance: (v) => (String(v) === '' || Number(v) < 1 ? 'min 1' : null),
      },
    },
  });

  const submit = form.onSubmit((v) => {
    if (!isAdmin) return;
    onSubmit({
      id: dossier.id,
      closed: dossier.closed,
      recalledForModification: recallForModification,
      tvaDue: v.tvaDue === '' ? undefined : Number(v.tvaDue),
      advancePayments: v.advancePayments.map((p) => ({ datePaid: fromInput(p.datePaid), advance: Number(p.advance) })),
      name: v.name,
      description: v.description,
      comment: v.comment,
    });
  });

  const totals = computeTotals(fees.data ?? [], invoices.data ?? []);
  const totalAttachments = (fees.data ?? []).reduce((s, f) => s + (f.attachmentIds?.length ?? 0), 0) + invoiceIds.length;
  const filtered = filterExpenses(fees.data ?? [], search);

  const removeButton = (onClick: () => void) =>
    !dossier.closed &&
    isAdmin && (
      <ActionIcon variant="subtle" color="red" onClick={onClick} aria-label="remove">
        <Icon icon="times" />
      </ActionIcon>
    );

  return (
    <form onSubmit={submit} className={demoMode ? 'blur' : undefined}>
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="payments">Advance Payments</Tabs.Tab>
          <Tabs.Tab value="expenses">Expenses</Tabs.Tab>
          <Tabs.Tab value="invoices">Invoices</Tabs.Tab>
          <Tabs.Tab value="documents">Documents</Tabs.Tab>
          <Tabs.Tab value="comment">Comment</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata" pt="sm">
          <Stack gap="sm">
            <TextInput label="Id" value={dossier.id ?? ''} disabled />
            <TextInput label="Name" placeholder="Name (Minimum 5 characters)" data-autofocus disabled={!isAdmin || !!dossier.closed} {...form.getInputProps('name')} />
            <Textarea label="Description" autosize disabled={!isAdmin || !!dossier.closed} {...form.getInputProps('description')} />
            <NumberInput label="VAT Due" placeholder="VAT Due (in €)" decimalScale={2} disabled={disabled} {...form.getInputProps('tvaDue')} />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {size !== undefined && <TextInput label="Size" value={bytesToHuman(size)} disabled />}
              <TextInput label="Total Attachments" value={String(totalAttachments)} disabled />
              <TextInput label="Creation Date" value={fmtDateTime(dossier.creationDate)} disabled />
              <TextInput label="Updated Date" value={fmtDateTime(dossier.updatedDate)} disabled />
              {dossier.closedDate && <TextInput label="Closed Date" value={fmtDateTime(dossier.closedDate)} disabled />}
              {dossier.recalledForModificationDate && <TextInput label="Recalled Date" value={fmtDateTime(dossier.recalledForModificationDate)} disabled />}
            </SimpleGrid>
            <Group justify="flex-end">
              <Button
                variant="outline"
                disabled={!dossier.id || (!invoiceIds.length && !feeIds.length)}
                onClick={() => dossier.id && dossiersApi.generateSummary(dossier.id)}
              >
                Download Summary
              </Button>
              {isAdmin && (
                <Button type="submit" disabled={!form.isValid() || (!!dossier.closed && !recallForModification)}>
                  Submit
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="sm">
          <Stack gap="sm">
            {!!totals.vatTotal && !!totals.feeTotalVat && (
              <Text>
                Estimated VAT: ({fmtCurrency(totals.vatTotal)} - {fmtCurrency(totals.feeTotalVat)}) = {fmtCurrency(totals.vatTotal - totals.feeTotalVat)}
              </Text>
            )}
            {isAdmin && editable && (
              <Group justify="flex-end">
                <Button variant="outline" leftSection={<Icon icon="plus" />} onClick={() => form.insertListItem('advancePayments', { datePaid: toInputDate(new Date()), advance: '' })}>
                  Add
                </Button>
              </Group>
            )}
            {!form.values.advancePayments.length && <NoContent />}
            {form.values.advancePayments.map((_, i) => (
              <Paper key={i} bg="gray.0" p="sm">
                <Group align="flex-end">
                  <TextInput type="date" label="Date Paid" disabled={disabled} {...form.getInputProps(`advancePayments.${i}.datePaid`)} />
                  <NumberInput label="Advance" placeholder="Advance (in €)" decimalScale={2} disabled={disabled} {...form.getInputProps(`advancePayments.${i}.advance`)} />
                  {isAdmin && editable && (
                    <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem('advancePayments', i)} aria-label="remove payment">
                      <Icon icon="trash" />
                    </ActionIcon>
                  )}
                </Group>
              </Paper>
            ))}
            {isAdmin && (
              <Group justify="flex-end">
                <Button type="submit" disabled={!form.isValid() || (!!dossier.closed && !recallForModification)}>
                  Submit
                </Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="sm">
          {fees.isLoading ? (
            <Loader />
          ) : (
            <Stack gap="sm">
              {!!totals.feeTotalExclVat && (
                <Text>
                  Total: {fmtCurrency(totals.feeTotalExclVat)}, VAT: {fmtCurrency(totals.feeTotalVat)}
                </Text>
              )}
              {!!fees.data?.length && <TextInput placeholder="Search" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />}
              {!filtered.length && <NoContent />}
              <Stack gap={0} className="bordered-list">
                {filtered.map((f) => (
                  <Group key={f.id} justify="space-between" px="sm" py={4} wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Icon icon="circle" color={tagColor(labels, f.tag)} />
                      <Anchor onClick={() => openFeeDetail(f)}>
                        {f.subject} <b>[{f.attachmentIds?.length}]</b>
                      </Anchor>
                    </Group>
                    {removeButton(() => {
                      setSearch('');
                      onRemoveFee(f);
                    })}
                  </Group>
                ))}
              </Stack>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="invoices" pt="sm">
          <Stack gap="sm">
            {!!totals.invoiceTotalExclVat && <Text>Total Excl. VAT: {fmtCurrency(totals.invoiceTotalExclVat)}</Text>}
            {!invoices.data?.length && <NoContent />}
            <Stack gap={0} className="bordered-list">
              {invoices.data?.map((i) => (
                <Group key={i.id} justify="space-between" px="sm" py={4} wrap="nowrap">
                  <Group gap="xs">
                    <Anchor onClick={() => openInvoiceDetail(i)}>{i.newInvoiceNumber || i.invoiceNumber}</Anchor>
                    <Text size="sm" c="dimmed">
                      ({i.billTo?.clientName} - {fmtCurrency(i.subTotal)})
                    </Text>
                  </Group>
                  {removeButton(() => onRemoveInvoice(i))}
                </Group>
              ))}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="sm">
          {!documents.data?.length && <NoContent />}
          <Stack gap={0} className="bordered-list">
            {documents.data?.map((d) => (
              <Group key={d.id} justify="space-between" px="sm" py={4}>
                <Anchor onClick={() => openDocumentEditor(d, { readOnly: true })}>{d.title}</Anchor>
                {removeButton(() => onRemoveDocument(d))}
              </Group>
            ))}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="comment" pt="sm">
          <Stack gap="sm">
            <Textarea label="Comments" placeholder="Comment" autosize minRows={10} disabled={!isAdmin || !!dossier.closed} {...form.getInputProps('comment')} />
            {isAdmin && (
              <Group justify="flex-end">
                <Button type="submit" disabled={!form.isValid() || (!!dossier.closed && !recallForModification)}>
                  Submit
                </Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
