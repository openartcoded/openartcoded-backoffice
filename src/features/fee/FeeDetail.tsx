import { useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, FileInput, Group, Loader, NumberInput, Select, Stack, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { ImportedInfo, useUploads } from '@/components/common';
import { AttachmentList, FileActions } from '@/components/files';
import { openModal } from '@/components/modal';
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
        label="Select a tag"
        data={tags.map((t) => ({ value: t.name ?? '', label: titleCase(t.name) }))}
        value={value}
        onChange={setValue}
        disabled={disabled}
      />
      {isAdmin && (
        <Group justify="flex-end">
          <Button leftSection={<Icon icon="check" />} disabled={!value || disabled} onClick={() => onSubmit(tags.find((t) => t.name === value) ?? null)}>
            Set
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
      <NumberInput label="Price HVAT" decimalScale={2} value={price} onChange={setPrice} disabled={disabled} />
      <NumberInput label="VAT" decimalScale={2} value={vat} onChange={setVat} disabled={disabled} />
      <Text ta="right" c="red">
        Total VAT incl.: {fmtCurrency(Number(price) + Number(vat))}
      </Text>
      {isAdmin && (
        <Group justify="flex-end">
          <Button disabled={disabled || price === '' || vat === ''} onClick={() => onSubmit(Number(price), Number(vat))}>
            Submit
          </Button>
        </Group>
      )}
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
                  {fee.paymentProofUploadId === a.id ? '✔ Proof' : 'Proof'}
                </Button>
              }
            />
          </Group>
        ))}
      </Stack>
      <Stack gap="xs" p="sm" bg="gray.0">
        <FileInput label="New attachment" value={file} onChange={setFile} />
        <Checkbox label="Mark as payment proof" checked={isPaymentProof} onChange={(e) => setIsPaymentProof(e.currentTarget.checked)} />
        <Group>
          <Button variant="outline" color="green" onClick={upload} disabled={!file || busy}>
            {busy ? 'Uploading...' : 'Upload'}
          </Button>
        </Group>
      </Stack>
      <Group justify="flex-end">
        <Button onClick={save} disabled={busy || !isAdmin}>
          Save Changes
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

  return (
    <Stack className={demoMode ? 'blur' : undefined}>
      <Group gap="xs">
        {fee.tag && <Icon icon="circle" color={tagColor(labels, fee.tag)} />}
        <Text fw={600}>{titleCase(fee.subject)}</Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="edit fee"
          onClick={() => openModal({ title: `Edit ${titleCase(fee.subject)}`, size: 'xl', render: () => <FeeEdit fee={fee} onUpdated={updated} /> })}
        >
          <Icon icon="edit" />
        </ActionIcon>
        <ImportedInfo imported={fee.imported} date={fee.importedDate} />
      </Group>
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="body">Body</Tabs.Tab>
          <Tabs.Tab value="attachments">Attachments</Tabs.Tab>
          <Tabs.Tab value="costs">Costs</Tabs.Tab>
          <Tabs.Tab value="tag">Tag</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="metadata" pt="sm">
          <Stack gap="sm">
            <TextInput label="Id" value={fee.id} disabled />
            <TextInput label="Date received" value={fmtDateTime(fee.date)} disabled />
            <TextInput label="Updated Date" value={fmtDateTime(fee.updatedDate)} disabled />
            {fee.archivedDate && <TextInput label="Archived Date" value={fmtDateTime(fee.archivedDate)} disabled />}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="body" pt="sm">
          <Textarea value={fee.body} autosize minRows={4} readOnly />
        </Tabs.Panel>
        <Tabs.Panel value="attachments" pt="sm">
          <AttachmentList
            files={attachments}
            badge={(a) => fee.paymentProofUploadId === a.id && <Badge color="yellow">proof</Badge>}
            canRemove={() => fee.attachmentIds.length > 1 && !fee.archived}
            onRemove={
              isAdmin
                ? async (a) => {
                    updated(await feesApi.removeAttachment(fee.id, a.id));
                    toast.success(`Attachment ${a.id} removed`);
                  }
                : undefined
            }
          />
        </Tabs.Panel>
        <Tabs.Panel value="costs" pt="sm">
          <UpdatePrice
            fee={fee}
            onSubmit={async (price, vat) => {
              updated(await feesApi.updatePrice(fee.id, price, vat));
              toast.success('Price updated');
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="tag" pt="sm">
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
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export function openFeeDetail(fee: Fee, onUpdated?: (f: Fee) => void) {
  openModal({
    title: 'Expense',
    size: 'xl',
    closeOnClickOutside: false,
    render: () => <FeeDetail fee={fee} onUpdated={onUpdated} />,
  });
}
