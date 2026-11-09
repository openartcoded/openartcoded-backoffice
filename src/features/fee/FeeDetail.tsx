import { useState } from 'react';
import { Badge, Button, Checkbox, FileInput, Group, Loader, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { ImportedInfo, useUploads } from '@/components/common';
import { AttachmentList, FileActions } from '@/components/files';
import { openModal } from '@/components/modal';
import { openDrawer } from '@/components/drawer';
import { FormSection, StatusBadge } from '@/components/ui';
import { feesApi, labelsApi } from '@/api/billing';
import { useDemoMode, useIsAdmin } from '@/auth/session';
import { fmtCurrency, fmtDateTime, titleCase } from '@/lib/format';
import { toast } from '@/lib/ui';
import type { Fee, Label } from '@/types';

export const tagColor = (labels: Label[] | undefined, tag?: string) => labels?.find((l) => l.name === tag)?.colorHex ?? '#FFFFFF';

export function TagForm({
  tags,
  selected,
  disabled,
  hideCancel,
  onSubmit,
}: {
  tags: Label[];
  selected?: string;
  disabled?: boolean;
  hideCancel?: boolean;
  onSubmit: (tag: Label | null) => void;
}) {
  const isAdmin = useIsAdmin();
  const [value, setValue] = useState<string | null>(selected ?? null);
  return (
    <Stack gap="sm">
      <Select
        label="Tag"
        searchable
        data={tags.map((t) => ({ value: t.name ?? '', label: titleCase(t.name) }))}
        value={value}
        onChange={setValue}
        disabled={disabled}
      />
      {isAdmin && (
        <Group justify="flex-end">
          <Button size="xs" variant="light" disabled={!value || disabled} onClick={() => onSubmit(tags.find((t) => t.name === value) ?? null)}>
            Set tag
          </Button>
          {!hideCancel && (
            <Button variant="outline" color="red" leftSection={<Icon icon="times" />} disabled={disabled} onClick={() => onSubmit(null)}>
              Cancel
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}

export function UpdatePrice({ fee, onSubmit }: { fee: Fee; onSubmit: (priceHVAT: number, vat: number) => void }) {
  const isAdmin = useIsAdmin();
  const [price, setPrice] = useState<number | string>(fee.priceHVAT ?? 0);
  const [vat, setVat] = useState<number | string>(fee.vat ?? 0);
  const disabled = !!fee.archived || !isAdmin;
  return (
    <Stack gap="sm">
      <SimpleGrid cols={2}>
        <NumberInput label="Amount excl. VAT" suffix=" €" decimalScale={2} value={price} onChange={setPrice} disabled={disabled} />
        <NumberInput label="VAT" suffix=" €" decimalScale={2} value={vat} onChange={setVat} disabled={disabled} />
      </SimpleGrid>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Total incl. VAT: <b>{fmtCurrency(Number(price) + Number(vat))}</b>
        </Text>
        {isAdmin && (
          <Button size="xs" variant="light" disabled={disabled || price === '' || vat === ''} onClick={() => onSubmit(Number(price), Number(vat))}>
            Save amount
          </Button>
        )}
      </Group>
    </Stack>
  );
}

/** edit subject/body, mark the payment proof and add attachments */
export function FeeEdit({ fee: initial, onUpdated }: { fee: Fee; onUpdated: (f: Fee) => void }) {
  const isAdmin = useIsAdmin();
  const [fee, setFee] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [isPaymentProof, setIsPaymentProof] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: attachments = [], refetch } = useUploads(fee.attachmentIds);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const updated = await feesApi.addAttachment(fee.id, file, isPaymentProof);
      setFee(updated);
      onUpdated(updated);
      refetch();
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Upload failed. Try with less attachments');
    } finally {
      setFile(null);
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await feesApi.update(fee);
      toast.success('Fee updated');
      onUpdated(updated);
    } catch {
      toast.error('Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="sm">
      <TextInput label="Subject" value={fee.subject} disabled={!isAdmin} onChange={(e) => setFee({ ...fee, subject: e.currentTarget.value })} />
      <Textarea label="Body" minRows={6} autosize value={fee.body} disabled={!isAdmin} onChange={(e) => setFee({ ...fee, body: e.currentTarget.value })} />
      <Text size="sm" fw={500}>
        Attachments
      </Text>
      {!attachments.length && <Text c="dimmed">No attachments.</Text>}
      <Stack gap={0} className="bordered-list" mah="20vh" style={{ overflowY: 'auto' }}>
        {attachments.map((a) => (
          <Group key={a.id} justify="space-between" px="sm" py={4} wrap="nowrap">
            <Text size="sm" className="text-break">
              {a.originalFilename}
            </Text>
            <FileActions
              file={a}
              extra={
                <Button size="compact-xs" variant="subtle" disabled={!isAdmin} onClick={() => setFee({ ...fee, paymentProofUploadId: a.id })}>
                  {fee.paymentProofUploadId === a.id ? 'Payment proof ✓' : 'Mark as proof'}
                </Button>
              }
            />
          </Group>
        ))}
      </Stack>
      <Stack gap="xs" p="sm" bg="gray.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
        <FileInput label="New attachment" value={file} onChange={setFile} />
        <Checkbox label="Mark as payment proof" checked={isPaymentProof} onChange={(e) => setIsPaymentProof(e.currentTarget.checked)} />
        <Group>
          <Button variant="default" leftSection={<Icon icon="upload" />} onClick={upload} loading={busy} disabled={!file}>
            Upload
          </Button>
        </Group>
      </Stack>
      <Group justify="flex-end">
        <Button onClick={save} disabled={busy || !isAdmin}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

export function FeeDetail({ fee: initial, onUpdated }: { fee: Fee; onUpdated?: (f: Fee) => void }) {
  const isAdmin = useIsAdmin();
  const demoMode = useDemoMode();
  const [fee, setFee] = useState(initial);
  const { data: labels } = useQuery({ queryKey: ['labels'], queryFn: labelsApi.findAll });
  const { data: attachments = [], refetch } = useUploads(fee.attachmentIds);

  const updated = (f: Fee) => {
    setFee(f);
    refetch();
    onUpdated?.(f);
  };

  if (!labels) return <Loader />;

  const edit = () => openModal({ title: 'Edit expense', size: 'xl', render: () => <FeeEdit fee={fee} onUpdated={updated} /> });

  return (
    <Stack gap="xl" className={demoMode ? 'blur' : undefined}>
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} size="lg">
            {titleCase(fee.subject)}
          </Text>
          {isAdmin && (
            <Button size="xs" variant="default" leftSection={<Icon icon="edit" />} onClick={edit}>
              Edit
            </Button>
          )}
        </Group>
        <Group gap="xs">
          <TagBadgeInline labels={labels} tag={fee.tag} />
          {fee.archived && <StatusBadge value="PROCESSED" label="Processed" color="green" />}
          {fee.paymentProofUploadId && <StatusBadge value="PROOF" label="Payment proof" color="teal" />}
          <ImportedInfo imported={fee.imported} date={fee.importedDate} />
        </Group>
        <Text size="xs" c="dimmed">
          Received {fmtDateTime(fee.date)}
          {fee.archivedDate ? ` · processed ${fmtDateTime(fee.archivedDate)}` : ''} · id {fee.id}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
        <FormSection title="Amount">
          <UpdatePrice
            fee={fee}
            onSubmit={async (price, vat) => {
              updated(await feesApi.updatePrice(fee.id, price, vat));
              toast.success('Amount updated');
            }}
          />
        </FormSection>
        <FormSection title="Classification">
          <TagForm
            tags={labels}
            selected={fee.tag}
            hideCancel
            disabled={fee.archived || !isAdmin}
            onSubmit={async (tag) => {
              if (!tag?.name) return;
              const [f] = await feesApi.updateTag([fee.id], tag.name);
              if (f) updated(f);
              toast.success('Tag updated');
            }}
          />
        </FormSection>
      </SimpleGrid>

      <FormSection title={`Attachments (${attachments.length})`}>
        <AttachmentList
          files={attachments}
          badge={(a) => fee.paymentProofUploadId === a.id && <StatusBadge value="PROOF" label="Payment proof" color="teal" />}
          canRemove={() => fee.attachmentIds.length > 1 && !fee.archived}
          onRemove={
            isAdmin
              ? async (a) => {
                  updated(await feesApi.removeAttachment(fee.id, a.id));
                  toast.success('Attachment removed');
                }
              : undefined
          }
        />
      </FormSection>

      <FormSection title="Message">
        <Paper withBorder p="sm" bg="gray.0">
          <Text size="sm" className="pre-wrap">
            {fee.body || '—'}
          </Text>
        </Paper>
      </FormSection>
    </Stack>
  );
}

function TagBadgeInline({ labels, tag }: { labels: Label[]; tag?: string }) {
  if (!tag) return <StatusBadge value="NO_TAG" label="No tag" color="gray" />;
  return (
    <Badge variant="dot" color={tagColor(labels, tag)} radius="sm" tt="none" fw={500}>
      {titleCase(tag)}
    </Badge>
  );
}

export function openFeeDetail(fee: Fee, onUpdated?: (f: Fee) => void) {
  openDrawer({
    title: 'Expense',
    size: 'xl',
    closeOnClickOutside: false,
    render: () => <FeeDetail fee={fee} onUpdated={onUpdated} />,
  });
}
